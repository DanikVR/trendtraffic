/**
 * TrendTraffic — реальный исполнитель шага рендера (HTTP к воркеру OpenMontage).
 *
 * Заменяет SimulationExecutor, когда задан RENDER_WORKER_URL (см. server.ts).
 * Маршрутизация:
 *  - CPU-шаги  → RENDER_WORKER_URL (рендер-VPS по Tailscale);
 *  - GPU-шаги  → RENDER_GPU_WORKER_URL (домашний RTX 5080), с учётом ctx.gpuTarget;
 *    нет URL / 'off' → шаг пропускается с заметкой (конвейер не падает).
 *
 * Файлы: вход — абсолютный URL web-VPS (/uploads → PUBLIC_BASE_URL); выход воркера
 * скачиваем и кладём в uploads/renders (его потом подхватывает Галерея).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { RenderStep } from './types.js';
import type { StepContext, StepResult, StepExecutor } from './executor.js';
import { getRenderWorkerUrl, getRenderGpuWorkerUrl } from '../../config/systemConfig.js';

const __dirname_e = path.dirname(fileURLToPath(import.meta.url));
const RENDERS_DIR = path.resolve(__dirname_e, '../../../../uploads/renders');

/** Базовый публичный адрес web-VPS (чтобы воркер скачал вход по абсолютному URL). */
function publicBase(): string {
  return String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
}

/** Относительный /uploads/... → абсолютный (если задан PUBLIC_BASE_URL). */
function toAbsolute(url: string | null): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = publicBase();
  return base ? base + (url.startsWith('/') ? url : '/' + url) : url;
}

async function postJson(url: string, body: unknown, timeoutMs = 900_000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((data as any)?.error || `воркер вернул HTTP ${r.status}`);
    return data;
  } finally {
    clearTimeout(t);
  }
}

async function downloadToFile(url: string, dest: string, timeoutMs = 900_000): Promise<void> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`скачивание результата: HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(dest, buf);
  } finally {
    clearTimeout(t);
  }
}

export class HttpWorkerExecutor implements StepExecutor {
  async execute(step: RenderStep, ctx: StepContext): Promise<StepResult> {
    // 1) Куда слать шаг
    let workerUrl: string;
    if (step.target === 'gpu') {
      if (ctx.gpuTarget === 'off') return { skipped: true, note: 'GPU выключен в админке — шаг пропущен' };
      const gpu = getRenderGpuWorkerUrl();
      if (!gpu) return { skipped: true, note: `GPU-воркер (${ctx.gpuTarget}) ещё не подключён — шаг пропущен` };
      workerUrl = gpu;
    } else {
      const cpu = getRenderWorkerUrl();
      if (!cpu) return { skipped: true, note: 'CPU-воркер OpenMontage не настроен (RENDER_WORKER_URL) — шаг пропущен' };
      workerUrl = cpu;
    }

    // 2) Выполнить шаг на воркере
    const res = await postJson(`${workerUrl}/execute`, {
      tool: step.tool,
      kind: step.kind,
      llm: step.llm,
      params: step.params,
      input_url: toAbsolute(ctx.currentUrl),
      base_url: publicBase(),
      job_id: ctx.jobId,
      tenant_id: ctx.tenantId,
    });

    if (res?.skipped) return { skipped: true, note: res.note || 'шаг пропущен воркером' };
    if (!res?.output_name) {
      // Воркер ничего не произвёл — проброс текущего медиа дальше.
      return { outputUrl: ctx.currentUrl, note: res?.note || 'без изменений (passthrough)' };
    }

    // 3) Забрать результат воркера → сохранить в uploads/renders
    fs.mkdirSync(RENDERS_DIR, { recursive: true });
    const ext = path.extname(String(res.output_name)) || '.mp4';
    const localName = `${ctx.jobId}-${Date.now().toString(36)}${ext}`;
    await downloadToFile(`${workerUrl}/files/${encodeURIComponent(res.output_name)}`, path.join(RENDERS_DIR, localName));
    return { outputUrl: `/uploads/renders/${localName}`, note: res.note };
  }
}
