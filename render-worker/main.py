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
                                "subtitle_gen", "color_grade", "video_compose", "audio_mixer", "tts")
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

    # broll(clip_search) / news_source / web_research / talking_head / upscale
    return None, f"{step_tool}: на CPU-воркере не выполняется — passthrough"


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


@app.get("/files/{name}")
def files(name: str):
    p = (FILES_DIR / name).resolve()
    if p.parent != FILES_DIR.resolve() or not p.exists():
        raise HTTPException(status_code=404, detail="not found")
    mime = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
    return FileResponse(str(p), media_type=mime, filename=name)
