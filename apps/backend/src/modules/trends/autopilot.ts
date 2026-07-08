/**
 * TrendTraffic — АВТОПИЛОТ ТРЕНДОВ: конвейер «тренд → автоанализ → UGC».
 *
 * trend_watches («автоанализ ключевика»): по расписанию сканируем тренды по слову,
 * берём ОДНО ещё не анализированное видео (предпочтение — по новизне), скачиваем
 * его с анализом (ingestTrendVideo: файл + TrendDNA + покадровый Gemini) и, если к
 * watch привязан UGC-шаблон с автопубликацией, собираем ролик по шаблону.
 *
 * Планировщик — по образцу channels/scheduler.ts (нативный setInterval, без внешних
 * очередей); всё состояние в Postgres (auto_runs) — рестарт бэкенда не теряет журнал.
 * Доступ: строго Enterprise (авто-расходы идут с ключей клиента: TikHub/Claude/
 * Gemini/ElevenLabs/HeyGen). Стоп-краны: интервал ≥ 60 мин, дневной лимит на watch
 * (дефолт 5), автопауза после 3 ошибок подряд.
 *
 * Сборка UGC — внутренним HTTP-вызовом собственного /api/render/ugc/build с
 * подписанным JWT {tenantId}: переиспользуем ВЕСЬ конвейер сборки (4 ветки, форматы,
 * заставки, слои) без дублирования. Скрипт ролика = copyReadyScript из ДНК тренда
 * (перевод на язык шаблона, дефолт en — translateUgcScript).
 */

import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import pool from '../../db/index.js';
import { JWT_SECRET } from '../../config/secrets.js';
import { scanTrends, type StoredVideo } from './service.js';
import { ingestTrendVideo } from './ingest.js';
import { translateUgcScript } from '../render/director.js';
import type { TrendDNA } from './dna.js';

// ── Константы-предохранители ─────────────────────────────────────────────────
export const MIN_INTERVAL_MINUTES = 60;   // чаще раза в час нельзя (деньги клиента)
export const DEFAULT_DAILY_CAP = 5;       // роликов/анализов в сутки на один watch
const FAIL_STREAK_PAUSE = 3;              // подряд ошибок → автопауза watch
const CLAIM_PER_TICK = 2;                 // watch-ей за тик (щадим TikHub/LLM)
const PUBLISH_LADDER = [1, 7, 30, 90, 180, 0] as const; // лестница расширения периода
const BUILD_POLL_MS = 10_000;
const BUILD_TIMEOUT_MS = 45 * 60_000;

export interface TrendWatch {
  id: string;
  tenantId: string;
  keyword: string;
  platform: string;
  scanParams: Record<string, any>;
  intervalMinutes: number;
  enabled: boolean;
  dailyCap: number;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  lastError?: string | null;
  failStreak: number;
  createdAt?: string;
}

function mapWatch(r: any): TrendWatch {
  return {
    id: r.id, tenantId: r.tenant_id, keyword: r.keyword, platform: r.platform,
    scanParams: r.scan_params || {}, intervalMinutes: r.interval_minutes,
    enabled: !!r.enabled, dailyCap: r.daily_cap,
    lastRunAt: r.last_run_at ? new Date(r.last_run_at).toISOString() : null,
    nextRunAt: r.next_run_at ? new Date(r.next_run_at).toISOString() : null,
    lastError: r.last_error || null, failStreak: r.fail_streak || 0,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
  };
}

// ── CRUD (роуты в trends/router.ts) ─────────────────────────────────────────

export async function listWatches(tenantId: string): Promise<TrendWatch[]> {
  const r = await pool.query(`SELECT * FROM trend_watches WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`, [tenantId]);
  return r.rows.map(mapWatch);
}

