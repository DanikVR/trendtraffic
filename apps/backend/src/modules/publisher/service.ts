/**
 * Публикатор — сервисный слой Ф2–Ф5. Используется роутером И планировщиком (scheduler.ts).
 *
 * Слоты «Моё расписание» — СВОИ (таблица publisher_slots, dow/hh/mm в UTC): слоты Blotato
 * гейтятся его тарифом (живой зонд юзера получил 401), свои же работают у всех и нужны
 * цепочкам. Режим «Следующий слот» = наш расчёт → в Blotato уходит обычный scheduledTime.
 *
 * Пост-движок (Ф3): Claude (ключ тенанта «ИИ-режиссёр», как ДНК трендов) пишет подпись
 * per-платформа + хэштеги (бренд/ниша — из TrendDNA ролика, если есть разбор) с A/B-вариантами.
 * Хэштеги «актуальные из TikHub-скана» — TODO следующего витка (дорогой вызов в каптионе).
 *
 * Цепочки (Ф2/Ф4): manual — серия готовых роликов раскладывается по свободным слотам СРАЗУ
 * при создании; auto — тик подхватывает свежие НЕопубликованные ролики автопилота
 * (папка auto-ugc), пишет подпись и ставит в ближайший свободный слот (dailyCap + автопауза
 * после 3 фейлов подряд).
 *
 * Ретраи (Ф5): транзиентные фейлы сабмита получают next_retry_at (2→4→8 мин, до 3 попыток);
 * тик пере-отправляет. Статус-синк — тот же ленивый Get Post Status, но и ВНЕ открытой ленты.
 */

import { randomUUID } from 'crypto';
import pool from '../../db/index.js';
import { getEffectiveProviderKey } from '../tenant_settings/provider_keys.js';
import { resolveAnthropicKey, DEFAULT_DIRECTOR_MODEL } from '../render/director.js';
import { getTrendDNAByAsset } from '../trends/dna.js';
import { AUTO_UGC_FOLDER } from '../media/assets.js';
import {
  createPost, getPostStatus, cancelScheduled, BlotatoError,
  BLOTATO_PLATFORMS, type BlotatoPlatform,
} from './blotato.js';

// ── Общее ────────────────────────────────────────────────────────────────────
export async function tenantBlotatoKey(tenantId: string): Promise<string | null> {
  return getEffectiveProviderKey(tenantId, 'blotato');
}

/** Абсолютная база для медиа-URL, когда нет req (планировщик): env обязателен на проде. */
export function publicBase(): string {
  return String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
}
export const absUrl = (base: string, u?: string | null): string =>
  (u && !/^https?:\/\//i.test(u) ? base + (u.startsWith('/') ? u : '/' + u) : (u || ''));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Платформенные target'ы (обязательные поля — с безопасными дефолтами) ─────
export function buildTarget(platform: BlotatoPlatform, o: Record<string, any>, fallbackTitle: string): Record<string, unknown> {
  switch (platform) {
    case 'tiktok': return {
      targetType: 'tiktok',
      privacyLevel: o.privacyLevel || 'PUBLIC_TO_EVERYONE',
      disabledComments: !!o.disabledComments,
      disabledDuet: !!o.disabledDuet,
      disabledStitch: !!o.disabledStitch,
      isBrandedContent: !!o.isBrandedContent,
      isYourBrand: !!o.isYourBrand,
      isAiGenerated: o.isAiGenerated !== false,
      ...(o.isDraft ? { isDraft: true } : {}),
      ...(o.title ? { title: String(o.title).slice(0, 90) } : {}),
    };
    case 'youtube': return {
      targetType: 'youtube',
      title: String(o.title || fallbackTitle || 'Video').slice(0, 100),
      privacyStatus: o.privacyStatus || 'public',
      shouldNotifySubscribers: o.shouldNotifySubscribers !== false,
      ...(o.isMadeForKids != null ? { isMadeForKids: !!o.isMadeForKids } : {}),
      ...(o.containsSyntheticMedia != null ? { containsSyntheticMedia: !!o.containsSyntheticMedia } : {}),
    };
    case 'instagram': return {
      targetType: 'instagram',
      ...(o.mediaType && o.mediaType !== 'post' ? { mediaType: o.mediaType } : {}),
    };
    case 'facebook': return {
      targetType: 'facebook',
      pageId: String(o.pageId || ''),
      ...(o.mediaType ? { mediaType: o.mediaType } : {}),
      ...(o.link ? { link: o.link } : {}),
    };
    case 'linkedin': return { targetType: 'linkedin', ...(o.pageId ? { pageId: String(o.pageId) } : {}) };
    case 'pinterest': return {
      targetType: 'pinterest',
      boardId: String(o.boardId || ''),
      ...(o.title ? { title: o.title } : {}),
      ...(o.link ? { link: o.link } : {}),
      ...(o.altText ? { altText: o.altText } : {}),
    };
    case 'threads': return { targetType: 'threads', ...(o.replyControl ? { replyControl: o.replyControl } : {}) };
    default: return { targetType: platform }; // twitter | bluesky
  }
}

/** Ошибки, которые Blotato вернёт гарантированно, — ловим ДО сабмита (НЕ ретраятся). */
export function targetPrecheck(platform: BlotatoPlatform, o: Record<string, any>): string | null {
  if (platform === 'facebook' && !o.pageId) return 'Facebook: не выбрана страница (pageId)';
  if (platform === 'pinterest' && !o.boardId) return 'Pinterest: не выбрана доска (boardId)';
  return null;
}

// ── Медиа из Галереи ─────────────────────────────────────────────────────────
export async function resolveMedia(tenantId: string, args: { assetId?: string; mediaUrl?: string; title?: string })
  : Promise<{ fileUrl: string; title: string }> {
  if (args.assetId) {
    const r = await pool.query(
      `SELECT file_url, original_name FROM media_assets WHERE id = $1 AND tenant_id = $2`,
      [args.assetId, tenantId]
    );
    if (!r.rows[0]) throw new Error('Файл не найден в Галерее');
    return { fileUrl: r.rows[0].file_url, title: args.title || r.rows[0].original_name || '' };
  }
  return { fileUrl: String(args.mediaUrl || ''), title: args.title || '' };
}

// ── Слоты «Моё расписание» (наши; dow/hh/mm в UTC, dow: 0=Вс … 6=Сб как JS getUTCDay) ──
export interface SlotRow { id: number; dow: number; hh: number; mm: number }

export async function listSlots(tenantId: string): Promise<SlotRow[]> {
  const r = await pool.query(
    `SELECT id, dow, hh, mm FROM publisher_slots WHERE tenant_id = $1 ORDER BY dow, hh, mm`, [tenantId]);
  return r.rows.map((x: any) => ({ id: Number(x.id), dow: x.dow, hh: x.hh, mm: x.mm }));
}

export async function addSlots(tenantId: string, slots: { dow: number; hh: number; mm: number }[]): Promise<void> {
  for (const s of slots) {
    const dow = Math.max(0, Math.min(6, Math.trunc(Number(s.dow))));
    const hh = Math.max(0, Math.min(23, Math.trunc(Number(s.hh))));
    const mm = Math.max(0, Math.min(59, Math.trunc(Number(s.mm))));
    // без дублей (мягко): проверка на существование
    const ex = await pool.query(
      `SELECT 1 FROM publisher_slots WHERE tenant_id=$1 AND dow=$2 AND hh=$3 AND mm=$4`, [tenantId, dow, hh, mm]);
    if (!ex.rows.length) {
      await pool.query(`INSERT INTO publisher_slots (tenant_id, dow, hh, mm) VALUES ($1,$2,$3,$4)`, [tenantId, dow, hh, mm]);
    }
  }
}

export async function removeSlot(tenantId: string, id: number): Promise<void> {
  await pool.query(`DELETE FROM publisher_slots WHERE tenant_id = $1 AND id = $2`, [tenantId, id]);
}

/** Кандидаты времени по слотам на N дней вперёд (UTC), отсортированы. */
function slotCandidates(slots: SlotRow[], afterMs: number, days = 35): number[] {
  const out: number[] = [];
  const start = new Date(afterMs);
  for (let d = 0; d < days; d++) {
    const day = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + d));
    const dow = day.getUTCDay();
    for (const s of slots) {
      if (s.dow !== dow) continue;
      const t = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), s.hh, s.mm, 0);
      if (t > afterMs) out.push(t);
    }
  }
  return out.sort((a, b) => a - b);
}

