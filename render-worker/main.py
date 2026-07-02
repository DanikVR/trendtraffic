"""
TrendTraffic — Python-обёртка OpenMontage (рендер-воркер, FastAPI).

Web-VPS оркестратор шлёт сюда по ОДНОМУ шагу плана (по Tailscale). Воркер
скачивает вход, вызывает инструмент(ы) OpenMontage с ТОЧНЫМИ inputs (по реальным
input_schema, см. tools/*), читает выход из ToolResult.artifacts и отдаёт файл.

Безопасность: слушать ТОЛЬКО Tailscale-адрес (WORKER_HOST=100.x). Любая ошибка
инструмента → passthrough (вход=выход) + note, чтобы конвейер не падал целиком.

Карта узел→инструмент (= planner.TOOL_MAP):
  length→video_trimmer · format→auto_reframe · silence→silence_cutter ·
  subtitles→subtitle_gen(+transcriber+burn) · audio→audio_mixer · voiceover→tts(piper) ·
  color→color_grade · export→video_compose · broll→clip_search(вставка перебивок,
  клипы подбирает бэкенд в стоках) · upscale→Real-ESRGAN на GPU / CPU-фолбэк lanczos ·
  news/research→passthrough (наша LLM-сторона) · avatar→GPU SadTalker (облако HeyGen — на бэке).
"""
import os
import re
import sys
import time
import uuid
import shutil
import subprocess
import mimetypes
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Optional, Tuple, Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

OPENMONTAGE_DIR = os.environ.get("OPENMONTAGE_DIR", "/opt/openmontage")
WORK_DIR = Path(os.environ.get("RENDER_WORK_DIR", os.path.join(OPENMONTAGE_DIR, "projects", "_trendtraffic")))
FILES_DIR = WORK_DIR / "out"
FILES_DIR.mkdir(parents=True, exist_ok=True)

MEDIA_EXT = (".mp4", ".mov", ".webm", ".mkv", ".wav", ".mp3", ".m4a", ".png", ".jpg", ".jpeg")

registry = None
TOOLS: list = []


def _load_registry() -> None:
    global registry, TOOLS
    try:
        if OPENMONTAGE_DIR not in sys.path:
            sys.path.insert(0, OPENMONTAGE_DIR)
        os.chdir(OPENMONTAGE_DIR)
        from tools.tool_registry import registry as _reg  # type: ignore
        _reg.discover("tools")
        registry = _reg
        try:
            TOOLS = list(_reg.list_all())
        except Exception:
            TOOLS = []
        print(f"[worker] OpenMontage реестр загружен, инструментов: {len(TOOLS)}")
    except Exception as e:  # noqa: BLE001
        print(f"[worker] не удалось загрузить OpenMontage registry: {e}")


_load_registry()
app = FastAPI(title="TrendTraffic Render Worker")


class ExecBody(BaseModel):
    tool: str
    kind: Optional[str] = None
    llm: bool = False
    params: dict = {}
    input_url: Optional[str] = None
    base_url: Optional[str] = None
    job_id: Optional[str] = None
    tenant_id: Optional[str] = None


class TranscribeBody(BaseModel):
    input_url: str
    base_url: Optional[str] = None


class DiarizeBody(BaseModel):
    input_url: str
    base_url: Optional[str] = None
    hf_token: Optional[str] = None


@app.get("/health")
def health():
    return {"ok": registry is not None, "tools": len(TOOLS), "openmontage_dir": OPENMONTAGE_DIR}


# ── утилиты ──────────────────────────────────────────────────────────────────
def _download(url: str, dest: Path) -> None:
    # Только http/https: url приходит из пользовательских спецификаций — file:// и
    # прочие схемы дали бы чтение локальных файлов через urlopen.
    scheme = urllib.parse.urlparse(url).scheme.lower()
    if scheme not in ("http", "https"):
        raise ValueError(f"недопустимая схема URL: {scheme or '(нет)'}")
    req = urllib.request.Request(url, headers={"User-Agent": "trendtraffic-render-worker"})
    with urllib.request.urlopen(req, timeout=180) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)


def _sweep_old(dir_path: Path, max_age_sec: float, skip: tuple = ()) -> None:
    """TTL-очистка рабочих каталогов/выходов: без неё диск VPS забивается нарезками за дни."""
    try:
        now = time.time()
        for p in dir_path.iterdir():
            if p.name in skip:
                continue
            try:
                if now - p.stat().st_mtime > max_age_sec:
                    if p.is_dir():
                        shutil.rmtree(p, ignore_errors=True)
                    else:
                        p.unlink()
            except Exception:  # noqa: BLE001
                continue
    except Exception:  # noqa: BLE001
        pass


def _sweep_workdirs() -> None:
    _sweep_old(WORK_DIR, 24 * 3600, skip=("out",))
    _sweep_old(FILES_DIR, 48 * 3600)


def _abs_url(base_url: Optional[str], u: Optional[str]) -> Optional[str]:
    if not u:
        return None
    if u.startswith("http://") or u.startswith("https://"):
        return u
    base = (base_url or "").rstrip("/")
    return base + (u if u.startswith("/") else "/" + u) if base else None


def _download_media(base_url: Optional[str], u: Optional[str], work: Path, default_ext=".mp3") -> Optional[str]:
    url = _abs_url(base_url, u)
    if not url:
        return None
    ext = os.path.splitext(urllib.parse.urlparse(url).path)[1] or default_ext
    dest = work / f"media_{uuid.uuid4().hex[:6]}{ext}"
    try:
        _download(url, dest)
        return str(dest)
    except Exception:
        return None


_VIDEO_EXTS = (".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv")


def _is_video_url(u: Optional[str]) -> bool:
    """Похоже ли на видео по расширению (для наложения медиа реплики как видео, а не картинки)."""
    if not u:
        return False
    return os.path.splitext(urllib.parse.urlparse(str(u)).path)[1].lower() in _VIDEO_EXTS


def _result_file(result: Any) -> Optional[str]:
    """Выход инструмента: сначала ToolResult.artifacts (список путей), потом data."""
    arts = getattr(result, "artifacts", None) or []
    for a in arts:
        if isinstance(a, str) and os.path.exists(a):
            return a
    data = getattr(result, "data", None)
    if isinstance(data, dict):
        for k in ("output_path", "output", "path", "video", "file", "out_path", "video_path"):
            v = data.get(k)
            if isinstance(v, str) and os.path.exists(v):
                return v
    return None


def run_tool(name: str, inputs: dict) -> Tuple[Optional[str], Optional[dict], Optional[str]]:
    """Запускает инструмент. -> (file_path|None, data|None, note|None)."""
    if registry is None:
        return None, None, "registry не загружен"
    tool = registry.get(name)
    if tool is None:
        return None, None, f"инструмент '{name}' не найден"
    try:
        res = tool.execute(inputs)
    except Exception as e:  # noqa: BLE001
        return None, None, f"{name}: ошибка execute — {e}"
    if getattr(res, "success", None) is False:
        return None, getattr(res, "data", None), f"{name}: {getattr(res, 'error', None) or 'не успех'}"
    return _result_file(res), getattr(res, "data", None), None


