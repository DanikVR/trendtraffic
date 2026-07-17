/**
 * Constellation — сквозная скролл-хореография частиц (референс Dala).
 *
 * Фиксированный канвас на весь вьюпорт живёт ПОД контентом всю страницу.
 * Сотни контурных треугольников собираются в 3D-фигуры и распадаются по скроллу:
 *   герой → play-знак (бренд) · statement/how/фичи → рассеянное «поле хаоса» ·
 *   экономия → стрелка роста · тариф → лёгкий хаос · финал → снова play-знак.
 *
 * Механика: у каждой частицы есть цель в текущей точке таймлайна; частица
 * «догоняет» её (ease-follow, независим от FPS) — отсюда живые шлейфы при
 * скролле и сборка из разлёта на старте. В переходах между фигурами шум
 * усиливается колоколом (эффект взрыва/сборки). Фигуры покачиваются вокруг
 * оси Y (sway) в честной 3D-проекции с перспективой; параллакс от мыши.
 */

import { useEffect, useRef } from 'react';

type Vec3 = { x: number; y: number; z: number };
type ShapeName = 'play' | 'chaos' | 'arrow';

type Particle = {
  x: number; y: number;          // текущая экранная позиция
  size: number;
  color: string;
  rot: number;
  rotSpeed: number;
  phase: number;
  follow: number;                // индивидуальная скорость «догона» (разброс = органика)
  chaosDim: number;              // множитель альфы в хаосе (большинство почти гаснет)
  seed: number;
};

type Key = { at: number; shape: ShapeName; ax: number; ay: number; s: number };

const COLORS = [
  '#efe6d8', '#efe6d8', '#f4eee2', '#ffffff', '#e8ddc8',
  '#8052ff', '#8052ff', '#a688ff', '#6f42e8',
  '#ffb829', '#ffb829', '#2fbfa0', '#ff5ad1', '#5aa0ff',
];

const easeInOut = (t: number) => t * t * (3 - 2 * t);            // smoothstep
const bell = (t: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, t))); // пик в середине перехода

/** Точки внутри play-треугольника со скруглёнными углами → нормализованные 3D. */
function genPlay(n: number): Vec3[] {
  const c = document.createElement('canvas');
  c.width = 240; c.height = 240;
  const g = c.getContext('2d')!;
  const p = [[30, 18], [222, 120], [30, 222]] as const;
  g.beginPath();
  g.moveTo(p[0][0], p[0][1]);
  g.lineTo(p[1][0], p[1][1]);
  g.lineTo(p[2][0], p[2][1]);
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = 26;
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.stroke();
  g.fill();
  const img = g.getImageData(0, 0, 240, 240).data;
  const pts: Vec3[] = [];
  let guard = 0;
  while (pts.length < n && guard < n * 80) {
    guard++;
    const x = Math.random() * 240;
    const y = Math.random() * 240;
    if (img[(Math.floor(y) * 240 + Math.floor(x)) * 4 + 3] > 128) {
      pts.push({ x: x / 240 - 0.5, y: y / 240 - 0.5, z: (Math.random() - 0.5) * 0.16 });
    }
  }
  while (pts.length < n) pts.push({ x: 0, y: 0, z: 0 });
  return pts;
}

