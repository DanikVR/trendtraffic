"""
TrendTraffic — Hotebook-воркер: FastAPI-обёртка над notebooklm-py (неофициальный
клиент Google NotebookLM). Слушает только внутренний адрес (см. install.sh),
web-VPS ходит сюда без своей авторизации (замкнутая сеть, как render-worker).

Зачем обёртка, а не встроенный `notebooklm-server`: нам нужен учёт задач
генерации (поллинг из Node-бэкенда), стейджинг готовых файлов под скачивание,
классификация ошибок (auth / api_changed / quota / network) для «плашки
синхронизации» в UI и живучесть при протухших куках.

Сверено с notebooklm-py 0.7.3: методы client.notebooks/sources/chat/artifacts,
generate_slide_deck / generate_data_table, enum-параметры (AudioFormat и т.д.),
AskResult.references. При обновлении либы несовпавшие параметры не роняют
генерацию — сворачиваются текстом в instructions.

Авторизация Google: профиль notebooklm-py (NOTEBOOKLM_HOME, по умолчанию
~/.notebooklm). Логин выполняется отдельно (`notebooklm login` на машине с
браузером) либо импортом storage_state.json через POST /auth/import.

Эндпоинты:
  GET  /health                       — жив ли сервис + версия либы
  GET  /auth/status                  — реальная проверка сессии (list notebooks)
  POST /auth/import                  — {storage_state:{...}} → записать профиль
  POST /notebooks                    — {title} → создать блокнот
  GET  /notebooks                    — список
  POST /notebooks/{nb}/sources       — {kind:'url'|'text', url|title+content}
  POST /notebooks/{nb}/sources/file  — multipart-файл → источник
  GET  /notebooks/{nb}/sources       — список источников
  DELETE /notebooks/{nb}/sources/{sid}
  POST /notebooks/{nb}/chat          — {question} → {answer, citations}
  POST /notebooks/{nb}/generate      — {type, params} → {task_id} (фоновая задача)
  GET  /tasks/{task_id}              — статус/результат генерации
  GET  /files/{name}                 — скачать готовый артефакт
"""

import asyncio
import csv as _csv
import inspect
import json
import os
import re
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

try:
    from notebooklm import NotebookLMClient  # type: ignore
    _IMPORT_ERROR: Optional[str] = None
except Exception as e:  # noqa: BLE001 — либа могла не встать; /health это покажет
    NotebookLMClient = None  # type: ignore
    _IMPORT_ERROR = str(e)

try:
    from notebooklm.rpc import types as rpct  # enum-типы параметров генерации
except Exception:  # noqa: BLE001
    rpct = None  # type: ignore

app = FastAPI(title="TrendTraffic Hotebook Worker (NotebookLM)")

OUT_DIR = Path(os.environ.get("NOTEBOOKLM_OUT", str(Path(__file__).parent / "out")))
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Клиент: один на процесс (uvicorn = один event loop), пересоздаём при сбоях ──
_client = None
_client_lock = asyncio.Lock()


def _storage_state_path() -> Path:
    """Путь storage_state.json активного профиля (default), уважая NOTEBOOKLM_HOME."""
    home = Path(os.environ.get("NOTEBOOKLM_HOME", str(Path.home() / ".notebooklm")))
    profile = os.environ.get("NOTEBOOKLM_PROFILE", "default")
    return home / "profiles" / profile / "storage_state.json"


class AuthMissing(Exception):
    pass


async def get_client():
    global _client
    if NotebookLMClient is None:
        raise HTTPException(503, f"notebooklm-py не установлен: {_IMPORT_ERROR}")
    async with _client_lock:
        if _client is None:
            if not _storage_state_path().exists():
                raise AuthMissing("Google-аккаунт не подключён (нет storage_state.json)")
            c = NotebookLMClient.from_storage()
            _client = await c.__aenter__()
        return _client


