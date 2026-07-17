/**
 * Мини-клиент Claude для скиллов и планировщика сториборда.
 *
 * Ключ: per-tenant 'anthropic' → resolveAnthropicKey (BYO-политика: у Премиума без
 * своего ключа — null, платформенный ключ не тратим). SDK динамически, как в
 * render/director.ts. Ошибки — наружу понятным текстом (роутеры отдают 400/502).
 */

import { resolveAnthropicKey, DEFAULT_DIRECTOR_MODEL } from '../render/director.js';

let _Ctor: any = null;
async function getClient(apiKey: string): Promise<any> {
  if (!_Ctor) {
    const mod: any = await import('@anthropic-ai/sdk');
    _Ctor = mod.default || mod.Anthropic || mod;
  }
  return new _Ctor({ apiKey });
}

export class NoAnthropicKeyError extends Error {
  constructor() {
    super('Нужен ключ Anthropic (Claude). Добавьте его в Настройки → Ключи провайдеров.');
    this.name = 'NoAnthropicKeyError';
  }
}

/** Ключ тенанта или понятная ошибка (для скиллов, где Claude обязателен). */
export async function requireAnthropicKey(tenantId: string): Promise<string> {
  const key = await resolveAnthropicKey(tenantId);
  if (!key) throw new NoAnthropicKeyError();
  return key;
}

/** Один вызов Claude → финальный текст. */
export async function callClaudeText(opts: {
  apiKey: string; system: string; user: string; model?: string; maxTokens?: number;
}): Promise<string> {
  const client = await getClient(opts.apiKey);
  const res = await client.messages.create({
    model: opts.model || DEFAULT_DIRECTOR_MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    thinking: { type: 'adaptive' },
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
  });
  return (res.content || [])
    .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
    .map((b: any) => b.text)
    .join('')
    .trim();
}

/** Достаёт первый JSON-объект/массив из текста модели (обрамляющий текст игнорируем). */
export function extractJson(raw: string): any | null {
  const m = raw.match(/[\[{][\s\S]*[\]}]/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
