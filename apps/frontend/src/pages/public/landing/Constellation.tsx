/**
 * Constellation — фирменная hero-визуализация лендинга: сотни мелких
 * контурных треугольников спектральных цветов слетаются в большой
 * play-треугольник (видео) и живут: дрейф, мерцание, параллакс от мыши.
 *
 * Канвас, без зависимостей. prefers-reduced-motion → статичная сборка.
 */

import { useEffect, useRef } from 'react';

type Particle = {
  sx: number; sy: number;   // старт (разлетевшееся состояние)
  tx: number; ty: number;   // цель в фигуре (норм. координаты 0..1 бокса фигуры)
  ambient: boolean;         // фоновая частица вне фигуры
  size: number;
  color: string;
  rot: number;
  rotSpeed: number;
  phase: number;
  depth: number;            // 0.35..1 — параллакс и яркость
  delay: number;            // задержка сборки, мс
};

const COLORS = [
  '#8052ff', '#8052ff', '#8052ff', '#9a73ff', '#6f42e8',
  '#ffb829', '#ffb829', '#2fbfa0', '#15846e', '#ff5ad1', '#5aa0ff',
];

/** Точки внутри play-треугольника со скруглёнными углами (норм. 0..1). */
function samplePlayTriangle(n: number): Array<{ x: number; y: number }> {
  const c = document.createElement('canvas');
  c.width = 240; c.height = 240;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  // Треугольник ▶ со скруглением через lineJoin round + толстую обводку
  const p = [[30, 18], [222, 120], [30, 222]] as const;
  g.beginPath();
  g.moveTo(p[0][0], p[0][1]);
  g.lineTo(p[1][0], p[1][1]);
  g.lineTo(p[2][0], p[2][1]);
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = 26;
  g.strokeStyle = '#fff';
  g.stroke();
  g.fill();
  const img = g.getImageData(0, 0, 240, 240).data;
  const pts: Array<{ x: number; y: number }> = [];
  let guard = 0;
  while (pts.length < n && guard < n * 60) {
    guard++;
    const x = Math.random() * 240;
    const y = Math.random() * 240;
    const a = img[(Math.floor(y) * 240 + Math.floor(x)) * 4 + 3];
    if (a > 128) pts.push({ x: x / 240, y: y / 240 });
  }
  return pts;
}

function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }

export function Constellation({ started }: { started: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const startedRef = useRef(started);
  startedRef.current = started;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let particles: Particle[] = [];
    let W = 0, H = 0, dpr = 1;
    // Центр и размер фигуры в текущем вьюпорте
    let shape = { cx: 0, cy: 0, box: 0 };
    const mouse = { x: 0, y: 0 };        // -1..1 от центра
    let startAt: number | null = reduced ? 0 : null;

    const rebuild = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const narrow = W < 960;
      shape.box = narrow ? Math.min(W, H) * 0.62 : Math.min(W * 0.42, H * 0.72);
      shape.cx = narrow ? W * 0.5 : W * 0.72;
      shape.cy = narrow ? H * 0.42 : H * 0.52;

      const count = narrow ? 620 : 980;
      const ambientCount = narrow ? 70 : 130;
      const targets = samplePlayTriangle(count);
      particles = [];
      for (let i = 0; i < targets.length; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = (0.55 + Math.random() * 0.75) * Math.max(W, H) * 0.6;
        particles.push({
          sx: shape.cx + Math.cos(ang) * rad,
          sy: shape.cy + Math.sin(ang) * rad,
          tx: targets[i].x, ty: targets[i].y,
          ambient: false,
          size: 2.4 + Math.random() * 3.8,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.0012,
          phase: Math.random() * Math.PI * 2,
          depth: 0.35 + Math.random() * 0.65,
          delay: Math.random() * 900,
        });
      }
      for (let i = 0; i < ambientCount; i++) {
        particles.push({
          sx: Math.random() * W, sy: Math.random() * H,
          tx: Math.random(), ty: Math.random(),
          ambient: true,
          size: 1.8 + Math.random() * 3,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.0009,
          phase: Math.random() * Math.PI * 2,
          depth: 0.2 + Math.random() * 0.5,
          delay: Math.random() * 600,
        });
      }
    };

    const drawTri = (x: number, y: number, s: number, rot: number) => {
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = rot + (k * Math.PI * 2) / 3;
        const px = x + Math.cos(a) * s;
        const py = y + Math.sin(a) * s;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (startAt === null) {
        if (startedRef.current) startAt = now;
      }
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1.25;

      const t = now;
      for (const p of particles) {
        let prog = 1;
        if (!reduced && startAt !== null) {
          prog = easeOutCubic(Math.min(1, Math.max(0, (t - startAt - p.delay) / 1500)));
        } else if (startAt === null) {
          prog = 0;
        }
        const gx = p.ambient ? p.tx * W : shape.cx + (p.tx - 0.5) * shape.box;
        const gy = p.ambient ? p.ty * H : shape.cy + (p.ty - 0.5) * shape.box;
        const driftX = Math.sin(t * 0.00045 + p.phase) * 4.5 * p.depth;
        const driftY = Math.cos(t * 0.00038 + p.phase * 1.7) * 4.5 * p.depth;
        const parX = mouse.x * 16 * p.depth;
        const parY = mouse.y * 10 * p.depth;
        const x = p.sx + (gx - p.sx) * prog + driftX + parX;
        const y = p.sy + (gy - p.sy) * prog + driftY + parY;
        p.rot += p.rotSpeed * 16;

        const twinkle = 0.6 + 0.4 * Math.sin(t * 0.0011 * (0.6 + p.depth) + p.phase);
        const base = p.ambient ? 0.28 : 0.42 + 0.5 * p.depth;
        ctx.globalAlpha = Math.max(0.05, Math.min(1, base * twinkle * (0.15 + 0.85 * prog)));
        ctx.strokeStyle = p.color;
        drawTri(x, y, p.size, p.rot);
      }
      ctx.globalAlpha = 1;
      if (reduced) cancelAnimationFrame(raf); // один статичный кадр
    };

    const onMouse = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onResize = () => rebuild();

    rebuild();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouse, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouse);
    };
  }, []);

  return (
    <div className="ttl-hero-canvas" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