async def drop_client():
    """Сбросить клиент (после auth-ошибки) — следующий вызов пересоздаст его."""
    global _client
    async with _client_lock:
        if _client is not None:
            try:
                await _client.__aexit__(None, None, None)
            except Exception:
                pass
            _client = None


# ── Классификация ошибок для «плашки синхронизации» ─────────────────────────
def classify_error(e: Exception) -> str:
    """'auth' | 'quota' | 'network' | 'api_changed' — что показывать в UI."""
    if isinstance(e, AuthMissing):
        return "auth"
    name = type(e).__name__.lower()
    text = (str(e) or "").lower()
    if any(k in text for k in ("quota", "limit reached", "rate limit", "too many")):
        return "quota"
    if any(k in name for k in ("auth", "login", "credential", "cookie", "session")) or \
       any(k in text for k in ("unauthorized", "sign in", "signin", "login", "401", "403", "cookie", "expired")):
        return "auth"
    if any(k in name for k in ("connect", "timeout", "network", "dns")) or \
       any(k in text for k in ("connection", "timed out", "temporarily unavailable", "503", "network")):
        return "network"
    # Непредвиденное (изменился внутренний RPC Google, битый парсинг ответа и т.п.)
    return "api_changed"


def jsonable(o: Any, depth: int = 0) -> Any:
    """Модели notebooklm-py → JSON (dataclass/pydantic/список/словарь/примитив/str)."""
    if depth > 6:
        return str(o)
    if o is None or isinstance(o, (bool, int, float, str)):
        return o
    if isinstance(o, (list, tuple)):
        return [jsonable(x, depth + 1) for x in o]
    if isinstance(o, dict):
        return {str(k): jsonable(v, depth + 1) for k, v in o.items()}
    for attr in ("model_dump", "dict"):
        fn = getattr(o, attr, None)
        if callable(fn):
            try:
                return jsonable(fn(), depth + 1)
            except Exception:
                pass
    if hasattr(o, "__dataclass_fields__"):
        import dataclasses
        try:
            return jsonable(dataclasses.asdict(o), depth + 1)
        except Exception:
            pass
    if hasattr(o, "__dict__") and o.__dict__:
        return {k: jsonable(v, depth + 1) for k, v in o.__dict__.items() if not k.startswith("_")}
    return str(o)


# ── Генерация артефактов ─────────────────────────────────────────────────────
TASKS: Dict[str, Dict[str, Any]] = {}

# Тип артефакта → методы generate/download, расширение, таймаут, payload-извлечение.
GEN_SPEC: Dict[str, Dict[str, Any]] = {
    "audio":       {"gen": "generate_audio",       "dl": "download_audio",       "ext": ".mp3",  "timeout": 1800},
    "video":       {"gen": "generate_video",       "dl": "download_video",       "ext": ".mp4",  "timeout": 2700},
    "slides":      {"gen": "generate_slide_deck",  "dl": "download_slide_deck",  "ext": ".pdf",  "timeout": 1800},
    "report":      {"gen": "generate_report",      "dl": "download_report",      "ext": ".md",   "timeout": 1200},
    "infographic": {"gen": "generate_infographic", "dl": "download_infographic", "ext": ".png",  "timeout": 1800},
    "quiz":        {"gen": "generate_quiz",        "dl": "download_quiz",        "ext": ".json", "timeout": 1200, "payload": "json"},
    "flashcards":  {"gen": "generate_flashcards",  "dl": "download_flashcards",  "ext": ".json", "timeout": 1200, "payload": "json"},
    "mindmap":     {"gen": "generate_mind_map",    "dl": "download_mind_map",    "ext": ".json", "timeout": 1200, "payload": "json"},
    "table":       {"gen": "generate_data_table",  "dl": "download_data_table",  "ext": ".csv",  "timeout": 1200, "payload": "csv"},
}


def to_enum(enum_name: str, v: Any):
    """'deep_dive' → AudioFormat.DEEP_DIVE (по имени или значению, без регистра)."""
    if rpct is None or v in (None, ""):
        return None
    E = getattr(rpct, enum_name, None)
    if E is None:
        return None
    s = str(v).strip().lower()
    for m in E:
        if m.name.lower() == s or str(m.value).lower() == s:
            return m
    return None


