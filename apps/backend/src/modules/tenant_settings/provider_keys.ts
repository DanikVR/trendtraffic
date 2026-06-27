/**
 * Per-tenant BYO-ключи генеративных провайдеров OpenMontage (TrendTraffic).
 *
 * OpenMontage умеет дёргать платные сервисы (FAL, OpenAI, ElevenLabs, HeyGen,
 * Runway, Suno, xAI, Doubao, Google) и бесплатные сток-источники (Pexels,
 * Pixabay, Unsplash) + HF-токен. Enterprise-тенант вводит СВОИ ключи здесь —
 * рендер от его имени использует их.
 *
 * Хранение: единая таблица tenant_provider_keys (tenant_id VARCHAR(64), provider),
 * ключ зашифрован AES-256-GCM (encryptSecret/decryptSecret на SIP_ENCRYPTION_KEY).
 * Кнопка «Проверить» РЕАЛЬНО пингует API провайдера (где это возможно бесплатно).
 *
 * Аналог tenant_settings/tikhub.ts, но обобщён на N провайдеров одной таблицей.
 */

import pool from '../../db/index.js';
import { encryptSecret, decryptSecret } from './encryption.js';

export type ProviderKeyStatus = 'active' | 'invalid' | 'quota_exceeded' | 'unknown' | null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v: string | null | undefined): boolean { return !!v && UUID_RE.test(v); }

const NOT_TENANT_MSG =
  'Ключи генерации доступны только Enterprise-тенантам. Вы вошли как суперадмин — у вас нет tenant-аккаунта.';

export interface VerifyResult { ok: boolean; status: ProviderKeyStatus; message: string; }

interface ProviderDef {
  id: string;
  label: string;
  group: 'llm' | 'paid' | 'stock';
  help?: string;       // ссылка «где взять ключ»
  verify: (key: string) => Promise<VerifyResult>;
}

// ── ping с таймаутом + маппинг HTTP→статус ──────────────────────────────────
async function ping(url: string, opts: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const tmr = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(tmr); }
}

function fromResp(r: Response, label: string): VerifyResult {
  if (r.ok) return { ok: true, status: 'active', message: `${label}: ключ активен` };
  if (r.status === 401 || r.status === 403) return { ok: false, status: 'invalid', message: `${label}: ключ невалиден (HTTP ${r.status})` };
  if (r.status === 429) return { ok: false, status: 'quota_exceeded', message: `${label}: превышен лимит / нет баланса (429)` };
  return { ok: false, status: 'unknown', message: `${label}: не удалось подтвердить (HTTP ${r.status})` };
}

async function tryVerify(label: string, fn: () => Promise<Response>): Promise<VerifyResult> {
  try { return fromResp(await fn(), label); }
  catch (e: any) { return { ok: false, status: 'unknown', message: `${label}: сеть/таймаут — ${e?.message || e}` }; }
}

// Провайдеры, у которых нет дешёвого публичного «whoami» — ключ сохраняем,
// но авто-проверку честно помечаем как «не подтверждено».
function savedOnly(label: string): VerifyResult {
  return { ok: true, status: 'unknown', message: `${label}: ключ сохранён. Авто-проверка для этого провайдера пока недоступна.` };
}

