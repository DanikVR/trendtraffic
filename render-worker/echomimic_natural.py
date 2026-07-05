#!/usr/bin/env python3
"""EchoMimic-v2 identity helper — запускается интерпретатором emv2 (там numpy/PIL/rembg).

Проблема: EchoMimic-v2 ТЕРЯЕТ личность на вырезке с ЧИСТО-ЗЕЛЁНЫМ фоном #00FF00 (это
out-of-distribution: модель обучена на людях в естественных сценах) — лицо/волосы/одежда
уплывают к «прайору» модели (демо-женщина). Проверено: тот же человек на нейтральном фоне
и в центре кадра сохраняется отлично.

Решение (две стадии, вокруг infer_acc):
  prep  <src_green> <out_ref>   — кроп на человека (по не-зелёным пикселям) + центр + квадрат,
                                  зелёный фон → нейтральный серый. Личность сохраняется.
  matte <src_mp4>  <out_mp4>    — rembg (u2net_human_seg) вырезает человека из серого выхода
                                  и кладёт на #00FF00 → бэкенд-хромакей работает как раньше.
"""
import os
import sys
import glob
import uuid
import subprocess

GRAY = (143, 143, 143)


def _erode_px():
    """Сколько пикселей съедать с края маски (ECHOMIMIC_ERODE, деф. 1; 0 = выкл).
    Убирает полу-зелёный anti-alias край — «контур» вокруг человека после хромакея."""
    try:
        return max(0, int(os.getenv("ECHOMIMIC_ERODE", "1") or 1))
    except ValueError:
        return 1


def _green_mask(a):
    import numpy as np  # noqa: F401
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    return (g > 110) & (g - r > 40) & (g - b > 40)


def prep_ref_natural(src, out):
    """Зелёная вырезка → человек в центре квадрата на нейтральном сером. Возврат: путь или ''."""
    import numpy as np
    from PIL import Image
    im = Image.open(src).convert("RGB")
    a = np.asarray(im).copy()
    gm = _green_mask(a)
    frac = float(gm.mean())
    ys, xs = np.where(~gm)
    if frac < 0.12 or xs.size < 500:
        # фон уже естественный (или зелёного мало) — просто центрируем в квадрат
        person, H, W = a, a.shape[0], a.shape[1]
    else:
        x0, x1 = int(xs.min()), int(xs.max())
        y0, y1 = int(ys.min()), int(ys.max())
        mw, mh = int((x1 - x0) * 0.12), int((y1 - y0) * 0.08)
        x0 = max(0, x0 - mw); x1 = min(a.shape[1] - 1, x1 + mw)
        y0 = max(0, y0 - mh); y1 = min(a.shape[0] - 1, y1 + mh)
        a[gm] = GRAY                    # зелёный → серый
        person = a[y0:y1 + 1, x0:x1 + 1]
        H, W = person.shape[:2]
    S = max(H, W)
    canvas = np.full((S, S, 3), GRAY, np.uint8)
    oy, ox = (S - H) // 2, (S - W) // 2
    canvas[oy:oy + H, ox:ox + W] = person
    Image.fromarray(canvas).save(out)
    print("[natural] prep green_frac=%.2f -> %dx%d" % (frac, S, S), flush=True)
    return out


