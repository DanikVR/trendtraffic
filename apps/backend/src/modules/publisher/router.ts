/**
 * TrendTraffic — HTTP-роутер Публикатора (вкладка Галереи; Ф1–Ф5).
 *
 *  Ф1:  GET /status · GET /accounts (+/:id/subaccounts, /pinterest/boards)
 *       POST /posts · GET /posts · POST /posts/:id/retry · DELETE /posts/:id
 *  Ф2:  GET/POST/DELETE /slots (+GET /slots/next) — СВОИ слоты «Моё расписание»
 *       PATCH /posts/:id — перенос запланированного на новое время
 *       GET/POST/PATCH/DELETE /chains — цепочки (ручные: серия по слотам; авто: см. Ф4)
 *  Ф3:  POST /ai-caption — Пост-движок (Claude, A/B, per-платформа, хэштеги)
 *       GET/POST/DELETE /templates — шаблоны текстов
 *  Ф5:  GET /analytics — топ постов Blotato (X/IG/FB/Threads/Bluesky)
 *
 * Ключ — BYO per-tenant (tenant_provider_keys, id 'blotato'); доступ — все платные тарифы.
 * Бизнес-логика (сабмит, слоты, цепочки, подписи, ретраи) — в service.ts, её же использует
 * планировщик scheduler.ts.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import pool from '../../db/index.js';
import { JWT_SECRET } from '../../config/secrets.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';
import {
  listAccounts, listSubaccounts, listPinterestBoards, cancelScheduled, updateScheduledTime, getAnalytics,
  BlotatoError, BLOTATO_PLATFORMS, BLOTATO_SETTINGS_URL, type BlotatoAccount,
} from './blotato.js';
import {
  tenantBlotatoKey, submitPost, resubmitRow, syncPendingTenant,
  listSlots, addSlots, removeSlot, nextFreeSlotTimes,
  listChains, createManualChain, cancelChain,
  generateCaptions, type TargetInput,
} from './service.js';

const router = Router();

/** Форматы UGC-сборки — фильтр авто-цепочки берёт только ролики своего формата. */
const UGC_FORMAT_KEYS = ['9x16', '16x9', '1x1', '4x5'];

interface AuthedRequest extends Request {
  tenantId?: string;
  userRole?: string;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  try {
    const decoded = jwt.verify(authHeader.substring(7), JWT_SECRET) as any;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Невалидный токен' });
  }
}

/** Публикатор доступен всем платным (решение В2): Премиум/Энтерпрайз/триал/superadmin. */
async function requireFullAccess(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    if (await hasEnterpriseAccess(req.tenantId, req.userRole as any)) return next();
  } catch { /* ниже 402 */ }
  return res.status(402).json({ error: 'Публикатор доступен на тарифе Премиум или Энтерпрайз. Оформите подписку.' });
}

router.use(requireAuth);
router.use(requireFullAccess);

const NO_KEY = {
  error: 'no_key',
  message: 'Ключ Blotato не задан. Заведите свой аккаунт my.blotato.com и вставьте API-ключ в Настройки → Ключи → Blotato.',
  settingsUrl: BLOTATO_SETTINGS_URL,
};

/** Абсолютная база сервиса — Blotato качает медиа по публичному URL. */
function absBase(req: Request): string {
  const env = String(process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
  if (env) return env;
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0] || req.protocol || 'https';
  return `${proto}://${req.get('host')}`;
}

// ── Кэш аккаунтов (память процесса, TTL 5 мин; ?refresh=1 сбрасывает) ────────
const accCache = new Map<string, { at: number; accounts: BlotatoAccount[] }>();
const ACC_TTL = 5 * 60_000;

router.get('/status', async (req: AuthedRequest, res: Response) => {
  const key = await tenantBlotatoKey(req.tenantId!);
  res.json({ hasKey: !!key, settingsUrl: BLOTATO_SETTINGS_URL, platforms: BLOTATO_PLATFORMS });
});

router.get('/accounts', async (req: AuthedRequest, res: Response) => {
  try {
    const key = await tenantBlotatoKey(req.tenantId!);
    if (!key) return res.status(409).json(NO_KEY);
    const tId = req.tenantId!;
    const cached = accCache.get(tId);
    if (!req.query.refresh && cached && Date.now() - cached.at < ACC_TTL) {
      return res.json({ accounts: cached.accounts, cached: true });
    }
    const accounts = await listAccounts(key);
    accCache.set(tId, { at: Date.now(), accounts });
    res.json({ accounts, cached: false });
  } catch (e: any) {
    const status = e instanceof BlotatoError && e.status === 401 ? 409 : 502;
    res.status(status).json(status === 409
      ? { ...NO_KEY, error: 'bad_key', message: 'Blotato отверг ключ (401). Проверьте ключ в Настройки → Ключи → Blotato (возможно, на тарифе Blotato нет API).' }
      : { error: e?.message || 'Blotato недоступен' });
  }
});