def _ts(s: str) -> float:
    s = s.strip()
    if ":" in s:
        mm, ss = s.split(":", 1)
        return int(mm) * 60 + float(ss)
    return float(s)


def _parse_range(text: str, duration_choice) -> Tuple[Optional[float], Optional[float]]:
    """text '0:10-0:40' / '10-40' → (start,end); иначе по выбору длительности (15/30/60 → 0..N)."""
    if text:
        m = re.search(r"(\d{1,2}:\d{2}|\d+)\s*[-–—]\s*(\d{1,2}:\d{2}|\d+)", text)
        if m:
            try:
                return _ts(m.group(1)), _ts(m.group(2))
            except Exception:
                pass
    if duration_choice:
        d = str(duration_choice[0])
        if d in ("15", "30", "60"):
            return 0.0, float(d)
    return None, None  # best / full / пусто → без обрезки


# ── диспетчер: узел плана → точные inputs инструмента(ов) ────────────────────
def dispatch(step_tool: str, params: dict, input_path: Optional[str], work: Path,
             base_url: Optional[str], llm: bool) -> Tuple[Optional[str], str]:
    """-> (output_file|None, note). None = passthrough (вход=выход)."""
    choices = params.get("choices") or {}
    text = str(params.get("text") or "").strip()
    media = params.get("mediaUrl")

    def out(sfx=".mp4") -> str:
        return str(work / f"o_{uuid.uuid4().hex[:6]}{sfx}")

    needs_video = step_tool in ("video_trimmer", "auto_reframe", "silence_cutter",
                                "subtitle_gen", "color_grade", "video_compose", "audio_mixer",
                                "tts", "upscale")
    if needs_video and not input_path:
        return None, "нет входного видео — passthrough"

    if step_tool == "video_trimmer":  # length
        start, end = _parse_range(text, choices.get("duration"))
        if start is None and end is None:
            return None, "длина: без обрезки (весь/ЛЛМ) — passthrough"
        inp = {"operation": "cut", "input_path": input_path, "output_path": out(), "codec": "libx264"}
        if start is not None:
            inp["start_seconds"] = start
        if end is not None:
            inp["end_seconds"] = end
        f, _, n = run_tool("video_trimmer", inp)
        return (f, n or "обрезка")

    if step_tool == "auto_reframe":  # format
        # Имена пресетов auto_reframe (ASPECT_PRESETS): неизвестный ключ молча падал в 9:16,
        # из-за чего «16:9»/«1:1» всегда давали вертикаль. Маппим в реальные имена.
        amap = {"9:16": "portrait", "16:9": "landscape", "1:1": "square",
                "4:5": "vertical_4_5", "21:9": "cinematic"}
        orient = (choices.get("orient") or ["9:16"])[0]
        f, _, n = run_tool("auto_reframe", {"input_path": input_path, "output_path": out(),
                                            "target_aspect": amap.get(orient, "portrait")})
        return (f, n or f"формат {orient}")

    if step_tool == "silence_cutter":  # silence
        m = (choices.get("mode") or ["cut"])[0]
        if m == "none":
            return None, "паузы: не трогать — passthrough"
        mode = {"cut": "remove", "speed": "speed_up"}.get(m, "remove")
        f, _, n = run_tool("silence_cutter", {"input_path": input_path, "output_path": out(), "mode": mode})
        return (f, n or "паузы")

    if step_tool == "subtitle_gen":  # subtitles: transcribe → subtitle_gen(.srt) → burn
        style = (choices.get("style") or ["word"])[0]
        if style == "none":
            return None, "субтитры: выключены"
        _, tdata, tn = run_tool("transcriber", {"input_path": input_path, "output_dir": str(work)})
        segs = (tdata or {}).get("segments")
        if not segs:
            return None, f"субтитры: транскрипт пуст ({tn or 'нет segments'})"
        hl = {"word": "word_by_word", "karaoke": "karaoke", "plain": "none"}.get(style, "none")
        srt, _, sn = run_tool("subtitle_gen", {"segments": segs, "format": "srt",
                                               "output_path": out(".srt"), "highlight_style": hl})
        if not srt:
            return None, f"субтитры: srt не создан ({sn or ''})"
        f, _, cn = run_tool("video_compose", {"operation": "burn_subtitles", "input_path": input_path,
                                              "subtitle_path": srt, "output_path": out()})
        return (f, cn or "субтитры вшиты")

    if step_tool == "audio_mixer":  # audio: музыка (+дакинг под голос через sidechain)
        if not media:
            return None, "аудио: музыка не выбрана — passthrough"
        mp = _download_media(base_url, media, work, default_ext=".mp3")
        if not mp:
            return None, "аудио: музыка не скачалась"
        vol = {"low": 0.10, "mid": 0.20, "high": 0.35}.get((choices.get("vol") or ["mid"])[0], 0.20)
        duck = (choices.get("duck") or ["on"])[0] != "off"
        if duck:
            # Музыка приглушается, когда в исходнике звучит голос (sidechaincompress),
            # затем миксуется с оригинальной дорожкой. Музыка зациклена на всю длину.
            f2 = out()
            ok, err = _run([FFMPEG, "-y", "-i", input_path, "-stream_loop", "-1", "-i", mp,
                            "-filter_complex",
                            f"[1:a]volume={vol:.2f}[m];"
                            f"[m][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=120:release=500[dk];"
                            f"[0:a][dk]amix=inputs=2:duration=first:normalize=0[a]",
                            "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac",
                            "-shortest", f2], timeout=1200)
            if ok and os.path.exists(f2):
                return f2, "аудио: музыка + приглушение под голос"
            print(f"[worker] duck mix failed: {err[:200]} — фолбэк segmented_music")
        f, _, n = run_tool("audio_mixer", {"operation": "segmented_music", "video_path": input_path,
                                           "music_path": mp, "music_volume": vol, "output_path": out()})
        return (f, n or "аудио")

    if step_tool == "tts":  # voiceover: piper (голос М/Ж из узла) → подмешать как дорожку видео
        if not text:
            return None, "озвучка: нет текста — passthrough"
        voice = (choices.get("voice") or ["female"])[0]
        wav, _, n = _tts(text, voice, out(".wav"))
        if not wav:
            return None, f"озвучка: tts не создан ({n or ''})"
        f, _, cn = run_tool("video_compose", {"operation": "encode", "input_path": input_path,
                                              "audio_path": wav, "output_path": out()})
        return (f, cn or f"озвучка ({'муж.' if voice == 'male' else 'жен.'} голос)")

    if step_tool == "color_grade":  # color: профили color_grade + LUT .cube + Ч/Б через custom_vf
        preset = (choices.get("preset") or ["none"])[0]
        lut = None
        if media and str(media).lower().endswith(".cube"):
            lut = _download_media(base_url, media, work, default_ext=".cube")
        if preset == "none" and not lut:
            return None, "цвет: без изменений"
        inp = {"input_path": input_path, "output_path": out()}
        label = preset
        if lut:
            inp["lut_path"] = lut
            label = "LUT"
        elif preset == "bw":
            inp["custom_vf"] = "hue=s=0,eq=contrast=1.06"
        else:
            pmap = {"warm": "cinematic_warm", "cold": "cinematic_cool",
                    "cinema": "moody_dark", "vivid": "bright_clean"}
            inp["profile"] = pmap.get(preset, "neutral")
        f, _, n = run_tool("color_grade", inp)
        if not f and preset == "bw":  # схема без custom_vf → ближайший профиль
            f, _, n = run_tool("color_grade", {"input_path": input_path, "output_path": out(),
                                               "profile": "high_contrast"})
        return (f, n or f"цветокор: {label}")

    if step_tool == "video_compose":  # export: media-profile площадки (один файл на формат)
        plats = [str(p) for p in (choices.get("platforms") or [])]
        prof_map = {"tiktok": "tiktok", "reels": "instagram_reels", "shorts": "youtube_shorts",
                    "youtube": "youtube_landscape", "instagram": "instagram_feed"}
        inp = {"operation": "encode", "input_path": input_path, "output_path": out()}
        note = "экспорт"
        if plats:
            first = prof_map.get(plats[0])
            if first:
                inp["profile"] = first
            vertical = {"tiktok", "reels", "shorts"}
            same = [p for p in plats if (p in vertical) == (plats[0] in vertical)]
            other = [p for p in plats if p not in same]
            note = f"экспорт: {', '.join(same)}"
            if other:
                note += f" · ВНИМАНИЕ: {', '.join(other)} — другой формат кадра, для него соберите вариант с узлом «Формат»"
        f, _, n = run_tool("video_compose", inp)
        return (f, n or note)

    if step_tool == "upscale":  # upscale: GPU Real-ESRGAN, иначе CPU-фолбэк (lanczos+unsharp)
        sc = (choices.get("scale") or ["off"])[0]
        if sc == "off":
            return None, "апскейл: выключен — passthrough"
        scale = 4 if sc == "4" else 2
        if registry is not None and registry.get("upscale") is not None:
            f, _, n = run_tool("upscale", {"input_path": input_path, "output_path": out(), "scale": scale})
            if f:
                return (f, n or f"апскейл ×{scale} (Real-ESRGAN)")
        f2 = out()
        ok, err = _run([FFMPEG, "-y", "-i", input_path,
                        "-vf", f"scale=iw*{scale}:ih*{scale}:flags=lanczos,unsharp=5:5:0.6:5:5:0.0",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
                        "-c:a", "copy", f2], timeout=1800)
        if ok and os.path.exists(f2):
            return f2, f"апскейл ×{scale} (CPU lanczos; GPU-воркер даст нейро-качество)"
        return None, f"апскейл: не получился ({err[:160]})"

    if step_tool == "talking_head":  # avatar (GPU SadTalker): фото + озвучка → говорящая голова
        if not media:
            return None, "аватар: нужна фото/аватар (медиа узла) — passthrough"
        img = _download_media(base_url, media, work, default_ext=".jpg")
        if not img:
            return None, "аватар: фото не скачалось"
        if not text:
            return None, "аватар: нет сценария для озвучки — passthrough"
        # Локальный движок — только SadTalker; engine=heygen (облако) тут недоступен.
        wav, _, tn = run_tool("piper_tts", {"text": text, "output_path": out(".wav")})
        if not wav:
            return None, f"аватар: озвучка не создана ({tn or ''})"
        f, _, n = run_tool("talking_head", {"image_path": img, "audio_path": wav,
                                            "output_path": out(), "model": "sadtalker"})
        return (f, n or "аватар (говорящая голова)")

    if step_tool == "podcast_compose":  # подкаст-сцена (2 ведущих): TTS на 2 голоса → головы → сшивка
        return _podcast_compose(params, work, base_url)

    if step_tool == "clip_search":  # broll: перебивки поверх исходника (клипы подобрал бэкенд)
        clips = params.get("clips") or []
        if not input_path:
            return None, "b-roll: нет входного видео — passthrough"
        if not clips:
            return None, "b-roll: клипы не подобраны — passthrough"
        return _broll_insert(input_path, clips, params.get("timings") or [], work, base_url)

    # news_source / web_research — наша LLM-сторона (passthrough)
    return None, f"{step_tool}: на воркере не выполняется — passthrough"