def _matte_rvm(src_mp4, out_mp4, downsample=0.4):
    """RVM (RobustVideoMatting) на GPU: человек → зелёный. ~37 fps (в 20-40x быстрее rembg),
    temporally-stable (чище края волос). Модель качается один раз в кэш torch.hub."""
    import time
    import torch
    import torch.nn.functional as F
    import cv2
    import numpy as np
    t0 = time.time()
    erode_px = _erode_px()
    model = torch.hub.load("PeterL1n/RobustVideoMatting", "mobilenetv3", trust_repo=True).eval().cuda()
    for p in model.parameters():
        p.requires_grad_(False)
    cap = cv2.VideoCapture(src_mp4)
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    tmp = out_mp4 + ".noaudio.mp4"
    vw = cv2.VideoWriter(tmp, cv2.VideoWriter_fourcc(*"mp4v"), fps, (W, H))
    bgr = torch.tensor([0.0, 1.0, 0.0], device="cuda").view(1, 3, 1, 1)   # зелёный RGB
    rec = [None] * 4
    nf = 0
    with torch.no_grad():
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            src = torch.from_numpy(rgb).permute(2, 0, 1).unsqueeze(0).float().cuda() / 255.0
            fgr, pha, *rec = model(src, *rec, downsample_ratio=downsample)
            # эрозия альфы (ECHOMIMIC_ERODE px, деф. 1): край anti-alias (полу-зелёные пиксели) уходит
            # в чистый зелёный → бэкенд-хромакей срезает его без остаточного «контура» вокруг человека.
            for _ in range(erode_px):
                pha = -F.max_pool2d(-pha, kernel_size=3, stride=1, padding=1)
            com = fgr * pha + bgr * (1 - pha)
            arr = (com[0].permute(1, 2, 0).clamp(0, 1).cpu().numpy() * 255).astype(np.uint8)
            vw.write(cv2.cvtColor(arr, cv2.COLOR_RGB2BGR))
            nf += 1
    cap.release(); vw.release()
    del model
    try: torch.cuda.empty_cache()
    except Exception: pass
    if nf == 0:
        return False
    subprocess.run(["ffmpeg", "-y", "-i", tmp, "-i", src_mp4, "-map", "0:v", "-map", "1:a?",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", out_mp4],
                   capture_output=True)
    try: os.remove(tmp)
    except OSError: pass
    print("[natural] matte RVM %d кадров за %.1fс -> %s" % (nf, time.time() - t0, out_mp4), flush=True)
    return os.path.exists(out_mp4)


def matte_to_green(src_mp4, out_mp4):
    """Серый выход EchoMimic → человек на чистом зелёном (для бэкенд-хромакея).
    Сначала быстрый GPU-RVM; если не вышел (нет модели/сети/GPU) — фолбэк на rembg (CPU)."""
    if os.getenv("ECHOMIMIC_MATTE", "rvm") != "rembg":
        try:
            if _matte_rvm(src_mp4, out_mp4):
                return True
        except Exception as e:  # noqa: BLE001
            print("[natural] RVM не вышел (%s) — фолбэк rembg" % e, flush=True)
    from rembg import remove, new_session
    work = os.path.dirname(os.path.abspath(out_mp4)) or "."
    fr = os.path.join(work, "fr_%s" % uuid.uuid4().hex[:5])
    og = os.path.join(work, "og_%s" % uuid.uuid4().hex[:5])
    os.makedirs(fr, exist_ok=True); os.makedirs(og, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-i", src_mp4, os.path.join(fr, "f%05d.png")],
                   capture_output=True)
    frames = sorted(glob.glob(os.path.join(fr, "f*.png")))
    if not frames:
        return False
    import io
    from PIL import Image, ImageFilter
    erode_px = _erode_px()
    sess = new_session("u2net_human_seg")
    for f in frames:
        out = remove(open(f, "rb").read(), session=sess)   # RGBA: альфа отдельно, чтобы съесть край
        im = Image.open(io.BytesIO(out)).convert("RGBA")
        alpha = im.getchannel("A")
        for _ in range(erode_px):   # та же эрозия, что в RVM-пути: без неё контур остаётся в фолбэке
            alpha = alpha.filter(ImageFilter.MinFilter(3))
        green = Image.new("RGB", im.size, (0, 255, 0))
        green.paste(im.convert("RGB"), mask=alpha)
        green.save(os.path.join(og, os.path.basename(f)))
    # частота кадров — из исходника (EchoMimic = 24), аудио берём из него же
    subprocess.run(["ffmpeg", "-y", "-framerate", "24", "-i", os.path.join(og, "f%05d.png"),
                    "-i", src_mp4, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", out_mp4],
                   capture_output=True)
    for d in (fr, og):
        for f in glob.glob(os.path.join(d, "*")):
            try: os.remove(f)
            except OSError: pass
        try: os.rmdir(d)
        except OSError: pass
    print("[natural] matte %d кадров -> %s" % (len(frames), out_mp4), flush=True)
    return os.path.exists(out_mp4)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        if mode == "prep":
            prep_ref_natural(sys.argv[2], sys.argv[3])
        elif mode == "matte":
            ok = matte_to_green(sys.argv[2], sys.argv[3])
            sys.exit(0 if ok else 2)
        else:
            print("usage: echomimic_natural.py prep|matte ...", file=sys.stderr)
            sys.exit(1)
    except Exception as e:  # noqa: BLE001
        print("[natural] ОШИБКА %s: %s" % (mode, e), file=sys.stderr, flush=True)
        sys.exit(3)
