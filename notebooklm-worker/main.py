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

Авторизация Google — ПЕР-ТЕНАНТНАЯ: у каждого Enterprise-тенанта свой профиль
notebooklm-py (свой Google-аккаунт, свои куки, свои лимиты и блокноты). Профиль
задаётся query-параметром ?profile=<tenantId> на ВСЕХ ручках (пусто → 'default').
Куки профиля лежат в NOTEBOOKLM_HOME/profiles/<profile>/storage_state.json.
Подключение: `notebooklm -p <profile> login` (окно на машине воркера) либо импорт
storage_state.json через POST /auth/import?profile=<tenantId>.

Эндпоинты (все принимают ?profile=<tenantId>):
  GET  /health                       — жив ли сервис + версия либы
  GET  /auth/status                  — реальная проверка сессии (list notebooks)
  POST /auth/import                  — {storage_state:{...}} → записать профиль
  POST /auth/adopt-default           — перенести сессию 'default' в профиль тенанта
  POST /auth/login-window            — открыть окно входа Google на машине воркера
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

# ── Клиенты ПЕР-ПРОФИЛЬ: каждый Enterprise-тенант = свой профиль notebooklm-py ──
# (свой Google-аккаунт, свои куки, свои лимиты и блокноты). profile = tenantId
# (или 'default' для обратной совместимости/платформенного). Кэш клиентов —
# словарь по имени профиля; один общий lock (создание клиента редкое).
_clients: Dict[str, Any] = {}
_client_lock = asyncio.Lock()

_HOME = Path(os.environ.get("NOTEBOOKLM_HOME", str(Path.home() / ".notebooklm")))


def _safe_profile(profile: Optional[str]) -> str:
    """tenantId → безопасное имя профиля (без обхода путей). Пусто → 'default'."""
    p = (profile or "").strip() or os.environ.get("NOTEBOOKLM_PROFILE", "default")
    p = re.sub(r"[^A-Za-z0-9_.-]", "_", p)
    return p or "default"


def _storage_state_path(profile: Optional[str] = None) -> Path:
    """Путь storage_state.json конкретного профиля, уважая NOTEBOOKLM_HOME."""
    return _HOME / "profiles" / _safe_profile(profile) / "storage_state.json"


class AuthMissing(Exception):
    pass


async def get_client(profile: Optional[str] = None):
    prof = _safe_profile(profile)
    if NotebookLMClient is None:
        raise HTTPException(503, f"notebooklm-py не установлен: {_IMPORT_ERROR}")
    async with _client_lock:
        if prof not in _clients:
            if not _storage_state_path(prof).exists():
                raise AuthMissing(f"Google-аккаунт не подключён (профиль {prof})")
            c = NotebookLMClient.from_storage(profile=prof)
            _clients[prof] = await c.__aenter__()
        return _clients[prof]


async def drop_client(profile: Optional[str] = None):
    """Сбросить клиент профиля (после auth-ошибки) — следующий вызов пересоздаст."""
    prof = _safe_profile(profile)
    async with _client_lock:
        c = _clients.pop(prof, None)
        if c is not None:
            try:
                await c.__aexit__(None, None, None)
            except Exception:
                pass


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


async def run_generation(task_id: str, nb: str, gtype: str, p: Dict[str, Any], profile: str = "default"):
    t = TASKS[task_id]
    t["status"] = "running"
    try:
        client = await get_client(profile)
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
            await drop_client(profile)
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


async def _auth_status(profile: str):
    """Живая проверка сессии профиля: дешёвый вызов API. Классифицирует поломку."""
    prof = _safe_profile(profile)
    try:
        client = await get_client(prof)
        notebooks = await client.notebooks.list()
        email = None
        try:
            st = json.loads(_storage_state_path(prof).read_text(encoding="utf-8"))
            email = ((st.get("notebooklm") or {}).get("account") or {}).get("email")
        except Exception:
            pass
        return {"ok": True, "error_kind": None, "email": email, "notebooks": len(jsonable(notebooks) or [])}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        kind = classify_error(e)
        if kind == "auth":
            await drop_client(prof)
        return {"ok": False, "error_kind": kind, "error": str(e) or type(e).__name__}


@app.get("/auth/status")
async def auth_status(profile: str = "default"):
    return await _auth_status(profile)


@app.post("/auth/import")
async def auth_import(body: AuthImportIn, profile: str = "default"):
    """Записать storage_state.json (куки Google) в профиль тенанта и пересоздать клиент."""
    ss = body.storage_state
    if not isinstance(ss, dict) or not isinstance(ss.get("cookies"), list) or not ss["cookies"]:
        raise HTTPException(400, "Ожидается JSON storage_state с массивом cookies")
    prof = _safe_profile(profile)
    path = _storage_state_path(prof)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(ss, ensure_ascii=False, indent=1), encoding="utf-8")
    try:
        os.chmod(path, 0o600)
    except Exception:
        pass
    await drop_client(prof)
    return await _auth_status(prof)


