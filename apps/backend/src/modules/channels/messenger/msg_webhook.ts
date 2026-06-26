/**
 * Messenger (Messenger Platform API) — приёмник вебхуков + account-level настройки.
 *
 *   GET/POST /api/messenger/webhook  — верификация + события (object='page')
 *   GET  /api/messenger/status       — подключена ли страница (Bearer)
 *   GET  /api/messenger/profile      — Greeting + Ice Breakers + Persistent Menu (Bearer)
 *   POST /api/messenger/profile      — сохранить их + Get Started (Bearer)
 *   GET  /api/messenger/ref-url      — m.me deep-link для трафика в Директ (Bearer)
 */

import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../../config/secrets.js';
import { resolveMsgConfigByPageId, resolveMsgConfigByTenant, getVerifyToken } from './msg_config.js';
import { processMessengerEntry, processMessengerComment } from './msg_inbound.js';
import { setMessengerProfile, getMessengerProfile } from './msg_client.js';

const router = Router();

function bearerTenant(req: Request): string {
  const h = req.header('authorization') || '';
  if (!h.startsWith('Bearer ')) return '';
  try { const d: any = jwt.verify(h.slice(7), JWT_SECRET); return d?.tenantId || ''; } catch { return ''; }
}

router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = getVerifyToken();
  if (mode === 'subscribe' && expected && token === expected) return res.status(200).send(String(challenge ?? ''));
  return res.status(403).send('forbidden');
});

function signatureOk(req: Request): boolean {
  const appSecret = process.env.MESSENGER_APP_SECRET;
  if (!appSecret) return true;
  const raw: Buffer = (req as any).rawBody || Buffer.from('');
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
  const got = req.header('x-hub-signature-256') || '';
  try { return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected)); } catch { return false; }
}

async function handleWebhook(body: any): Promise<void> {
  if (body?.object !== 'page') return;
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    const pageId = entry?.id != null ? String(entry.id) : null;
    if (!pageId) continue;
    const cfg = await resolveMsgConfigByPageId(pageId);
    if (!cfg) { console.warn('[msg/webhook] нет конфигурации для страницы', pageId); continue; }
    const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
    for (const ev of messaging) {
      try { const r = await processMessengerEntry(cfg, ev); if (!(r.ok && r.replied)) console.log('[msg/webhook] dm:', JSON.stringify(r)); }
      catch (e) { console.error('[msg/inbound] event failed:', (e as Error).message); }
    }
    // Comment-to-DM: коммент под постом приходит как changes[] поле 'feed'.
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const ch of changes) {
      if (ch?.field !== 'feed') continue;
      try { await processMessengerComment(cfg, ch); }
      catch (e) { console.error('[msg/comment] event failed:', (e as Error).message); }
    }
  }
}

router.post('/webhook', (req: Request, res: Response) => {
  if (!signatureOk(req)) return res.status(403).json({ error: 'bad_signature' });
  res.status(200).json({ ok: true });
  handleWebhook(req.body || {}).catch((err) => console.error('[msg/webhook] handler error:', err?.message || err));
});

router.get('/status', async (req: Request, res: Response) => {
  const tenantId = bearerTenant(req);
  if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
  const cfg = await resolveMsgConfigByTenant(tenantId);
  res.json({ connected: !!cfg, pageId: cfg?.pageId || null });
});

router.get('/profile', async (req: Request, res: Response) => {
  const tenantId = bearerTenant(req);
  if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
  const cfg = await resolveMsgConfigByTenant(tenantId);
  if (!cfg) return res.json({ connected: false, greeting: '', iceBreakers: [], menu: [] });
  const data = await getMessengerProfile(cfg);
  res.json({ connected: true, ...data });
});

router.post('/profile', async (req: Request, res: Response) => {
  const tenantId = bearerTenant(req);
  if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
  const cfg = await resolveMsgConfigByTenant(tenantId);
  if (!cfg) return res.status(400).json({ ok: false, error: 'messenger_not_connected' });
  const r = await setMessengerProfile(cfg, {
    greeting: String(req.body?.greeting || ''),
    iceBreakers: Array.isArray(req.body?.iceBreakers) ? req.body.iceBreakers : [],
    menu: Array.isArray(req.body?.menu) ? req.body.menu : [],
  });
  if (!r.ok) return res.status(502).json({ ok: false, error: r.error });
  res.json({ ok: true });
});

router.get('/ref-url', async (req: Request, res: Response) => {
  const tenantId = bearerTenant(req);
  if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
  const cfg = await resolveMsgConfigByTenant(tenantId);
  if (!cfg) return res.json({ connected: false, url: '' });
  const username = process.env.MESSENGER_PAGE_USERNAME || '';
  const ref = String(req.query.ref || 'vibevox');
  const url = username ? `https://m.me/${username}?ref=${encodeURIComponent(ref)}` : '';
  res.json({ connected: true, url, ref, note: username ? null : 'Задайте MESSENGER_PAGE_USERNAME в .env для m.me-ссылки.' });
});

export default router;