/** Ближайшие СВОБОДНЫЕ слоты тенанта (свободен = нет нашего запланированного поста ±60с). */
export async function nextFreeSlotTimes(tenantId: string, count: number, afterMs = Date.now()): Promise<Date[]> {
  const slots = await listSlots(tenantId);
  if (!slots.length) return [];
  const candidates = slotCandidates(slots, afterMs);
  if (!candidates.length) return [];
  const r = await pool.query(
    `SELECT scheduled_at FROM publisher_posts
     WHERE tenant_id = $1 AND scheduled_at IS NOT NULL AND status IN ('scheduled','submitted')
       AND scheduled_at > NOW() - INTERVAL '1 minute'`,
    [tenantId]
  );
  const occupied = new Set<number>(
    r.rows.map((x: any) => Math.round(new Date(x.scheduled_at).getTime() / 60000))
  );
  const picked: Date[] = [];
  for (const t of candidates) {
    if (occupied.has(Math.round(t / 60000))) continue;
    picked.push(new Date(t));
    occupied.add(Math.round(t / 60000));
    if (picked.length >= count) break;
  }
  return picked;
}

// ── Единый сабмит поста (роутер, цепочки, ретраи) ────────────────────────────
export interface TargetInput {
  accountId: string;
  platform: string;
  options?: Record<string, any>;
  textOverride?: string;
  /** Тред (X/Threads/Bluesky): дополнительные посты после первого. */
  thread?: string[];
}

export interface SubmitArgs {
  tenantId: string;
  baseUrl?: string;               // absBase(req); планировщик берёт publicBase()
  assetId?: string;
  mediaUrl?: string;
  title?: string;
  text: string;
  mode: 'now' | 'time' | 'slot';
  scheduledAt?: string;           // ISO (mode=time)
  targets: TargetInput[];
  chainId?: string | null;
}

export interface SubmitResult {
  groupId: string;
  scheduledAtIso?: string;
  results: { id: string; platform: string; accountId: string; ok: boolean; error?: string }[];
}

/** Транзиентная ошибка → имеет смысл авторетраить (сеть/лимит/5xx), валидационная — нет. */
function isRetriable(e: any): boolean {
  if (e instanceof BlotatoError) return e.status === 0 || e.status === 429 || e.status >= 500;
  return true; // сетевые/неизвестные — пробуем
}

export async function submitPost(args: SubmitArgs): Promise<SubmitResult> {
  const { tenantId } = args;
  const key = await tenantBlotatoKey(tenantId);
  if (!key) throw new Error('Ключ Blotato не задан (Настройки → Ключи → Blotato)');
  const targets = args.targets || [];
  if (!targets.length) throw new Error('Не выбраны аккаунты (targets)');
  if (targets.length > 12) throw new Error('Слишком много целей за раз (максимум 12)');

  const media = await resolveMedia(tenantId, args);
  const base = (args.baseUrl || publicBase());
  const publicUrl = absUrl(base, media.fileUrl);
  const mediaUrls = publicUrl ? [publicUrl] : [];
  const fallbackTitle = (media.title || args.text || 'Video').split('\n')[0].trim().slice(0, 100);

  let scheduledTime: string | undefined;
  if (args.mode === 'time') {
    if (!args.scheduledAt || Number.isNaN(Date.parse(args.scheduledAt))) throw new Error('Некорректное время публикации');
    scheduledTime = new Date(args.scheduledAt).toISOString();
  } else if (args.mode === 'slot') {
    const [slot] = await nextFreeSlotTimes(tenantId, 1, Date.now() + 60_000);
    if (!slot) throw new Error('Нет свободных слотов — добавьте времена в «Моё расписание»');
    scheduledTime = slot.toISOString();
  }

  const groupId = randomUUID();
  const results: SubmitResult['results'] = [];

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const platform = String(t.platform || '').toLowerCase() as BlotatoPlatform;
    const rowId = randomUUID();
    const opts = t.options || {};
    // Лимит сети — последний рубеж: счётчик в Студии не блокирует, а цепочки идут мимо UI.
    const rowText = fitText((t.textOverride ?? args.text) || '', TEXT_LIMITS[platform]);
    let submissionId: string | null = null;
    let status = scheduledTime ? 'scheduled' : 'submitted';
    let error: string | null = null;
    let retriable = false;

    if (!(BLOTATO_PLATFORMS as readonly string[]).includes(platform)) {
      status = 'failed'; error = `Платформа не поддерживается: ${t.platform}`;
    } else {
      const pre = targetPrecheck(platform, opts);
      if (pre) { status = 'failed'; error = pre; }
      else {
        try {
          const thread = Array.isArray(t.thread) ? t.thread.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 24) : [];
          const r = await createPost(key, {
            accountId: String(t.accountId), platform, text: rowText, mediaUrls,
            target: buildTarget(platform, opts, fallbackTitle),
            scheduledTime,
            additionalPosts: thread.length && ['twitter', 'threads', 'bluesky'].includes(platform)
              ? thread.map((x) => ({ text: x })) : undefined,
          });
          submissionId = r.submissionId;
        } catch (e: any) {
          status = 'failed';
          error = e instanceof BlotatoError ? e.message : (e?.message || 'Ошибка Blotato');
          retriable = isRetriable(e);
        }
      }
    }

    await pool.query(
      `INSERT INTO publisher_posts
         (id, tenant_id, group_id, chain_id, asset_id, media_url, text, platform, account_id, account_name,
          target, mode, scheduled_at, submission_id, status, error, retries, next_retry_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,0,$17)`,
      [rowId, tenantId, groupId, args.chainId || null, args.assetId || null, media.fileUrl || null, rowText,
       platform, String(t.accountId), opts.accountName || null, JSON.stringify({ ...opts, ...(t.thread?.length ? { thread: t.thread } : {}) }),
       args.mode, scheduledTime || null, submissionId, status, error,
       status === 'failed' && retriable ? new Date(Date.now() + 2 * 60_000) : null]
    );
    results.push({ id: rowId, platform, accountId: String(t.accountId), ok: status !== 'failed', error: error || undefined });
    if (i < targets.length - 1) await sleep(350); // лимит Blotato 30 постов/мин
  }
  return { groupId, scheduledAtIso: scheduledTime, results };
}

