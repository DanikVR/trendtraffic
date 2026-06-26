/**
 * Instagram (прямой Graph API) — IG-0. Приёмник вебхуков.
 *
 * ОДИН callback URL (регистрируется в Meta dashboard), два метода:
 *   GET  /api/instagram/webhook  — верификация (hub.mode/hub.verify_token → hub.challenge)
 *   POST /api/instagram/webhook  — события (messages; comments — IG-1)
 *
 * Подпись X-Hub-Signature-256 проверяем, если задан INSTAGRAM_APP_SECRET
 * (raw body захватывает express.json({verify}) при монтировании в server.ts).
 * Отвечаем 200 быстро (Meta повторяет доставку при задержке), обработка — в фоне.
 */

import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../../config/secrets.js';
import { resolveIgConfigByIgId, resolveIgConfigByTenant, getVerifyToken } from './ig_config.js';
import { processInstagramEntry, processInstagramComment } from './ig_inbound.js';
import { buildAuthorizeUrl, connectInstagramAccount, getIgOAuthConfig } from './ig_oauth.js';
import { getIgAccountByTenant } from './ig_accounts.js';
import { setInstagramIceBreakers, getInstagramIceBreakers } from './ig_client.js';

/** tenantId из Bearer JWT (для account-level API). '' если нет/невалиден. */
function bearerTenant(req: Request): string {
  const h = req.header('authorization') || '';
  if (!h.startsWith('Bearer ')) return '';
  try { const d: any = jwt.verify(h.slice(7), JWT_SECRET); return d?.tenantId || ''; } catch { return ''; }
}

const router = Router();

// GET — верификация вебхука.
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = getVerifyToken();
  if (mode === 'subscribe' && expected && token === expected) {
    return res.status(200).send(String(challenge ?? ''));
  }
  return res.status(403).send('forbidden');
});

function signatureOk(req: Request): boolean {
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appSecret) return true; // dev: подпись не проверяем, если секрет не задан
  const raw: Buffer = (req as any).rawBody || Buffer.from('');
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
  const got = req.header('x-hub-signature-256') || '';
  try {
    return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function handleWebhook(body: any): Promise<void> {
  if (body?.object !== 'instagram') return;
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    const igId = entry?.id != null ? String(entry.id) : null;
    if (!igId) continue;
    const cfg = await resolveIgConfigByIgId(igId);
    if (!cfg) {
      console.warn(`[ig/webhook] нет конфигурации для IG-аккаунта ${igId} (.env INSTAGRAM_*) — пропуск`);
      continue;
    }
    const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
    for (const ev of messaging) {
      try {
        const r = await processInstagramEntry(cfg, ev);
        if (!(r.ok && r.replied)) console.log('[ig/webhook] dm:', JSON.stringify(r));
      } catch (e) {
        console.error('[ig/inbound] event failed:', (e as Error).message);
      }
    }
    // Comment-to-DM (IG-1): entry.changes с field='comments'.
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const ch of changes) {
      if (ch?.field !== 'comments') continue;
      try {
        const r = await processInstagramComment(cfg, ch);
        if (!(r.ok && r.replied)) console.log('[ig/webhook] comment:', JSON.stringify(r));
      } catch (e) {
        console.error('[ig/comment] event failed:', (e as Error).message);
      }
    }
  }
}

router.post('/webhook', (req: Request, res: Response) => {
  if (!signatureOk(req)) return res.status(403).json({ error: 'bad_signature' });
  const payload = req.body || {};
  res.status(200).json({ ok: true }); // быстрый ack
  handleWebhook(payload).catch((err) => console.error('[ig/webhook] handler error:', err?.message || err));
});

// ── IG-0.5: OAuth-самоподключение магазина ──

/** Старт OAuth. JWT передаётся в query (top-level redirect не может слать заголовок). */
router.get('/oauth/start', (req: Request, res: Response) => {
  let tenantId = '';
  try { const d: any = jwt.verify(String(req.query.t || ''), JWT_SECRET); tenantId = d?.tenantId || ''; } catch { /* invalid */ }
  if (!tenantId) return res.status(401).send('Требуется вход.');
  if (!getIgOAuthConfig()) return res.status(503).send('OAuth Instagram не настроен на сервере (INSTAGRAM_APP_ID/SECRET/REDIRECT).');
  const state = jwt.sign({ tenantId, k: 'ig_oauth' }, JWT_SECRET, { expiresIn: '10m' });
  const url = buildAuthorizeUrl(state);
  if (!url) return res.status(503).send('OAuth Instagram не настроен.');
  res.redirect(url);
});

/** Callback Meta: обмен code → токен → сохранение → редирект во фронт. */
router.get('/oauth/callback', async (req: Request, res: Response) => {
  const code = String(req.query.code || '');
  const front = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
  let tenantId = '';
  try { const d: any = jwt.verify(String(req.query.state || ''), JWT_SECRET); if (d?.k === 'ig_oauth') tenantId = d?.tenantId || ''; } catch { /* invalid */ }
  if (!tenantId || !code) return res.redirect(`${front}/flow?ig=error`);
  const r = await connectInstagramAccount(tenantId, code);
  const u = r.ok && r.username ? `&u=${encodeURIComponent(r.username)}` : '';
  return res.redirect(`${front}/flow?ig=${r.ok ? 'connected' : 'error'}${u}`);
});

/** Статус подключения (Bearer JWT). */
router.get('/status', async (req: Request, res: Response) => {
  const h = req.header('authorization') || '';
  let tenantId = '';
  try { if (h.startsWith('Bearer ')) { const d: any = jwt.verify(h.slice(7), JWT_SECRET); tenantId = d?.tenantId || ''; } } catch { /* invalid */ }
  if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
  const acc = await getIgAccountByTenant(tenantId);
  res.json({ connected: !!acc, username: acc?.username || null, igId: acc?.igId || null, oauthReady: !!getIgOAuthConfig() });
});

// GET /ice-breakers — текущие приветственные вопросы аккаунта.
router.get('/ice-breakers', async (req: Request, res: Response) => {
  const tenantId = bearerTenant(req);
  if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
  const cfg = await resolveIgConfigByTenant(tenantId);
  if (!cfg) return res.json({ connected: false, iceBreakers: [] });
  const items = await getInstagramIceBreakers(cfg);
  res.json({ connected: true, iceBreakers: items });
});

// POST /ice-breakers { iceBreakers:[{question,payload?}] } — сохранить (пустой список = удалить).
router.post('/ice-breakers', async (req: Request, res: Response) => {
  const tenantId = bearerTenant(req);
  if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
  const cfg = await resolveIgConfigByTenant(tenantId);
  if (!cfg) return res.status(400).json({ ok: false, error: 'instagram_not_connected' });
  const items = Array.isArray(req.body?.iceBreakers) ? req.body.iceBreakers : [];
  const r = await setInstagramIceBreakers(cfg, items);
  if (!r.ok) return res.status(502).json({ ok: false, error: r.error });
  res.json({ ok: true });
});

export default router;