/** Стрелка роста: ломаная снизу-слева вверх-вправо + наконечник. */
function genArrow(n: number): Vec3[] {
  const path = [
    { x: -0.46, y: 0.32 }, { x: -0.14, y: 0.04 }, { x: 0.02, y: 0.18 }, { x: 0.40, y: -0.24 },
  ];
  const segs: Array<{ ax: number; ay: number; dx: number; dy: number; len: number }> = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const dx = path[i + 1].x - path[i].x;
    const dy = path[i + 1].y - path[i].y;
    const len = Math.hypot(dx, dy);
    segs.push({ ax: path[i].x, ay: path[i].y, dx, dy, len });
    total += len;
  }
  // Наконечник — треугольник по направлению последнего сегмента
  const last = segs[segs.length - 1];
  const dirX = last.dx / last.len, dirY = last.dy / last.len;
  const tipX = 0.40 + dirX * 0.14, tipY = -0.24 + dirY * 0.14;
  const perpX = -dirY, perpY = dirX;
  const b1x = 0.40 + perpX * 0.085, b1y = -0.24 + perpY * 0.085;
  const b2x = 0.40 - perpX * 0.085, b2y = -0.24 - perpY * 0.085;

  const pts: Vec3[] = [];
  const headCount = Math.floor(n * 0.28);
  for (let i = 0; i < n - headCount; i++) {
    let d = Math.random() * total;
    let seg = segs[0];
    for (const s of segs) { if (d <= s.len) { seg = s; break; } d -= s.len; }
    const t = d / seg.len;
    const px = seg.ax + seg.dx * t;
    const py = seg.ay + seg.dy * t;
    const pl = Math.hypot(seg.dx, seg.dy);
    const nx = -seg.dy / pl, ny = seg.dx / pl;
    const off = (Math.random() - 0.5) * 0.075;
    pts.push({ x: px + nx * off, y: py + ny * off, z: (Math.random() - 0.5) * 0.12 });
  }
  for (let i = 0; i < headCount; i++) {
    // равномерно в треугольнике наконечника (барицентрически)
    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    pts.push({
      x: tipX + (b1x - tipX) * u + (b2x - tipX) * v,
      y: tipY + (b1y - tipY) * u + (b2y - tipY) * v,
      z: (Math.random() - 0.5) * 0.12,
    });
  }
  return pts;
}

/** Хаос: равномерное облако в единичном кубе (масштабируется на весь вьюпорт). */
function genChaos(n: number): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    pts.push({ x: Math.random() - 0.5, y: Math.random() - 0.5, z: Math.random() - 0.5 });
  }
  return pts;
}