def _tts(text: str, voice: Optional[str], out_path: str):
    """Piper TTS с попыткой выбрать голос; фолбэк — без него (схема может не поддерживать voice)."""
    if voice:
        f, d, n = run_tool("piper_tts", {"text": text, "voice": voice, "output_path": out_path})
        if f:
            return f, d, n
    return run_tool("piper_tts", {"text": text, "output_path": out_path})


# ── ffmpeg-обёртки для сборки сплит-скрина (ffmpeg есть на VPS — см. docs §5) ──
FFMPEG = os.environ.get("FFMPEG_BIN", "ffmpeg")
FFPROBE = os.environ.get("FFPROBE_BIN", "ffprobe")
POD_W, POD_H = 1080, 1920  # вертикаль 9:16


def _run(cmd: list, timeout: int = 900) -> Tuple[bool, str]:
    try:
        p = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
        return p.returncode == 0, (p.stderr.decode("utf-8", "ignore") if p.returncode != 0 else "")
    except Exception as e:  # noqa: BLE001
        return False, str(e)


def _media_duration(path: str) -> float:
    try:
        p = subprocess.run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
                            "-of", "default=nw=1:nk=1", path],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
        return float((p.stdout or b"").decode().strip() or 0)
    except Exception:  # noqa: BLE001
        return 0.0