export async function createWatch(tenantId: string, w: {
  keyword: string; platform?: string; scanParams?: Record<string, any>;
  intervalMinutes?: number; dailyCap?: number;
}): Promise<TrendWatch> {
  const keyword = String(w.keyword || '').trim().slice(0, 255);
  if (!keyword) throw new Error('Укажите ключевое слово.');
  // Только платформы, которые ingestTrendVideo умеет СКАЧИВАТЬ: YouTube отвергается
  // всегда (подпись потоков ненадёжна), Reddit не поддержан анализатором — watch был бы
  // обречён падать каждый прогон.
  const AUTOPILOT_PLATFORMS = ['tiktok', 'instagram', 'twitter'];
  const platform = AUTOPILOT_PLATFORMS.includes(String(w.platform)) ? String(w.platform) : 'tiktok';
  if (w.platform && !AUTOPILOT_PLATFORMS.includes(String(w.platform))) {
    throw new Error('Автоанализ поддерживает TikTok, Instagram и X — на этой платформе скачивание видео недоступно.');
  }
  const interval = Math.max(MIN_INTERVAL_MINUTES, Math.round(Number(w.intervalMinutes) || 1440));
  const cap = Math.min(20, Math.max(1, Math.round(Number(w.dailyCap) || DEFAULT_DAILY_CAP)));
  const params = w.scanParams && typeof w.scanParams === 'object' ? w.scanParams : {};
  const r = await pool.query(
    `INSERT INTO trend_watches (id, tenant_id, keyword, platform, scan_params, interval_minutes, daily_cap, next_run_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, CURRENT_TIMESTAMP) RETURNING *`,
    [randomUUID(), tenantId, keyword, platform, JSON.stringify(params), interval, cap]
  );
  return mapWatch(r.rows[0]);
}

export async function updateWatch(tenantId: string, id: string, patch: {
  enabled?: boolean; intervalMinutes?: number; dailyCap?: number;
}): Promise<TrendWatch | null> {
  const sets: string[] = []; const vals: any[] = [tenantId, id];
  if (typeof patch.enabled === 'boolean') {
    sets.push(`enabled = $${vals.push(patch.enabled)}`);
    // Включение = чистый лист: сброс серии ошибок и немедленный следующий прогон.
    if (patch.enabled) sets.push(`fail_streak = 0`, `last_error = NULL`, `next_run_at = CURRENT_TIMESTAMP`);
  }
  if (Number.isFinite(Number(patch.intervalMinutes))) sets.push(`interval_minutes = $${vals.push(Math.max(MIN_INTERVAL_MINUTES, Math.round(Number(patch.intervalMinutes))))}`);
  if (Number.isFinite(Number(patch.dailyCap))) sets.push(`daily_cap = $${vals.push(Math.min(20, Math.max(1, Math.round(Number(patch.dailyCap)))))}`);
  if (!sets.length) return null;
  const r = await pool.query(`UPDATE trend_watches SET ${sets.join(', ')} WHERE tenant_id = $1 AND id = $2 RETURNING *`, vals);
  return r.rows[0] ? mapWatch(r.rows[0]) : null;
}

