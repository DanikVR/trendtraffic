/**
 * AuraVisualizer — шейдероподобный аудио-визуализатор в стиле LiveKit Agents UI.
 *
 * ТОЛЬКО для новых публичных страниц (лендинг, тарифы и т.д.).
 * Рисует на <canvas> в 5 режимах: aura | wave | bar | radial | grid.
 * Реагирует на живой звук через AnalyserNode; без звука — мягкая «дышащая»
 * синтетическая анимация, чтобы элемент всегда выглядел живым.
 *
 * Лёгкий: без внешних зависимостей и WebGL — держит TBT в норме (SEO-аудит).
 */

import { useEffect, useRef } from 'react';

type AuraMode = 'aura' | 'wave' | 'bar' | 'radial' | 'grid';

interface AuraVisualizerProps {
  mode?: AuraMode;
  /** true → визуализатор «горит» ярче (идёт запись/воспроизведение). */
  active?: boolean;
  /** Источник живого звука. Если задан — амплитуда берётся из него. */
  analyser?: AnalyserNode | null;
  className?: string;
}

// Тёплая палитра VibeVox (оранжевый акцент)
const C_ORANGE = '#ff7300';
const C_EMBER = '#ff4d00';
const C_AMBER = '#ffb547';
const C_GLOW = '#ff8a2b';