@app.post("/auth/adopt-default")
async def auth_adopt_default(profile: str = "default"):
    """Перенести существующую сессию профиля 'default' (старый платформенный вход,
    сделанный `notebooklm login`) в профиль тенанта — чтобы суперадмин, залогинившийся
    один раз, не логинился заново. Копирует storage_state.json + master_token.json."""
    prof = _safe_profile(profile)
    if prof == "default":
        return await _auth_status("default")
    src = _storage_state_path("default")
    if not src.exists():
        raise HTTPException(404, "нет сессии профиля default для переноса")
    dst = _storage_state_path(prof)
    if dst.exists():  # у тенанта уже своя сессия — не перетираем
        return await _auth_status(prof)
    dst.parent.mkdir(parents=True, exist_ok=True)
    import shutil
    shutil.copy2(src, dst)
    mt = src.parent / "master_token.json"
    if mt.exists():
        try:
            shutil.copy2(mt, dst.parent / "master_token.json")
        except Exception:
            pass
    await drop_client(prof)
    return await _auth_status(prof)


def _wrap_api_error(e: Exception):
    kind = classify_error(e)
    raise HTTPException(502, detail={"error": str(e) or type(e).__name__, "error_kind": kind})


@app.post("/auth/login-window")
async def auth_login_window(profile: str = "default"):
    """Открыть окно интерактивного входа Google НА МАШИНЕ ВОРКЕРА (WSLg/десктоп)
    для конкретного профиля тенанта.

    Запускает `notebooklm -p <profile> login` отдельным процессом: на экране машины
    воркера появляется Chromium, человек входит в Google, куки сохраняются в профиль.
    Не ждём (вход занимает минуты) — фронт жмёт «Проверить» / поллит /auth/status.
    """
    import subprocess
    import sys
    prof = _safe_profile(profile)
    exe = Path(sys.executable).parent / "notebooklm"
    base = str(exe) if exe.exists() else "notebooklm"
    cmd = [base, "-p", prof, "login"]
    env = dict(os.environ)
    env.setdefault("DISPLAY", ":0")
    try:
        subprocess.Popen(cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"не удалось открыть окно входа: {e}")
    return {"started": True, "note": "Окно Chromium открыто на машине воркера (ждёт входа до 5 минут)"}


@app.post("/notebooks")
async def create_notebook(body: NotebookIn, profile: str = "default"):
    try:
        client = await get_client(profile)
        nb = await client.notebooks.create(body.title)
        return {"notebook": jsonable(nb)}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        if classify_error(e) == "auth":
            await drop_client(profile)
        _wrap_api_error(e)


@app.get("/notebooks")
async def list_notebooks(profile: str = "default"):
    try:
        client = await get_client(profile)
        return {"notebooks": jsonable(await client.notebooks.list())}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        _wrap_api_error(e)


@app.post("/notebooks/{nb}/sources")
async def add_source(nb: str, body: SourceIn, profile: str = "default"):
    try:
        client = await get_client(profile)
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
            await drop_client(profile)
        _wrap_api_error(e)


@app.post("/notebooks/{nb}/sources/file")
async def add_source_file(nb: str, file: UploadFile = File(...), profile: str = "default"):
    tmp = OUT_DIR / f"up-{uuid.uuid4().hex}-{re.sub(r'[^A-Za-z0-9._-]', '_', file.filename or 'file')}"
    try:
        tmp.write_bytes(await file.read())
        client = await get_client(profile)
        src = await client.sources.add_file(nb, str(tmp))
        return {"source": jsonable(src)}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        if classify_error(e) == "auth":
            await drop_client(profile)
        _wrap_api_error(e)
    finally:
        try:
            tmp.unlink(missing_ok=True)
        except Exception:
            pass


@app.get("/notebooks/{nb}/sources")
async def list_sources(nb: str, profile: str = "default"):
    try:
        client = await get_client(profile)
        return {"sources": jsonable(await client.sources.list(nb))}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        _wrap_api_error(e)


@app.delete("/notebooks/{nb}/sources/{sid}")
async def delete_source(nb: str, sid: str, profile: str = "default"):
    try:
        client = await get_client(profile)
        await client.sources.delete(nb, sid)
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        _wrap_api_error(e)


@app.post("/notebooks/{nb}/chat")
async def chat(nb: str, body: ChatIn, profile: str = "default"):
    try:
        client = await get_client(profile)
        r = await client.chat.ask(nb, body.question)
        return {
            "answer": jsonable(getattr(r, "answer", None)) or jsonable(r),
            "citations": jsonable(getattr(r, "references", None)),
        }
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        if classify_error(e) == "auth":
            await drop_client(profile)
        _wrap_api_error(e)


@app.post("/notebooks/{nb}/generate")
async def generate(nb: str, body: GenerateIn, profile: str = "default"):
    gtype = body.type
    if gtype not in GEN_SPEC:
        raise HTTPException(400, f"неизвестный тип артефакта: {gtype}")
    prof = _safe_profile(profile)
    task_id = uuid.uuid4().hex
    TASKS[task_id] = {
        "status": "queued", "type": gtype, "notebook": nb, "profile": prof,
        "params": body.params, "created_at": time.time(),
    }
    asyncio.create_task(run_generation(task_id, nb, gtype, body.params or {}, prof))
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
