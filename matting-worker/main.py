# TrendTraffic Matting Worker — ИИ-вырезка фона видео (RobustVideoMatting, GPU).
#
# Зачем: UGC-студия, источник аватара «Готовое видео» — вырезать ЛЮБОЙ фон (комната,
# улица), а не только однотонный хромакей. Веб-VPS без GPU → считаем здесь (WSL на
# домашнем ПК, RTX 5080), бэкенд ходит по Tailscale через форвардер (порт 8801).
#
# API (async job+poll — тот же паттерн, что старый /avatar: инференс идёт минуты,
# держать HTTP-соединение нельзя — рвётся по таймаутам fetch/undici/форвардера):
#   GET  /health                → {ok, device, variant, jobs}
#   POST /matting {video_url}   → {job_id, status: "processing"}
#   GET  /matting/status?job=   → {status: processing|done|failed, progress, output_name, error}
#   GET  /files/{name}          → готовый webm (VP9 + альфа-канал, yuva420p, без звука)
#
# Выход — ровно тот артефакт, который composeUgc умеет как avatarKind='alpha'
# (декод `-c:v libvpx-vp9` до -i, силуэт во всех ветках). Звук бэкенд берёт из
# ИСХОДНОГО ролика (voicePath) — сюда аудио не кладём.
#
# Инференс БЕЗ av/pims (конвертер RVM их требует, а колёса под свежий Python капризны):
# свой цикл через ffmpeg-пайпы — decode rawvideo RGB → рекуррентная модель RVM
# (fgr+pha) → RGBA rawvideo → libvpx-vp9. Память O(seq_chunk), длина клипа не ограничена
# VRAM (модель рекуррентная), процесс один на джоб.

import json
import os
import re
import shutil
import subprocess
import threading
import time
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="tt-matting")

WORK_DIR = Path(os.environ.get("MATTING_WORK_DIR", "/opt/tt-matting/work"))
FILES_DIR = WORK_DIR / "out"
JOBS_DIR = WORK_DIR / "jobs"
for d in (FILES_DIR, JOBS_DIR):
    d.mkdir(parents=True, exist_ok=True)

VARIANT = os.environ.get("MATTING_VARIANT", "mobilenetv3")  # mobilenetv3 (быстро) | resnet50 (чуть чище края)
MAX_SIDE = int(os.environ.get("MATTING_MAX_SIDE", "1920"))  # больше — даунскейлим (вход и выход)
MAX_SEC = float(os.environ.get("MATTING_MAX_SEC", "600"))   # потолок длительности клипа
SEQ_CHUNK = int(os.environ.get("MATTING_SEQ_CHUNK", "8"))   # кадров за форвард (GPU-эффективность)

_jobs: dict = {}
_gpu_lock = threading.Lock()   # одна GPU-задача за раз (соседи по GPU: браузер/другие воркеры)
_model = None
_model_lock = threading.Lock()
_device = None
_dtype = None


def _load_model():
    """Ленивая загрузка RVM (torch.hub кэширует репо+веса в ~/.cache/torch)."""
    global _model, _device, _dtype
    with _model_lock:
        if _model is not None:
            return _model
        import torch  # noqa: PLC0415
        _device = "cuda" if torch.cuda.is_available() else "cpu"
        _dtype = torch.float16 if _device == "cuda" else torch.float32
        m = torch.hub.load("PeterL1n/RobustVideoMatting", VARIANT, trust_repo=True)
        _model = m.to(device=_device, dtype=_dtype).eval()
        print(f"[matting] модель {VARIANT} загружена на {_device}", flush=True)
        return _model


def _job_write(job_id: str, data: dict) -> None:
    """Статус на диск: переживает рестарт сервиса (реанимация — _requeue_unfinished)."""
    try:
        with open(JOBS_DIR / (job_id + ".json"), "w") as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception as e:  # noqa: BLE001
        print(f"[matting] не записал джоб {job_id}: {e}", flush=True)


def _sweep_old() -> None:
    cutoff = time.time() - 48 * 3600
    for d in (FILES_DIR, JOBS_DIR):
        try:
            for p in d.iterdir():
                if p.stat().st_mtime < cutoff:
                    p.unlink()
        except Exception:  # noqa: BLE001
            pass
    for k in [k for k, v in list(_jobs.items()) if v.get("ts", 0) < cutoff]:
        _jobs.pop(k, None)