def build_gen_kwargs(gtype: str, fn, p: Dict[str, Any]) -> Dict[str, Any]:
    """kwargs generate_* из настроек UI; не поместившееся сворачивается в instructions."""
    try:
        params = set(inspect.signature(fn).parameters.keys())
    except (TypeError, ValueError):
        params = set()
    kw: Dict[str, Any] = {}
    folded: list = []

    def put(name: str, val: Any, ui_key: str):
        raw = p.get(ui_key)
        if val is not None and name in params:
            kw[name] = val
        elif raw not in (None, ""):
            folded.append((ui_key, raw))

    if "language" in params:
        kw["language"] = str(p.get("language") or "ru")
    elif p.get("language"):
        folded.append(("language", p.get("language")))

    if gtype == "audio":
        put("audio_format", to_enum("AudioFormat", p.get("format")), "format")
        put("audio_length", to_enum("AudioLength", p.get("length")), "length")
    elif gtype == "video":
        put("video_format", to_enum("VideoFormat", p.get("format")), "format")
        put("video_style", to_enum("VideoStyle", p.get("style")), "style")
    elif gtype == "slides":
        put("slide_format", to_enum("SlideDeckFormat", p.get("format")), "format")
        put("slide_length", to_enum("SlideDeckLength", p.get("length")), "length")
    elif gtype == "report":
        put("report_format", to_enum("ReportFormat", p.get("format")), "format")
    elif gtype in ("quiz", "flashcards"):
        put("quantity", to_enum("QuizQuantity", p.get("count")), "count")
        put("difficulty", to_enum("QuizDifficulty", p.get("difficulty")), "difficulty")
    elif gtype == "infographic":
        put("orientation", to_enum("InfographicOrientation", p.get("orientation")), "orientation")
        put("detail_level", to_enum("InfographicDetail", p.get("detail")), "detail")
        put("style", to_enum("InfographicStyle", p.get("style")), "style")

    focus = str(p.get("focus") or "").strip()
    if folded:  # непереданные параметры уходят текстовой инструкцией — NotebookLM их уважает
        note = ". ".join(f"{k}: {v}" for k, v in folded)
        focus = (focus + ". " if focus else "") + note
    if focus:
        for fk in ("instructions", "custom_prompt", "extra_instructions"):
            if fk in params:
                kw[fk] = focus
                break
    return kw


