#!/usr/bin/env python3
"""
build-public.py — собирает ПУБЛИЧНЫЙ, Flow-only, бесплатный-без-входа билд «Flow Booster»
для Chrome Web Store из общего исходника trendtraffic-extension.

Что делает (правило CWS «одна цель» = автоматизация Google Flow):
  • берёт только Flow-части: background.js, content-flow.js, content-bridge.js (мост TrendFlow —
    опциональный экспорт результата), injected.js, sidepanel.* ;
  • ВЫБРАСЫВАЕТ NotebookLM и HeyGen: content-notebook/heygen + injected-nlm/heygen ;
  • нейтрализует в background.js фоновые циклы NotebookLM/HeyGen (nlmLoop/tickHeygen/nlmHeartbeat) —
    остаётся только tickFlow (сам no-op без входа) ;
  • пишет свой manifest (своё имя/бренд, урезанные права и хосты, без notebooklm/heygen, без scripting) ;
  • кладёт STORE.md (текст листинга + обоснование прав + privacy) ;
  • пакует dist-public/ → dist-public.zip (файлы в корне архива — для загрузки в CWS).

Запуск:  python apps/trendtraffic-extension/build-public.py   (из корня репозитория ИЛИ из папки расширения)
"""
import json, os, re, shutil, zipfile, sys

HERE = os.path.dirname(os.path.abspath(__file__))          # …/apps/trendtraffic-extension
OUT = os.path.join(HERE, "dist-public")
ZIP = os.path.join(HERE, "dist-public.zip")

PUBLIC_NAME = "Flow Booster — Bulk & Auto for Google Flow"
PUBLIC_DESC = ("Batch-generate and auto-download videos & images on Google Flow (Veo). "
               "Queue prompts, run them automatically, save results. Free, no sign-up.")

# файлы src, которые ВХОДЯТ в публичный билд (всё остальное из src/ отбрасывается)
SRC_KEEP = ["background.js", "content-flow.js", "content-bridge.js", "injected.js",
            "sidepanel.html", "sidepanel.css", "sidepanel.js"]

def read(p):  return open(p, "r", encoding="utf-8").read()
def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "w", encoding="utf-8", newline="\n").write(s)

def manifest_version():
    return json.loads(read(os.path.join(HERE, "manifest.json")))["version"]

def public_manifest(version):
    return {
        "manifest_version": 3,
        "name": PUBLIC_NAME,
        "version": version,
        "description": PUBLIC_DESC,
        "default_locale": "en",  # для рантайм-строк (fb_*/flow_*); имя/описание — литералы выше
        "minimum_chrome_version": "116",
        "icons": {"16": "icons/icon-16.png", "32": "icons/icon-32.png",
                  "48": "icons/icon-48.png", "128": "icons/icon-128.png"},
        "action": {"default_title": PUBLIC_NAME, "default_icon": {
            "16": "icons/icon-16.png", "32": "icons/icon-32.png",
            "48": "icons/icon-48.png", "128": "icons/icon-128.png"}},
        "permissions": ["storage", "downloads", "tabs", "alarms", "sidePanel"],
        "host_permissions": [
            "https://labs.google/*",
            "https://*.googleapis.com/*", "https://*.googleusercontent.com/*",
            "https://*.ggpht.com/*", "https://*.gstatic.com/*", "https://*.google.com/*",
            "https://app.trendtraffic.pro/*",
            "http://localhost:*/*", "http://127.0.0.1:*/*",
        ],
        "background": {"service_worker": "src/background.js", "type": "module"},
        "side_panel": {"default_path": "src/sidepanel.html"},
        "content_scripts": [
            {"matches": ["https://labs.google/fx/tools/flow*", "https://labs.google/fx/*/tools/flow*"],
             "js": ["src/content-flow.js"], "run_at": "document_idle", "all_frames": False},
            {"matches": ["https://app.trendtraffic.pro/*", "http://localhost/*",
                         "http://localhost:*/*", "http://127.0.0.1:*/*"],
             "js": ["src/content-bridge.js"], "run_at": "document_idle", "all_frames": False},
        ],
        "web_accessible_resources": [
            {"resources": ["src/injected.js"], "matches": ["https://labs.google/*"]},
        ],
    }

def transform_background(js):
    # выключаем фоновые циклы чужих сервисов — в Flow-only билде их content-скриптов нет
    for call in ("void nlmHeartbeat();", "void nlmLoop();", "void tickHeygen();"):
        js = js.replace(call, "void 0; /* off in Flow-only build */")
    return js