export function AuraVisualizer({
  mode = 'aura',
  active = false,
  analyser = null,
  className,
}: AuraVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Держим свежие значения внутри RAF-цикла без переподписки.
  const modeRef = useRef(mode);
  const activeRef = useRef(active);
  const analyserRef = useRef<AnalyserNode | null>(analyser);
  modeRef.current = mode;
  activeRef.current = active;
  analyserRef.current = analyser;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let t = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const freq = new Uint8Array(64);
    const time = new Uint8Array(256);
    let smooth = 0; // сглаженная амплитуда 0..1

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Текущая амплитуда: из анализатора (RMS) либо синтетическая.
    const readLevel = (): number => {
      const an = analyserRef.current;
      if (an) {
        an.getByteTimeDomainData(time);
        let sum = 0;
        for (let i = 0; i < time.length; i++) {
          const v = (time[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / time.length);
        return Math.min(1, rms * 3.2);
      }
      // Синтетика: мягкое дыхание + лёгкая «речь»
      const base = 0.32 + 0.18 * Math.sin(t * 0.9) + 0.1 * Math.sin(t * 2.3 + 1);
      return Math.max(0.05, base * (activeRef.current ? 1.25 : 0.7));
    };

    const readFreq = (): Uint8Array => {
      const an = analyserRef.current;
      if (an) {
        an.getByteFrequencyData(freq);
        return freq;
      }
      for (let i = 0; i < freq.length; i++) {
        const n = i / freq.length;
        const env = Math.sin(n * Math.PI); // купол
        freq[i] =
          (0.5 + 0.5 * Math.sin(t * 2 + i * 0.5 + Math.sin(t + i))) *
          env *
          (activeRef.current ? 230 : 150);
      }
      return freq;
    };

    const lerpColor = (a: string, b: string, k: number) => {
      const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
      const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
      const r = Math.round(pa[0] + (pb[0] - pa[0]) * k);
      const g = Math.round(pa[1] + (pb[1] - pa[1]) * k);
      const bl = Math.round(pa[2] + (pb[2] - pa[2]) * k);
      return `rgb(${r},${g},${bl})`;
    };

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const min = Math.min(w, h);
      const lvl = readLevel();
      smooth += (lvl - smooth) * 0.18;
      const amp = smooth;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      const m = modeRef.current;

      if (m === 'aura') {
        // Мягкое неоновое облако: несколько вложенных радиальных пятен,
        // медленно вращающихся и пульсирующих от громкости.
        const blobs = 5;
        for (let i = 0; i < blobs; i++) {
          const ang = t * 0.4 + (i / blobs) * Math.PI * 2;
          const orbit = min * (0.06 + 0.05 * i) * (0.7 + amp * 0.8);
          const bx = cx + Math.cos(ang) * orbit;
          const by = cy + Math.sin(ang * 1.1) * orbit;
          const rad = min * (0.16 + 0.05 * i) * (0.8 + amp * 0.7);
          const col = i % 2 === 0 ? C_ORANGE : i % 3 === 0 ? C_AMBER : C_EMBER;
          const grad = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
          grad.addColorStop(0, hexA(col, 0.55 * (0.5 + amp)));
          grad.addColorStop(0.5, hexA(col, 0.18));
          grad.addColorStop(1, hexA(col, 0));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(bx, by, rad, 0, Math.PI * 2);
          ctx.fill();
        }
        // Яркое ядро
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, min * 0.18 * (0.7 + amp));
        core.addColorStop(0, hexA('#FFFFFF', 0.85 * (0.4 + amp)));
        core.addColorStop(0.4, hexA(C_EMBER, 0.4));
        core.addColorStop(1, hexA(C_EMBER, 0));
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(cx, cy, min * 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (m === 'wave') {
        const an = analyserRef.current;
        ctx.lineWidth = Math.max(2, min * 0.012);
        ctx.lineCap = 'round';
        for (let pass = 0; pass < 2; pass++) {
          ctx.beginPath();
          const col = pass === 0 ? C_AMBER : C_EMBER;
          ctx.strokeStyle = hexA(col, pass === 0 ? 0.9 : 0.5);
          ctx.shadowColor = col;
          ctx.shadowBlur = min * 0.04;
          const N = an ? time.length : 120;
          for (let i = 0; i < N; i++) {
            const x = (i / (N - 1)) * w;
            let v: number;
            if (an) v = (time[i] - 128) / 128;
            else v = Math.sin(i * 0.18 + t * 3 + pass) * (0.3 + amp);
            const y = cy + v * h * 0.32 * (0.6 + amp) + (pass ? min * 0.01 : 0);
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      } else if (m === 'bar') {
        const arr = readFreq();
        const bars = 40;
        const bw = w / bars;
        for (let i = 0; i < bars; i++) {
          const fi = Math.floor((i / bars) * arr.length);
          const v = arr[fi] / 255;
          const bh = Math.max(min * 0.01, v * h * 0.4 * (0.7 + amp));
          const x = i * bw + bw * 0.18;
          const col = lerpColor(C_ORANGE, C_AMBER, i / bars);
          ctx.fillStyle = hexA(col, 0.92);
          ctx.shadowColor = col;
          ctx.shadowBlur = min * 0.03;
          roundRect(ctx, x, cy - bh, bw * 0.64, bh, bw * 0.3);
          roundRect(ctx, x, cy, bw * 0.64, bh * 0.85, bw * 0.3);
        }
        ctx.shadowBlur = 0;
      } else if (m === 'radial') {
        const arr = readFreq();
        const bars = 64;
        const r0 = min * 0.16;
        ctx.lineCap = 'round';
        for (let i = 0; i < bars; i++) {
          const fi = Math.floor((i / bars) * arr.length);
          const v = arr[fi] / 255;
          const len = min * 0.04 + v * min * 0.22 * (0.7 + amp);
          const ang = (i / bars) * Math.PI * 2 + t * 0.2;
          const x0 = cx + Math.cos(ang) * r0;
          const y0 = cy + Math.sin(ang) * r0;
          const x1 = cx + Math.cos(ang) * (r0 + len);
          const y1 = cy + Math.sin(ang) * (r0 + len);
          const col = lerpColor(C_EMBER, C_AMBER, (Math.sin(ang) + 1) / 2);
          ctx.strokeStyle = hexA(col, 0.9);
          ctx.lineWidth = Math.max(2, min * 0.01);
          ctx.shadowColor = col;
          ctx.shadowBlur = min * 0.03;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, r0);
        core.addColorStop(0, hexA(C_ORANGE, 0.5 + amp * 0.4));
        core.addColorStop(1, hexA(C_ORANGE, 0));
        ctx.fillStyle = core;
        ctx.beginPath();
        ctx.arc(cx, cy, r0, 0, Math.PI * 2);
        ctx.fill();
      } else if (m === 'grid') {
        const cols = 16;
        const rows = 9;
        const gx = w / (cols + 1);
        const gy = h / (rows + 1);
        for (let i = 1; i <= cols; i++) {
          for (let j = 1; j <= rows; j++) {
            const x = i * gx;
            const y = j * gy;
            const d = Math.hypot(x - cx, y - cy) / (min * 0.7);
            const pulse = 0.5 + 0.5 * Math.sin(t * 3 - d * 6);
            const r = Math.max(0.5, (min * 0.006) * (0.4 + pulse * (0.6 + amp)));
            const col = lerpColor(C_ORANGE, C_GLOW, pulse);
            ctx.fillStyle = hexA(col, 0.25 + pulse * 0.6 * (0.4 + amp));
            ctx.shadowColor = col;
            ctx.shadowBlur = min * 0.02;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.shadowBlur = 0;
      }

      ctx.globalCompositeOperation = 'source-over';
      t += 0.016;
      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}

// #RRGGBB + alpha → rgba()
function hexA(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  ctx.fill();
}

export default AuraVisualizer;