// ── Реестр провайдеров ──────────────────────────────────────────────────────
export const PROVIDERS: ProviderDef[] = [
  // ИИ-режиссёр (LLM-«мозг» умных шагов: ресёрч, сценарий, выбор момента, новости)
  { id: 'anthropic', label: 'Anthropic Claude (ИИ-режиссёр: ресёрч, сценарий, новости)', group: 'llm', help: 'https://console.anthropic.com/settings/keys',
    verify: (k) => tryVerify('Anthropic', () => ping('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': k, 'anthropic-version': '2023-06-01' } })) },

  // Платные генеративные
  { id: 'fal', label: 'FAL.ai (FLUX, Veo, Kling, MiniMax)', group: 'paid', help: 'https://fal.ai/dashboard/keys',
    verify: async () => savedOnly('FAL') },
  { id: 'openai', label: 'OpenAI (TTS, DALL·E)', group: 'paid', help: 'https://platform.openai.com/api-keys',
    verify: (k) => tryVerify('OpenAI', () => ping('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${k}` } })) },
  { id: 'elevenlabs', label: 'ElevenLabs (озвучка, музыка, SFX)', group: 'paid', help: 'https://elevenlabs.io/app/settings/api-keys',
    verify: (k) => tryVerify('ElevenLabs', () => ping('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': k } })) },
  { id: 'heygen', label: 'HeyGen (аватары, видео-шлюз)', group: 'paid', help: 'https://app.heygen.com/settings/api',
    verify: (k) => tryVerify('HeyGen', () => ping('https://api.heygen.com/v2/user/remaining_quota', { headers: { 'X-Api-Key': k } })) },
  { id: 'runway', label: 'Runway (Gen-4 видео)', group: 'paid', help: 'https://dev.runwayml.com',
    verify: async () => savedOnly('Runway') },
  { id: 'suno', label: 'Suno (генерация музыки)', group: 'paid', help: 'https://suno.com',
    verify: async () => savedOnly('Suno') },
  { id: 'xai', label: 'xAI Grok (картинки, видео)', group: 'paid', help: 'https://console.x.ai',
    verify: (k) => tryVerify('xAI', () => ping('https://api.x.ai/v1/models', { headers: { Authorization: `Bearer ${k}` } })) },
  { id: 'doubao', label: 'Doubao Speech (TTS)', group: 'paid', help: 'https://console.volcengine.com',
    verify: async () => savedOnly('Doubao') },
  { id: 'google', label: 'Google (Imagen, Cloud TTS)', group: 'paid', help: 'https://aistudio.google.com/app/apikey',
    verify: async (k) => {
      try {
        const r = await ping(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(k.trim())}`);
        if (r.ok) return { ok: true, status: 'active', message: 'Google: ключ активен' };
        const body: any = await r.json().catch(() => ({}));
        const reason = String(body?.error?.details?.[0]?.reason || body?.error?.status || '');
        if (r.status === 403 && /BLOCKED|DISABLED|SERVICE|PERMISSION/i.test(reason)) {
          return { ok: false, status: 'invalid',
            message: 'Google: ключ распознан, но Generative Language API заблокирован/не включён в проекте. Включите «Generative Language API» и снимите ограничения ключа (Cloud Console → Credentials → API restrictions), либо возьмите ключ на aistudio.google.com/app/apikey.' };
        }
        if (r.status === 400) return { ok: false, status: 'invalid', message: 'Google: ключ невалиден (API key not valid).' };
        return fromResp(r, 'Google');
      } catch (e: any) {
        return { ok: false, status: 'unknown', message: `Google: сеть/таймаут — ${e?.message || e}` };
      }
    } },

  // Бесплатные сток-источники
  { id: 'pexels', label: 'Pexels (сток видео/фото)', group: 'stock', help: 'https://www.pexels.com/api/',
    verify: (k) => tryVerify('Pexels', () => ping('https://api.pexels.com/v1/curated?per_page=1', { headers: { Authorization: k } })) },
  { id: 'pixabay', label: 'Pixabay (сток)', group: 'stock', help: 'https://pixabay.com/api/docs/',
    verify: (k) => tryVerify('Pixabay', () => ping(`https://pixabay.com/api/?key=${encodeURIComponent(k)}&per_page=3`)) },
  { id: 'unsplash', label: 'Unsplash (сток-фото)', group: 'stock', help: 'https://unsplash.com/developers',
    verify: (k) => tryVerify('Unsplash', () => ping('https://api.unsplash.com/photos?per_page=1', { headers: { Authorization: `Client-ID ${k}` } })) },
  { id: 'hf', label: 'HuggingFace (диаризация речи)', group: 'stock', help: 'https://huggingface.co/settings/tokens',
    verify: (k) => tryVerify('HuggingFace', () => ping('https://huggingface.co/api/whoami-v2', { headers: { Authorization: `Bearer ${k}` } })) },
];

const PROVIDER_IDS = new Set(PROVIDERS.map((p) => p.id));
export function isProvider(id: string): boolean { return PROVIDER_IDS.has(id); }

export interface ProviderKeyInfo {
  id: string;
  label: string;
  group: 'llm' | 'paid' | 'stock';
  help?: string;
  hasKey: boolean;
  status: ProviderKeyStatus;
  lastCheckAt: string | null;
  prefix: string | null;
}

// ── Чтение ──────────────────────────────────────────────────────────────────
export async function listProviderKeys(tenantId: string): Promise<ProviderKeyInfo[]> {
  const byProvider = new Map<string, { key_encrypted: string | null; status: string | null; last_check: any }>();
  if (isUuid(tenantId)) {
    try {
      const res = await pool.query(
        `SELECT provider, key_encrypted, status, last_check FROM tenant_provider_keys WHERE tenant_id = $1`,
        [tenantId]
      );
      for (const row of res.rows) byProvider.set(row.provider, row);
    } catch { /* таблица отсутствует в fallback — деградируем тихо */ }
  }
  return PROVIDERS.map((p) => {
    const row = byProvider.get(p.id);
    const key = row ? decryptSecret(row.key_encrypted) : null;
    return {
      id: p.id, label: p.label, group: p.group, help: p.help,
      hasKey: !!key,
      status: (row?.status as ProviderKeyStatus) || null,
      lastCheckAt: row?.last_check ? new Date(row.last_check).toISOString() : null,
      prefix: key ? `${key.slice(0, 6)}...***` : null,
    };
  });
}

export async function getProviderKeyInfo(tenantId: string, provider: string): Promise<ProviderKeyInfo | null> {
  const all = await listProviderKeys(tenantId);
  return all.find((p) => p.id === provider) || null;
}

async function getStoredKey(tenantId: string, provider: string): Promise<string | null> {
  if (!isUuid(tenantId)) return null;
  try {
    const res = await pool.query(
      `SELECT key_encrypted FROM tenant_provider_keys WHERE tenant_id = $1 AND provider = $2`,
      [tenantId, provider]
    );
    return res.rows[0] ? decryptSecret(res.rows[0].key_encrypted) : null;
  } catch { return null; }
}

/** "Эффективный" ключ провайдера для рендера. null = не задан. */
export async function getEffectiveProviderKey(tenantId: string | null | undefined, provider: string): Promise<string | null> {
  if (!tenantId || !isProvider(provider)) return null;
  const key = await getStoredKey(tenantId, provider);
  return key || null;
}

// ── Запись ──────────────────────────────────────────────────────────────────
export async function setProviderKey(tenantId: string, provider: string, rawKey: string | null): Promise<void> {
  if (!isUuid(tenantId)) throw new Error(NOT_TENANT_MSG);
  if (!isProvider(provider)) throw new Error('Неизвестный провайдер');
  const enc = encryptSecret(rawKey);
  await pool.query(
    `INSERT INTO tenant_provider_keys (tenant_id, provider, key_encrypted, status, updated_at)
     VALUES ($1, $2, $3, NULL, NOW())
     ON CONFLICT (tenant_id, provider)
     DO UPDATE SET key_encrypted = EXCLUDED.key_encrypted, status = NULL, updated_at = NOW()`,
    [tenantId, provider, enc]
  );
}

export async function clearProviderKey(tenantId: string, provider: string): Promise<void> {
  if (!isUuid(tenantId)) throw new Error(NOT_TENANT_MSG);
  await pool.query(`DELETE FROM tenant_provider_keys WHERE tenant_id = $1 AND provider = $2`, [tenantId, provider]);
}

async function setStatus(tenantId: string, provider: string, status: ProviderKeyStatus): Promise<void> {
  if (!isUuid(tenantId)) return;
  try {
    await pool.query(
      `UPDATE tenant_provider_keys SET status = $3, last_check = NOW(), updated_at = NOW()
       WHERE tenant_id = $1 AND provider = $2`,
      [tenantId, provider, status]
    );
  } catch { /* fallback noop */ }
}

// ── Валидация (реальный пинг провайдера) ────────────────────────────────────
export async function validateProviderKey(
  tenantId: string,
  provider: string,
  rawKey?: string | null
): Promise<VerifyResult> {
  const def = PROVIDERS.find((p) => p.id === provider);
  if (!def) return { ok: false, status: null, message: 'Неизвестный провайдер' };

  let key = (rawKey || '').trim();
  if (!key) key = (await getStoredKey(tenantId, provider)) || '';
  if (!key) return { ok: false, status: null, message: 'Ключ не задан' };

  let result: VerifyResult;
  try { result = await def.verify(key); }
  catch (e: any) { result = { ok: false, status: 'unknown', message: `Ошибка проверки: ${e?.message || e}` }; }

  await setStatus(tenantId, provider, result.status);
  return result;
}