def _video_wh(path: str) -> Tuple[int, int]:
    """Ширина×высота первого видеопотока (дефолт 1080×1920 при сбое probe)."""
    try:
        p = subprocess.run([FFPROBE, "-v", "error", "-select_streams", "v:0",
                            "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
                           stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
        w, h = (p.stdout or b"").decode().strip().split(",")[:2]
        return max(int(w), 16), max(int(h), 16)
    except Exception:  # noqa: BLE001
        return 1080, 1920


_IMG_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif")


def _broll_insert(input_path: str, clip_urls: list, timings: list, work: Path,
                  base_url: Optional[str]) -> Tuple[Optional[str], str]:
    """Вставляет перебивки (клипы/картинки) ПОВЕРХ исходника в заданные моменты.

    Звук исходника не трогаем (перебивка — визуальная), клип масштабируется
    cover-кропом под кадр. Тайминги: заданные бэкендом (ритм DNA) или равномерно,
    минуя первые 2 сек (хук) и хвост.
    """
    dur = _media_duration(input_path)
    if dur < 4.0:
        return None, "b-roll: исходник короче 4 сек — перебивки не ставим"
    files = []
    for u in clip_urls[:4]:
        p = _download_media(base_url, u, work, default_ext=".mp4")
        if p:
            files.append(p)
    if not files:
        return None, "b-roll: клипы не скачались"

    seg = 2.5  # длительность одной перебивки
    n = len(files)
    times = []
    for t in timings:
        try:
            times.append(float(t))
        except Exception:  # noqa: BLE001
            continue
    times = [t for t in times if 0.5 <= t < dur - 1.5][:n]
    if len(times) < n:
        usable = max(dur - 4.0, 1.0)
        times = [2.0 + usable * (i + 1) / (n + 1) for i in range(n)]
    times.sort()

    w, h = _video_wh(input_path)
    inputs = ["-i", input_path]
    fparts = []
    last = "[0:v]"
    used = 0
    for i, (p, t) in enumerate(zip(files, times)):
        d = min(seg, max(dur - t - 0.3, 0.8))
        if p.lower().endswith(_IMG_EXTS):
            inputs += ["-loop", "1", "-t", f"{d:.2f}", "-i", p]
        else:
            inputs += ["-i", p]
        end = t + d
        fparts.append(
            f"[{used + 1}:v]trim=0:{d:.2f},setpts=PTS-STARTPTS+{t:.3f}/TB,"
            f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1[b{i}]")
        fparts.append(f"{last}[b{i}]overlay=0:0:enable='between(t,{t:.3f},{end:.3f})'[v{i}]")
        last = f"[v{i}]"
        used += 1
    out_p = str(work / f"o_{uuid.uuid4().hex[:6]}.mp4")
    cmd = [FFMPEG, "-y", *inputs, "-filter_complex", ";".join(fparts),
           "-map", last, "-map", "0:a?", "-c:v", "libx264", "-preset", "veryfast",
           "-crf", "20", "-c:a", "copy", out_p]
    ok, err = _run(cmd, timeout=1800)
    if not (ok and os.path.exists(out_p)):
        return None, f"b-roll: ffmpeg не собрал ({err[:160]})"
    return out_p, f"b-roll: {used} перебивк(и) на {', '.join(f'{t:.0f}с' for t in times[:used])}"
    """Вырезает [start,end] из записи в моно-wav 22.05кГц (для сохранения реального голоса)."""
    dur = end - start
    if dur < 0.15:  # битые/схлопнутые таймкоды: 150мс «пшика» вместо реплики хуже, чем явный отказ
        print(f"[worker] cut_audio: слишком короткий диапазон {start:.3f}-{end:.3f}")
        return None
    cmd = [FFMPEG, "-y", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", src,
           "-vn", "-ac", "1", "-ar", "22050", "-c:a", "pcm_s16le", out_path]
    ok, err = _run(cmd, timeout=300)
    if not (ok and os.path.exists(out_path)):
        print(f"[worker] cut_audio failed: {err[:200]}")
        return None
    return out_path


def _pad_audio(wav: str, min_sec: float, out_path: str) -> str:
    """Дополняет короткую озвучку тишиной до min_sec (чтобы короткие реплики не мелькали)."""
    if min_sec <= 0 or _media_duration(wav) >= min_sec:
        return wav
    cmd = [FFMPEG, "-y", "-i", wav, "-af", "apad", "-t", f"{min_sec:.3f}",
           "-ac", "1", "-ar", "22050", "-c:a", "pcm_s16le", out_path]
    ok, _ = _run(cmd, timeout=120)
    return out_path if ok and os.path.exists(out_path) else wav


def _pod_segment(left: str, left_v: bool, right: str, right_v: bool,
                 audio: str, cut: Optional[str], anim: str, out_path: str,
                 cut_v: bool = False) -> Optional[str]:
    """
    Один сегмент сплит-скрина: ведущий A слева, B справа (каждый half×H), общая дорожка —
    озвучка реплики. Если к фразе прикреплена картинка (cut) — она эффектно «выезжает»
    карточкой по центру с анимацией anim (slide-left/right/up | fade | zoom | auto).
    Говорящая сторона — видео-голова или статичное фото (loop).
    """
    half = POD_W // 2
    dur = _media_duration(audio) or 4.0
    inputs: list = []
    inputs += (["-i", left] if left_v else ["-loop", "1", "-i", left])      # 0: левый
    inputs += (["-i", right] if right_v else ["-loop", "1", "-i", right])   # 1: правый
    inputs += ["-i", audio]                                                 # 2: звук
    fc = (
        f"[0:v]scale={half}:{POD_H}:force_original_aspect_ratio=increase,"
        f"crop={half}:{POD_H},fps=30,setsar=1[l];"
        f"[1:v]scale={half}:{POD_H}:force_original_aspect_ratio=increase,"
        f"crop={half}:{POD_H},fps=30,setsar=1[r];"
        f"[l][r]hstack=inputs=2[base];"
    )
    last = "base"
    if cut:
        # видео нельзя подавать с -loop (опция image2-демаксера — mp4 уронит весь сегмент)
        inputs += (["-i", cut] if cut_v else ["-loop", "1", "-i", cut])  # 3: медиа к фразе
        side = int(POD_W * 0.62)
        d = 0.45  # длительность входа
        cx, cy = "(W-w)/2", "(H-h)/2"
        pre = (f"[3:v]scale={side}:{side}:force_original_aspect_ratio=increase,crop={side}:{side},setsar=1")
        if anim == "slide-left":
            x, y = f"(W-w)/2-((W-w)/2+w)*(1-min(1\\,t/{d}))", cy
        elif anim == "slide-right":
            x, y = f"(W-w)/2+(W-(W-w)/2)*(1-min(1\\,t/{d}))", cy
        elif anim == "slide-up":
            x, y = cx, f"(H-h)/2+(H-(H-h)/2)*(1-min(1\\,t/{d}))"
        else:  # fade / zoom / auto → проявление
            x, y = cx, cy
            pre += f",format=yuva420p,fade=in:st=0:d={d}:alpha=1"
        fc += f"{pre}[cut];[{last}][cut]overlay=x={x}:y={y}[v];"
        last = "v"
    cmd = [FFMPEG, "-y", *inputs,
           "-filter_complex", fc.rstrip("; "),
           "-map", f"[{last}]", "-map", "2:a",
           "-t", f"{dur:.3f}", "-r", "30", "-pix_fmt", "yuv420p",
           "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-ac", "2",
           out_path]
    ok, err = _run(cmd, timeout=900)
    if not (ok and os.path.exists(out_path)):
        print(f"[worker] pod segment ffmpeg failed: {err[:300]}")
        return None
    return out_path


def _pod_concat(segments: list, out_path: str, work: Path) -> Optional[str]:
    if len(segments) == 1:
        return segments[0]
    lst = work / f"concat_{uuid.uuid4().hex[:6]}.txt"
    with open(lst, "w", encoding="utf-8") as f:
        for s in segments:
            f.write("file '%s'\n" % str(s).replace("'", "'\\''"))
    base = [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(lst)]
    # быстрый путь: stream-copy (сегменты с одинаковыми параметрами кодирования)
    ok, _ = _run(base + ["-c", "copy", out_path], timeout=600)
    if ok and os.path.exists(out_path):
        return out_path
    # фолбэк: переэнкод (если copy не сошёлся по таймингам)
    ok, err = _run(base + ["-r", "30", "-pix_fmt", "yuv420p",
                           "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", out_path], timeout=1800)
    if not (ok and os.path.exists(out_path)):
        print(f"[worker] pod concat ffmpeg failed: {err[:300]}")
        return None
    return out_path


def _podcast_mix(pod: dict, lines: list, host_a: dict, host_b: dict, img_a: str, img_b: str,
                 rec_path: Optional[str], base_url: Optional[str], work: Path) -> Tuple[Optional[str], str]:
    """
    Фаза 2 (таймлайн с НАЛОЖЕНИЕМ): каждая реплика — клип со своей позицией на выходном
    таймлайне (l['tStart'], сек). Дорожки микшируются (adelay по tStart + amix), поэтому
    клипы могут накладываться — один «перебивает» другого. Видео — сплит-скрин (статичные
    фото) на всю длину; картинки реплик показываются во время своего клипа.
    """
    def out(sfx=".mp4") -> str:
        return str(work / f"m_{uuid.uuid4().hex[:6]}{sfx}")

    half = POD_W // 2
    clips: list = []
    notes: list = []
    used_real = 0
    used_imgs = 0
    for i, l in enumerate(lines):
        spk = "B" if l.get("speaker") == "B" else "A"
        text = str(l.get("text") or "").strip()
        wav = None
        st = None
        if rec_path:
            try:
                st, en = float(l.get("start")), float(l.get("end"))
            except (TypeError, ValueError):
                st = en = None
            if st is not None and en is not None and en > st:
                wav = _cut_audio(rec_path, st, en, out(".wav"))
                if wav:
                    used_real += 1
        if not wav:
            voice = (host_b if spk == "B" else host_a).get("voice") or "female"
            wav, _, _ = _tts(text, voice, out(".wav"))
        if not wav:
            notes.append(f"реплика {i + 1}: озвучка не создана")
            continue
        d = _media_duration(wav) or 1.0
        try:
            t = float(l.get("tStart"))
        except (TypeError, ValueError):
            t = None
        if t is None:  # нет позиции — берём исходный таймкод, иначе встык за предыдущим
            t = st if st is not None else (clips[-1]["t"] + clips[-1]["dur"] if clips else 0.0)
        media_url = l.get("image")
        is_vid = _is_video_url(media_url)
        img = _download_media(base_url, media_url, work, default_ext=(".mp4" if is_vid else ".jpg")) if media_url else None
        if img:
            used_imgs += 1
        clips.append({"wav": wav, "t": max(0.0, t), "dur": d, "image": img, "video": bool(img and is_vid)})
    if not clips:
        tail = "; ".join(notes) if notes else "нет клипов"
        return None, f"подкаст(таймлайн): {tail}"

    total = max(c["t"] + c["dur"] for c in clips) + 0.2
    inputs: list = ["-loop", "1", "-t", f"{total:.3f}", "-i", img_a,   # 0
                    "-loop", "1", "-t", f"{total:.3f}", "-i", img_b]   # 1
    for c in clips:                                                    # 2 .. 2+N-1 — аудио клипов
        inputs += ["-i", c["wav"]]
    img_clips = [c for c in clips if c["image"]]
    img_start = 2 + len(clips)
    for c in img_clips:                                               # медиа реплик — после аудио
        if c["video"]:                                               # видео — играет (без -loop), звук отбрасываем
            inputs += ["-i", c["image"]]
        else:                                                        # картинка — статичная (looped)
            inputs += ["-loop", "1", "-i", c["image"]]

    fc = (
        f"[0:v]scale={half}:{POD_H}:force_original_aspect_ratio=increase,crop={half}:{POD_H},fps=30,setsar=1[l];"
        f"[1:v]scale={half}:{POD_H}:force_original_aspect_ratio=increase,crop={half}:{POD_H},fps=30,setsar=1[r];"
        f"[l][r]hstack=inputs=2[v0];"
    )
    last_v = "v0"
    side = int(POD_W * 0.62)
    for k, c in enumerate(img_clips):
        idx = img_start + k
        t0, t1 = c["t"], c["t"] + c["dur"]
        # видео сдвигаем по времени (setpts), чтобы играло с начала клипа; картинка — статична
        pts = f",setpts=PTS-STARTPTS+{t0:.3f}/TB" if c["video"] else ""
        fc += (f"[{idx}:v]scale={side}:{side}:force_original_aspect_ratio=increase,crop={side}:{side},setsar=1{pts}[ci{k}];"
               f"[{last_v}][ci{k}]overlay=(W-w)/2:(H-h)/2:enable='between(t\\,{t0:.3f}\\,{t1:.3f})'[vi{k}];")
        last_v = f"vi{k}"
    for k, c in enumerate(clips):
        ms = int(c["t"] * 1000)
        fc += f"[{2 + k}:a]adelay={ms}|{ms}[a{k}];"
    fc += "".join(f"[a{k}]" for k in range(len(clips)))
    fc += f"amix=inputs={len(clips)}:normalize=0:duration=longest[aout]"

    out_path = out()
    cmd = [FFMPEG, "-y", *inputs, "-filter_complex", fc,
           "-map", f"[{last_v}]", "-map", "[aout]",
           "-t", f"{total:.3f}", "-r", "30", "-pix_fmt", "yuv420p",
           "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", "-ac", "2", out_path]
    ok, err = _run(cmd, timeout=1800)
    if not (ok and os.path.exists(out_path)):
        print(f"[worker] pod mix ffmpeg failed: {err[:400]}")
        return None, "подкаст(таймлайн): ffmpeg-микс не удался"
    extra = ("; " + "; ".join(notes)) if notes else ""
    return out_path, f"подкаст-таймлайн (наложение): {len(clips)} клип., реальный голос {used_real}, картинок {used_imgs}{extra}"


def _podcast_compose(params: dict, work: Path, base_url: Optional[str]) -> Tuple[Optional[str], str]:
    """
    Собирает подкаст-сцену (сплит-скрин, 2 ведущих) из спецификации params['podcast']:
      • TTS каждой реплики голосом её ведущего (Piper);
      • говорящая сторона — talking_head (если есть GPU-воркер с SadTalker), иначе статичное фото;
      • НЕговорящая сторона — статичное фото второго ведущего → оба в кадре одновременно;
      • картинки-вставки распределяются по репликам (центр-overlay / topbar);
      • покадровая сборка и склейка сегментов через ffmpeg (вертикаль 9:16).

    Мягкая деградация: ошибка сегмента → пропуск + заметка, конвейер не падает.
    """
    def out(sfx=".mp4") -> str:
        return str(work / f"p_{uuid.uuid4().hex[:6]}{sfx}")

    pod = params.get("podcast") or {}
    host_a = pod.get("hostA") or {}
    host_b = pod.get("hostB") or {}
    img_a = _download_media(base_url, host_a.get("photoUrl"), work, default_ext=".jpg")
    img_b = _download_media(base_url, host_b.get("photoUrl"), work, default_ext=".jpg")
    if not img_a or not img_b:
        return None, "подкаст: не скачались фото ведущих — passthrough"

    layout = pod.get("layout") if pod.get("layout") in ("overlay", "topbar") else "overlay"
    try:
        seg_sec = float(pod.get("segSec") or 0)
    except Exception:  # noqa: BLE001
        seg_sec = 0.0

    # Лимиты MVP: синхронный рендер должен уложиться в таймаут — длинные подкасты режем.
    POD_MAX_SEC = 180   # не диаризуем/не собираем дольше ~3 мин
    POD_MAX_LINES = 40

    # Разбор записи: при source='diarize' и наличии записи берём РЕАЛЬНЫЙ голос —
    # нарезаем дорожку по таймкодам реплик (а не ре-синтез TTS).
    rec_path = None
    if pod.get("source") == "diarize" and pod.get("recordingUrl"):
        rec_path = _download_media(base_url, pod.get("recordingUrl"), work, default_ext=".mp3")

    truncated = ""
    def _has_clip(l) -> bool:
        if not isinstance(l, dict):
            return False
        if str(l.get("text") or "").strip():
            return True
        try:  # клип без текста, но с аудио-диапазоном (после разреза / только запись) — валиден
            return float(l.get("start")) < float(l.get("end"))
        except (TypeError, ValueError):
            return False
    lines = [l for l in (pod.get("dialogue") or []) if _has_clip(l)]
    # Реплик нет, но это разбор записи → диаризуем сами (одной кнопки «Собрать» достаточно).
    if not lines and rec_path:
        src = rec_path
        dur = _media_duration(rec_path)
        if dur and dur > POD_MAX_SEC:  # длинную запись режем до POD_MAX_SEC, чтобы whisper+сборка успели
            cut = _cut_audio(rec_path, 0, POD_MAX_SEC, out(".wav"))
            if cut:
                src = cut
                truncated += f"; запись обрезана до {POD_MAX_SEC}с (MVP)"
        dlines, _m = _diarize_audio(src, work, None)
        lines = [l for l in dlines if str(l.get("text") or "").strip()]
    if not lines:
        return None, "подкаст: нет реплик (разберите запись / сгенерируйте диалог) — passthrough"
    if len(lines) > POD_MAX_LINES:
        lines = lines[:POD_MAX_LINES]
        truncated += f"; обрезано до {POD_MAX_LINES} реплик (MVP)"

    # Фаза 2: режим таймлайна с наложением (микс дорожек). Иначе — обычная последовательная сборка.
    if pod.get("timeline"):
        mf, mnote = _podcast_mix(pod, lines, host_a, host_b, img_a, img_b, rec_path, base_url, work)
        if mf:
            return mf, mnote + truncated
        # не молчим о деградации: пользователь должен видеть, что наложения/позиции потеряны
        truncated += f"; таймлайн-микс не удался ({mnote}) — собрано последовательно, без наложений"

    has_talking = registry.get("talking_head") is not None
    segments: list = []
    notes: list = []
    used_heads = 0
    used_real = 0
    used_imgs = 0
    for i, l in enumerate(lines):
        spk = "B" if l.get("speaker") == "B" else "A"
        voice = (host_b if spk == "B" else host_a).get("voice") or "female"
        text = str(l.get("text") or "").strip()  # None → '' (иначе TTS озвучит слово «None»)
        # источник звука реплики: реальный фрагмент записи (диаризация) либо TTS.
        wav, tn = None, ""
        if rec_path:
            try:
                st, en = float(l.get("start")), float(l.get("end"))
            except (TypeError, ValueError):
                st = en = None
            if st is not None and en is not None and en > st:
                wav = _cut_audio(rec_path, st, en, out(".wav"))
                if wav:
                    used_real += 1
        if not wav:
            wav, _, tn = _tts(text, voice, out(".wav"))
        if not wav:
            notes.append(f"реплика {i + 1}: озвучка не создана ({tn or ''})")
            continue
        wav = _pad_audio(wav, seg_sec, out(".wav"))  # короткие реплики → не мельтешат
        # говорящая сторона: голова (GPU) либо статичное фото
        speak_img = img_b if spk == "B" else img_a
        speak_clip = None
        if has_talking:
            speak_clip, _, hn = run_tool("talking_head", {"image_path": speak_img, "audio_path": wav,
                                                          "output_path": out(), "model": "sadtalker"})
            if speak_clip:
                used_heads += 1
            else:
                notes.append(f"реплика {i + 1}: голова не создана ({hn or ''})")
        # раскладка: A слева, B справа — у говорящего видео/фото, у второго статичное фото
        if spk == "A":
            left, left_v, right, right_v = (speak_clip or img_a), bool(speak_clip), img_b, False
        else:
            left, left_v, right, right_v = img_a, False, (speak_clip or img_b), bool(speak_clip)
        # медиа к фразе (B-roll, картинка или видео) с выездом; «auto» → со стороны говорящего
        lmedia = l.get("image")
        l_is_vid = _is_video_url(lmedia)
        limg = _download_media(base_url, lmedia, work, default_ext=(".mp4" if l_is_vid else ".jpg")) if lmedia else None
        lanim = str(l.get("anim") or "auto")
        if lanim == "auto":
            lanim = "slide-left" if spk == "A" else "slide-right"
        if limg:
            used_imgs += 1
        seg = _pod_segment(left, left_v, right, right_v, wav, limg, lanim, out(), cut_v=l_is_vid)
        if seg:
            segments.append(seg)
        else:
            notes.append(f"реплика {i + 1}: сегмент не собран (ffmpeg)")

    if not segments:
        tail = "; ".join(notes) if notes else "нет сегментов"
        return None, f"подкаст: не собрано ни одного сегмента — {tail}"

    final = _pod_concat(segments, out(), work)
    if not final:
        return None, "подкаст: склейка сегментов не удалась (ffmpeg concat)"

    head_note = (f"говорящие головы {used_heads}/{len(lines)}"
                 if has_talking else "статичные фото (нет GPU talking_head)")
    audio_note = f"реальный голос {used_real}/{len(lines)}" if rec_path else "озвучка TTS"
    extra = ("; " + "; ".join(notes)) if notes else ""
    return final, f"подкаст-сплит-скрин: {len(segments)} сегм., {head_note}, {audio_note}, картинок {used_imgs}{truncated}{extra}"


@app.post("/execute")
def execute(body: ExecBody):
    _sweep_workdirs()
    # job_id идёт в путь — только безопасные символы (без ../)
    job = re.sub(r"[^A-Za-z0-9_-]", "", str(body.job_id or "")) or uuid.uuid4().hex
    work = WORK_DIR / job
    work.mkdir(parents=True, exist_ok=True)

    input_path: Optional[str] = None
    if body.input_url:
        ext = os.path.splitext(urllib.parse.urlparse(body.input_url).path)[1] or ".mp4"
        input_path = str(work / f"input{ext}")
        try:
            _download(body.input_url, Path(input_path))
        except Exception as e:  # noqa: BLE001
            return {"skipped": False, "output_name": None, "note": f"вход не скачался: {e}"}

    if registry is None:
        return {"skipped": False, "output_name": None, "note": "OpenMontage registry не загружен — passthrough"}

    try:
        out_file, note = dispatch(body.tool, body.params or {}, input_path, work, body.base_url, body.llm)
    except Exception as e:  # noqa: BLE001
        return {"skipped": False, "output_name": None, "note": f"{body.tool}: {e} (passthrough)"}

    if not out_file or not os.path.exists(out_file):
        return {"skipped": False, "output_name": None, "note": note or "passthrough"}

    name = f"{job}-{uuid.uuid4().hex[:8]}{os.path.splitext(out_file)[1] or '.mp4'}"
    shutil.copyfile(out_file, FILES_DIR / name)
    return {"skipped": False, "output_name": name, "note": note}


@app.post("/transcribe")
def transcribe(body: TranscribeBody):
    """Транскрибирует вход (faster-whisper) и отдаёт сегменты — для ЛЛМ-выбора момента."""
    if registry is None:
        return {"segments": [], "note": "registry не загружен"}
    _sweep_workdirs()
    job = uuid.uuid4().hex
    work = WORK_DIR / job
    work.mkdir(parents=True, exist_ok=True)
    url = _abs_url(body.base_url, body.input_url) or body.input_url
    ext = os.path.splitext(urllib.parse.urlparse(url).path)[1] or ".mp4"
    input_path = str(work / f"input{ext}")
    try:
        _download(url, Path(input_path))
    except Exception as e:  # noqa: BLE001
        return {"segments": [], "note": f"вход не скачался: {e}"}
    _, data, note = run_tool("transcriber", {"input_path": input_path, "output_dir": str(work)})
    raw = (data or {}).get("segments") or []
    segs = []
    for s in raw:
        try:
            segs.append({
                "start": float(s.get("start", 0) or 0),
                "end": float(s.get("end", 0) or 0),
                "text": str(s.get("text", "") or "").strip(),
            })
        except Exception:  # noqa: BLE001
            continue
    return {"segments": segs, "note": note}


def _pyannote_turns(audio_path: str, hf_token: Optional[str]) -> Optional[list]:
    """
    pyannote speaker-diarization-3.1 → [(start, end, label)]. Требует установленных
    torch + pyannote.audio И валидного hf_token (модель gated — нужно принять условия
    на HuggingFace). Недоступно / ошибка → None (тогда /diarize падает на разделение по
    паузам). Так «настоящая» диаризация включается там, где есть torch (GPU-воркер).
    """
    if not hf_token:
        return None
    try:
        from pyannote.audio import Pipeline  # type: ignore  # noqa: WPS433
    except Exception:  # noqa: BLE001
        print("[worker] pyannote.audio не установлен — диаризация по паузам")
        return None
    try:
        pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1", use_auth_token=hf_token)
        diar = pipe(audio_path, num_speakers=2)
        turns = [(float(t.start), float(t.end), str(spk))
                 for t, _, spk in diar.itertracks(yield_label=True)]
        turns.sort(key=lambda x: x[0])
        return turns or None
    except Exception as e:  # noqa: BLE001
        print(f"[worker] pyannote diarize error: {e}")
        return None


def _overlap_speaker(turns: list, start: float, end: float) -> Optional[str]:
    """Метка спикера pyannote с наибольшим перекрытием по времени для [start, end]."""
    best, best_ov = None, 0.0
    for ts, te, spk in turns:
        ov = min(end, te) - max(start, ts)
        if ov > best_ov:
            best_ov, best = ov, spk
    return best


def _read_wav_mono16k(src: str, work: Path):
    """Конвертирует вход в моно 16 кГц WAV (ffmpeg) и читает в numpy float32 [-1..1]. -> (sig, sr) | (None,0)."""
    try:
        import numpy as np  # noqa: WPS433
        import wave  # noqa: WPS433
    except Exception:  # noqa: BLE001
        return None, 0
    tmp = str(work / f"diar_{uuid.uuid4().hex[:6]}.wav")
    ok, _ = _run([FFMPEG, "-y", "-i", src, "-ac", "1", "-ar", "16000", "-f", "wav", tmp], timeout=300)
    if not (ok and os.path.exists(tmp)):
        return None, 0
    try:
        with wave.open(tmp, "rb") as w:
            sr = w.getframerate()
            raw = w.readframes(w.getnframes())
        sig = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        return sig, sr
    except Exception:  # noqa: BLE001
        return None, 0


def _seg_features(sig, sr, start: float, end: float):
    """Признаки сегмента [start,end]: [медианная F0 (высота голоса), спектральный центроид]. None — если тихо/коротко."""
    import numpy as np  # noqa: WPS433
    a = max(0, int(start * sr)); b = min(int(sig.size), int(end * sr))
    seg = sig[a:b]
    if seg.size < sr // 10:  # < 100 мс — слишком коротко
        return None
    fl, hop = 1024, 512
    starts = list(range(0, max(1, seg.size - fl), hop))
    if len(starts) > 40:  # не более 40 кадров на сегмент
        starts = [starts[i] for i in np.linspace(0, len(starts) - 1, 40).astype(int)]
    win = np.hanning(fl)
    lo, hi = int(sr / 350), int(sr / 70)  # диапазон голоса 70–350 Гц
    f0s: list = []; cents: list = []
    for s0 in starts:
        fr = seg[s0:s0 + fl]
        if fr.size < fl:
            fr = np.pad(fr, (0, fl - fr.size))
        if float(np.sqrt(np.mean(fr * fr))) < 0.01:  # тихий кадр — пропуск
            continue
        mag = np.abs(np.fft.rfft(fr * win))
        ssum = float(mag.sum())
        if ssum > 0:
            cents.append(float((np.fft.rfftfreq(fl, 1.0 / sr) * mag).sum() / ssum))
        fr0 = fr - fr.mean()
        corr = np.correlate(fr0, fr0, mode="full")[fl - 1:]
        h = min(hi, corr.size - 1)
        if lo < h and corr[0] > 0:
            peak = int(np.argmax(corr[lo:h])) + lo
            if peak > 0 and corr[peak] > 0.3 * corr[0]:
                f0s.append(sr / peak)
    if not cents or not f0s:
        # без питча (шёпот/смех/шум) сегмент в кластеризацию не берём: F0=0 после
        # z-нормализации — экстремальный выброс, он захватывал начальный центроид k-means
        return None
    return [float(np.median(f0s)), float(np.median(cents))]


def _cluster_speakers(input_path: str, raw_segments: list, work: Path) -> Optional[list]:
    """
    Бестокенная акустическая диаризация на 2 голоса: по каждому whisper-сегменту берём
    высоту голоса (F0) + тембр (центроид), нормируем и кластеризуем k-means(2). Работает
    оффлайн (только numpy+ffmpeg), без HuggingFace/torch. -> список меток 'A'/'B' по каждому
    сегменту raw_segments, либо None (тогда фолбэк на разделение по паузам).
    """
    try:
        import numpy as np  # noqa: WPS433
    except Exception:  # noqa: BLE001
        return None
    try:
        sig, sr = _read_wav_mono16k(input_path, work)
        if sig is None or int(getattr(sig, "size", 0)) == 0:
            return None
        feats = []
        for s in raw_segments:
            try:
                st = float(s.get("start", 0) or 0); en = float(s.get("end", 0) or 0)
            except Exception:  # noqa: BLE001
                feats.append(None); continue
            feats.append(_seg_features(sig, sr, st, en) if en > st else None)
        good = [f for f in feats if f is not None]
        if len(good) < 4:  # мало данных — не кластеризуем
            return None
        X = np.array(good, dtype=np.float64)
        mean = X.mean(axis=0); std = X.std(axis=0); std[std == 0] = 1.0
        Z = (X - mean) / std
        Z[:, 0] *= 1.6  # высота голоса — главный признак
        order = np.argsort(Z[:, 0])
        c = np.array([Z[order[0]], Z[order[-1]]])  # инициализация по крайним
        labels = np.zeros(len(Z), dtype=int)
        for it in range(30):
            d0 = ((Z - c[0]) ** 2).sum(axis=1); d1 = ((Z - c[1]) ** 2).sum(axis=1)
            newl = (d1 < d0).astype(int)
            if it > 0 and np.array_equal(newl, labels):
                labels = newl; break
            labels = newl
            for k in range(2):
                if (labels == k).any():
                    c[k] = Z[labels == k].mean(axis=0)
        # вырожденное разделение (почти совпавшие центроиды: узкополосный шум/музыка,
        # неразличимые признаки) — кластерам верить нельзя, отдаём фолбэку по паузам
        if float(np.linalg.norm(c[0] - c[1])) < 1.0:
            print("[worker] speaker-cluster: центроиды не разделились — фолбэк на паузы")
            return None
        # разложим метки обратно на все сегменты (None → та же, что у предыдущего)
        gpos = 0; seg_lbl: list = []
        for f in feats:
            if f is None:
                seg_lbl.append(None)
            else:
                seg_lbl.append(int(labels[gpos])); gpos += 1
        first = next((lb for lb in seg_lbl if lb is not None), 0)  # первый голос = A
        out: list = []; last = "A"
        for lb in seg_lbl:
            if lb is None:
                out.append(last)
            else:
                last = "A" if lb == first else "B"; out.append(last)
        return out
    except Exception as e:  # noqa: BLE001
        print(f"[worker] speaker-cluster error: {e}")
        return None


def _diarize_audio(input_path: str, work: Path, hf_token: Optional[str] = None) -> Tuple[list, str]:
    """
    Транскрипция (faster-whisper) + разбивка на 2 спикера → ([{speaker,text,start,end}], method).
    Приоритет: pyannote (если hf_token+pyannote) → акустическая кластеризация (numpy, оффлайн) →
    разделение по паузам. Общая для /diarize и сборки podcast_compose.
    """
    _, data, note = run_tool("transcriber", {"input_path": input_path, "output_dir": str(work)})
    raw = (data or {}).get("segments") or []
    if not raw:
        return [], f"транскрипт пуст ({note or 'нет речи'})"
    turns = _pyannote_turns(input_path, hf_token)
    lines: list = []
    if turns:
        label_map: dict = {}

        def to_ab(lbl: str) -> str:
            if lbl not in label_map:
                label_map[lbl] = "A" if len(label_map) == 0 else "B"
            return label_map[lbl]

        for s in raw:
            try:
                start = float(s.get("start", 0) or 0); end = float(s.get("end", 0) or 0)
                text = str(s.get("text", "") or "").strip()
            except Exception:  # noqa: BLE001
                continue
            if not text:
                continue
            lbl = _overlap_speaker(turns, start, end)
            spk = to_ab(lbl) if lbl is not None else (lines[-1]["speaker"] if lines else "A")
            # не склеиваем клип дольше ~7с — иначе на таймлайне один гигантский блок вместо реплик
            if lines and lines[-1]["speaker"] == spk and (end - lines[-1]["start"]) <= 7.0:
                lines[-1]["text"] += " " + text; lines[-1]["end"] = end
            else:
                lines.append({"speaker": spk, "text": text, "start": start, "end": end})
        method = "pyannote 3.1 (HF)"
    else:
        # 2) Бестокенная акустическая кластеризация (высота голоса + тембр) — по всей записи.
        cl = _cluster_speakers(input_path, raw, work)
        if cl and len(cl) == len(raw):
            for idx, s in enumerate(raw):
                try:
                    start = float(s.get("start", 0) or 0); end = float(s.get("end", 0) or 0)
                    text = str(s.get("text", "") or "").strip()
                except Exception:  # noqa: BLE001
                    continue
                if not text:
                    continue
                spk = cl[idx] if cl[idx] in ("A", "B") else "A"
                # не склеиваем клип дольше ~7с — для дробного таймлайна
                if lines and lines[-1]["speaker"] == spk and (end - lines[-1]["start"]) <= 7.0:
                    lines[-1]["text"] += " " + text; lines[-1]["end"] = end
                else:
                    lines.append({"speaker": spk, "text": text, "start": start, "end": end})
            method = "whisper + акустическая кластеризация (2 голоса)"
        if not lines:
            # 3) Фолбэк — разделение по паузам.
            GAP = 0.8
            speaker = "A"
            prev_end = None
            for s in raw:
                try:
                    start = float(s.get("start", 0) or 0); end = float(s.get("end", 0) or 0)
                    text = str(s.get("text", "") or "").strip()
                except Exception:  # noqa: BLE001
                    continue
                if not text:
                    continue
                if prev_end is not None and (start - prev_end) > GAP:
                    speaker = "B" if speaker == "A" else "A"
                if lines and lines[-1]["speaker"] == speaker and (end - lines[-1]["start"]) <= 7.0:
                    lines[-1]["text"] += " " + text; lines[-1]["end"] = end
                else:
                    lines.append({"speaker": speaker, "text": text, "start": start, "end": end})
                prev_end = end
            method = "whisper+паузы" + (" (pyannote недоступен)" if hf_token else "")
    return lines, method


@app.post("/diarize")
def diarize(body: DiarizeBody):
    """
    Разбирает запись подкаста на 2 голоса → реплики [{speaker:'A'|'B', text, start, end}].

    При наличии hf_token и установленного pyannote.audio — настоящая диаризация
    pyannote/speaker-diarization-3.1 (HuggingFace), спикеры сопоставляются с whisper-
    сегментами по перекрытию. Иначе — фолбэк: транскрипция + разделение по паузам.
    """
    if registry is None:
        return {"lines": [], "tracks": [], "note": "registry не загружен"}
    _sweep_workdirs()
    job = uuid.uuid4().hex
    work = WORK_DIR / job
    work.mkdir(parents=True, exist_ok=True)
    url = _abs_url(body.base_url, body.input_url) or body.input_url
    ext = os.path.splitext(urllib.parse.urlparse(url).path)[1] or ".mp3"
    input_path = str(work / f"input{ext}")
    try:
        _download(url, Path(input_path))
    except Exception as e:  # noqa: BLE001
        return {"lines": [], "tracks": [], "note": f"вход не скачался: {e}"}

    lines, method = _diarize_audio(input_path, work, body.hf_token)
    if not lines:
        return {"lines": [], "tracks": [], "note": f"диаризация: {method}"}
    return {"lines": lines, "tracks": [], "note": f"диаризация: {len(lines)} реплик ({method})"}


@app.get("/files/{name}")
def files(name: str):
    p = (FILES_DIR / name).resolve()
    if p.parent != FILES_DIR.resolve() or not p.exists():
        raise HTTPException(status_code=404, detail="not found")
    mime = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
    return FileResponse(str(p), media_type=mime, filename=name)