router.get('/accounts/:id/subaccounts', async (req: AuthedRequest, res: Response) => {
  try {
    const key = await tenantBlotatoKey(req.tenantId!);
    if (!key) return res.status(409).json(NO_KEY);
    res.json({ items: await listSubaccounts(key, String(req.params.id)) });
  } catch (e: any) { res.status(502).json({ error: e?.message || 'Blotato недоступен' }); }
});

router.get('/pinterest/boards', async (req: AuthedRequest, res: Response) => {
  try {
    const key = await tenantBlotatoKey(req.tenantId!);
    if (!key) return res.status(409).json(NO_KEY);
    res.json({ items: await listPinterestBoards(key, req.query.accountId ? String(req.query.accountId) : undefined) });
  } catch (e: any) { res.status(502).json({ error: e?.message || 'Blotato недоступен' }); }
});

// ── Посты ────────────────────────────────────────────────────────────────────

/** POST /posts — { assetId?|mediaUrl?, text, mode:'now'|'time'|'slot', scheduledAt?, targets:[...] } */
router.post('/posts', async (req: AuthedRequest, res: Response) => {
  try {
    const b = (req.body || {}) as any;
    const out = await submitPost({
      tenantId: req.tenantId!, baseUrl: absBase(req),
      assetId: b.assetId || undefined, mediaUrl: b.mediaUrl || undefined, title: b.title || undefined,
      text: String(b.text || ''), mode: (b.mode === 'time' || b.mode === 'slot') ? b.mode : 'now',
      scheduledAt: b.scheduledAt, targets: (b.targets || []) as TargetInput[],
    });
    const ok = out.results.filter((r) => r.ok).length;
    res.status(ok > 0 ? 201 : 502).json({ ...out, ok, failed: out.results.length - ok });
  } catch (e: any) {
    const msg = e?.message || 'Не удалось опубликовать';
    res.status(/Ключ Blotato/.test(msg) ? 409 : 400).json({ error: msg });
  }
});

