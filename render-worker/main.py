"""
TrendTraffic — Python-обёртка OpenMontage (рендер-воркер, FastAPI).

Web-VPS оркестратор шлёт сюда по ОДНОМУ шагу плана (по Tailscale). Воркер:
  1) скачивает вход (input_url с web-VPS),
  2) вызывает инструмент OpenMontage: registry.get(tool).execute(inputs) -> ToolResult,
  3) кладёт результат в files-папку и отдаёт имя; web-VPS забирает его GET /files/<name>.

Безопасность: слушать ТОЛЬКО Tailscale-адрес (WORKER_HOST=100.x) — наружу не торчим.
Запуск: uvicorn main:app --host $WORKER_HOST --port $WORKER_PORT  (см. install.sh / systemd).

v1: универсальный диспетчер. Точная карта inputs под каждый инструмент OpenMontage
дорабатывается на первых реальных прогонах (видно по note каждого шага). Любая
неуверенность → passthrough (вход = выход) + note, чтобы конвейер не падал целиком.
"""
import os
import sys
import uuid
import shutil
import mimetypes
import urllib.request
import urllib.parse
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

OPENMONTAGE_DIR = os.environ.get("OPENMONTAGE_DIR", "/opt/openmontage")
WORK_DIR = Path(os.environ.get("RENDER_WORK_DIR", os.path.join(OPENMONTAGE_DIR, "projects", "_trendtraffic")))
FILES_DIR = WORK_DIR / "out"
FILES_DIR.mkdir(parents=True, exist_ok=True)

MEDIA_EXT = (".mp4", ".mov", ".webm", ".mkv", ".wav", ".mp3", ".m4a", ".png", ".jpg", ".jpeg", ".srt")

# ── Загрузка реестра OpenMontage в этом же интерпретаторе ────────────────────
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


@app.get("/health")
def health():
    return {"ok": registry is not None, "tools": len(TOOLS), "openmontage_dir": OPENMONTAGE_DIR}


def _download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "trendtraffic-render-worker"})
    with urllib.request.urlopen(req, timeout=180) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f)


def _find_output(data) -> Optional[str]:
    """Ищет путь к произведённому файлу в ToolResult.data (разные инструменты называют по-разному)."""
    if not isinstance(data, dict):
        return None
    for k in ("output_path", "output", "path", "video", "file", "result", "out_path", "video_path", "audio_path"):
        v = data.get(k)
        if isinstance(v, str) and os.path.exists(v):
            return v
    for v in data.values():
        if isinstance(v, str) and os.path.exists(v) and os.path.splitext(v)[1].lower() in MEDIA_EXT:
            return v
    return None


def _passthrough(note: str) -> dict:
    return {"skipped": False, "output_name": None, "note": note}


@app.post("/execute")
def execute(body: ExecBody):
    job = body.job_id or uuid.uuid4().hex
    work = WORK_DIR / job
    work.mkdir(parents=True, exist_ok=True)

    # 1) вход
    input_path: Optional[str] = None
    if body.input_url:
        ext = os.path.splitext(urllib.parse.urlparse(body.input_url).path)[1] or ".mp4"
        input_path = str(work / f"input{ext}")
        try:
            _download(body.input_url, Path(input_path))
        except Exception as e:  # noqa: BLE001
            return _passthrough(f"вход не скачался: {e}")

    # 2) реестр
    if registry is None:
        return _passthrough("OpenMontage registry не загружен — passthrough")
    tool = registry.get(body.tool)
    if tool is None:
        return _passthrough(f"инструмент '{body.tool}' не найден в реестре — passthrough")

    # 3) inputs (best-effort: вход + параметры узла + рабочая папка)
    inputs = dict(body.params or {})
    if input_path:
        inputs.setdefault("input_path", input_path)
        inputs.setdefault("input", input_path)
        inputs.setdefault("video_path", input_path)
    inputs.setdefault("output_dir", str(work))
    inputs.setdefault("work_dir", str(work))

    # 4) выполнить
    try:
        result = tool.execute(inputs)
    except Exception as e:  # noqa: BLE001
        return _passthrough(f"{body.tool}: ошибка execute — {e} (passthrough)")

    if getattr(result, "success", None) is False:
        return _passthrough(f"{body.tool}: {getattr(result, 'error', None) or 'не успех'} (passthrough)")

    out = _find_output(getattr(result, "data", None))
    if not out:
        return _passthrough(f"{body.tool}: выполнен, файл-результат не найден (passthrough)")

    # 5) в files-папку под уникальным именем
    name = f"{job}-{uuid.uuid4().hex[:8]}{os.path.splitext(out)[1] or '.mp4'}"
    shutil.copyfile(out, FILES_DIR / name)
    return {"skipped": False, "output_name": name, "note": f"{body.tool}: готово"}


@app.get("/files/{name}")
def files(name: str):
    p = (FILES_DIR / name).resolve()
    if p.parent != FILES_DIR.resolve() or not p.exists():
        raise HTTPException(status_code=404, detail="not found")
    mime = mimetypes.guess_type(str(p))[0] or "application/octet-stream"
    return FileResponse(str(p), media_type=mime, filename=name)
