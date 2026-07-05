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


def _esrgan_model_path():
    """Веса RealESRGAN_x2plus: env ECHOMIMIC_ESRGAN_MODEL либо models/ рядом со скриптом.
    Качаются один раз с релиза xinntao (≈64МБ)."""
    p = os.getenv("ECHOMIMIC_ESRGAN_MODEL")
    if p:
        return p
    d = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, "RealESRGAN_x2plus.pth")
    if not os.path.exists(p):
        import urllib.request
        url = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth"
        print("[natural] качаю RealESRGAN_x2plus.pth …", flush=True)
        urllib.request.urlretrieve(url, p + ".part")
        os.replace(p + ".part", p)
    return p


def _build_rrdbnet():
    """RRDBNet (архитектура Real-ESRGAN x2plus) инлайном — без basicsr/realesrgan (они ломаются
    на свежих torch/torchvision). Имена слоёв 1:1 как в basicsr → state_dict грузится напрямую."""
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    class ResidualDenseBlock(nn.Module):
        def __init__(self, nf=64, gc=32):
            super().__init__()
            self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1)
            self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
            self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
            self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
            self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1)
            self.lrelu = nn.LeakyReLU(0.2, True)

        def forward(self, x):
            x1 = self.lrelu(self.conv1(x))
            x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
            x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
            x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
            x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
            return x5 * 0.2 + x

    class RRDB(nn.Module):
        def __init__(self, nf, gc=32):
            super().__init__()
            self.rdb1 = ResidualDenseBlock(nf, gc)
            self.rdb2 = ResidualDenseBlock(nf, gc)
            self.rdb3 = ResidualDenseBlock(nf, gc)

        def forward(self, x):
            return self.rdb3(self.rdb2(self.rdb1(x))) * 0.2 + x

    class RRDBNet(nn.Module):
        def __init__(self, num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32):
            super().__init__()
            # x2plus: вход pixel_unshuffle(2) → 12 каналов, два ×2 апсемпла на выходе
            self.conv_first = nn.Conv2d(num_in_ch * 4, num_feat, 3, 1, 1)
            self.body = nn.Sequential(*[RRDB(num_feat, num_grow_ch) for _ in range(num_block)])
            self.conv_body = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
            self.conv_up1 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
            self.conv_up2 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
            self.conv_hr = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
            self.conv_last = nn.Conv2d(num_feat, num_out_ch, 3, 1, 1)
            self.lrelu = nn.LeakyReLU(0.2, True)

        def forward(self, x):
            feat = self.conv_first(F.pixel_unshuffle(x, 2))
            feat = feat + self.conv_body(self.body(feat))
            feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode="nearest")))
            feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode="nearest")))
            return self.conv_last(self.lrelu(self.conv_hr(feat)))

    return RRDBNet()