// ── Ретраи (Ф5): бэкофф 2 → 4 → 8 минут, максимум 3 автопопытки ──────────────
const RETRY_STEPS_MIN = [2, 4, 8];

export async function resubmitRow(tenantId: string, rowId: string, baseUrl?: string): Promise<{ ok: boolean; error?: string }> {
  const key = await tenantBlotatoKey(tenantId);
  if (!key) return { ok: false, error: 'Ключ Blotato не задан' };
  const r = await pool.query(`SELECT * FROM publisher_posts WHERE id = $1 AND tenant_id = $2`, [rowId, tenantId]);
  const row = r.rows[0];
  if (!row) return { ok: false, error: 'Пост не найден' };
  if (row.status !== 'failed') return { ok: false, error: 'Повторить можно только упавший пост' };

  const platform = String(row.platform) as BlotatoPlatform;
  const opts = (typeof row.target === 'object' && row.target) ? row.target : {};
  const pre = targetPrecheck(platform, opts);
  if (pre) {
    await pool.query(`UPDATE publisher_posts SET next_retry_at=NULL, updated_at=NOW() WHERE id=$1`, [row.id]);
    return { ok: false, error: pre };
  }
  const base = baseUrl || publicBase();
  const mediaUrls = row.media_url ? [absUrl(base, row.media_url)] : [];
  const sched = row.scheduled_at && new Date(row.scheduled_at).getTime() > Date.now()
    ? new Date(row.scheduled_at).toISOString() : undefined;
  try {
    const thread: string[] = Array.isArray((opts as any).thread) ? (opts as any).thread : [];
    const out = await createPost(key, {
      accountId: String(row.account_id), platform, text: row.text || '', mediaUrls,
      target: buildTarget(platform, opts, (row.text || 'Video').split('\n')[0].slice(0, 100)),
      scheduledTime: sched,
      additionalPosts: thread.length && ['twitter', 'threads', 'bluesky'].includes(platform)
        ? thread.map((x: string) => ({ text: x })) : undefined,
    });
    await pool.query(
      `UPDATE publisher_posts SET submission_id=$2, status=$3, error=NULL, next_retry_at=NULL, updated_at=NOW() WHERE id=$1`,
      [row.id, out.submissionId, sched ? 'scheduled' : 'submitted']
    );
    return { ok: true };
  } catch (e: any) {
    const msg = e instanceof BlotatoError ? e.message : (e?.message || 'Ошибка Blotato');
    const retries = Number(row.retries || 0) + 1;
    const next = isRetriable(e) && retries < RETRY_STEPS_MIN.length
      ? new Date(Date.now() + RETRY_STEPS_MIN[retries] * 60_000) : null;
    await pool.query(
      `UPDATE publisher_posts SET error=$2, retries=$3, next_retry_at=$4, updated_at=NOW() WHERE id=$1`,
      [row.id, msg, retries, next]
    );
    return { ok: false, error: msg };
  }
}

/** Автоповтор из тика: упавшие с подошедшим next_retry_at (по всем тенантам, до 5 за тик). */
export async function tickRetries(): Promise<number> {
  const r = await pool.query(
    `SELECT id, tenant_id FROM publisher_posts
     WHERE status = 'failed' AND next_retry_at IS NOT NULL AND next_retry_at <= NOW()
     ORDER BY next_retry_at ASC LIMIT 5`);
  let done = 0;
  for (const row of r.rows) {
    try { await resubmitRow(row.tenant_id, row.id); done++; } catch { /* учтено в строке */ }
    await sleep(400);
  }
  return done;
}

// ── Статус-синк (ленивый + фоновый) ──────────────────────────────────────────
export async function syncPendingTenant(tenantId: string, key?: string | null, limit = 8): Promise<void> {
  const k = key || await tenantBlotatoKey(tenantId);
  if (!k) return;
  const r = await pool.query(
    `SELECT id, submission_id FROM publisher_posts
     WHERE tenant_id = $1 AND submission_id IS NOT NULL AND status IN ('submitted','scheduled')
       AND updated_at < NOW() - INTERVAL '20 seconds'
       AND (scheduled_at IS NULL OR scheduled_at < NOW() + INTERVAL '2 minutes')
     ORDER BY updated_at ASC LIMIT $2`,
    [tenantId, limit]
  );
  if (!r.rows.length) return;
  await Promise.allSettled(r.rows.map(async (row: any) => {
    const st = await getPostStatus(k, row.submission_id);
    if (st.type === 'published') {
      await pool.query(`UPDATE publisher_posts SET status='published', post_url=$2, error=NULL, updated_at=NOW() WHERE id=$1`, [row.id, st.postUrl]);
    } else if (st.type === 'failed') {
      await pool.query(`UPDATE publisher_posts SET status='failed', error=$2, updated_at=NOW() WHERE id=$1`, [row.id, st.errorMessage || 'Ошибка публикации']);
    } else {
      await pool.query(`UPDATE publisher_posts SET updated_at=NOW() WHERE id=$1`, [row.id]);
    }
  }));
}

/** Фоновый проход по тенантам с «в полёте» (для тика — лента может быть закрыта). */
export async function tickStatusSync(): Promise<void> {
  const r = await pool.query(
    `SELECT DISTINCT tenant_id FROM publisher_posts
     WHERE submission_id IS NOT NULL AND status IN ('submitted','scheduled')
       AND updated_at < NOW() - INTERVAL '3 minutes'
       AND (scheduled_at IS NULL OR scheduled_at < NOW() + INTERVAL '2 minutes')
     LIMIT 10`);
  for (const row of r.rows) {
    try { await syncPendingTenant(row.tenant_id); } catch { /* best-effort */ }
    await sleep(300);
  }
}

// ── Пост-движок (Ф3): подписи per-платформа + хэштеги, A/B ───────────────────
export interface CaptionVariant {
  base: string;
  hashtags: string[];
  platforms: Record<string, string>;
  youtubeTitle?: string;
}