async def run_generation(task_id: str, nb: str, gtype: str, p: Dict[str, Any]):
    t = TASKS[task_id]
    t["status"] = "running"
    try:
        client = await get_client()
        arts = client.artifacts
        spec = GEN_SPEC[gtype]
        gen_fn = getattr(arts, spec["gen"], None)
        if gen_fn is None:
            raise RuntimeError(f"метод {spec['gen']} отсутствует в notebooklm-py (обновите библиотеку)")
        kw = build_gen_kwargs(gtype, gen_fn, p or {})
        t["kwargs_used"] = {k: getattr(v, "name", v) for k, v in kw.items()}
        status = await gen_fn(nb, **kw)

        # У ментальной карты результат приходит сразу (MindMapResult) — без задачи.
        gen_task_id = getattr(status, "task_id", None)
        t["remote_task_id"] = jsonable(gen_task_id)
        mind_map = getattr(status, "mind_map", None)
        if mind_map is not None:
            t["payload"] = jsonable(mind_map)
        if gen_task_id:
            await arts.wait_for_completion(nb, gen_task_id, timeout=float(spec["timeout"]))
        t["status"] = "downloading"

        fname = f"{task_id}{spec['ext']}"
        fpath = OUT_DIR / fname
        dl_fn = getattr(arts, spec["dl"], None)
        if dl_fn is None:
            raise RuntimeError(f"метод {spec['dl']} отсутствует в notebooklm-py")
        real = None
        if gen_task_id:
            try:
                real = await dl_fn(nb, str(fpath), gen_task_id)  # artifact_id = id задачи
            except Exception:
                real = None
        if real is None:
            real = await dl_fn(nb, str(fpath))  # без id → самый свежий артефакт типа
        if isinstance(real, str) and real and Path(real).exists() and Path(real) != fpath:
            src = Path(real)
            fname = src.name
            fpath = OUT_DIR / fname
            if src.parent != OUT_DIR:
                src.replace(fpath)

        if not fpath.exists() or fpath.stat().st_size == 0:
            raise RuntimeError("артефакт не скачался (пустой файл)")

        # Payload для интерактивных вьюверов в панели (тест/карточки/менталка/таблица).
        if spec.get("payload") == "json" and t.get("payload") is None:
            try:
                t["payload"] = json.loads(fpath.read_text(encoding="utf-8"))
            except Exception:
                pass
        elif spec.get("payload") == "csv":
            try:
                with fpath.open(encoding="utf-8", newline="") as fh:
                    rows = list(_csv.reader(fh))
                if rows:
                    t["payload"] = {"headers": rows[0], "rows": rows[1:200]}
            except Exception:
                pass

        t["file_name"] = fname
        t["size"] = fpath.stat().st_size
        t["status"] = "done"
    except Exception as e:  # noqa: BLE001
        kind = classify_error(e)
        t["status"] = "error"
        t["error"] = str(e) or type(e).__name__
        t["error_kind"] = kind
        if kind == "auth":
            await drop_client()
    finally:
        t["finished_at"] = time.time()


# ── Модели запросов ──────────────────────────────────────────────────────────
class NotebookIn(BaseModel):
    title: str


class SourceIn(BaseModel):
    kind: str  # 'url' | 'text'
    url: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None


class ChatIn(BaseModel):
    question: str


class GenerateIn(BaseModel):
    type: str
    params: Dict[str, Any] = {}


class AuthImportIn(BaseModel):
    storage_state: Dict[str, Any]


# ── Эндпоинты ────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    ver = None
    if NotebookLMClient is not None:
        try:
            import notebooklm  # type: ignore
            ver = getattr(notebooklm, "__version__", None)
        except Exception:
            pass
    return {
        "ok": NotebookLMClient is not None,
        "service": "hotebook-worker",
        "lib": ver,
        "lib_error": _IMPORT_ERROR,
        "auth_file": _storage_state_path().exists(),
        "tasks": len(TASKS),
    }


@app.get("/auth/status")
async def auth_status():
    """Живая проверка: дешёвый вызов API. Классифицирует поломку для плашки."""
    try:
        client = await get_client()
        notebooks = await client.notebooks.list()
        email = None
        try:
            st = json.loads(_storage_state_path().read_text(encoding="utf-8"))
            email = ((st.get("notebooklm") or {}).get("account") or {}).get("email")
        except Exception:
            pass
        return {"ok": True, "error_kind": None, "email": email, "notebooks": len(jsonable(notebooks) or [])}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        kind = classify_error(e)
        if kind == "auth":
            await drop_client()
        return {"ok": False, "error_kind": kind, "error": str(e) or type(e).__name__}


@app.post("/auth/import")
async def auth_import(body: AuthImportIn):
    """Записать storage_state.json (куки Google) и пересоздать клиент."""
    ss = body.storage_state
    if not isinstance(ss, dict) or not isinstance(ss.get("cookies"), list) or not ss["cookies"]:
        raise HTTPException(400, "Ожидается JSON storage_state с массивом cookies")
    path = _storage_state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(ss, ensure_ascii=False, indent=1), encoding="utf-8")
    try:
        os.chmod(path, 0o600)
    except Exception:
        pass
    await drop_client()
    return await auth_status()


def _wrap_api_error(e: Exception):
    kind = classify_error(e)
    raise HTTPException(502, detail={"error": str(e) or type(e).__name__, "error_kind": kind})