STORE_MD = """# Flow Booster — Chrome Web Store listing kit

**Name:** {name}
**Short description (≤132):** {desc}

## Full description (draft)
Flow Booster turns Google Flow (Veo) into a bulk generation engine. Paste dozens of prompts,
pick your model, aspect ratio, count and resolution, press Start — Flow Booster fills the prompt,
runs each generation, waits, and auto-downloads the results into a folder you choose. Free, and
no account is required.

Features
- Batch prompts — one per line, run them all automatically.
- Parallel generation (1–4 at once).
- Modes: Text→Video, Image→Video, Ingredients→Video, Text→Image, Image→Image.
- Model (Veo 3.1 Fast/Quality, Veo 2), aspect ratio 16:9 / 9:16 / 1:1, count, length.
- Auto-download to disk with folder + filename prefix; resolution 720p / 1080p / 2K / 4K.
- Characters / consistency — named reference images, auto-attached by name (or all), via @mention
  or reference upload; plus "chain last result".
- Optional: send results to your TrendFlow Gallery (only if you connect your TrendFlow account).

Everything except the optional TrendFlow export works with no sign-in.

## Permission justifications (for CWS review)
- **storage** — save your batch settings (models, folder, prompts) locally.
- **downloads** — save generated videos/images to your computer with your chosen name/folder.
- **tabs** — locate the open Google Flow tab to drive it.
- **alarms** — keep the background worker alive between generations.
- **sidePanel** — the control panel UI.
- **host `labs.google`** — the extension runs on Google Flow to automate generation.
- **hosts `*.googleapis.com / *.googleusercontent.com / *.ggpht.com / *.gstatic.com / *.google.com`**
  — fetch the finished media from Google's CDN to download it.
- **host `app.trendtraffic.pro`** — OPTIONAL export of results to the user's TrendFlow account.

## Privacy (single purpose)
Single purpose: automate bulk generation and downloading on Google Flow. The extension does not
collect or transmit personal data. Prompts and settings stay in local browser storage. Generated
media is downloaded to the user's device; it is sent to TrendFlow only if the user explicitly
connects their TrendFlow account and enables that toggle. No analytics, no tracking.

## Notes for the maintainer
- Generated from the shared `trendtraffic-extension` source by `build-public.py`.
  Re-run it after changing the shared Flow files. Do NOT hand-edit `dist-public/`.
- NotebookLM + HeyGen code paths are excluded/neutralized here (single-purpose compliance).
""".format(name=PUBLIC_NAME, desc=PUBLIC_DESC)

def main():
    try: sys.stdout.reconfigure(encoding="utf-8")  # Windows-консоль по умолчанию cp1251 → давит ✓/—
    except Exception: pass
    ver = manifest_version()
    if os.path.isdir(OUT): shutil.rmtree(OUT)
    os.makedirs(OUT)

    # icons + _locales — как есть
    shutil.copytree(os.path.join(HERE, "icons"), os.path.join(OUT, "icons"))
    shutil.copytree(os.path.join(HERE, "_locales"), os.path.join(OUT, "_locales"))

    # src — только разрешённые файлы; background.js трансформируем
    for f in SRC_KEEP:
        srcp = os.path.join(HERE, "src", f)
        data = read(srcp)
        if f == "background.js":
            data = transform_background(data)
        write(os.path.join(OUT, "src", f), data)

    # manifest + store kit
    write(os.path.join(OUT, "manifest.json"), json.dumps(public_manifest(ver), ensure_ascii=False, indent=2) + "\n")
    write(os.path.join(OUT, "STORE.md"), STORE_MD)

    # zip (файлы в корне архива)
    if os.path.exists(ZIP): os.remove(ZIP)
    files = []
    for root, dirs, fs in os.walk(OUT):
        dirs.sort()
        for fn in sorted(fs):
            full = os.path.join(root, fn)
            rel = os.path.relpath(full, OUT).replace(os.sep, "/")
            files.append((full, rel))
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for full, rel in files:
            z.write(full, rel)

    print(f"Flow Booster public build v{ver}")
    print(f"  folder: {OUT}  ({len(files)} files)")
    print(f"  zip:    {ZIP}  ({os.path.getsize(ZIP)} bytes)")
    # sanity
    excluded = ["content-notebook.js", "content-heygen.js", "injected-nlm.js", "injected-heygen.js"]
    present = os.listdir(os.path.join(OUT, "src"))
    bad = [e for e in excluded if e in present]
    print("  excluded NLM/HeyGen present?:", bad or "none ✓")
    bg = read(os.path.join(OUT, "src", "background.js"))
    print("  nlmLoop neutralized:", ("void nlmLoop();" not in bg))
    print("  tickFlow kept:", ("void tickFlow();" in bg))

if __name__ == "__main__":
    main()
