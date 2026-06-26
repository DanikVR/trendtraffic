/**
 * OMNICHANNEL Фаза 1 — приёмник вебхуков Chatwoot Agent Bot.
 *
 * URL (в настройках Agent Bot как outgoing_url):
 *   POST /api/chatwoot/webhook/<секрет>
 *
 * Отвечаем 200 сразу (Chatwoot ждёт быстрый ack, иначе повторяет доставку),
 * а ИИ-обработку выполняем асинхронно. Анти-петля: реагируем только на
 * входящие сообщения от клиента (message_type='incoming'), игнорируя наши же
 * outgoing-ответы и приватные заметки агентов.
 */

import { Router, type Request, type Response } from 'express';
import { resolveInboxOrEnvDefault } from './inboxes.js';
import { processChatwootInbound } from './chatwoot_inbound.js';
import { deleteTasksForChatwootContact } from '../crm_tasks/service.js';

const router = Router();

function webhookSecretOk(secret: string): boolean {
  const expected = process.env.CHATWOOT_WEBHOOK_SECRET || '';
  return expected.length > 0 && secret === expected;
}

async function handleEvent(payload: any): Promise<void> {
  const event = payload?.event;

  // VibeVox CRM: контакт удалён в Chatwoot → каскадно снимаем его отложенные задачи,
  // чтобы воркер не слал «в пустоту» (см. docs/KANBAN_CRM_MODULE.md).
  if (event === 'contact_deleted' || event === 'contact.deleted') {
    const accId = payload?.account?.id ?? payload?.account_id;
    const contactId = payload?.id ?? payload?.contact?.id;
    if (accId != null && contactId != null) {
      const n = await deleteTasksForChatwootContact(String(accId), String(contactId));
      if (n > 0) console.log(`[chatwoot/webhook] контакт ${contactId} удалён → снято CRM-задач: ${n}`);
    }
    return;
  }

  if (event !== 'message_created') return; // прочие события в Фазе 1 игнорируем

  // Анти-петля: только входящие от клиента.
  const mt = payload?.message_type;
  const isIncoming = mt === 'incoming' || mt === 0;
  if (!isIncoming) return;
  if (payload?.private === true) return; // приватные заметки агентов — пропуск

  const inboxId =
    payload?.inbox?.id ??
    payload?.conversation?.inbox_id ??
    payload?.conversation?.channel?.inbox_id ??
    null;
  if (inboxId == null) {
    console.warn('[chatwoot/webhook] message_created без inbox_id — пропуск');
    return;
  }

  const inbox = await resolveInboxOrEnvDefault(inboxId);
  if (!inbox) {
    console.warn(`[chatwoot/webhook] инбокс ${inboxId} не привязан к tenant (channel_inboxes / env) — пропуск`);
    return;
  }

  const result = await processChatwootInbound(inbox, payload);
  if (result.ok && result.replied) {
    console.log(`[chatwoot/webhook] ответ отправлен (room ${result.roomId})`);
  } else {
    console.warn('[chatwoot/webhook] не ответили:', JSON.stringify(result));
  }
}

router.post('/webhook/:secret', (req: Request, res: Response) => {
  if (!webhookSecretOk(req.params.secret)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const payload = req.body || {};
  // Быстрый ack — Chatwoot не любит долгий ответ (повторяет доставку).
  res.status(200).json({ ok: true });
  // ИИ-обработка в фоне; ошибки только логируем.
  handleEvent(payload).catch((err) =>
    console.error('[chatwoot/webhook] handler error:', err?.message || err)
  );
});

export default router;
