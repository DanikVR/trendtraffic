/**
 * Blotato API — тонкий клиент Публикатора (BYO-ключ тенанта).
 *
 * База: https://backend.blotato.com/v2, авторизация заголовком `blotato-api-key`.
 * Публикация: POST /posts — сейчас | scheduledTime (ISO UTC) | useNextFreeSlot.
 * Статусы:    GET /posts (окно по умолчанию ~7 дней, поэтому свою историю храним в БД)
 *             + Get Post Status по postSubmissionId (форму ответа парсим защитно —
 *             на живом сабмите эндпоинт не прогонялся, аккаунтов у ключа ещё нет).
 * Лимит Blotato: 30 постов/мин → между сабмитами держим паузу, на 429/5xx один ретрай.
 *
 * ВАЖНО: подключить соцсети через API НЕЛЬЗЯ — только кабинет my.blotato.com
 * (поэтому плитки сетей в UI ведут сразу на нужную страницу кабинета).
 */

export const BLOTATO_BASE = 'https://backend.blotato.com/v2';
/** Страница кабинета Blotato, где подключаются соцсети и создаётся API-ключ. */
export const BLOTATO_SETTINGS_URL = 'https://my.blotato.com/settings';

/** Платформы, которые умеет публиковать Blotato (targetType). */
export const BLOTATO_PLATFORMS = [
  'tiktok', 'instagram', 'youtube', 'twitter', 'facebook',
  'linkedin', 'threads', 'bluesky', 'pinterest',
] as const;
export type BlotatoPlatform = (typeof BLOTATO_PLATFORMS)[number];

export interface BlotatoAccount {
  id: string;
  platform: string;
  /** Отображаемое имя (fullname) — Blotato может не отдавать. */
  name?: string;
  /** @handle на платформе. */
  username?: string;
}

export class BlotatoError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'BlotatoError';
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** fetch с таймаутом + один ретрай на 429/502/503 (их лимит 30 постов/мин). */
async function bfetch(key: string, path: string, init: RequestInit = {}, timeoutMs = 25_000): Promise<any> {
  const url = `${BLOTATO_BASE}${path}`;
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const tmr = setTimeout(() => ctrl.abort(), timeoutMs);
    let resp: Response;
    try {
      resp = await fetch(url, {
        ...init,
        headers: { 'blotato-api-key': key, 'Content-Type': 'application/json', ...(init.headers || {}) },
        signal: ctrl.signal,
      });
    } catch (e: any) {
      clearTimeout(tmr);
      if (attempt === 0) { await sleep(1500); continue; } // сеть/таймаут — один повтор
      throw new BlotatoError(0, `Blotato недоступен: ${e?.message || e}`);
    } finally {
      clearTimeout(tmr);
    }
    if (resp.ok) {
      const text = await resp.text();
      try { return text ? JSON.parse(text) : {}; } catch { return {}; }
    }
    // 429 (лимит 30/мин) и временные 5xx — один повтор с паузой.
    if (attempt === 0 && (resp.status === 429 || resp.status === 502 || resp.status === 503)) {
      await sleep(resp.status === 429 ? 4000 : 1500);
      continue;
    }
    let msg = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      if (body?.message) msg = String(Array.isArray(body.message) ? body.message.join('; ') : body.message);
      else if (body?.error) msg = String(body.error);
    } catch { /* тело не JSON — оставляем HTTP-код */ }
    throw new BlotatoError(resp.status, msg);
  }
}

/** Подключённые соцаккаунты кабинета. Пустой список = соцсети ещё не подключены. */
export async function listAccounts(key: string): Promise<BlotatoAccount[]> {
  const d = await bfetch(key, '/users/me/accounts');
  const items = Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : [];
  return items.map((a: any): BlotatoAccount => ({
    id: String(a?.id ?? ''),
    platform: String(a?.platform ?? '').toLowerCase(),
    name: a?.fullname || a?.name || undefined,
    username: a?.username || undefined,
  })).filter((a: BlotatoAccount) => a.id && a.platform);
}

/** Сабаккаунты: страницы Facebook, страницы компаний LinkedIn, плейлисты YouTube. */
export async function listSubaccounts(key: string, accountId: string): Promise<{ id: string; name: string }[]> {
  const d = await bfetch(key, `/users/me/accounts/${encodeURIComponent(accountId)}/subaccounts`);
  const items = Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : [];
  return items.map((s: any) => ({ id: String(s?.id ?? ''), name: String(s?.name ?? s?.title ?? s?.id ?? '') })).filter((s: any) => s.id);
}

