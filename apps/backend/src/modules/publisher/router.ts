/**
 * TrendTraffic — HTTP-роутер Публикатора (вкладка Галереи, Ф1).
 *
 *  GET    /api/publisher/status                 — есть ли ключ Blotato у тенанта (+статус проверки)
 *  GET    /api/publisher/accounts               — подключённые соцаккаунты (кэш 5 мин, ?refresh=1)
 *  GET    /api/publisher/accounts/:id/subaccounts — страницы FB / LinkedIn / плейлисты YouTube
 *  GET    /api/publisher/pinterest/boards       — доски Pinterest (?accountId=)
 *  POST   /api/publisher/posts                  — опубликовать: 1 медиа × N аккаунтов (now|time|slot)
 *  GET    /api/publisher/posts                  — наша история + ленивый синк статусов из Blotato
 *  POST   /api/publisher/posts/:id/retry        — повторить упавший таргет
 *  DELETE /api/publisher/posts/:id              — отменить запланированный / убрать запись из истории
 *
 * Ключ — BYO per-tenant (решение юзера 08.07.2026): tenant_provider_keys, id 'blotato'
 * (вводится в Настройки → Ключи, там же реальная проверка). Подключение соцсетей —
 * ТОЛЬКО в кабинете my.blotato.com: у Blotato нет API для этого, плитки сетей в UI
 * ведут сразу на нужную страницу кабинета.
 *
 * Доступ: все платные тарифы (Премиум/Энтерпрайз/триал) — решение В2; гейт тот же,
 * что у Трендов (hasEnterpriseAccess = «полный доступ», Premium его тоже имеет).
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import pool from '../../db/index.js';
import { JWT_SECRET } from '../../config/secrets.js';
import { hasEnterpriseAccess } from '../billing/feature_gate.js';
import { getEffectiveProviderKey } from '../tenant_settings/provider_keys.js';
import {
  listAccounts, listSubaccounts, listPinterestBoards, createPost, getPostStatus, cancelScheduled,
  BlotatoError, BLOTATO_PLATFORMS, BLOTATO_SETTINGS_URL, type BlotatoPlatform, type BlotatoAccount,
} from './blotato.js';

const router = Router();

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

/** Ключ Blotato тенанта; null → фронт показывает онбординг (ввести в Настройки → Ключи). */
async function tenantKey(req: AuthedRequest): Promise<string | null> {
  return getEffectiveProviderKey(req.tenantId, 'blotato');
}
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
const absUrl = (base: string, u?: string | null): string =>
  (u && !/^https?:\/\//i.test(u) ? base + (u.startsWith('/') ? u : '/' + u) : (u || ''));

// ── Кэш аккаунтов (память процесса, TTL 5 мин; ?refresh=1 сбрасывает) ────────
const accCache = new Map<string, { at: number; accounts: BlotatoAccount[] }>();
const ACC_TTL = 5 * 60_000;

router.get('/status', async (req: AuthedRequest, res: Response) => {
  const key = await tenantKey(req);
  res.json({ hasKey: !!key, settingsUrl: BLOTATO_SETTINGS_URL, platforms: BLOTATO_PLATFORMS });
});

router.get('/accounts', async (req: AuthedRequest, res: Response) => {
  try {
    const key = await tenantKey(req);
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
    const key = await tenantKey(req);
    if (!key) return res.status(409).json(NO_KEY);
    res.json({ items: await listSubaccounts(key, String(req.params.id)) });
  } catch (e: any) { res.status(502).json({ error: e?.message || 'Blotato недоступен' }); }
});

router.get('/pinterest/boards', async (req: AuthedRequest, res: Response) => {
  try {
    const key = await tenantKey(req);
    if (!key) return res.status(409).json(NO_KEY);
    res.json({ items: await listPinterestBoards(key, req.query.accountId ? String(req.query.accountId) : undefined) });
  } catch (e: any) { res.status(502).json({ error: e?.message || 'Blotato недоступен' }); }
});

// ── Сборка платформенного target (обязательные поля — с безопасными дефолтами) ──
function buildTarget(platform: BlotatoPlatform, o: Record<string, any>, fallbackTitle: string): Record<string, unknown> {
  switch (platform) {
    case 'tiktok': return {
      targetType: 'tiktok',
      privacyLevel: o.privacyLevel || 'PUBLIC_TO_EVERYONE',
      disabledComments: !!o.disabledComments,
      disabledDuet: !!o.disabledDuet,
      disabledStitch: !!o.disabledStitch,
      isBrandedContent: !!o.isBrandedContent,
      isYourBrand: !!o.isYourBrand,
      // Наши ролики — сгенерированные: честный дефолт «ИИ-контент» (отключаемо в студии).
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

/** Обязательные поля, без которых Blotato гарантированно вернёт ошибку, — валидируем ДО сабмита. */
function targetPrecheck(platform: BlotatoPlatform, o: Record<string, any>): string | null {
  if (platform === 'facebook' && !o.pageId) return 'Facebook: не выбрана страница (pageId)';
  if (platform === 'pinterest' && !o.boardId) return 'Pinterest: не выбрана доска (boardId)';
  return null;
}

interface PostTargetInput {
  accountId: string;
  platform: string;
  options?: Record<string, any>;
  textOverride?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST /posts — { assetId?|mediaUrl?, text, mode:'now'|'time'|'slot', scheduledAt?, targets:[...] } */
router.post('/posts', async (req: AuthedRequest, res: Response) => {
  try {
    const key = await tenantKey(req);
    if (!key) return res.status(409).json(NO_KEY);
    const tId = req.tenantId!;
    const { assetId, mediaUrl, text = '', mode = 'now', scheduledAt, targets } = (req.body || {}) as {
      assetId?: string; mediaUrl?: string; text?: string; mode?: 'now' | 'time' | 'slot';
      scheduledAt?: string; targets?: PostTargetInput[];
    };
    if (!Array.isArray(targets) || targets.length === 0) return res.status(400).json({ error: 'Не выбраны аккаунты (targets)' });
    if (targets.length > 12) return res.status(400).json({ error: 'Слишком много целей за раз (максимум 12)' });
    if (mode === 'time' && !scheduledAt) return res.status(400).json({ error: 'Не задано время публикации (scheduledAt)' });

    // Медиа: из Галереи (assetId — проверяем принадлежность тенанту) или готовый URL.
    let fileUrl = String(mediaUrl || '');
    let title = '';
    if (assetId) {
      const r = await pool.query(
        `SELECT file_url, original_name FROM media_assets WHERE id = $1 AND tenant_id = $2`,
        [assetId, tId]
      );
      if (!r.rows[0]) return res.status(404).json({ error: 'Файл не найден в Галерее' });
      fileUrl = r.rows[0].file_url;
      title = r.rows[0].original_name || '';
    }
    const base = absBase(req);
    const publicUrl = absUrl(base, fileUrl);
    const mediaUrls = publicUrl ? [publicUrl] : [];
    const fallbackTitle = (title || text || 'Video').split('\n')[0].trim().slice(0, 100);
    const scheduledTime = mode === 'time' ? new Date(String(scheduledAt)).toISOString() : undefined;
    if (mode === 'time' && Number.isNaN(Date.parse(String(scheduledAt)))) {
      return res.status(400).json({ error: 'Некорректное время публикации' });
    }

    const groupId = randomUUID();
    const results: { id: string; platform: string; accountId: string; ok: boolean; error?: string }[] = [];

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const platform = String(t.platform || '').toLowerCase() as BlotatoPlatform;
      const rowId = randomUUID();
      const opts = t.options || {};
      const rowText = (t.textOverride ?? text) || '';
      let submissionId: string | null = null;
      let status = mode === 'now' ? 'submitted' : 'scheduled';
      let error: string | null = null;

      if (!(BLOTATO_PLATFORMS as readonly string[]).includes(platform)) {
        status = 'failed'; error = `Платформа не поддерживается: ${t.platform}`;
      } else {
        const pre = targetPrecheck(platform, opts);
        if (pre) { status = 'failed'; error = pre; }
        else {
          try {
            const target = buildTarget(platform, opts, fallbackTitle);
            const r = await createPost(key, {
              accountId: String(t.accountId), platform, text: rowText, mediaUrls, target,
              scheduledTime, useNextFreeSlot: mode === 'slot' || undefined,
            });
            submissionId = r.submissionId;
          } catch (e: any) {
            status = 'failed';
            error = e instanceof BlotatoError ? e.message : (e?.message || 'Ошибка Blotato');
          }
        }
      }

      await pool.query(
        `INSERT INTO publisher_posts
           (id, tenant_id, group_id, asset_id, media_url, text, platform, account_id, account_name,
            target, mode, scheduled_at, submission_id, status, error)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [rowId, tId, groupId, assetId || null, fileUrl || null, rowText, platform, String(t.accountId),
         opts.accountName || null, JSON.stringify(opts), mode,
         scheduledTime || null, submissionId, status, error]
      );
      results.push({ id: rowId, platform, accountId: String(t.accountId), ok: status !== 'failed', error: error || undefined });
      if (i < targets.length - 1) await sleep(350); // бережём лимит 30 постов/мин
    }

    const okCount = results.filter((r) => r.ok).length;
    res.status(okCount > 0 ? 201 : 502).json({ groupId, results, ok: okCount, failed: results.length - okCount });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Не удалось опубликовать' });
  }
});

/** Ленивый синк статусов: до 8 самых старых «в полёте» строк за запрос ленты. */
async function syncPending(tId: string, key: string): Promise<void> {
  const r = await pool.query(
    `SELECT id, submission_id FROM publisher_posts
     WHERE tenant_id = $1 AND submission_id IS NOT NULL AND status IN ('submitted','scheduled')
       AND updated_at < NOW() - INTERVAL '20 seconds'
     ORDER BY updated_at ASC LIMIT 8`,
    [tId]
  );
  if (!r.rows.length) return;
  await Promise.allSettled(r.rows.map(async (row: any) => {
    const st = await getPostStatus(key, row.submission_id);
    if (st.type === 'published') {
      await pool.query(`UPDATE publisher_posts SET status='published', post_url=$2, error=NULL, updated_at=NOW() WHERE id=$1`, [row.id, st.postUrl]);
    } else if (st.type === 'failed') {
      await pool.query(`UPDATE publisher_posts SET status='failed', error=$2, updated_at=NOW() WHERE id=$1`, [row.id, st.errorMessage || 'Ошибка публикации']);
    } else {
      await pool.query(`UPDATE publisher_posts SET updated_at=NOW() WHERE id=$1`, [row.id]); // не душим одну и ту же строку
    }
  }));
}

router.get('/posts', async (req: AuthedRequest, res: Response) => {
  try {
    const tId = req.tenantId!;
    const key = await tenantKey(req);
    if (key) { try { await syncPending(tId, key); } catch { /* синк — best-effort */ } }
    const limit = Math.min(Number(req.query.limit) || 200, 400);
    const r = await pool.query(
      `SELECT id, group_id, asset_id, media_url, text, platform, account_id, account_name,
              mode, scheduled_at, submission_id, status, post_url, error, created_at
       FROM publisher_posts WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [tId, limit]
    );
    res.json({ posts: r.rows });
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось загрузить посты' }); }
});

/** Повторить упавший таргет (пересобираем сабмит из сохранённой строки). */
router.post('/posts/:id/retry', async (req: AuthedRequest, res: Response) => {
  try {
    const key = await tenantKey(req);
    if (!key) return res.status(409).json(NO_KEY);
    const tId = req.tenantId!;
    const r = await pool.query(`SELECT * FROM publisher_posts WHERE id = $1 AND tenant_id = $2`, [String(req.params.id), tId]);
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: 'Пост не найден' });
    if (row.status !== 'failed') return res.status(400).json({ error: 'Повторить можно только упавший пост' });

    const platform = String(row.platform) as BlotatoPlatform;
    const opts = typeof row.target === 'object' && row.target ? row.target : {};
    const pre = targetPrecheck(platform, opts);
    if (pre) return res.status(400).json({ error: pre });
    const base = absBase(req);
    const mediaUrls = row.media_url ? [absUrl(base, row.media_url)] : [];
    // Время в прошлом → публикуем сейчас; будущее сохранённое время — уважаем.
    const sched = row.scheduled_at && new Date(row.scheduled_at).getTime() > Date.now()
      ? new Date(row.scheduled_at).toISOString() : undefined;
    try {
      const out = await createPost(key, {
        accountId: String(row.account_id), platform, text: row.text || '', mediaUrls,
        target: buildTarget(platform, opts, (row.text || 'Video').split('\n')[0].slice(0, 100)),
        scheduledTime: sched, useNextFreeSlot: row.mode === 'slot' || undefined,
      });
      await pool.query(
        `UPDATE publisher_posts SET submission_id=$2, status=$3, error=NULL, updated_at=NOW() WHERE id=$1`,
        [row.id, out.submissionId, (sched || row.mode === 'slot') ? 'scheduled' : 'submitted']
      );
      res.json({ ok: true });
    } catch (e: any) {
      const msg = e instanceof BlotatoError ? e.message : (e?.message || 'Ошибка Blotato');
      await pool.query(`UPDATE publisher_posts SET error=$2, updated_at=NOW() WHERE id=$1`, [row.id, msg]);
      res.status(502).json({ error: msg });
    }
  } catch (e: any) { res.status(500).json({ error: e?.message || 'Не удалось повторить' }); }
});

/** Отмена запланированного (снимаем из Blotato) или удаление записи из истории. */
router.delete('/posts/:id', async (req: AuthedRequest, res: Response) => {
  try {
    const tId = req.tenantId!;
    const r = await pool.query(`SELECT * FROM publisher_posts WHERE id = $1 AND tenant_id = $2`, [String(req.params.id), tId]);
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: 'Пост не найден' });
    if (row.status === 'scheduled' && row.submission_id) {
      const key = await tenantKey(req);
      if (!key) return res.status(409).json(NO_KEY);
      try { await cancelScheduled(key, row.submission_id); }
      catch (e: any) {
        // Уже опубликован/не найден в Blotato — не блокируем чистку записи.
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

export default router;