@app.post("/notebooks")
async def create_notebook(body: NotebookIn):
    try:
        client = await get_client()
        nb = await client.notebooks.create(body.title)
        return {"notebook": jsonable(nb)}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        if classify_error(e) == "auth":
            await drop_client()
        _wrap_api_error(e)


@app.get("/notebooks")
async def list_notebooks():
    try:
        client = await get_client()
        return {"notebooks": jsonable(await client.notebooks.list())}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        _wrap_api_error(e)


@app.post("/notebooks/{nb}/sources")
async def add_source(nb: str, body: SourceIn):
    try:
        client = await get_client()
        if body.kind == "url":
            if not body.url:
                raise HTTPException(400, "url обязателен")
            src = await client.sources.add_url(nb, body.url)
        elif body.kind == "text":
            if not body.content:
                raise HTTPException(400, "content обязателен")
            src = await client.sources.add_text(nb, body.title or "Текст", body.content)
        else:
            raise HTTPException(400, f"неизвестный kind: {body.kind}")
        return {"source": jsonable(src)}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        if classify_error(e) == "auth":
            await drop_client()
        _wrap_api_error(e)


@app.post("/notebooks/{nb}/sources/file")
async def add_source_file(nb: str, file: UploadFile = File(...)):
    tmp = OUT_DIR / f"up-{uuid.uuid4().hex}-{re.sub(r'[^A-Za-z0-9._-]', '_', file.filename or 'file')}"
    try:
        tmp.write_bytes(await file.read())
        client = await get_client()
        src = await client.sources.add_file(nb, str(tmp))
        return {"source": jsonable(src)}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        if classify_error(e) == "auth":
            await drop_client()
        _wrap_api_error(e)
    finally:
        try:
            tmp.unlink(missing_ok=True)
        except Exception:
            pass


@app.get("/notebooks/{nb}/sources")
async def list_sources(nb: str):
    try:
        client = await get_client()
        return {"sources": jsonable(await client.sources.list(nb))}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        _wrap_api_error(e)


@app.delete("/notebooks/{nb}/sources/{sid}")
async def delete_source(nb: str, sid: str):
    try:
        client = await get_client()
        await client.sources.delete(nb, sid)
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        _wrap_api_error(e)


@app.post("/notebooks/{nb}/chat")
async def chat(nb: str, body: ChatIn):
    try:
        client = await get_client()
        r = await client.chat.ask(nb, body.question)
        return {
            "answer": jsonable(getattr(r, "answer", None)) or jsonable(r),
            "citations": jsonable(getattr(r, "references", None)),
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        if classify_error(e) == "auth":
            await drop_client()
        _wrap_api_error(e)


@app.post("/notebooks/{nb}/generate")
async def generate(nb: str, body: GenerateIn):
    gtype = body.type
    if gtype not in GEN_SPEC:
        raise HTTPException(400, f"неизвестный тип артефакта: {gtype}")
    task_id = uuid.uuid4().hex
    TASKS[task_id] = {
        "status": "queued", "type": gtype, "notebook": nb,
        "params": body.params, "created_at": time.time(),
    }
    asyncio.create_task(run_generation(task_id, nb, gtype, body.params or {}))
    # Подчистка стариков (реестр в памяти; файлы живут в OUT_DIR до забора).
    if len(TASKS) > 400:
        for k in sorted(TASKS, key=lambda k: TASKS[k].get("created_at", 0))[:100]:
            TASKS.pop(k, None)
    return {"task_id": task_id}


@app.get("/tasks/{task_id}")
async def task_state(task_id: str):
    t = TASKS.get(task_id)
    if not t:
        raise HTTPException(404, "задача не найдена (воркер перезапускался?)")
    return {"task": t}


@app.get("/files/{name}")
async def get_file(name: str):
    if "/" in name or "\\" in name or ".." in name:
        raise HTTPException(400, "плохое имя файла")
    p = OUT_DIR / name
    if not p.exists():
        raise HTTPException(404, "файла нет")
    return FileResponse(str(p))