/** Доски Pinterest (boardId обязателен для пина). */
export async function listPinterestBoards(key: string, accountId?: string): Promise<{ id: string; name: string }[]> {
  const qs = accountId ? `?accountId=${encodeURIComponent(accountId)}` : '';
  const d = await bfetch(key, `/social/pinterest/boards${qs}`);
  const items = Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : [];
  return items.map((b: any) => ({ id: String(b?.id ?? ''), name: String(b?.name ?? b?.title ?? b?.id ?? '') })).filter((b: any) => b.id);
}

export interface CreatePostArgs {
  accountId: string;
  platform: BlotatoPlatform;
  text: string;
  /** Абсолютные публичные URL медиа ([] = текстовый пост). */
  mediaUrls: string[];
  /** Платформенный target ЦЕЛИКОМ (targetType + опции) — собирает сервис. */
  target: Record<string, unknown>;
  /** ISO UTC — запланировать на время. */
  scheduledTime?: string;
  /** Занять ближайший свободный слот расписания Blotato. */
  useNextFreeSlot?: boolean;
  /** Тред (X/Threads/Bluesky): дополнительные посты после первого. */
  additionalPosts?: { text: string }[];
}

/** POST /posts → postSubmissionId. Ошибки Blotato пробрасываются BlotatoError с их message. */
export async function createPost(key: string, args: CreatePostArgs): Promise<{ submissionId: string | null }> {
  const content: Record<string, unknown> = { text: args.text, platform: args.platform, mediaUrls: args.mediaUrls };
  if (args.additionalPosts?.length) content.additionalPosts = args.additionalPosts;
  const body: Record<string, unknown> = {
    post: { accountId: args.accountId, content, target: args.target },
  };
  if (args.scheduledTime) body.scheduledTime = args.scheduledTime;
  if (args.useNextFreeSlot) body.useNextFreeSlot = true;
  const d = await bfetch(key, '/posts', { method: 'POST', body: JSON.stringify(body) });
  const id = d?.postSubmissionId || d?.id || null;
  return { submissionId: id ? String(id) : null };
}

export type BlotatoPostState =
  | { type: 'scheduled' }
  | { type: 'published'; postUrl: string | null }
  | { type: 'failed'; errorMessage: string | null }
  | { type: 'unknown' };

/** Статус одного сабмита. 404/неожиданная форма → 'unknown' (не считаем ошибкой). */
export async function getPostStatus(key: string, submissionId: string): Promise<BlotatoPostState> {
  let d: any;
  try {
    d = await bfetch(key, `/posts/${encodeURIComponent(submissionId)}`);
  } catch (e: any) {
    if (e instanceof BlotatoError && (e.status === 404 || e.status === 400)) return { type: 'unknown' };
    throw e;
  }
  const raw = d?.post ?? d?.item ?? d;
  const st = raw?.state ?? raw?.status ?? raw;
  const type = String(st?.type ?? st ?? '').toLowerCase();
  if (type === 'published') return { type: 'published', postUrl: st?.postUrl ? String(st.postUrl) : null };
  if (type === 'failed') return { type: 'failed', errorMessage: st?.errorMessage ? String(st.errorMessage) : null };
  if (type === 'scheduled' || type === 'queued' || type === 'submitted') return { type: 'scheduled' };
  return { type: 'unknown' };
}

/** Отмена запланированного поста (DELETE /schedules/:id — id = postSubmissionId). */
export async function cancelScheduled(key: string, submissionId: string): Promise<void> {
  await bfetch(key, `/schedules/${encodeURIComponent(submissionId)}`, { method: 'DELETE' });
}

/** Перенос запланированного поста на новое время (PATCH /schedules/:id). */
export async function updateScheduledTime(key: string, submissionId: string, scheduledTimeIso: string): Promise<void> {
  await bfetch(key, `/schedules/${encodeURIComponent(submissionId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ scheduledTime: scheduledTimeIso }),
  });
}

/** Аналитика опубликованного (X/IG/FB/Threads/Bluesky; TikTok/YouTube их API не покрывает).
 *  Форму ответа парсим защитно — отдаём массив как есть, фронт показывает известные поля. */
export async function getAnalytics(key: string, days = 30): Promise<any[]> {
  const d = await bfetch(key, `/analytics?days=${Math.max(1, Math.min(days, 90))}`);
  return Array.isArray(d?.items) ? d.items : Array.isArray(d?.posts) ? d.posts : Array.isArray(d) ? d : [];
}