function parseJsonLoose(txt: string): any | null {
  let s = String(txt || '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  const a = s.indexOf('{'); const b = s.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
}

const TONES: Record<string, string> = {
  engaging: 'вовлекающий (живой, с хуком и лёгким интригующим CTA)',
  expert: 'экспертный (уверенно, по делу, без воды и кликбейта)',
  selling: 'продающий (выгода, оффер, чёткий призыв к действию)',
};

export async function generateCaptions(args: {
  tenantId: string; title?: string; assetId?: string; platforms: string[];
  tone?: string; language?: string; count?: number; brief?: string;
}): Promise<{ variants: CaptionVariant[]; model: string; usedDna: boolean }> {
  const apiKey = await resolveAnthropicKey(args.tenantId);
  if (!apiKey) throw new Error('Ключ Claude не задан (Настройки → Генерация → ИИ-режиссёр)');

  let dna: any = null;
  if (args.assetId) {
    try { const stored: any = await getTrendDNAByAsset(args.tenantId, args.assetId); dna = stored?.dna || stored || null; }
    catch { dna = null; }
  }
  const platforms = (args.platforms || []).map((p) => String(p).toLowerCase())
    .filter((p) => (BLOTATO_PLATFORMS as readonly string[]).includes(p));
  // Пустой/неизвестный список площадок не должен рождать промпт с «заполни: » без сетей.
  const askFor = platforms.length ? platforms : ['tiktok', 'instagram'];
  const lang = args.language || 'ru';
  const tone = TONES[args.tone || 'engaging'] || TONES.engaging;
  const count = Math.max(1, Math.min(Number(args.count) || 2, 3));

  const ctx: string[] = [];
  if (args.title) ctx.push(`Название ролика: ${args.title}`);
  if (args.brief) ctx.push(`Бриф от автора: ${String(args.brief).slice(0, 500)}`);
  if (dna?.hookType) ctx.push(`Тип хука: ${dna.hookType}`);
  if (dna?.whyItWorks) ctx.push(`Почему тренд работает: ${String(dna.whyItWorks).slice(0, 400)}`);
  if (dna?.targetAudience) ctx.push(`Аудитория: ${String(dna.targetAudience).slice(0, 200)}`);
  if (Array.isArray(dna?.keywords) && dna.keywords.length) ctx.push(`Ключевые слова тренда: ${dna.keywords.slice(0, 12).join(', ')}`);
  if (dna?.copyReadyScript) ctx.push(`Сценарий ролика (фрагмент): ${String(dna.copyReadyScript).slice(0, 600)}`);

  const system =
    'Ты — SMM-редактор коротких видео. Пишешь подписи, которые дочитывают и по которым кликают. ' +
    'Отвечай СТРОГО одним JSON-объектом без пояснений и markdown.';
  const user =
    `Напиши ${count} ${count === 1 ? 'вариант' : 'варианта'} подписи к посту с видео. Язык: ${lang}. Тон: ${tone}.\n` +
    `Платформы: ${askFor.join(', ')}.\n` +
    (ctx.length ? `Контекст:\n${ctx.join('\n')}\n` : '') +
    'Правила: первая строка — хук; без кавычек-ёлочек вокруг всего текста; эмодзи умеренно; ' +
    'хэштеги НЕ вставляй ни в base, ни в тексты сетей — отдай отдельным массивом ' +
    '(5–8: смесь широких и нишевых, с #).\n' +
    'ПОД КАЖДУЮ СЕТЬ — СВОЙ текст (не копия base), с её манерой:\n' +
    '· tiktok — разговорно и коротко (1–3 строки), хук в первых 3 словах, вопрос или спор в конце;\n' +
    '· instagram — чуть длиннее и эмоциональнее (2–4 строки), призыв сохранить/переслать;\n' +
    '· youtube — описание Shorts: 2–3 предложения по сути ролика + что смотреть дальше; ' +
    'ОБЯЗАТЕЛЬНО поле youtubeTitle — цепкий заголовок до 90 символов без кликбейта-обмана;\n' +
    '· twitter/threads/bluesky — уложись в лимит (280/500/300); linkedin — деловой тон, БЕЗ хэштегов.\n' +
    'Формат ответа: {"variants":[{"base":"…","hashtags":["#…"],"platforms":{"tiktok":"…","instagram":"…","youtube":"…"},"youtubeTitle":"…"}]} ' +
    `— в platforms заполни ВСЕ запрошенные площадки: ${askFor.join(', ')}.`;

  const mod: any = await import('@anthropic-ai/sdk');
  const Anthropic = mod.default || mod.Anthropic || mod;
  const client = new Anthropic({ apiKey });
  // ⚠️ БЕЗ префилла assistant-сообщением: модель режиссёра (Opus 4.8) его НЕ поддерживает
  // и отвечает 400 "This model does not support assistant message prefill" — из-за этого
  // в v2.6.22–2.6.26 падала ЛЮБАЯ генерация подписи. Чистый JSON просим системным
  // промптом, разбираем через parseJsonLoose (он сам снимает ```-обёртку и преамбулу).
  // Вторая попытка — на случай обрыва/мусора в ответе.
  let j: any = null;
  for (let attempt = 0; attempt < 2 && !j; attempt++) {
    const res = await client.messages.create({
      model: DEFAULT_DIRECTOR_MODEL, max_tokens: 2000,
      system, messages: [{ role: 'user', content: user }],
    });
    const txt = (res.content || []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('');
    j = parseJsonLoose(txt);
  }
  const rawVars = Array.isArray(j?.variants) ? j.variants : [];
  const variants: CaptionVariant[] = rawVars.slice(0, 3).map((v: any): CaptionVariant => ({
    base: String(v?.base || '').trim(),
    hashtags: (Array.isArray(v?.hashtags) ? v.hashtags : [])
      .map((h: any) => String(h || '').trim()).filter(Boolean)
      .map((h: string) => (h.startsWith('#') ? h : `#${h.replace(/^#+/, '')}`)).slice(0, 10),
    platforms: (v?.platforms && typeof v.platforms === 'object')
      ? Object.fromEntries(Object.entries(v.platforms)
          .filter(([k, val]) => typeof val === 'string' && (BLOTATO_PLATFORMS as readonly string[]).includes(k))
          .map(([k, val]) => [k, String(val).trim()]))
      : {},
    youtubeTitle: v?.youtubeTitle ? String(v.youtubeTitle).trim().slice(0, 100) : undefined,
  })).filter((v: CaptionVariant) => v.base);
  if (!variants.length) throw new Error('ИИ вернул неразборчивый ответ — повторите.');
  return { variants, model: DEFAULT_DIRECTOR_MODEL, usedDna: !!dna };
}

// ── Черновики: массовая обработка выделенного в Галерее (папка «Черновики») ──
// Статус 'draft' = строка есть у нас, но в Blotato НЕ ушла: submission_id/scheduled_at
// пустые, слоты такими строками НЕ занимаются (nextFreeSlotTimes смотрит только
// scheduled/submitted), статус-синк и авторетраи их не видят. Публикация — отдельным
// шагом (publishDrafts): один ролик = одна группа = один слот на все свои платформы.

/**
 * Практические лимиты подписи по сетям — те же, что показывает счётчик в Студии
 * (apps/frontend/src/pages/publisher/PublisherStudio.tsx). Держим копию здесь: массовые
 * черновики и цепочки идут мимо UI, и текст сверх лимита сеть отвергает уже на сабмите.
 */
const TEXT_LIMITS: Record<string, number> = {
  twitter: 280, threads: 500, bluesky: 300, instagram: 2200, tiktok: 2200,
  linkedin: 3000, facebook: 5000, youtube: 5000, pinterest: 500,
};

/** Обрезка по границе слова (без лимита — текст как есть). */
function fitText(s: string, limit?: number): string {
  if (!limit || s.length <= limit) return s;
  const cut = s.slice(0, limit);
  const sp = cut.lastIndexOf(' ');
  return (sp > limit * 0.6 ? cut.slice(0, sp) : cut).trimEnd();
}

/** Текст + блок хэштегов так, чтобы вместе уложиться в лимит сети. */
function joinWithinLimit(body: string, tags: string, limit?: number): string {
  if (!tags) return fitText(body, limit);
  if (!limit) return `${body}\n\n${tags}`;
  const room = limit - tags.length - 2; // 2 = '\n\n'
  // Если под текст осталась пара слов — теги дороже не стоят, публикуем сам текст.
  if (room < 40) return fitText(body, limit);
  return `${fitText(body, room)}\n\n${tags}`;
}

/** Текст подписи под КОНКРЕТНУЮ платформу из варианта Пост-движка. */
export function captionForPlatform(v: CaptionVariant, platform: string): string {
  const own = v.platforms?.[platform];
  const body = (own && own.trim()) ? own.trim() : v.base;
  const chars = TEXT_LIMITS[platform];
  // LinkedIn — деловой тон без хэштегов (так же просим и у Claude в промпте).
  if (platform === 'linkedin' || !v.hashtags.length) return fitText(body, chars);
  // YouTube: теги живут в описании, 3–5 достаточно; короткие сети — тоже не мусорим.
  const limit = platform === 'youtube' ? 5 : (platform === 'twitter' || platform === 'bluesky') ? 3 : 8;
  // Модель иногда всё же ставит теги прямо в текст сети — не клеим их вторым блоком.
  const inBody = new Set((body.match(/#[^\s#]+/g) || []).map((h) => h.toLowerCase()));
  const tags = v.hashtags.filter((h) => !inBody.has(h.toLowerCase())).slice(0, limit);
  return joinWithinLimit(body, tags.join(' '), chars);
}

/**
 * Раскладка варианта по таргетам: каждая сеть получает СВОЙ текст через textOverride,
 * YouTube — ещё и заголовок. Общая точка для цепочек (ручных и авто) — раньше они
 * слали один base во все сети и персонализация Пост-движка пропадала.
 */
export function targetsWithCaptions(targets: TargetInput[], v: CaptionVariant, fallbackTitle: string): TargetInput[] {
  return targets.map((t) => {
    const platform = String(t.platform).toLowerCase();
    const out: TargetInput = { ...t, textOverride: captionForPlatform(v, platform) };
    if (platform === 'youtube') {
      const opts = { ...(t.options || {}) };
      if (!opts.title) opts.title = (v.youtubeTitle || fallbackTitle).slice(0, 100);
      out.options = opts;
    }
    return out;
  });
}

export interface BulkDraftItem { assetId?: string; mediaUrl?: string; title?: string }
export interface BulkDraftArgs {
  tenantId: string;
  baseUrl?: string;
  items: BulkDraftItem[];
  targets: TargetInput[];          // по аккаунту на платформу (TikTok/IG/YouTube и др.)
  ai?: boolean;                    // писать подписи Claude (иначе фолбэк из названия + ключевиков ДНК)
  tone?: string; language?: string;
  onProgress?: (done: number, total: number, note?: string) => void;
}

/** Массовая обработка: N роликов × M платформ → строки-черновики со СВОИМ текстом на сеть. */
export async function createDrafts(args: BulkDraftArgs): Promise<{ groups: number; rows: number; errors: string[] }> {
  const items = (args.items || []).slice(0, 50);
  const targets = (args.targets || []).filter((t) => t?.accountId && t?.platform);
  if (!items.length) throw new Error('Не выбраны ролики');
  if (!targets.length) throw new Error('Не выбраны аккаунты соцсетей');
  const errors: string[] = [];
  let groups = 0; let rows = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    args.onProgress?.(i, items.length, item.title || '');
    let media: { fileUrl: string; title: string };
    try { media = await resolveMedia(args.tenantId, item); }
    catch (e: any) { errors.push(`${item.title || 'ролик'}: ${e?.message || 'файл не найден'}`); continue; }

    const platforms = [...new Set(targets.map((t) => String(t.platform).toLowerCase()))];
    const title = item.title || media.title || 'Новое видео';
    // Подписи: один вызов Claude на ролик отдаёт версии под все выбранные сети.
    let variant: CaptionVariant | null = null;
    if (args.ai !== false) {
      try {
        const g = await generateCaptions({
          tenantId: args.tenantId, title, assetId: item.assetId, platforms,
          tone: args.tone, language: args.language, count: 1,
        });
        variant = g.variants[0] || null;
      } catch (e: any) {
        errors.push(`${title}: подпись без ИИ (${e?.message || 'ошибка Claude'})`);
      }
    }
    if (!variant) {
      let dna: any = null;
      if (item.assetId) { try { const s: any = await getTrendDNAByAsset(args.tenantId, item.assetId); dna = s?.dna || s; } catch { /* без ДНК */ } }
      variant = { base: fallbackCaption(title, dna), hashtags: [], platforms: {} };
    }

    const groupId = randomUUID();
    for (const t of targets) {
      const platform = String(t.platform).toLowerCase();
      const opts: Record<string, any> = { ...(t.options || {}) };
      // YouTube требует заголовок: берём от Пост-движка, иначе имя ролика.
      if (platform === 'youtube' && !opts.title) opts.title = (variant.youtubeTitle || title).slice(0, 100);
      const text = captionForPlatform(variant, platform);
      await pool.query(
        `INSERT INTO publisher_posts
           (id, tenant_id, group_id, chain_id, asset_id, media_url, text, platform, account_id, account_name,
            target, mode, scheduled_at, submission_id, status, error, retries, next_retry_at)
         VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,'slot',NULL,NULL,'draft',NULL,0,NULL)`,
        [randomUUID(), args.tenantId, groupId, item.assetId || null, media.fileUrl || null, text,
         platform, String(t.accountId), opts.accountName || null, JSON.stringify(opts)]
      );
      rows++;
    }
    groups++;
    args.onProgress?.(i + 1, items.length, title);
  }
  return { groups, rows, errors };
}

/** Публикация черновиков: группа (=ролик) целиком уходит в один слот/время. */
export async function publishDrafts(args: {
  tenantId: string; baseUrl?: string; ids: string[];
  mode: 'now' | 'time' | 'slot'; scheduledAt?: string;
}): Promise<{ ok: number; failed: number; groups: number; firstAt?: string; lastAt?: string }> {
  const key = await tenantBlotatoKey(args.tenantId);
  if (!key) throw new Error('Ключ Blotato не задан (Настройки → Ключи → Blotato)');
  const ids = (args.ids || []).map(String).filter(Boolean).slice(0, 200);
  if (!ids.length) throw new Error('Не выбраны черновики');
  const r = await pool.query(
    `SELECT * FROM publisher_posts WHERE tenant_id = $1 AND status = 'draft' AND id = ANY($2::uuid[])
     ORDER BY created_at ASC`, [args.tenantId, ids]);
  const list = r.rows as any[];
  if (!list.length) throw new Error('Черновики не найдены (возможно, уже опубликованы)');

  // Группируем по ролику: все сети одного ролика уходят в ОДНО время.
  const byGroup = new Map<string, any[]>();
  for (const row of list) { const a = byGroup.get(row.group_id) || []; a.push(row); byGroup.set(row.group_id, a); }
  const groupIds = [...byGroup.keys()];

  let times: (string | undefined)[] = [];
  if (args.mode === 'slot') {
    const slots = await nextFreeSlotTimes(args.tenantId, groupIds.length, Date.now() + 60_000);
    if (slots.length < groupIds.length) {
      throw new Error(`Свободных слотов ${slots.length}, а роликов ${groupIds.length} — добавьте времена в «Моё расписание».`);
    }
    times = slots.map((d) => d.toISOString());
  } else if (args.mode === 'time') {
    if (!args.scheduledAt || Number.isNaN(Date.parse(args.scheduledAt))) throw new Error('Некорректное время публикации');
    times = groupIds.map(() => new Date(args.scheduledAt!).toISOString());
  } else {
    times = groupIds.map(() => undefined);
  }

  const base = args.baseUrl || publicBase();
  let ok = 0; let failed = 0;
  for (let gi = 0; gi < groupIds.length; gi++) {
    const when = times[gi];
    for (const row of byGroup.get(groupIds[gi])!) {
      const platform = String(row.platform) as BlotatoPlatform;
      const opts = (typeof row.target === 'object' && row.target) ? row.target : {};
      const pre = (BLOTATO_PLATFORMS as readonly string[]).includes(platform)
        ? targetPrecheck(platform, opts) : `Платформа не поддерживается: ${platform}`;
      if (pre) {
        failed++;
        await pool.query(`UPDATE publisher_posts SET status='failed', error=$2, updated_at=NOW() WHERE id=$1`, [row.id, pre]);
        continue;
      }
      try {
        const out = await createPost(key, {
          accountId: String(row.account_id), platform, text: row.text || '',
          mediaUrls: row.media_url ? [absUrl(base, row.media_url)] : [],
          target: buildTarget(platform, opts, (row.text || 'Video').split('\n')[0].slice(0, 100)),
          scheduledTime: when,
        });
        await pool.query(
          `UPDATE publisher_posts SET submission_id=$2, status=$3, mode=$4, scheduled_at=$5, error=NULL, updated_at=NOW() WHERE id=$1`,
          [row.id, out.submissionId, when ? 'scheduled' : 'submitted', args.mode, when || null]
        );
        ok++;
      } catch (e: any) {
        const msg = e instanceof BlotatoError ? e.message : (e?.message || 'Ошибка Blotato');
        await pool.query(
          `UPDATE publisher_posts SET status='failed', error=$2, mode=$3, scheduled_at=$4, next_retry_at=$5, updated_at=NOW() WHERE id=$1`,
          [row.id, msg, args.mode, when || null, isRetriable(e) ? new Date(Date.now() + 2 * 60_000) : null]
        );
        failed++;
      }
      await sleep(350);   // лимит Blotato 30 постов/мин
    }
  }
  const stamps = times.filter(Boolean) as string[];
  return { ok, failed, groups: groupIds.length, firstAt: stamps[0], lastAt: stamps[stamps.length - 1] };
}

/** Правка черновика (текст поста и заголовок YouTube) до публикации. */
export async function updateDraft(tenantId: string, id: string, patch: { text?: string; title?: string })
  : Promise<{ ok: boolean; error?: string }> {
  const r = await pool.query(`SELECT * FROM publisher_posts WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
  const row = r.rows[0];
  if (!row) return { ok: false, error: 'Черновик не найден' };
  if (row.status !== 'draft') return { ok: false, error: 'Править можно только черновик' };
  const text = patch.text != null ? String(patch.text).slice(0, 5000) : row.text;
  const opts = (typeof row.target === 'object' && row.target) ? { ...row.target } : {};
  if (patch.title != null) opts.title = String(patch.title).slice(0, 100);
  await pool.query(`UPDATE publisher_posts SET text=$2, target=$3, updated_at=NOW() WHERE id=$1`,
    [row.id, text, JSON.stringify(opts)]);
  return { ok: true };
}

// ── Ф6: ручной архив (посты, которые НЕ уходят в Blotato) ────────────────────
/**
 * Статус 'manual' = пост живёт ТОЛЬКО у нас. Отличия от 'draft': площадка выбирается
 * без подключённого аккаунта Blotato (account_id = 'manual:<платформа>'), ключ Blotato
 * не нужен вовсе, а scheduled_at — это дата в календаре, а не очередь отправки
 * (submission_id всегда NULL). Поэтому слот-занятость (nextFreeSlotTimes смотрит
 * scheduled/submitted), статус-синк и авторетраи такие строки НЕ видят — публикует
 * человек руками, скачав видео и текст своей сети из раскрытого поста.
 */
export const MANUAL_ACCOUNT_PREFIX = 'manual:';
export const MANUAL_STATUS = 'manual';

export interface ManualPostArgs {
  tenantId: string;
  items: BulkDraftItem[];
  platforms: string[];          // ЛЮБЫЕ площадки — подключённый аккаунт не требуется
  ai?: boolean;
  tone?: string; language?: string;
  /** Дата в календаре; пусто = пост лежит в архиве «без даты». */
  scheduledAt?: string | null;
  /** Готовые тексты по сетям (из Студии). Что задано здесь — ИИ не перезаписывает. */
  texts?: Record<string, string>;
  /** Готовые заголовки по сетям (сейчас нужен только YouTube). */
  titles?: Record<string, string>;
  onProgress?: (done: number, total: number, title?: string) => void;
}

/** Создание постов ручного архива: ролик × выбранные сети, у каждой сети СВОЙ текст. */
export async function createManualPosts(args: ManualPostArgs): Promise<{ groups: number; rows: number; errors: string[] }> {
  const items = (args.items || []).slice(0, 50);
  if (!items.length) throw new Error('Не выбраны ролики');
  const platforms = [...new Set((args.platforms || []).map((p) => String(p).toLowerCase()))]
    .filter((p) => (BLOTATO_PLATFORMS as readonly string[]).includes(p));
  if (!platforms.length) throw new Error('Не выбраны соцсети');

  let when: string | null = null;
  if (args.scheduledAt) {
    if (Number.isNaN(Date.parse(args.scheduledAt))) throw new Error('Некорректная дата публикации');
    when = new Date(args.scheduledAt).toISOString();
  }

  const errors: string[] = [];
  let groups = 0; let rows = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    args.onProgress?.(i, items.length, item.title || '');
    let media: { fileUrl: string; title: string };
    try { media = await resolveMedia(args.tenantId, item); }
    catch (e: any) { errors.push(`${item.title || 'ролик'}: ${e?.message || 'файл не найден'}`); continue; }

    const title = item.title || media.title || 'Новое видео';
    // Сети, для которых текст пришёл из Студии, ИИ не нужен вовсе — не платим за него.
    const missing = platforms.filter((p) => !(args.texts?.[p] || '').trim());
    let variant: CaptionVariant | null = null;
    if (args.ai !== false && missing.length) {
      try {
        const g = await generateCaptions({
          tenantId: args.tenantId, title, assetId: item.assetId, platforms: missing,
          tone: args.tone, language: args.language, count: 1,
        });
        variant = g.variants[0] || null;
      } catch (e: any) {
        errors.push(`${title}: подпись без ИИ (${e?.message || 'ошибка Claude'})`);
      }
    }
    if (!variant && missing.length) {
      let dna: any = null;
      if (item.assetId) { try { const s: any = await getTrendDNAByAsset(args.tenantId, item.assetId); dna = s?.dna || s; } catch { /* без ДНК */ } }
      variant = { base: fallbackCaption(title, dna), hashtags: [], platforms: {} };
    }

    const groupId = randomUUID();
    for (const platform of platforms) {
      const opts: Record<string, any> = {};
      const ready = (args.texts?.[platform] || '').trim();
      const body = ready || (variant ? captionForPlatform(variant, platform) : '');
      // Заголовок обязателен исторически именно для YouTube, поэтому кладём его туда же.
      if (platform === 'youtube') {
        opts.title = String(args.titles?.youtube || variant?.youtubeTitle || title).slice(0, 100);
      }
      await pool.query(
        `INSERT INTO publisher_posts
           (id, tenant_id, group_id, chain_id, asset_id, media_url, text, platform, account_id, account_name,
            target, mode, scheduled_at, submission_id, status, error, retries, next_retry_at)
         VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,'time',$11,NULL,$12,NULL,0,NULL)`,
        [randomUUID(), args.tenantId, groupId, item.assetId || null, media.fileUrl || null,
         body, platform, `${MANUAL_ACCOUNT_PREFIX}${platform}`,
         null, JSON.stringify(opts), when, MANUAL_STATUS]
      );
      rows++;
    }
    groups++;
    args.onProgress?.(i + 1, items.length, title);
  }
  return { groups, rows, errors };
}

/**
 * Правка поста ручного архива: текст, заголовок и дата в календаре. Дату можно менять
 * и группой (весь ролик переезжает целиком) — так работает перетаскивание в календаре.
 */
export async function updateManualPost(
  tenantId: string, id: string,
  patch: { text?: string; title?: string; scheduledAt?: string | null; wholeGroup?: boolean },
): Promise<{ ok: boolean; error?: string; moved?: number }> {
  const r = await pool.query(`SELECT * FROM publisher_posts WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
  const row = r.rows[0];
  if (!row) return { ok: false, error: 'Пост не найден' };
  if (row.status !== MANUAL_STATUS) return { ok: false, error: 'Это не пост ручного архива' };

  if (patch.text != null || patch.title != null) {
    const text = patch.text != null ? String(patch.text).slice(0, 5000) : row.text;
    const opts = (typeof row.target === 'object' && row.target) ? { ...row.target } : {};
    if (patch.title != null) opts.title = String(patch.title).slice(0, 100);
    await pool.query(`UPDATE publisher_posts SET text=$2, target=$3, updated_at=NOW() WHERE id=$1`,
      [row.id, text, JSON.stringify(opts)]);
  }

  let moved = 0;
  if (patch.scheduledAt !== undefined) {
    let when: string | null = null;
    if (patch.scheduledAt) {
      if (Number.isNaN(Date.parse(patch.scheduledAt))) return { ok: false, error: 'Некорректная дата' };
      when = new Date(patch.scheduledAt).toISOString();
    }
    const upd = patch.wholeGroup
      ? await pool.query(
          `UPDATE publisher_posts SET scheduled_at=$3, updated_at=NOW()
           WHERE tenant_id=$1 AND group_id=$2 AND status=$4`,
          [tenantId, row.group_id, when, MANUAL_STATUS])
      : await pool.query(
          `UPDATE publisher_posts SET scheduled_at=$2, updated_at=NOW() WHERE id=$1`, [row.id, when]);
    moved = upd.rowCount || 0;
  }
  return { ok: true, moved };
}

/** Удаление пачкой. «В полёте» (scheduled/submitted) НЕ трогаем: их надо снимать в Blotato
 *  через DELETE /posts/:id, иначе потеряем связь с уже отправленной публикацией.
 *  Строки ручного архива ('manual') удаляются свободно — их нигде больше нет. */
export async function deleteRows(tenantId: string, ids: string[]): Promise<{ deleted: number; skipped: number }> {
  const list = (ids || []).map(String).filter(Boolean).slice(0, 400);
  if (!list.length) return { deleted: 0, skipped: 0 };
  const r = await pool.query(
    `DELETE FROM publisher_posts
     WHERE tenant_id=$1 AND id = ANY($2::uuid[]) AND status NOT IN ('scheduled','submitted') RETURNING id`,
    [tenantId, list]);
  return { deleted: r.rowCount || 0, skipped: list.length - (r.rowCount || 0) };
}

/** Фолбэк-подпись без ИИ (авто-цепочки не должны стоять из-за отсутствия ключа Claude). */
export function fallbackCaption(title: string, dna?: any): string {
  const tags = (Array.isArray(dna?.keywords) ? dna.keywords : [])
    .slice(0, 5).map((k: string) => `#${String(k).replace(/\s+/g, '').replace(/^#+/, '')}`).filter((t: string) => t.length > 1);
  return [title || 'Новое видео', tags.join(' ')].filter(Boolean).join('\n\n');
}

// ── Цепочки (Ф2 ручные / Ф4 авто) ────────────────────────────────────────────
export interface ChainRow {
  id: string; tenant_id: string; name: string; kind: 'manual' | 'auto';
  items: any[]; targets: TargetInput[]; caption: { mode?: 'fixed' | 'ai'; text?: string; tone?: string; language?: string };
  daily_cap: number; enabled: boolean; cursor: number; fail_streak: number;
  /** Авто: брать только ролики этого формата ('9x16' | '16x9' | '1x1' | '4x5'); NULL = любой. */
  format_filter: string | null;
  last_error: string | null; last_run_at: string | null; created_at: string;
}

export async function listChains(tenantId: string): Promise<any[]> {
  const r = await pool.query(`SELECT * FROM publisher_chains WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50`, [tenantId]);
  const chains = r.rows;
  if (!chains.length) return [];
  const stats = await pool.query(
    `SELECT chain_id, status, COUNT(*)::int AS n FROM publisher_posts
     WHERE tenant_id = $1 AND chain_id IS NOT NULL GROUP BY chain_id, status`, [tenantId]);
  const byChain = new Map<string, Record<string, number>>();
  for (const s of stats.rows) {
    const m = byChain.get(s.chain_id) || {};
    m[s.status] = s.n; byChain.set(s.chain_id, m);
  }
  return chains.map((c: any) => ({ ...c, stats: byChain.get(c.id) || {} }));
}

/**
 * Подпись для ролика цепочки. Возвращает ВЕСЬ вариант (с текстами по сетям), а не одну
 * склеенную строку: раскладку по таргетам делает targetsWithCaptions.
 */
async function captionForItem(tenantId: string, chainCaption: ChainRow['caption'], item: { assetId?: string; title?: string }, platforms: string[]): Promise<CaptionVariant> {
  const title = item.title || 'Новое видео';
  if (chainCaption?.mode === 'ai') {
    try {
      const g = await generateCaptions({
        tenantId, title, assetId: item.assetId, platforms,
        tone: chainCaption.tone, language: chainCaption.language, count: 1,
      });
      if (g.variants[0]) return g.variants[0];
    } catch { /* падаем в фолбэк — цепочка не должна стоять */ }
  }
  // Фиксированный текст цепочки — один на все сети осознанно (так задал автор).
  if (chainCaption?.text) return { base: chainCaption.text, hashtags: [], platforms: {} };
  let dna: any = null;
  if (item.assetId) { try { const s: any = await getTrendDNAByAsset(tenantId, item.assetId); dna = s?.dna || s; } catch { /* без ДНК */ } }
  return { base: fallbackCaption(title, dna), hashtags: [], platforms: {} };
}

/** Ручная цепочка: серия готовых роликов раскладывается по свободным слотам СРАЗУ. */
export async function createManualChain(args: {
  tenantId: string; baseUrl?: string; name: string;
  items: { assetId?: string; mediaUrl?: string; title?: string }[];
  targets: TargetInput[]; caption: ChainRow['caption'];
}): Promise<{ chainId: string; scheduled: number; failed: number; firstAt?: string; lastAt?: string }> {
  const items = (args.items || []).slice(0, 30);
  if (!items.length) throw new Error('Пустая серия — выберите ролики');
  if (!args.targets?.length) throw new Error('Не выбраны аккаунты');
  const slots = await nextFreeSlotTimes(args.tenantId, items.length, Date.now() + 60_000);
  if (slots.length < items.length) {
    throw new Error(`Свободных слотов не хватает: нужно ${items.length}, найдено ${slots.length}. Добавьте времена в «Моё расписание».`);
  }
  const chainId = randomUUID();
  await pool.query(
    `INSERT INTO publisher_chains (id, tenant_id, name, kind, items, targets, caption, daily_cap, enabled, cursor)
     VALUES ($1,$2,$3,'manual',$4,$5,$6,99,TRUE,0)`,
    [chainId, args.tenantId, args.name.slice(0, 160), JSON.stringify(items), JSON.stringify(args.targets), JSON.stringify(args.caption || {})]
  );
  const platforms = Array.from(new Set(args.targets.map((t) => String(t.platform).toLowerCase())));
  let scheduled = 0, failed = 0;
  for (let i = 0; i < items.length; i++) {
    const v = await captionForItem(args.tenantId, args.caption || {}, items[i], platforms);
    const targets = targetsWithCaptions(args.targets, v, items[i].title || 'Новое видео');
    try {
      const out = await submitPost({
        tenantId: args.tenantId, baseUrl: args.baseUrl, chainId,
        assetId: items[i].assetId, mediaUrl: items[i].mediaUrl, title: items[i].title,
        text: v.base, mode: 'time', scheduledAt: slots[i].toISOString(), targets,
      });
      scheduled += out.results.filter((x) => x.ok).length;
      failed += out.results.filter((x) => !x.ok).length;
    } catch (e: any) { failed += args.targets.length; }
  }
  await pool.query(`UPDATE publisher_chains SET cursor=$2, last_run_at=NOW(), updated_at=NOW() WHERE id=$1`, [chainId, items.length]);
  return { chainId, scheduled, failed, firstAt: slots[0]?.toISOString(), lastAt: slots[items.length - 1]?.toISOString() };
}

/** Авто-цепочка (Ф4): свежий НЕопубликованный ролик автопилота (auto-ugc) → подпись → слот. */
async function tickAutoChain(chain: any): Promise<'posted' | 'skip'> {
  const tenantId = chain.tenant_id as string;
  // дневной кап
  const capR = await pool.query(
    `SELECT COUNT(DISTINCT group_id)::int AS n FROM publisher_posts
     WHERE chain_id = $1 AND created_at > date_trunc('day', NOW())`, [chain.id]);
  if ((capR.rows[0]?.n || 0) >= Number(chain.daily_cap || 3)) return 'skip';
  // кандидат: свежий ролик auto-ugc, который ЕЩЁ НЕ публиковался. format_filter цепочки
  // берёт только свой формат (9:16 → TikTok, 16:9 → YouTube): наборы двух цепочек с разными
  // фильтрами не пересекаются, конкуренции «кто первый запостил» больше нет.
  const fmtFilter = typeof chain.format_filter === 'string' && chain.format_filter ? chain.format_filter : null;
  const cand = await pool.query(
    `SELECT id, file_url, original_name FROM media_assets m
     WHERE tenant_id = $1 AND folder = $2 AND media_type = 'video'
       AND ($3::text IS NULL OR m.ugc_format = $3)
       AND NOT EXISTS (SELECT 1 FROM publisher_posts pp WHERE pp.tenant_id = $1 AND pp.asset_id = m.id)
     ORDER BY created_at DESC LIMIT 1`, [tenantId, AUTO_UGC_FOLDER, fmtFilter]);
  const a = cand.rows[0];
  if (!a) return 'skip';
  const targets: TargetInput[] = Array.isArray(chain.targets) ? chain.targets : [];
  if (!targets.length) throw new Error('У цепочки не выбраны аккаунты');
  const platforms = Array.from(new Set(targets.map((t) => String(t.platform).toLowerCase())));
  const title = a.original_name || 'Новое видео';
  const v = await captionForItem(tenantId, chain.caption || {}, { assetId: a.id, title }, platforms);
  const out = await submitPost({
    tenantId, chainId: chain.id, assetId: a.id, title: a.original_name || undefined,
    text: v.base, mode: 'slot', targets: targetsWithCaptions(targets, v, title),
  });
  const ok = out.results.filter((x) => x.ok).length;
  if (!ok) throw new Error(out.results[0]?.error || 'Все таргеты упали');
  await pool.query(
    `UPDATE publisher_chains SET cursor = cursor + 1, fail_streak = 0, last_error = NULL, last_run_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [chain.id]);
  return 'posted';
}

/** Тик авто-цепочек: по всем тенантам; автопауза после 3 фейлов подряд. */
export async function tickAutoChains(): Promise<void> {
  const r = await pool.query(`SELECT * FROM publisher_chains WHERE kind = 'auto' AND enabled = TRUE ORDER BY last_run_at NULLS FIRST LIMIT 20`);
  for (const chain of r.rows) {
    try {
      await tickAutoChain(chain);
    } catch (e: any) {
      const streak = Number(chain.fail_streak || 0) + 1;
      const off = streak >= 3;
      await pool.query(
        `UPDATE publisher_chains SET fail_streak=$2, last_error=$3, enabled=$4, last_run_at=NOW(), updated_at=NOW() WHERE id=$1`,
        [chain.id, streak, String(e?.message || e).slice(0, 500), !off]);
      if (off) console.warn(`[publisher] авто-цепочка "${chain.name}" поставлена на паузу после 3 фейлов: ${e?.message || e}`);
    }
    await sleep(500);
  }
}

/** Отмена остатка цепочки: снимаем её запланированные посты; саму цепочку выключаем/удаляем. */
export async function cancelChain(tenantId: string, chainId: string, removeRow: boolean): Promise<{ canceled: number }> {
  const key = await tenantBlotatoKey(tenantId);
  const r = await pool.query(
    `SELECT id, submission_id FROM publisher_posts
     WHERE tenant_id = $1 AND chain_id = $2 AND status = 'scheduled'`, [tenantId, chainId]);
  let canceled = 0;
  for (const row of r.rows) {
    if (key && row.submission_id) {
      try { await cancelScheduled(key, row.submission_id); }
      catch (e: any) {
        if (!(e instanceof BlotatoError && (e.status === 404 || e.status === 400))) continue; // не смогли снять — оставляем как есть
      }
    }
    await pool.query(`UPDATE publisher_posts SET status='canceled', updated_at=NOW() WHERE id=$1`, [row.id]);
    canceled++;
    await sleep(250);
  }
  if (removeRow) await pool.query(`DELETE FROM publisher_chains WHERE tenant_id=$1 AND id=$2`, [tenantId, chainId]);
  else await pool.query(`UPDATE publisher_chains SET enabled=FALSE, updated_at=NOW() WHERE tenant_id=$1 AND id=$2`, [tenantId, chainId]);
  return { canceled };
}