def _download(url: str, dest: Path) -> None:
    if not re.match(r"^https?://", url, re.I):
        raise ValueError("только http/https URL")
    req = urllib.request.Request(url, headers={"User-Agent": "tt-matting/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        shutil.copyfileobj(r, f, length=1 << 20)


def _probe(path: Path) -> dict:
    """ffprobe → {width, height, fps, duration}."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,avg_frame_rate:format=duration",
         "-of", "json", str(path)],
        capture_output=True, text=True, timeout=60,
    )
    j = json.loads(out.stdout or "{}")
    st = (j.get("streams") or [{}])[0]
    num, _, den = str(st.get("avg_frame_rate") or "30/1").partition("/")
    try:
        fps = float(num) / float(den or 1)
    except (ValueError, ZeroDivisionError):
        fps = 30.0
    if not (1 <= fps <= 120):
        fps = 30.0
    return {
        "width": int(st.get("width") or 0),
        "height": int(st.get("height") or 0),
        "fps": fps,
        "duration": float((j.get("format") or {}).get("duration") or 0),
    }


def _run_matting(job_id: str, in_path: Path, out_path: Path) -> None:
    """Декод → RVM (рекуррентно, чанками) → RGBA → libvpx-vp9 webm с альфой."""
    import numpy as np  # noqa: PLC0415
    import torch  # noqa: PLC0415

    info = _probe(in_path)
    W0, H0, fps, dur = info["width"], info["height"], info["fps"], info["duration"]
    if W0 < 16 or H0 < 16:
        raise RuntimeError("не удалось прочитать видео (нет видеопотока?)")
    if dur > MAX_SEC:
        raise RuntimeError(f"клип слишком длинный ({dur:.0f}с > {MAX_SEC:.0f}с)")
    # Кап разрешения + чётные стороны (yuva420p требует чётные W/H).
    scale = min(1.0, MAX_SIDE / max(W0, H0))
    W = max(16, int(W0 * scale) // 2 * 2)
    H = max(16, int(H0 * scale) // 2 * 2)
    fps_r = round(fps, 3)
    total = max(1, int(dur * fps_r))
    # Матте считается на даунсемпле (рекомендация RVM: ~512 по большой стороне),
    # результат применяется к полному разрешению — края остаются чёткими.
    downsample = min(1.0, 512.0 / max(W, H))

    model = _load_model()
    frame_bytes = W * H * 3

    dec = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", str(in_path),
         "-vf", f"scale={W}:{H}:flags=lanczos,fps={fps_r}",
         "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
    )
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y",
         "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-r", f"{fps_r}", "-i", "-",
         "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
         "-crf", "32", "-b:v", "0", "-cpu-used", "6", "-row-mt", "1", "-an",
         str(out_path)],
        stdin=subprocess.PIPE, stderr=subprocess.PIPE,
    )
    done_frames = 0
    try:
        rec = [None] * 4  # рекуррентное состояние RVM
        while True:
            raw = dec.stdout.read(frame_bytes * SEQ_CHUNK)
            if not raw:
                break
            n = len(raw) // frame_bytes
            if n == 0:
                break
            arr = np.frombuffer(raw[: n * frame_bytes], dtype=np.uint8).reshape(n, H, W, 3)
            src = torch.from_numpy(arr).permute(0, 3, 1, 2).to(_device, _dtype) / 255.0
            with torch.no_grad():
                fgr, pha, *rec = model(src, *rec, downsample)
            rgba = torch.cat([fgr, pha], dim=1).clamp_(0, 1).mul_(255).byte()
            rgba = rgba.permute(0, 2, 3, 1).contiguous().cpu().numpy()
            enc.stdin.write(rgba.tobytes())
            done_frames += n
            j = _jobs.get(job_id)
            if j is not None:
                j["progress"] = min(99, int(done_frames * 100 / total))
    finally:
        # закрыть пайпы аккуратно; сбои закрытия не должны маскировать исходную ошибку
        for closer in (lambda: dec.stdout.close(), lambda: enc.stdin.close()):
            try:
                closer()
            except Exception:  # noqa: BLE001
                pass
        try:
            dec.wait(timeout=30)
        except Exception:  # noqa: BLE001
            dec.kill()
    if done_frames == 0:
        enc.kill()
        raise RuntimeError("из видео не декодировалось ни одного кадра (битый файл?)")
    _, enc_err = enc.communicate(timeout=600)
    if enc.returncode != 0:
        raise RuntimeError(f"vp9-энкод не удался: {(enc_err or b'').decode(errors='replace')[-300:]}")


class MattingBody(BaseModel):
    video_url: str
    # запас на будущее: вариант модели на конкретный джоб (дефолт — env VARIANT)
    variant: Optional[str] = None


def _matting_run(job_id: str, body: MattingBody) -> None:
    res: dict = {"ts": time.time()}
    work = WORK_DIR / ("mat_" + uuid.uuid4().hex[:8])
    try:
        work.mkdir(parents=True, exist_ok=True)
        ext = os.path.splitext(urllib.parse.urlparse(body.video_url).path)[1] or ".mp4"
        src = work / ("in" + ext)
        _download(body.video_url, src)
        out_name = f"matting-{uuid.uuid4().hex[:8]}.webm"
        # Одна GPU-задача за раз: параллельные джобы ждут на локе (статус 'processing').
        with _gpu_lock:
            _run_matting(job_id, src, FILES_DIR / out_name)
        res.update({"status": "done", "output_name": out_name})
    except Exception as e:  # noqa: BLE001
        res.update({"status": "failed", "error": str(e)[:400]})
        print(f"[matting] джоб {job_id} упал: {e}", flush=True)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    prev = _jobs.get(job_id) or {}
    res["progress"] = 100 if res.get("status") == "done" else prev.get("progress", 0)
    _jobs[job_id] = res
    _job_write(job_id, res)  # финал на диск: статус переживает рестарт сервиса


@app.get("/health")
def health():
    try:
        import torch  # noqa: PLC0415
        device = "cuda" if torch.cuda.is_available() else "cpu"
    except Exception:  # noqa: BLE001
        device = "no-torch"
    active = sum(1 for v in _jobs.values() if v.get("status") == "processing")
    return {"ok": device == "cuda", "engine": "rvm", "variant": VARIANT, "device": device, "jobs": active}


@app.post("/matting")
def matting(body: MattingBody):
    """Запустить вырезку фона в ФОНЕ → {job_id}. Статус/результат — GET /matting/status?job=."""
    _sweep_old()
    job_id = "mat_" + uuid.uuid4().hex[:10]
    _jobs[job_id] = {"status": "processing", "progress": 0, "ts": time.time()}
    # спека на диск ДО старта треда: рестарт сервиса mid-render → джоб реанимируется с тем же id
    _job_write(job_id, {"status": "processing", "ts": time.time(), "body": body.model_dump()})
    threading.Thread(target=_matting_run, args=(job_id, body), daemon=True).start()
    return {"job_id": job_id, "status": "processing"}


@app.get("/matting/status")
def matting_status(job: str = ""):
    j = _jobs.get(job)
    if not j and re.fullmatch(r"mat_[0-9a-f]{10}", job or ""):
        try:  # память потеряна рестартом, но финал успел лечь на диск
            with open(JOBS_DIR / (job + ".json")) as f:
                j = json.load(f)
        except Exception:  # noqa: BLE001
            j = None
    if not j:
        return {"status": "not_found"}
    return {"status": j.get("status"), "progress": j.get("progress", 0),
            "output_name": j.get("output_name"), "error": j.get("error")}


@app.get("/files/{name}")
def files(name: str):
    p = (FILES_DIR / name).resolve()
    if p.parent != FILES_DIR.resolve() or not p.exists():
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(str(p), media_type="video/webm", filename=name)


def _requeue_unfinished() -> None:
    """Реанимация после рестарта: 'processing'-джобы с диска перезапускаются с ТЕМ ЖЕ job_id —
    бэкенд продолжает поллить и дождётся (урок старого /avatar: деплой не должен терять рендер)."""
    cutoff = time.time() - 6 * 3600
    for p in JOBS_DIR.glob("mat_*.json"):
        try:
            with open(p) as f:
                j = json.load(f)
            if j.get("status") != "processing" or j.get("ts", 0) < cutoff or "body" not in j:
                continue
            job_id = p.stem
            _jobs[job_id] = {"status": "processing", "progress": 0, "ts": j.get("ts") or time.time()}
            threading.Thread(target=_matting_run, args=(job_id, MattingBody(**j["body"])), daemon=True).start()
            print(f"[matting] реанимирован джоб {job_id}", flush=True)
        except Exception as e:  # noqa: BLE001
            print(f"[matting] реанимация {p.name} не удалась: {e}", flush=True)


_requeue_unfinished()