export async function deleteWatch(tenantId: string, id: string): Promise<boolean> {
  const r = await pool.query(`DELETE FROM trend_watches WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
  return (r.rowCount || 0) > 0;
}

export async function listRuns(tenantId: string, watchId?: string, limit = 30): Promise<any[]> {
  const lim = Math.min(100, Math.max(1, limit));
  const r = watchId
    ? await pool.query(`SELECT * FROM auto_runs WHERE tenant_id = $1 AND watch_id = $2 ORDER BY started_at DESC LIMIT $3`, [tenantId, watchId, lim])
    : await pool.query(`SELECT * FROM auto_runs WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT $2`, [tenantId, lim]);
  return r.rows.map((row: any) => ({
    id: row.id, watchId: row.watch_id, status: row.status,
    pickedPlatform: row.picked_platform, pickedExternalId: row.picked_external_id, pickedUrl: row.picked_url,
    assetId: row.asset_id, analysisId: row.analysis_id, templateId: row.template_id,
    resultAssetId: row.result_asset_id, resultUrls: row.result_urls || [],
    note: row.note, error: row.error,
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    finishedAt: row.finished_at ? new Date(row.finished_at).toISOString() : null,
  }));
}

// ── Строгий Enterprise-гейт автоцепочки ──────────────────────────────────────
// Автоцепочка — только Enterprise: расходы идут с ключей клиента, у Премиума ключа
// TikHub может не быть вовсе (платил бы платформенный бюджет). global_admin — тесты.
// ТРЁХЗНАЧНЫЙ ответ: true = Enterprise; false = ПОДТВЕРЖДЁННО не Enterprise;
// null = БД не ответила (транзиент) — НЕ выключать watch, просто пропустить прогон.
// (getFeatureAccess здесь не годится: он глотает ошибки чтения и отдаёт tier:null —
//  моргнувший Postgres навсегда выключал бы здоровый Enterprise-watch.)
export async function tenantAllowsAutopilot(tenantId: string): Promise<boolean | null> {
  if (tenantId === 'global_admin') return true;
  try {
    const r = await pool.query(`SELECT tier, status FROM subscriptions WHERE tenant_id = $1 LIMIT 1`, [tenantId]);
    const row = r.rows[0];
    return row?.tier === 'enterprise' && (row?.status === 'active' || row?.status === 'trialing');
  } catch { return null; }
}

// ── Один цикл watch ──────────────────────────────────────────────────────────

async function setRun(runId: string, patch: Record<string, any>): Promise<void> {
  const sets: string[] = []; const vals: any[] = [runId];
  for (const [k, v] of Object.entries(patch)) sets.push(`${k} = $${vals.push(v)}`);
  await pool.query(`UPDATE auto_runs SET ${sets.join(', ')} WHERE id = $1`, vals).catch(() => { /* журнал best-effort */ });
}

/** Видео уже анализировалось (video_analyses) или недавно бралось автопилотом? */
async function pickFresh(tenantId: string, videos: StoredVideo[]): Promise<StoredVideo | null> {
  const ids = videos.map((v) => v.externalId).filter(Boolean);
  if (!ids.length) return null;
  const seen = new Set<string>();
  try {
    const a = await pool.query(
      `SELECT external_id FROM video_analyses WHERE tenant_id = $1 AND external_id = ANY($2)`,
      [tenantId, ids]
    );
    for (const row of a.rows) seen.add(String(row.external_id));
    const b = await pool.query(
      `SELECT picked_external_id FROM auto_runs
       WHERE tenant_id = $1 AND picked_external_id = ANY($2) AND started_at > now() - interval '7 days'`,
      [tenantId, ids]
    );
    for (const row of b.rows) seen.add(String(row.picked_external_id));
  } catch { /* fallback-БД: считаем всё новым */ }
  return videos.find((v) => v.externalId && !seen.has(v.externalId) && v.webUrl) || null;
}

/** Сборка UGC по шаблону: внутренний вызов собственного /ugc/build + поллинг. */
async function buildFromTemplate(opts: {
  tenantId: string; runId: string; watch: TrendWatch;
  template: { id: number; name: string; spec: Record<string, any>; autopublish: Record<string, any> };
  clipUrl: string; dna: TrendDNA | null;
}): Promise<{ resultUrls: { url: string; name: string }[]; assetId: string | null }> {
  const { tenantId, watch, template } = opts;
  const spec: Record<string, any> = JSON.parse(JSON.stringify(template.spec || {}));
  const use = (template.spec?.analysisUse && typeof template.spec.analysisUse === 'object') ? template.spec.analysisUse : {};
  const lang = String(template.autopublish?.language || 'en').toLowerCase().slice(0, 3);

  spec.title = `Авто · ${template.name} · ${watch.keyword}`.slice(0, 90);
  spec.outFolder = 'auto-ugc';
  spec.buildJobId = null; spec.result = null; spec.results = [];
  // Фоновый прогон: только HeyGen API — 'heygen_ext' требует ОТКРЫТОЙ вкладки студии
  // HeyGen у клиента (иначе билд молча висит до 45-мин таймаута каждый прогон).
  spec.faceProvider = 'heygen_api';

  // ТРАНСЛЯЦИЯ РЕЖИМА: шаблон хранит фронтовую спеку (флаги retentionPreset/dialogueEnabled),
  // а /ugc/build ветвится по ОБЪЕКТАМ spec.retention/spec.dialogue, которые в ручном пути
  // строит MontageEditor.ugcBuildStart. Без этого «Монтаж»/«Диалоги» тихо падали бы в соло.
  if (!spec.noAvatar && spec.avatarSource === 'photo' && spec.dialogueEnabled) {
    // Диалог требует разбора ЗАПИСИ двух голосов — в автопрогоне записи нет.
    throw new Error('шаблон в режиме «Диалог двоих» не поддерживается автопубликацией (нужна живая запись) — выберите другой режим');
  }
  if (!spec.noAvatar && spec.avatarSource === 'photo' && spec.retentionPreset && spec.retentionPreset !== 'off') {
    spec.retention = { preset: spec.retentionPreset, brolls: [] };   // B-roll = видео тренда (spec.clip)
  }

  // Видео тренда → Видеоряд (если шаблон не запретил галочкой «видео из анализа»).
  if (use.video !== false) spec.clip = { url: opts.clipUrl, name: watch.keyword };

  // Скрипт: copyReadyScript из ДНК (перевод на язык шаблона; провал → русский текст с
  // пометкой). Режем на предложения-реплики: одна реплика на весь ролик давала бы один
  // гигантский титр в стилях «Строкой»/«Караоке» (approxCaps раскладывает по репликам).
  let scriptNote = '';
  if (use.script !== false) {
    const baseText = String(opts.dna?.copyReadyScript || '').trim();
    if (!baseText) throw new Error('в анализе тренда нет готового скрипта (copyReadyScript)');
    let text = baseText;
    if (lang !== 'ru') {
      const tr = await translateUgcScript({ tenantId, text: baseText, lang });
      if (tr) text = tr; else scriptNote = `перевод на ${lang} не удался — текст на русском`;
    }
    const sentences = text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
    spec.script = (sentences.length ? sentences : [text]).map((t) => ({ speaker: 'A', text: t }));
    spec.source = 'gen';
    spec.langs = [];
  }

  // Титры: пожелания стиля из визуального разбора (если поле пустое в шаблоне).
  if (use.subtitles !== false && opts.dna?.visualStyle && !String(spec.subtitles?.wishes || '').trim()) {
    spec.subtitles = { ...(spec.subtitles || {}), wishes: String(opts.dna.visualStyle).slice(0, 180) };
  }

  // Полный анализ — в сборку (retention-режиссура возьмёт sceneBeats и хук).
  if (opts.dna && (use.retention !== false)) {
    spec.analysis = { use, brief: opts.dna.brief, sceneBeats: opts.dna.sceneBeats, hookAnalysis: opts.dna.hookAnalysis };
  }

  const base = `http://127.0.0.1:${process.env.PORT || 3001}`;
  const token = jwt.sign({ tenantId, role: 'user' }, JWT_SECRET, { expiresIn: '3h' });
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const startRes = await fetch(`${base}/api/render/ugc/build`, { method: 'POST', headers, body: JSON.stringify({ spec }) });
  const startJson: any = await startRes.json().catch(() => ({}));
  if (!startRes.ok || !startJson?.jobId) throw new Error(`сборка UGC не запустилась: ${startJson?.error || `HTTP ${startRes.status}`}`);
  const jobId = String(startJson.jobId);
  await setRun(opts.runId, { note: [scriptNote, `job ${jobId}`].filter(Boolean).join(' · ') || null });

  const deadline = Date.now() + BUILD_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, BUILD_POLL_MS));
    const st = await fetch(`${base}/api/render/ugc/build/status?job=${encodeURIComponent(jobId)}`, { headers });
    const j: any = await st.json().catch(() => ({}));
    if (!st.ok) throw new Error(j?.error || `статус сборки: HTTP ${st.status}`);
    if (j.status === 'failed') throw new Error(`сборка UGC: ${j.error || 'ошибка'}`);
    if (j.status === 'done') {
      const results = Array.isArray(j.results) && j.results.length ? j.results : (j.fileUrl ? [{ url: j.fileUrl, name: spec.title }] : []);
      return { resultUrls: results, assetId: j.assetId || null };
    }
  }
  throw new Error('сборка UGC не уложилась в 45 минут');
}

