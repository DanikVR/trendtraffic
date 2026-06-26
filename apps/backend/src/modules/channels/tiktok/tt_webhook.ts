/**
 * TikTok (Business Messaging API) — приёмник вебхуков + account-level настройки.
 *
 *   GET  /api/tiktok/webhook         — верификация (verify_token → challenge)
 *   POST /api/tiktok/webhook         — события (сообщения, комментарии)
 *   GET  /api/tiktok/status          — подключён ли аккаунт (Bearer)
 *   GET  /api/tiktok/auto-messages   — текущие Welcome + Suggested (Bearer)
 *   POST /api/tiktok/auto-messages   — сохранить Welcome + Suggested (≤3) (Bearer)
 *   GET  /api/tiktok/ref-url         — deep-link для шапки профиля / QR (Bearer)
 *
 * ⚠️ Точные формы вебхука/подписи TikTok сверяются при partner-доступе.
 */

import { Router, type Request, type Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../../config/secrets.js';
import { resolveTtConfigByAccountId, resolveTtConfigByTenant, getVerifyToken } from './tt_config.js';
import { processTikTokEntry, processTikTokComment } from './tt_inbound.js';
import { setTikTokWelcome, setTikTokSuggestedQuestions, getTikTokAutoMessages } from './tt_client.js';

const router = Router();

function bearerTenant(req: Request): string {
  const h = req.header('authorization') || '';
  if (!h.startsWith('Bearer ')) return '';
  try { const d: any = jwt.verify(h.slice(7), JWT_SECRET); return d?.tenantId || ''; } catch { return ''; }
}

// GET — верификация вебхука.
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] ?? 'subscribe';
  const token = req.query['hub.verify_token'] ?? req.query['verify_token'];
  const challenge = req.query['hub.challenge'] ?? req.query['challenge'] ?? '';
  const expected = getVerifyToken();
  if (mode === 'subscribe' && expected && token === expected) return res.status(200).send(String(challenge));
  return res.status(403).send('forbidden');
});

async function handleWebhook(body: any): Promise<void> {
  // Событие(я) могут прийти батчем; форму сверяем при partner-доступе.
  const events: any[] = Array.isArray(body?.events) ? body.events
    : Array.isArray(body?.data?.events) ? body.data.events
    : Array.isArray(body) ? body : [body];
  for (const ev of events) {
    if (!ev || typeof ev !== 'object') continue;
    const businessId = String(ev?.business_id ?? ev?.account_id ?? body?.business_id ?? process.env.TIKTOK_BUSINESS_ID ?? '');
    const cfg = await resolveTtConfigByAccountId(businessId);
    if (!cfg) { console.warn('[tt/webhook] нет конфигурации для аккаунта', businessId); continue; }
    const type = String(ev?.type ?? ev?.event ?? '');
    try {
      if (/comment/i.test(type)) await processTikTokComment(cfg, ev);
      else await processTikTokEntry(cfg, ev);
    } catch (e) { console.error('[tt/webhook] event failed:', (e as Error).message); }
  }
}

router.post('/webhook', (req: Request, res: Response) => {
  res.status(200).json({ ok: true }); // быстрый ack
  handleWebhook(req.body || {}).catch((err) => console.error('[tt/webhook] handler error:', err?.message || err));
});

// Статус подключения (env-MVP: подключён, если для tenant задан токен).
router.get('/status', async (req: Request, res: Response) => {
  const tenantId = bearerTenant(req);
  if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
  const cfg = await resolveTtConfigByTenant(tenantId);
  res.json({ connected: !!cfg, accountId: cfg?.accountId || null });
});

// Welcome + Suggested Questions.
router.get('/auto-messages', async (req: Request, res: Response) => {
  const tenantId = bearerTenant(req);
  if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
  const cfg = await resolveTtConfigByTenant(tenantId);
  if (!cfg) return res.json({ connected: false, welcome: '', suggested: [] });
  const data = await getTikTokAutoMessages(cfg);
  res.json({ connected: true, ...data });
});

router.post('/auto-messages', async (req: Request, res: Response) => {
  const tenantId = bearerTenant(req);
  if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
  const cfg = await resolveTtConfigByTenant(tenantId);
  if (!cfg) return res.status(400).json({ ok: false, error: 'tiktok_not_connected' });
  const welcome = String(req.body?.welcome || '');
  const suggested = Array.isArray(req.body?.suggested) ? req.body.suggested.map((s: any) => String(s)) : [];
  const r1 = await setTikTokWelcome(cfg, welcome);
  const r2 = await setTikTokSuggestedQuestions(cfg, suggested);
  if (!r1.ok || !r2.ok) return res.status(502).json({ ok: false, error: r1.error || r2.error });
  res.json({ ok: true });
});

// Ref-URL (deep-link в шапку профиля / для QR). Точный deep-link формат — при partner-доступе.
router.get('/ref-url', async (req: Request, res: Response) => {
  const tenantId = bearerTenant(req);
  if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
  const cfg = await resolveTtConfigByTenant(tenantId);
  if (!cfg) return res.json({ connected: false, url: '' });
  const username = process.env.TIKTOK_USERNAME || '';
  const ref = String(req.query.ref || 'vibevox');
  const url = username ? `https://www.tiktok.com/@${username}?ref=${encodeURIComponent(ref)}` : '';
  res.json({ connected: true, url, ref, note: username ? null : 'Задайте TIKTOK_USERNAME в .env для ссылки.' });
});

export default router;
