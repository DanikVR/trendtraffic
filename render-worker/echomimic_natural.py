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


def matte_to_green(src_mp4, out_mp4):
    """Серый выход EchoMimic → человек на чистом зелёном (для бэкенд-хромакея)."""
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
    sess = new_session("u2net_human_seg")
    for f in frames:
        out = remove(open(f, "rb").read(), session=sess, bgcolor=(0, 255, 0, 255))
        open(os.path.join(og, os.path.basename(f)), "wb").write(out)
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