router.get('/posts', async (req: AuthedRequest, res: Response) => {
  try {
    const tId = req.tenantId!;
    try { await syncPendingTenant(tId); } catch { /* синк — best-effort */ }
    const limit = Math.min(Number(req.query.limit) || 200, 400);
    const r = await pool.query(
      `SELECT id, group_id, chain_id, asset_id, media_url, text, platform, account_id, account_name,
              mode, scheduled_at, submission_id, status, post_url, error, retries, next_retry_at, created_at
       FROM publisher_posts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tId, limit]
    );
    res.json({ posts: r.rows });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось загрузить посты' }); }
});

/** Повторить упавший таргет (та же логика, что у авторетраев). */
router.post('/posts/:id/retry', async (req: AuthedRequest, res: Response) => {
  try {
    const out = await resubmitRow(req.tenantId!, String(req.params.id), absBase(req));
    if (out.ok) return res.json({ ok: true });
    res.status(502).json({ error: out.error || 'Не удалось повторить' });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось повторить' }); }
});

/** Перенос запланированного поста на новое время (Ф2, календарь). */
router.patch('/posts/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const tId = req.tenantId!;
    const when = String((req.body || {}).scheduledAt || '');
    if (!when || Number.isNaN(Date.parse(when))) return res.status(400).json({ error: 'Некорректное время (scheduledAt)' });
    if (new Date(when).getTime() < Date.now() + 60_000) return res.status(400).json({ error: 'Время должно быть в будущем' });
    const r = await pool.query(`SELECT * FROM publisher_posts WHERE id = $1 AND tenant_id = $2`, [String(req.params.id), tId]);
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: 'Пост не найден' });
    if (row.status !== 'scheduled' || !row.submission_id) return res.status(400).json({ error: 'Переносить можно только запланированный пост' });
    const key = await tenantBlotatoKey(tId);
    if (!key) return res.status(409).json(NO_KEY);
    const iso = new Date(when).toISOString();
    try { await updateScheduledTime(key, row.submission_id, iso); }
    catch (e: any) {
      return res.status(502).json({ error: e instanceof BlotatoError ? `Blotato: ${e.message}` : (e?.message || 'Не удалось перенести') });
    }
    await pool.query(`UPDATE publisher_posts SET scheduled_at=$2, updated_at=NOW() WHERE id=$1`, [row.id, iso]);
    res.json({ ok: true, scheduledAt: iso });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось перенести' }); }
});

/** Отмена запланированного (снимаем из Blotato) или удаление записи из истории. */
router.delete('/posts/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const tId = req.tenantId!;
    const r = await pool.query(`SELECT * FROM publisher_posts WHERE id = $1 AND tenant_id = $2`, [String(req.params.id), tId]);
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: 'Пост не найден' });
    if (row.status === 'scheduled' && row.submission_id) {
      const key = await tenantBlotatoKey(tId);
      if (!key) return res.status(409).json(NO_KEY);
      try { await cancelScheduled(key, row.submission_id); }
      catch (e: any) {
        if (!(e instanceof BlotatoError && (e.status === 404 || e.status === 400))) {
          return res.status(502).json({ error: e?.message || 'Не удалось отменить в Blotato' });
        }
      }
      await pool.query(`UPDATE publisher_posts SET status='canceled', updated_at=NOW() WHERE id=$1`, [row.id]);
      return res.json({ ok: true, canceled: true });
    }
    await pool.query(`DELETE FROM publisher_posts WHERE id = $1`, [row.id]);
    res.json({ ok: true, deleted: true });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось удалить' }); }
});

// ── Ф2: слоты «Моё расписание» (наши, UTC) ───────────────────────────────────
router.get('/slots', async (req: AuthedRequest, res: Response) => {
  try {
    const slots = await listSlots(req.tenantId!);
    const next = await nextFreeSlotTimes(req.tenantId!, 3, Date.now() + 60_000);
    res.json({ slots, next: next.map((d) => d.toISOString()) });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось загрузить слоты' }); }
});

router.post('/slots', async (req: AuthedRequest, res: Response) => {
  try {
    const arr = Array.isArray((req.body || {}).slots) ? (req.body.slots as any[]) : [];
    if (!arr.length) return res.status(400).json({ error: 'Передайте slots: [{dow,hh,mm}]' });
    if (arr.length > 60) return res.status(400).json({ error: 'Слишком много слотов за раз' });
    await addSlots(req.tenantId!, arr);
    res.json({ ok: true, slots: await listSlots(req.tenantId!) });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось сохранить слоты' }); }
});

router.delete('/slots/:id', async (req: AuthedRequest, res: Response) => {
  try {
    await removeSlot(req.tenantId!, Number(req.params.id));
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось удалить слот' }); }
});

router.get('/slots/next', async (req: AuthedRequest, res: Response) => {
  try {
    const count = Math.max(1, Math.min(Number(req.query.count) || 1, 30));
    const next = await nextFreeSlotTimes(req.tenantId!, count, Date.now() + 60_000);
    res.json({ next: next.map((d) => d.toISOString()) });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось рассчитать слот' }); }
});

// ── Ф2/Ф4: цепочки ──────────────────────────────────────────────────────────
router.get('/chains', async (req: AuthedRequest, res: Response) => {
  try { res.json({ chains: await listChains(req.tenantId!) }); }
  catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось загрузить цепочки' }); }
});

router.post('/chains', async (req: AuthedRequest, res: Response) => {
  try {
    const b = (req.body || {}) as any;
    const kind = b.kind === 'auto' ? 'auto' : 'manual';
    const name = String(b.name || '').trim().slice(0, 160) || (kind === 'auto' ? 'Авто-цепочка' : 'Серия');
    const targets = (Array.isArray(b.targets) ? b.targets : []) as TargetInput[];
    if (!targets.length) return res.status(400).json({ error: 'Не выбраны аккаунты цепочки' });
    const caption = (b.caption && typeof b.caption === 'object') ? b.caption : {};
    if (kind === 'manual') {
      const out = await createManualChain({
        tenantId: req.tenantId!, baseUrl: absBase(req), name,
        items: Array.isArray(b.items) ? b.items : [], targets, caption,
      });
      return res.status(201).json(out);
    }
    // auto: только создать запись — контент подберёт тик (ролики автопилота auto-ugc)
    const id = randomUUID();
    const dailyCap = Math.max(1, Math.min(Number(b.dailyCap) || 3, 20));
    const formatFilter = UGC_FORMAT_KEYS.includes(String(b.formatFilter)) ? String(b.formatFilter) : null;
    await pool.query(
      `INSERT INTO publisher_chains (id, tenant_id, name, kind, items, targets, caption, daily_cap, enabled, cursor, format_filter)
       VALUES ($1,$2,$3,'auto','[]',$4,$5,$6,TRUE,0,$7)`,
      [id, req.tenantId!, name, JSON.stringify(targets), JSON.stringify(caption), dailyCap, formatFilter]
    );
    res.status(201).json({ chainId: id });
  } catch (e: any) { res.status(400).json({ error: e?.message || 'Не удалось создать цепочку' }); }
});

router.patch('/chains/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const b = (req.body || {}) as any;
    const sets: string[] = []; const vals: any[] = [req.tenantId!, String(req.params.id)];
    if (typeof b.enabled === 'boolean') { vals.push(b.enabled); sets.push(`enabled=$${vals.length}, fail_streak=0, last_error=NULL`); }
    if (b.dailyCap != null) { vals.push(Math.max(1, Math.min(Number(b.dailyCap) || 3, 20))); sets.push(`daily_cap=$${vals.length}`); }
    if (typeof b.name === 'string' && b.name.trim()) { vals.push(b.name.trim().slice(0, 160)); sets.push(`name=$${vals.length}`); }
    if (b.formatFilter !== undefined) { // '' | null = снять фильтр («любой формат»)
      vals.push(UGC_FORMAT_KEYS.includes(String(b.formatFilter)) ? String(b.formatFilter) : null);
      sets.push(`format_filter=$${vals.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Нечего менять' });
    await pool.query(`UPDATE publisher_chains SET ${sets.join(', ')}, updated_at=NOW() WHERE tenant_id=$1 AND id=$2`, vals);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось обновить цепочку' }); }
});

router.delete('/chains/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const out = await cancelChain(req.tenantId!, String(req.params.id), true);
    res.json({ ok: true, ...out });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось удалить цепочку' }); }
});

// ── Ф3: Пост-движок + шаблоны текстов ────────────────────────────────────────
router.post('/ai-caption', async (req: AuthedRequest, res: Response) => {
  try {
    const b = (req.body || {}) as any;
    const out = await generateCaptions({
      tenantId: req.tenantId!,
      title: b.title ? String(b.title) : undefined,
      assetId: b.assetId ? String(b.assetId) : undefined,
      platforms: Array.isArray(b.platforms) ? b.platforms : [],
      tone: b.tone, language: b.language, count: b.count, brief: b.brief,
    });
    res.json(out);
  } catch (e: any) { res.status(400).json({ error: e?.message || 'Не удалось сгенерировать подпись' }); }
});

router.get('/templates', async (req: AuthedRequest, res: Response) => {
  try {
    const r = await pool.query(
      `SELECT id, name, text, created_at FROM publisher_templates WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.tenantId!]);
    res.json({ templates: r.rows });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось загрузить шаблоны' }); }
});

router.post('/templates', async (req: AuthedRequest, res: Response) => {
  try {
    const b = (req.body || {}) as any;
    const name = String(b.name || '').trim().slice(0, 120);
    const text = String(b.text || '').slice(0, 5000);
    if (!name || !text) return res.status(400).json({ error: 'Нужны name и text' });
    const r = await pool.query(
      `INSERT INTO publisher_templates (tenant_id, name, text) VALUES ($1,$2,$3) RETURNING id, name, text, created_at`,
      [req.tenantId!, name, text]);
    res.status(201).json({ template: r.rows[0] });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось сохранить шаблон' }); }
});

router.delete('/templates/:id', async (req: AuthedRequest, res: Response) => {
  try {
    await pool.query(`DELETE FROM publisher_templates WHERE tenant_id=$1 AND id=$2`, [req.tenantId!, Number(req.params.id)]);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось удалить шаблон' }); }
});

// ── Ф5: аналитика Blotato (X/IG/FB/Threads/Bluesky; TikTok/YT — «Каналы»/TikHub) ──
router.get('/analytics', async (req: AuthedRequest, res: Response) => {
  try {
    const key = await tenantBlotatoKey(req.tenantId!);
    if (!key) return res.status(409).json(NO_KEY);
    const days = Math.max(1, Math.min(Number(req.query.days) || 30, 90));
    res.json({ items: await getAnalytics(key, days), days });
  } catch (e: any) {
    const msg = e instanceof BlotatoError ? e.message : (e?.message || 'Blotato недоступен');
    res.status(e instanceof BlotatoError && e.status === 401 ? 409 : 502).json({ error: msg });
  }
});

export default router;