/** Полный цикл одного watch: скан → выбор нового → скачивание+анализ → (опц.) сборка. */
export async function runWatchCycle(watch: TrendWatch): Promise<void> {
  const tenantId = watch.tenantId;

  const allowed = await tenantAllowsAutopilot(tenantId);
  if (allowed === null) return; // БД моргнула: claim уже сдвинул расписание — проверим в следующий прогон
  if (!allowed) {
    await pool.query(
      `UPDATE trend_watches SET enabled = FALSE, last_error = $2 WHERE id = $1`,
      [watch.id, 'Автоанализ доступен только на тарифе Enterprise — watch выключен.']
    ).catch(() => { /* */ });
    return;
  }

  // Дневной лимит = НАЧАТЫЕ прогоны (любой статус, кроме skipped «нет новых видео»):
  // предохранитель про деньги, а упавший на последнем шаге прогон уже потратил
  // TikHub/Claude/Gemini (и часто HeyGen). Прыжок next_run_at на завтра.
  try {
    const c = await pool.query(
      `SELECT COUNT(*)::int AS n FROM auto_runs
       WHERE watch_id = $1 AND started_at >= date_trunc('day', now()) AND status <> 'skipped'`,
      [watch.id]
    );
    if ((c.rows[0]?.n || 0) >= watch.dailyCap) {
      await pool.query(
        `UPDATE trend_watches SET next_run_at = date_trunc('day', now()) + interval '1 day 5 minutes', last_error = NULL WHERE id = $1`,
        [watch.id]
      );
      return;
    }
  } catch { /* fallback-БД — продолжаем */ }

  const runId = randomUUID();
  await pool.query(
    `INSERT INTO auto_runs (id, tenant_id, watch_id, status) VALUES ($1,$2,$3,'scanning')`,
    [runId, tenantId, watch.id]
  ).catch(() => { /* журнал best-effort */ });

  try {
    // 1) Скан с лестницей периода: нет новых видео → расширяем publishTime.
    const p = watch.scanParams || {};
    const basePublish = PUBLISH_LADDER.includes(Number(p.publishTime) as any) ? Number(p.publishTime) : 7;
    const startIdx = Math.max(0, PUBLISH_LADDER.indexOf(basePublish as any));
    let pick: StoredVideo | null = null;
    let usedPublish = basePublish;
    // Лестница периода имеет смысл только для TikTok — прочие платформы publishTime
    // игнорируют (provider.search его не принимает): 6 одинаковых платных сканов не гоняем.
    const ladderEnd = watch.platform === 'tiktok' ? PUBLISH_LADDER.length : startIdx + 1;
    for (let i = startIdx; i < ladderEnd && !pick; i++) {
      usedPublish = PUBLISH_LADDER[i];
      const scan = await scanTrends(tenantId, {
        kind: 'keyword', query: watch.keyword, platform: watch.platform as any,
        count: 30, mode: (['video', 'general', 'app'].includes(p.mode) ? p.mode : 'app'),
        sortType: ([0, 1, 2].includes(Number(p.sortType)) ? Number(p.sortType) : 2) as 0 | 1 | 2, // дефолт: по новизне
        publishTime: usedPublish as any,
        filters: p.filters && typeof p.filters === 'object' ? p.filters : undefined,
      } as any);
      pick = await pickFresh(tenantId, scan.videos);
    }
    if (!pick) {
      // «Новых видео нет» — НОРМАЛЬНОЕ состояние нишевого ключевика, не ошибка:
      // fail_streak не трогаем, расписание уже сдвинуто при claim.
      await setRun(runId, { status: 'skipped', note: 'новых видео нет — все найденные уже анализировались', finished_at: new Date() });
      await pool.query(`UPDATE trend_watches SET last_error = NULL WHERE id = $1`, [watch.id]).catch(() => { /* */ });
      return;
    }

    await setRun(runId, {
      status: 'ingesting', picked_platform: pick.platform, picked_external_id: pick.externalId, picked_url: pick.webUrl,
      note: usedPublish !== basePublish ? `период расширен до ${usedPublish === 0 ? 'всего времени' : usedPublish + ' дн.'}` : null,
    });

    // 2) Скачивание + анализ (файл + TrendDNA + покадровый Gemini) — ждём результат.
    const ing = await ingestTrendVideo(tenantId, String(pick.webUrl), { awaitAnalysis: true });
    await setRun(runId, { asset_id: ing.asset?.id || null, analysis_id: ing.analysis?.id || null });

    // 3) Шаблоны с автопубликацией, привязанные к этому watch.
    const tpls = await pool.query(
      `SELECT id, name, spec, autopublish FROM ugc_templates
       WHERE tenant_id = $1 AND autopublish->>'enabled' = 'true'
         AND autopublish->'source'->>'type' = 'trend_watch' AND autopublish->'source'->>'id' = $2`,
      [tenantId, watch.id]
    ).catch(() => ({ rows: [] as any[] }));

    if (tpls.rows.length) {
      if (ing.analysisError || !ing.dna) throw new Error(`анализ не построился (${ing.analysisError || 'нет ДНК'}) — сборка по шаблону пропущена`);
      await setRun(runId, { status: 'building', template_id: tpls.rows[0].id });
      const t = tpls.rows[0];
      const built = await buildFromTemplate({
        tenantId, runId, watch,
        template: { id: Number(t.id), name: String(t.name), spec: t.spec || {}, autopublish: t.autopublish || {} },
        clipUrl: ing.fileUrl, dna: ing.dna,
      });
      await setRun(runId, { result_asset_id: built.assetId, result_urls: JSON.stringify(built.resultUrls) });
    } else if (ing.analysisError) {
      await setRun(runId, { note: `анализ: ${ing.analysisError}` });
    }

    await setRun(runId, { status: 'done', finished_at: new Date() });
    await pool.query(`UPDATE trend_watches SET fail_streak = 0, last_error = NULL WHERE id = $1`, [watch.id]).catch(() => { /* */ });
  } catch (e: any) {
    const msg = String(e?.message || e).slice(0, 500);
    await setRun(runId, { status: 'failed', error: msg, finished_at: new Date() });
    try {
      const r = await pool.query(
        `UPDATE trend_watches SET fail_streak = fail_streak + 1, last_error = $2 WHERE id = $1 RETURNING fail_streak`,
        [watch.id, msg]
      );
      if ((r.rows[0]?.fail_streak || 0) >= FAIL_STREAK_PAUSE) {
        await pool.query(
          `UPDATE trend_watches SET enabled = FALSE, last_error = $2 WHERE id = $1`,
          [watch.id, `${msg} — автопауза после ${FAIL_STREAK_PAUSE} ошибок подряд`]
        );
      }
    } catch { /* */ }
    console.warn(`[trend-autopilot] watch ${watch.id} (${watch.keyword}):`, msg);
  }
}

