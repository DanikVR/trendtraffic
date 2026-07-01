/**
 * TrendTraffic — подбор B-roll клипов из стоков (Pexels / Pixabay).
 *
 * Ключи: tenant-ключ 'pexels'/'pixabay' (Настройки → Генерация → Сток-источники),
 * фолбэк — системные PEXELS_API_KEY / PIXABAY_API_KEY (стоки бесплатные, платформенный
 * ключ не несёт затрат — в отличие от Claude/HeyGen).
 *
 * Возвращает прямые mp4-ссылки (2–4 шт.) — воркер скачает и вставит перебивками.
 * Деградация мягкая: нет ключа / пусто → [] + заметка.
 */

import { getEffectiveProviderKey } from '../tenant_settings/provider_keys.js';

export interface BrollResult { clips: string[]; note: string }

async function getJson(url: string, headers: Record<string, string> = {}, timeoutMs = 20_000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Pexels Videos: вертикальные, берём файл ~720–1080 по ширине (не 4K — быстрее качать). */
async function searchPexels(key: string, query: string, count: number): Promise<string[]> {
  const d = await getJson(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=${count * 2}`,
    { Authorization: key },
  );
  const out: string[] = [];
  for (const v of d?.videos || []) {
    const files: any[] = (v?.video_files || [])
      .filter((f: any) => /mp4/i.test(f?.file_type || '') && f?.link)
      .sort((a: any, b: any) => Math.abs((a.width || 0) - 900) - Math.abs((b.width || 0) - 900));
    if (files[0]?.link) out.push(files[0].link);
    if (out.length >= count) break;
  }
  return out;
}

/** Pixabay Videos: medium-файл. */
async function searchPixabay(key: string, query: string, count: number): Promise<string[]> {
  const d = await getJson(
    `https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&per_page=${count * 2}`,
  );
  const out: string[] = [];
  for (const v of d?.hits || []) {
    const u = v?.videos?.medium?.url || v?.videos?.small?.url;
    if (u) out.push(u);
    if (out.length >= count) break;
  }
  return out;
}

/** Подбор клипов по запросу: Pexels → Pixabay. */
export async function resolveBrollClips(opts: {
  tenantId: string; query: string; count?: number;
}): Promise<BrollResult> {
  const query = (opts.query || '').trim();
  if (!query) return { clips: [], note: 'b-roll: пустой запрос для стоков' };
  const count = Math.min(Math.max(opts.count ?? 3, 1), 4);

  const pexels = (await getEffectiveProviderKey(opts.tenantId, 'pexels')) || process.env.PEXELS_API_KEY || null;
  if (pexels) {
    const clips = await searchPexels(pexels, query, count);
    if (clips.length) return { clips, note: `b-roll: ${clips.length} клипа(ов) с Pexels («${query}»)` };
  }
  const pixabay = (await getEffectiveProviderKey(opts.tenantId, 'pixabay')) || process.env.PIXABAY_API_KEY || null;
  if (pixabay) {
    const clips = await searchPixabay(pixabay, query, count);
    if (clips.length) return { clips, note: `b-roll: ${clips.length} клипа(ов) с Pixabay («${query}»)` };
  }
  if (!pexels && !pixabay) {
    return { clips: [], note: 'b-roll: нет ключа стоков — добавьте Pexels/Pixabay в Настройки → Генерация' };
  }
  return { clips: [], note: `b-roll: по запросу «${query}» ничего не нашлось` };
}
