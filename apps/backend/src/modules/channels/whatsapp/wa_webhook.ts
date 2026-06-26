/**
 * WhatsApp (Cloud API) — приёмник вебхуков.
 *
 *   GET  /api/whatsapp/webhook  — верификация (hub.verify_token → hub.challenge)
 *   POST /api/whatsapp/webhook  — события (messages); statuses (доставка) игнорим
 *   GET  /api/whatsapp/status   — подключён ли номер (Bearer)
 *
 * Подпись X-Hub-Signature-256 проверяем, если задан WHATSAPP_APP_SECRET (raw body
 * захватывает express.json({verify}) при монтировании в server.ts).
 */

import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../../config/secrets.js';
import { resolveWaConfigByPhoneId, getVerifyToken } from './wa_config.js';
import { processWhatsAppMessage } from './wa_inbound.js';

const router = Router();

router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = getVerifyToken();
  if (mode === 'subscribe' && expected && token === expected) return res.status(200).send(String(challenge ?? ''));
  return res.status(403).send('forbidden');
});

function signatureOk(req: Request): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) return true; // dev: без секрета не проверяем
  const raw: Buffer = (req as any).rawBody || Buffer.from('');
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex');
  const got = req.header('x-hub-signature-256') || '';
  try { return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected)); } catch { return false; }
}

async function handleWebhook(body: any): Promise<void> {
  if (body?.object !== 'whatsapp_business_account') return;
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const ch of changes) {
      if (ch?.field !== 'messages') continue;
      const value = ch.value || {};
      const phoneId = value?.metadata?.phone_number_id;
      if (!phoneId) continue;
      const cfg = await resolveWaConfigByPhoneId(String(phoneId));
      if (!cfg) { console.warn('[wa/webhook] нет конфигурации для номера', phoneId); continue; }
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const msg of messages) {
        const contact = contacts.find((c: any) => String(c?.wa_id) === String(msg?.from)) || contacts[0] || null;
        try {
          const r = await processWhatsAppMessage(cfg, msg, contact);
          if (!(r.ok && r.replied)) console.log('[wa/webhook]', JSON.stringify(r));
        } catch (e) { console.error('[wa/inbound] event failed:', (e as Error).message); }
      }
      // value.statuses (sent/delivered/read) — игнорируем.
    }
  }
}

router.post('/webhook', (req: Request, res: Response) => {
  if (!signatureOk(req)) return res.status(403).json({ error: 'bad_signature' });
  res.status(200).json({ ok: true }); // быстрый ack
  handleWebhook(req.body || {}).catch((err) => console.error('[wa/webhook] handler error:', err?.message || err));
});

router.get('/status', (req: Request, res: Response) => {
  const h = req.header('authorization') || '';
  let tenantId = '';
  try { if (h.startsWith('Bearer ')) { const d: any = jwt.verify(h.slice(7), JWT_SECRET); tenantId = d?.tenantId || ''; } } catch { /* */ }
  if (!tenantId) return res.status(401).json({ error: 'unauthorized' });
  const envTenant = process.env.WHATSAPP_DEFAULT_TENANT_ID || process.env.CHATWOOT_DEFAULT_TENANT_ID;
  const connected = !!process.env.WHATSAPP_ACCESS_TOKEN && String(envTenant) === String(tenantId);
  res.json({ connected, phoneNumberId: connected ? (process.env.WHATSAPP_PHONE_NUMBER_ID || null) : null });
});

export default router;
