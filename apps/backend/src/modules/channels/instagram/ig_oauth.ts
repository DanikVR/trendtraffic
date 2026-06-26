/**
 * Instagram IG-0.5 — OAuth (Instagram API with Instagram Login).
 *
 * SaaS-модель: приложение Meta ОДНО (наше). Магазин жмёт «Подключить Instagram»
 * → согласие Meta → code → обмен на долгоживущий токен → сохраняем per-tenant.
 *
 * .env: INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_OAUTH_REDIRECT
 *       (= https://<домен>/api/instagram/oauth/callback).
 */

import { upsertIgAccount } from './ig_accounts.js';

const AUTHORIZE = 'https://www.instagram.com/oauth/authorize';
const TOKEN = 'https://api.instagram.com/oauth/access_token';
const GRAPH = 'https://graph.instagram.com';
const SCOPES = 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments';

export function getIgOAuthConfig(): { appId: string; appSecret: string; redirectUri: string } | null {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  const redirectUri = process.env.INSTAGRAM_OAUTH_REDIRECT;
  if (!appId || !appSecret || !redirectUri) return null;
  return { appId, appSecret, redirectUri };
}

export function buildAuthorizeUrl(state: string): string | null {
  const cfg = getIgOAuthConfig();
  if (!cfg) return null;
  const p = new URLSearchParams({
    client_id: cfg.appId,
    redirect_uri: cfg.redirectUri,
    response_type: 'code',
    scope: SCOPES,
    state,
  });
  return `${AUTHORIZE}?${p.toString()}`;
}

/** Полный обмен: code → short-lived → long-lived (60 дней) → профиль → сохранение per-tenant. */
export async function connectInstagramAccount(tenantId: string, code: string): Promise<{ ok: boolean; username?: string; igId?: string; error?: string }> {
  const cfg = getIgOAuthConfig();
  if (!cfg) return { ok: false, error: 'OAuth не настроен (INSTAGRAM_APP_ID/SECRET/REDIRECT).' };
  try {
    // 1) code → short-lived token (+ user_id)
    const form = new URLSearchParams({
      client_id: cfg.appId,
      client_secret: cfg.appSecret,
      grant_type: 'authorization_code',
      redirect_uri: cfg.redirectUri,
      code,
    });
    const tr = await fetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    const tj: any = await tr.json().catch(() => null);
    if (!tr.ok || !tj?.access_token) return { ok: false, error: `token exchange ${tr.status}: ${JSON.stringify(tj).slice(0, 200)}` };
    const shortToken = String(tj.access_token);
    let igId = String(tj.user_id || tj.user?.id || '');

    // 2) short → long-lived
    const lr = await fetch(`${GRAPH}/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(cfg.appSecret)}&access_token=${encodeURIComponent(shortToken)}`);
    const lj: any = await lr.json().catch(() => null);
    const longToken = lr.ok && lj?.access_token ? String(lj.access_token) : shortToken;
    const expiresInSec = Number(lj?.expires_in) || 0;
    const expiresAt = expiresInSec > 0 ? new Date(Date.now() + expiresInSec * 1000) : null;

    // 3) профиль (ig id + username)
    let username: string | null = null;
    try {
      const pr = await fetch(`${GRAPH}/me?fields=user_id,username&access_token=${encodeURIComponent(longToken)}`);
      const pj: any = await pr.json().catch(() => null);
      if (pj?.user_id) igId = String(pj.user_id);
      if (pj?.username) username = String(pj.username);
    } catch { /* профиль необязателен */ }

    if (!igId) return { ok: false, error: 'Не удалось получить IG account id.' };

    // 4) сохранить per-tenant
    const saved = await upsertIgAccount({ tenantId, igId, username, accessToken: longToken, tokenExpiresAt: expiresAt });
    if (!saved) return { ok: false, error: 'Не удалось сохранить токен.' };
    return { ok: true, username: username || undefined, igId };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
