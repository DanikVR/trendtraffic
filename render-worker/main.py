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
  color→color_grade · export→video_compose · broll→clip_search(passthrough) ·
  news/research→passthrough (наша LLM-сторона) · avatar/upscale→GPU (сюда не маршрутятся).
"""
import os
import re
import sys
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
    req = urllib.request.Request(url, headers={"User-Agent": "trendtraffic-render-worker"})
    with urllib.request.urlopen(req, timeout=180) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)


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
        amap = {"9:16": "9:16", "16:9": "16:9", "1:1": "1:1", "4:5": "9:16", "21:9": "16:9"}
        orient = (choices.get("orient") or ["9:16"])[0]
        f, _, n = run_tool("auto_reframe", {"input_path": input_path, "output_path": out(),
                                            "target_aspect": amap.get(orient, "9:16")})
        return (f, n or "формат")

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

    if step_tool == "audio_mixer":  # audio: музыка + дакинг
        if not media:
            return None, "аудио: музыка не выбрана — passthrough"
        mp = _download_media(base_url, media, work, default_ext=".mp3")
        if not mp:
            return None, "аудио: музыка не скачалась"
        vol = {"low": 0.10, "mid": 0.20, "high": 0.35}.get((choices.get("vol") or ["mid"])[0], 0.20)
        f, _, n = run_tool("audio_mixer", {"operation": "segmented_music", "video_path": input_path,
                                           "music_path": mp, "music_volume": vol, "output_path": out()})
        return (f, n or "аудио")

    if step_tool == "tts":  # voiceover: piper → подмешать как аудио дорожку видео
        if not text:
            return None, "озвучка: нет текста — passthrough"
        wav, _, n = run_tool("piper_tts", {"text": text, "output_path": out(".wav")})
        if not wav:
            return None, f"озвучка: tts не создан ({n or ''})"
        f, _, cn = run_tool("video_compose", {"operation": "encode", "input_path": input_path,
                                              "audio_path": wav, "output_path": out()})
        return (f, cn or "озвучка")

    if step_tool == "color_grade":  # color (схема enhancement/ — best-effort)
        preset = (choices.get("preset") or ["none"])[0]
        if preset == "none":
            return None, "цвет: без изменений"
        f, _, n = run_tool("color_grade", {"input_path": input_path, "output_path": out(),
                                           "preset": preset, "look": preset})
        return (f, n or "цветокор")

    if step_tool == "video_compose":  # export
        plats = choices.get("platforms") or []
        inp = {"operation": "encode", "input_path": input_path, "output_path": out()}
        if plats:
            inp["profile"] = plats[0]
        f, _, n = run_tool("video_compose", inp)
        return (f, n or "экспорт")

    if step_tool == "upscale":  # upscale (GPU RealESRGAN; есть CPU-фолбэк)
        sc = (choices.get("scale") or ["off"])[0]
        if sc == "off":
            return None, "апскейл: выключен — passthrough"
        scale = 4 if sc == "4" else 2
        f, _, n = run_tool("upscale", {"input_path": input_path, "output_path": out(), "scale": scale})
        return (f, n or f"апскейл ×{scale}")

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

    # broll(clip_search) / news_source / web_research — наша LLM-сторона / стоки (passthrough)
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


def _cut_audio(src: str, start: float, end: float, out_path: str) -> Optional[str]:
    """Вырезает [start,end] из записи в моно-wav 22.05кГц (для сохранения реального голоса)."""
    dur = max(0.15, end - start)
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
                 audio: str, cut: Optional[str], anim: str, out_path: str) -> Optional[str]:
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
        inputs += ["-loop", "1", "-i", cut]  # 3: картинка к фразе
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
    cmd = [FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
           "-r", "30", "-pix_fmt", "yuv420p",
           "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac", out_path]
    ok, err = _run(cmd, timeout=1800)
    if not (ok and os.path.exists(out_path)):
        print(f"[worker] pod concat ffmpeg failed: {err[:300]}")
        return None
    return out_path


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

    # Разбор записи: при source='diarize' и наличии записи берём РЕАЛЬНЫЙ голос —
    # нарезаем дорожку по таймкодам реплик (а не ре-синтез TTS).
    rec_path = None
    if pod.get("source") == "diarize" and pod.get("recordingUrl"):
        rec_path = _download_media(base_url, pod.get("recordingUrl"), work, default_ext=".mp3")

    lines = [l for l in (pod.get("dialogue") or [])
             if isinstance(l, dict) and str(l.get("text") or "").strip()]
    # Реплик нет, но это разбор записи → диаризуем сами (одной кнопки «Собрать» достаточно).
    if not lines and rec_path:
        dlines, _m = _diarize_audio(rec_path, work, None)
        lines = [l for l in dlines if str(l.get("text") or "").strip()]
    if not lines:
        return None, "подкаст: нет реплик (разберите запись / сгенерируйте диалог) — passthrough"

    has_talking = registry.get("talking_head") is not None
    segments: list = []
    notes: list = []
    used_heads = 0
    used_real = 0
    used_imgs = 0
    for i, l in enumerate(lines):
        spk = "B" if l.get("speaker") == "B" else "A"
        voice = (host_b if spk == "B" else host_a).get("voice") or "female"
        text = str(l.get("text")).strip()
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
        # картинка к фразе (B-roll) с выездом; «auto» → со стороны говорящего (A слева, B справа)
        limg = _download_media(base_url, l.get("image"), work, default_ext=".jpg") if l.get("image") else None
        lanim = str(l.get("anim") or "auto")
        if lanim == "auto":
            lanim = "slide-left" if spk == "A" else "slide-right"
        if limg:
            used_imgs += 1
        seg = _pod_segment(left, left_v, right, right_v, wav, limg, lanim, out())
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
    return final, f"подкаст-сплит-скрин: {len(segments)} сегм., {head_note}, {audio_note}, картинок {used_imgs}{extra}"


@app.post("/execute")
def execute(body: ExecBody):
    job = body.job_id or uuid.uuid4().hex
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


def _diarize_audio(input_path: str, work: Path, hf_token: Optional[str] = None) -> Tuple[list, str]:
    """
    Транскрипция (faster-whisper) + разбивка на 2 спикера → ([{speaker,text,start,end}], method).
    С hf_token+pyannote — настоящая диаризация (сопоставление по перекрытию); иначе — по паузам.
    Общая для эндпоинта /diarize и сборки podcast_compose (одной кнопки «Собрать» достаточно).
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
            if lines and lines[-1]["speaker"] == spk:
                lines[-1]["text"] += " " + text; lines[-1]["end"] = end
            else:
                lines.append({"speaker": spk, "text": text, "start": start, "end": end})
        method = "pyannote 3.1 (HF)"
    else:
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
            if lines and lines[-1]["speaker"] == speaker:
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