export function Constellation({
  started, posRef, ambient = false, ambientTotalRef,
}: {
  started: boolean;
  /** Текущий ВИЗУАЛЬНЫЙ скролл (лерпнутый cur плавного скролла или window.scrollY). */
  posRef: { current: number };
  /**
   * Ambient-режим (правовые страницы): таймлайн строится от долей полной
   * прокрутки, фигуры собраны ВСЮ дорогу (play→стрелка→play→стрелка) с
   * короткими морф-вспышками между — без длинных тусклых фаз «хаоса»,
   * якорных секций лендинга (#how/#savings/…) не требуется.
   */
  ambient?: boolean;
  /**
   * Ambient: полный пробег прокрутки хоста (px), если скроллит не window
   * (например, /billing внутри лейаута приложения). Без него — body.scrollHeight.
   */
  ambientTotalRef?: { current: number };
}) {
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
    let W = 0, H = 0, dpr = 1;
    let narrow = false;
    let particles: Particle[] = [];
    let shapes: Record<ShapeName, Vec3[]> = { play: [], chaos: [], arrow: [] };
    let keys: Key[] = [];
    let framesSinceMeasure = 0;
    const mouse = { x: 0, y: 0 };
    const F = 620; // фокус перспективы, px

    const buildParticles = () => {
      const count = narrow ? 800 : 1500;
      shapes = { play: genPlay(count), chaos: genChaos(count), arrow: genArrow(count) };
      particles = [];
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = (0.4 + Math.random() * 0.8) * Math.max(W, H);
        particles.push({
          x: W * 0.6 + Math.cos(ang) * rad,
          y: H * 0.5 + Math.sin(ang) * rad,
          size: 2.2 + Math.random() * 3.6,
          color: COLORS[(Math.random() * COLORS.length) | 0],
          rot: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 0.0011,
          phase: Math.random() * Math.PI * 2,
          follow: 0.0035 + Math.random() * 0.004, // коэф. для 1-exp(-dt*k)
          chaosDim: Math.random() < 0.62 ? 0.10 + Math.random() * 0.12 : 0.45 + Math.random() * 0.3,
          seed: Math.random() * 1000,
        });
      }
    };

    /** Опорные точки таймлайна из реальных позиций секций (transform-независимо). */
    const measure = () => {
      const pos = posRef.current;
      if (ambient) {
        const vh = H;
        const total = Math.max(ambientTotalRef?.current || (document.body.scrollHeight - vh), vh);
        const side = narrow ? 0.5 : 0.72;
        const side2 = narrow ? 0.5 : 0.70;
        keys = [
          { at: 0,            shape: 'play',  ax: side,  ay: narrow ? 0.42 : 0.52, s: 1.04 },
          { at: total * 0.35, shape: 'arrow', ax: side2, ay: 0.48, s: 1.02 },
          { at: total * 0.70, shape: 'play',  ax: side,  ay: 0.50, s: 1.00 },
          { at: total + vh,   shape: 'arrow', ax: side2, ay: 0.46, s: 1.05 },
        ];
        return;
      }
      const top = (id: string, fallback: number) => {
        const el = document.getElementById(id);
        return el ? el.getBoundingClientRect().top + pos : fallback;
      };
      const vh = H;
      const how = top('how', vh * 2);
      const sav = top('savings', vh * 5);
      const price = top('pricing', vh * 7);
      const fin = top('final', vh * 8);
      const total = Math.max(document.body.scrollHeight - vh, fin + vh);
      const side = narrow ? 0.5 : 0.72;          // на узких — по центру, за текстом
      const side2 = narrow ? 0.5 : 0.70;
      keys = [
        { at: 0,                 shape: 'play',  ax: side,  ay: narrow ? 0.40 : 0.55, s: 1.00 },
        { at: vh * 0.5,          shape: 'play',  ax: side2, ay: 0.42, s: 1.16 },
        { at: how - vh * 0.55,   shape: 'chaos', ax: 0.5,   ay: 0.5,  s: 1.00 },
        { at: sav - vh * 0.85,   shape: 'chaos', ax: 0.5,   ay: 0.5,  s: 1.00 },
        { at: sav - vh * 0.15,   shape: 'arrow', ax: side,  ay: 0.46, s: 1.04 },
        { at: price - vh * 0.60, shape: 'arrow', ax: side,  ay: 0.46, s: 1.04 },
        { at: price + vh * 0.10, shape: 'chaos', ax: 0.5,   ay: 0.5,  s: 0.95 },
        { at: fin - vh * 0.20,   shape: 'play',  ax: side,  ay: 0.52, s: 1.06 },
        { at: total + vh,        shape: 'play',  ax: side,  ay: 0.40, s: 1.12 },
      ];
    };

    const resize = () => {
      const rect = canvas.parentElement!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      narrow = W < 960;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!particles.length) buildParticles();
      measure();
    };

    /** Мировые координаты точки фигуры (масштаб + sway-поворот вокруг Y). */
    const worldPoint = (shape: ShapeName, pt: Vec3, sc: number, now: number, out: Vec3) => {
      if (shape === 'chaos') {
        out.x = pt.x * W * 1.18 * sc;
        out.y = pt.y * H * 1.18 * sc;
        out.z = pt.z * 560 * sc;
        return;
      }
      const box = Math.min(W, H) * (narrow ? 0.58 : 0.66) * sc;
      const x = pt.x * box, y = pt.y * box, z = pt.z * box;
      const th = Math.sin(now * 0.00033 + (shape === 'arrow' ? 2.1 : 0.4)) * 0.42; // sway
      const cos = Math.cos(th), sin = Math.sin(th);
      out.x = x * cos + z * sin;
      out.y = y;
      out.z = -x * sin + z * cos;
    };

    const pa: Vec3 = { x: 0, y: 0, z: 0 };
    const pb: Vec3 = { x: 0, y: 0, z: 0 };

    let last = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!last) last = now;
      const dt = Math.min(64, now - last);
      last = now;

      // периодическая перемерка (лениво): макет мог сдвинуться (шрифты/резайз контента)
      if (++framesSinceMeasure > 150) { framesSinceMeasure = 0; measure(); }

      const pos = posRef.current;
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1.1;

      if (!keys.length) return;

      // Активный сегмент таймлайна
      let i = 0;
      while (i < keys.length - 2 && pos > keys[i + 1].at) i++;
      const A = keys[i], B = keys[i + 1];
      const span = Math.max(1, B.at - A.at);
      const t = easeInOut(Math.min(1, Math.max(0, (pos - A.at) / span)));
      const morphing = A.shape !== B.shape;
      const boost = morphing ? bell(t) : 0;                    // турбулентность перехода
      const chaosW = (A.shape === 'chaos' ? 1 - t : 0) + (B.shape === 'chaos' ? t : 0);
      const cx = W * (A.ax + (B.ax - A.ax) * t);
      const cy = H * (A.ay + (B.ay - A.ay) * t);
      const sc = A.s + (B.s - A.s) * t;
      const ampBase = 3.5 + chaosW * 14 + boost * 34;
      const startGate = startedRef.current || reduced;

      const ptsA = shapes[A.shape];
      const ptsB = shapes[B.shape];

      for (let k = 0; k < particles.length; k++) {
        const p = particles[k];

        worldPoint(A.shape, ptsA[k], sc, now, pa);
        let mx = pa.x, my = pa.y, mz = pa.z;
        if (morphing) {
          worldPoint(B.shape, ptsB[k], sc, now, pb);
          mx += (pb.x - mx) * t; my += (pb.y - my) * t; mz += (pb.z - mz) * t;
        }

        const persp = F / (F + mz);
        // шум-дрейф (в переходах — буря)
        const nx = Math.sin(now * 0.00045 + p.phase) * ampBase * (0.5 + persp * 0.5);
        const ny = Math.cos(now * 0.00038 + p.phase * 1.7 + p.seed) * ampBase * (0.5 + persp * 0.5);
        const par = (persp - 0.75) * 40;
        const tx = cx + mx * persp + nx + mouse.x * par;
        const ty = cy + my * persp + ny + mouse.y * par * 0.65;

        if (startGate) {
          if (reduced) { p.x = tx; p.y = ty; }
          else {
            const f = 1 - Math.exp(-dt * p.follow);
            p.x += (tx - p.x) * f;
            p.y += (ty - p.y) * f;
          }
        } else {
          // до конца прелоадера — лёгкий дрейф разлетевшегося состояния
          p.x += Math.sin(now * 0.0004 + p.phase) * 0.15;
          p.y += Math.cos(now * 0.00035 + p.phase) * 0.15;
        }

        p.rot += p.rotSpeed * dt * (1 + boost * 2.5);

        const twinkle = reduced ? 1 : 0.6 + 0.4 * Math.sin(now * 0.0011 * (0.5 + persp) + p.phase);
        const dimChaos = 1 + (p.chaosDim - 1) * chaosW;         // в хаосе большинство гаснет
        let alpha = (0.42 + 0.58 * Math.max(0.12, persp - 0.3)) * twinkle * dimChaos;
        if (!startGate) alpha *= 0.25;
        if (narrow) alpha *= 0.48;                               // на мобиле — фоновее (текст читается поверх)
        ctx.globalAlpha = Math.max(0.04, Math.min(1, alpha));
        ctx.strokeStyle = p.color;

        const s = p.size * persp;
        ctx.beginPath();
        for (let v = 0; v < 3; v++) {
          const a = p.rot + (v * Math.PI * 2) / 3;
          const px = p.x + Math.cos(a) * s;
          const py = p.y + Math.sin(a) * s;
          if (v === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    const onMouse = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };

    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouse, { passive: true });
    // отдельная перемерка после загрузки шрифтов (высоты секций меняются)
    const fontsReady = (document as any).fonts?.ready as Promise<unknown> | undefined;
    fontsReady?.then(() => measure()).catch(() => {});
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouse);
    };
  }, [posRef, ambient]);

  return (
    <div className="ttl-fx" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