def upscale_video(src_mp4, out_mp4):
    """Real-ESRGAN x2plus на GPU: видео → в 2 раза больше (768²→1536²). Добавляет реальную
    микродеталь (кожа/волосы) в диффузионный выход EchoMimic ДО матте — матте на 1536 даёт
    и более чистые края. fp16, покадрово через rawvideo-пайпы."""
    import time
    import torch
    import cv2
    import numpy as np
    t0 = time.time()
    model = _build_rrdbnet()
    sd = torch.load(_esrgan_model_path(), map_location="cpu")
    model.load_state_dict(sd.get("params_ema") or sd.get("params") or sd, strict=True)
    model = model.eval().cuda().half()
    for p in model.parameters():
        p.requires_grad_(False)
    cap = cv2.VideoCapture(src_mp4)
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    enc = subprocess.Popen(
        ["ffmpeg", "-y",
         "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", "%dx%d" % (W * 2, H * 2), "-r", "%.6f" % fps, "-i", "-",
         "-i", src_mp4, "-map", "0:v", "-map", "1:a?",
         "-c:v", "libx264", "-crf", "15", "-preset", "fast", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-shortest", out_mp4],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    nf = 0
    with torch.no_grad():
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            x = torch.from_numpy(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).permute(2, 0, 1).unsqueeze(0).cuda().half() / 255.0
            y = model(x).clamp(0, 1)
            arr = (y[0].permute(1, 2, 0).float().cpu().numpy() * 255).astype(np.uint8)
            enc.stdin.write(cv2.cvtColor(arr, cv2.COLOR_RGB2BGR).tobytes())
            nf += 1
    cap.release()
    del model
    try: torch.cuda.empty_cache()
    except Exception: pass
    try: enc.stdin.close()
    except Exception: pass
    try:
        enc.wait(timeout=1800)
    except Exception:
        enc.kill()
        return False
    print("[natural] esrgan x2 %d кадров за %.1fс -> %s" % (nf, time.time() - t0, out_mp4), flush=True)
    return nf > 0 and enc.returncode == 0 and os.path.exists(out_mp4)


def matte_alpha(src_mp4, out_color, out_alpha):
    """АЛЬФА-режим (вместо хромакея): RVM отдаёт fgr+pha напрямую → два файла:
    color = человек на нейтральном сером (превью читаемо, у краёв нет зелёного каста),
    alpha = маска градациями серого. Бэкенд склеивает alphamerge — края волос без
    хромакей-порогов и despill. Эрозия по умолчанию 0 (мягкий anti-alias край — фича)."""
    import time
    import torch
    import torch.nn.functional as F
    import cv2
    import numpy as np
    t0 = time.time()
    try:
        erode_px = max(0, int(os.getenv("ECHOMIMIC_ALPHA_ERODE", "0") or 0))
    except ValueError:
        erode_px = 0
    model = torch.hub.load("PeterL1n/RobustVideoMatting", "mobilenetv3", trust_repo=True).eval().cuda()
    for p in model.parameters():
        p.requires_grad_(False)
    cap = cv2.VideoCapture(src_mp4)
    W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)); H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    # RVM проектировали под внутренние ~512px: для 1536² берём меньший downsample_ratio
    ds = 0.4 if max(W, H) <= 1024 else 0.25
    encc = subprocess.Popen(
        ["ffmpeg", "-y",
         "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", "%dx%d" % (W, H), "-r", "%.6f" % fps, "-i", "-",
         "-i", src_mp4, "-map", "0:v", "-map", "1:a?",
         "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv444p",
         "-c:a", "aac", "-shortest", out_color],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    enca = subprocess.Popen(
        ["ffmpeg", "-y",
         "-f", "rawvideo", "-pix_fmt", "gray", "-s", "%dx%d" % (W, H), "-r", "%.6f" % fps, "-i", "-",
         "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "gray", out_alpha],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    gray = torch.tensor([143 / 255.0, 143 / 255.0, 143 / 255.0], device="cuda").view(1, 3, 1, 1)
    rec = [None] * 4
    nf = 0
    with torch.no_grad():
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            src = torch.from_numpy(rgb).permute(2, 0, 1).unsqueeze(0).float().cuda() / 255.0
            fgr, pha, *rec = model(src, *rec, downsample_ratio=ds)
            for _ in range(erode_px):
                pha = -F.max_pool2d(-pha, kernel_size=3, stride=1, padding=1)
            com = fgr * pha + gray * (1 - pha)
            arr = (com[0].permute(1, 2, 0).clamp(0, 1).cpu().numpy() * 255).astype(np.uint8)
            encc.stdin.write(cv2.cvtColor(arr, cv2.COLOR_RGB2BGR).tobytes())
            a8 = (pha[0, 0].clamp(0, 1).cpu().numpy() * 255).astype(np.uint8)
            enca.stdin.write(a8.tobytes())
            nf += 1
    cap.release()
    del model
    try: torch.cuda.empty_cache()
    except Exception: pass
    ok_all = nf > 0
    for enc in (encc, enca):
        try: enc.stdin.close()
        except Exception: pass
        try:
            enc.wait(timeout=900)
        except Exception:
            enc.kill()
            ok_all = False
        ok_all = ok_all and enc.returncode == 0
    print("[natural] matte ALPHA %d кадров за %.1fс -> %s + %s" % (nf, time.time() - t0, out_color, out_alpha), flush=True)
    return ok_all and os.path.exists(out_color) and os.path.exists(out_alpha)


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
    # Кадры уходят СРАЗУ в libx264 rawvideo-пайпом. Старый путь (cv2 mp4v → пере-кодирование в
    # yuv420p без crf) давал два поколения потерь и хрому в половинном разрешении — бэкенд-хромакей
    # режет по ЦВЕТУ, и у быстрых рук проступали «квадраты» макроблоков. yuv444p держит хрому в
    # полном разрешении, crf 16 ≈ визуально без потерь для промежуточного файла.
    enc = subprocess.Popen(
        ["ffmpeg", "-y",
         "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", "%dx%d" % (W, H), "-r", "%.6f" % fps, "-i", "-",
         "-i", src_mp4, "-map", "0:v", "-map", "1:a?",
         "-c:v", "libx264", "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv444p",
         "-c:a", "aac", "-shortest", out_mp4],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
            enc.stdin.write(cv2.cvtColor(arr, cv2.COLOR_RGB2BGR).tobytes())
            nf += 1
    cap.release()
    del model
    try: torch.cuda.empty_cache()
    except Exception: pass
    try: enc.stdin.close()
    except Exception: pass
    try:
        enc.wait(timeout=900)
    except Exception:
        enc.kill()
        return False
    if nf == 0:
        return False
    print("[natural] matte RVM %d кадров за %.1fс -> %s" % (nf, time.time() - t0, out_mp4), flush=True)
    return enc.returncode == 0 and os.path.exists(out_mp4)


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
    # частота кадров — из исходника (EchoMimic = 24), аудио берём из него же.
    # crf 16 + yuv444p — как в RVM-пути: полная хрома для чистого хромакея на бэке.
    subprocess.run(["ffmpeg", "-y", "-framerate", "24", "-i", os.path.join(og, "f%05d.png"),
                    "-i", src_mp4, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264",
                    "-crf", "16", "-preset", "medium", "-pix_fmt", "yuv444p",
                    "-c:a", "aac", "-shortest", out_mp4],
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
        elif mode == "upscale":
            ok = upscale_video(sys.argv[2], sys.argv[3])
            sys.exit(0 if ok else 2)
        elif mode == "mattealpha":
            ok = matte_alpha(sys.argv[2], sys.argv[3], sys.argv[4])
            sys.exit(0 if ok else 2)
        else:
            print("usage: echomimic_natural.py prep|matte|upscale|mattealpha ...", file=sys.stderr)
            sys.exit(1)
    except Exception as e:  # noqa: BLE001
        print("[natural] ОШИБКА %s: %s" % (mode, e), file=sys.stderr, flush=True)
        sys.exit(3)