// Прогоны, идущие прямо сейчас в ЭТОМ процессе: защита от параллельного запуска
// одного watch («Прогнать сейчас» поверх идущего цикла / двойной клик).
const inFlight = new Set<string>();
async function runGuarded(watch: TrendWatch): Promise<void> {
  if (inFlight.has(watch.id)) return;
  inFlight.add(watch.id);
  try { await runWatchCycle(watch); }
  finally { inFlight.delete(watch.id); }
}

/** Ручной запуск «Прогнать сейчас» (кнопка в UI): сдвигает расписание как обычный прогон.
 *  Если цикл этого watch уже идёт — второй не запускаем (busy). */
export async function runWatchNow(tenantId: string, watchId: string): Promise<{ started: boolean; busy?: boolean }> {
  if (inFlight.has(watchId)) return { started: false, busy: true };
  const r = await pool.query(
    `UPDATE trend_watches SET last_run_at = now(),
       next_run_at = now() + make_interval(mins => GREATEST(interval_minutes, ${MIN_INTERVAL_MINUTES}))
     WHERE tenant_id = $1 AND id = $2 RETURNING *`,
    [tenantId, watchId]
  );
  if (!r.rows[0]) return { started: false };
  void runGuarded(mapWatch(r.rows[0]));
  return { started: true };
}

