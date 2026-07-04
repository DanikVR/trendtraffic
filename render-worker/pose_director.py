#!/usr/bin/env python3
"""Сборка per-host папки поз для EchoMimic-v2 «студийного» поведения.

КЛЮЧЕВОЙ ФАКТ: draw_pose_select_v2 рисует ТОЛЬКО РУКИ (hands 2x21x2). Тело/лицо в
кондишен НЕ идут (берутся из реф-фото + аудио). Значит вся жестикуляция = руки.

Идея: непрерывный «курсор» проигрывает выбранный шаблон рук; скалярная ОГИБАЮЩАЯ gain[i]
гейтит амплитуду вокруг позы покоя (rest): во время речи хоста gain=level (пачками, не всю
фразу), в молчании gain=0 (руки в покое). Огибающую сглаживаем → плавные переходы без рывков.
  hands[i] = rest + (template[(i+phase)%N] - rest) * gain_env[i]
"""
import json
import os
import sys
import numpy as np


def _load_folder(pose_dir):
    n = len([f for f in os.listdir(pose_dir) if f.endswith(".npy")])
    frames = []
    for i in range(n):
        d = np.load(os.path.join(pose_dir, "%d.npy" % i), allow_pickle=True).tolist()
        frames.append(d)
    return frames


def _smooth(env, radius):
    if radius <= 0:
        return env
    k = 2 * radius + 1
    pad = np.pad(env, (radius, radius), mode="edge")
    ker = np.ones(k) / k
    return np.convolve(pad, ker, mode="valid")


def build(params):
    pose_dir = os.path.join(params["pose_root"], params["active_pose"])
    fps = float(params.get("fps", 24))
    total = float(params["total_sec"])
    L = int(round(total * fps))
    segs = params.get("speech_segs", [])          # [[start,end], ...] когда говорит ЭТОТ хост
    level = float(params.get("level_gain", 1.0))  # calm .5 / medium .8 / active 1.1
    phase = int(params.get("phase", 0))
    lead_in = float(params.get("lead_in", 0.5))
    lead_out = float(params.get("lead_out", 0.4))
    min_gest = float(params.get("min_gesture", 1.2))
    burst = float(params.get("burst_on", 2.2))
    gap = float(params.get("gap_off", 1.0))
    lerp = int(params.get("lerp", 8))
    out_dir = params["out_dir"]
    os.makedirs(out_dir, exist_ok=True)

    frames = _load_folder(pose_dir)
    N = len(frames)
    hands = np.stack([np.asarray(f["hands"], dtype=np.float64) for f in frames])   # (N,2,21,2)
    scores = np.stack([np.asarray(f["hands_score"], dtype=np.float64) for f in frames])
    # rest = кадр с САМЫМИ НИЗКИМИ руками (max средний y) = руки опущены/покой
    mean_y = hands[..., 1].reshape(N, -1).mean(axis=1)
    rest_idx = int(np.argmax(mean_y))
    rest_hands = hands[rest_idx]           # (2,21,2)
    rest_score = scores[rest_idx]

    # сырая огибающая gain[i]: level во время речи (пачками), 0 в молчании
    raw = np.zeros(L)
    for (s, e) in segs:
        s = float(s); e = float(e)
        if e - s < min_gest:
            continue                        # короткая реплика («да») — без жестов
        a = s + lead_in                     # плавный въезд
        b = e - lead_out                    # плавный выезд
        if b <= a:
            continue
        t = a
        on = True                           # чередуем пачку жеста / паузу
        while t < b:
            seg_len = burst if on else gap
            t2 = min(b, t + seg_len)
            if on:
                i0 = int(round(t * fps)); i1 = int(round(t2 * fps))
                raw[max(0, i0):min(L, i1)] = level
            t = t2; on = not on
    env = _smooth(raw, max(1, lerp // 2))   # плавные вкл/выкл

    base = frames[0]                        # шаблон структуры (bodies/faces игнорируются рендером)
    for i in range(L):
        cur = (i + phase) % N
        g = float(env[i])
        h = rest_hands + (hands[cur] - rest_hands) * g
        sc = rest_score if g < 0.02 else scores[cur]
        d = dict(base)
        d["hands"] = h
        d["hands_score"] = sc
        d["num"] = i
        d["draw_pose_params"] = base["draw_pose_params"]
        np.save(os.path.join(out_dir, "%d.npy" % i), d, allow_pickle=True)
    return {"frames": L, "rest_idx": rest_idx, "N": N, "active_frac": float((env > 0.05).mean())}


if __name__ == "__main__":
    params = json.load(open(sys.argv[1], encoding="utf-8"))
    print(json.dumps(build(params)))