// ── Планировщик ──────────────────────────────────────────────────────────────

let started = false;
let claiming = false;

export function startTrendAutopilot(): void {
  if (started) return;
  started = true;
  const TICK_MS = 60 * 1000;
  const run = async () => {
    if (claiming) return;   // защита от наезда самих claim-запросов
    claiming = true;
    try {
      // Похороны протухших прогонов: pm2-рестарт мид-цикла оставлял строку в
      // scanning/ingesting/building навсегда — она съедала dailyCap и висела в журнале.
      // 2 часа заведомо больше худшего легитимного прогона (скан + анализ + 45-мин билд).
      await pool.query(
        `UPDATE auto_runs SET status = 'failed', error = COALESCE(error, 'прерван (рестарт сервера)'), finished_at = now()
         WHERE finished_at IS NULL AND started_at < now() - interval '2 hours'`
      ).catch(() => { /* fallback-БД */ });

      // Атомарный claim (FOR UPDATE SKIP LOCKED) + сдвиг расписания ДО работы:
      // упавший прогон не зациклит watch на каждый тик. Сами циклы НЕ ждём:
      // 45-минутный билд одного тенанта не должен стопорить watch-и остальных
      // (дубль-запуск watch исключает inFlight, повторный claim — сдвиг next_run_at).
      const r = await pool.query(
        `UPDATE trend_watches SET last_run_at = now(),
           next_run_at = now() + make_interval(mins => GREATEST(interval_minutes, ${MIN_INTERVAL_MINUTES}))
         WHERE id IN (
           SELECT id FROM trend_watches WHERE enabled = TRUE AND next_run_at <= now()
           ORDER BY next_run_at LIMIT ${CLAIM_PER_TICK} FOR UPDATE SKIP LOCKED
         ) RETURNING *`
      );
      for (const row of r.rows) void runGuarded(mapWatch(row));
    } catch (err) {
      console.warn('[trend-autopilot] tick error:', (err as any)?.message || err);
    } finally {
      claiming = false;
    }
  };
  setTimeout(run, 120 * 1000);   // первый прогон через 2 мин после старта сервера
  setInterval(run, TICK_MS);
  console.log('[trend-autopilot] запущен (тик/мин, интервал watch ≥ 60 мин, Enterprise-only)');
}
