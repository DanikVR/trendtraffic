/**
 * TrendTraffic — «откуда взялся файл»: метки происхождения ассетов Галереи.
 *
 * У каждого файла в Галерее хранится ЦЕПОЧКА меток (media_assets.origins, TEXT[]) —
 * через какие блоки продукта он прошёл, в хронологическом порядке:
 *
 *   ['flow']            — сгенерировали в Google Flow;
 *   ['flow','ugc']      — тот же клип потом собрали в UGC-студии;
 *   ['trends','analytics','storyboard'] — скачали тренд, разобрали, сделали сториборд.
 *
 * Галерея рисует по одной иконке на метку (последняя = чем файл является сейчас)
 * и даёт фильтр-чипы по источникам.
 *
 * ⚠ Ключи ОБЯЗАНЫ совпадать с фронтом: apps/frontend/src/lib/mediaOrigins.tsx.
 *    Добавили ключ здесь — добавьте иконку и подпись там, иначе бейдж не отрисуется.
 */

import pool from '../../db/index.js';

/** Все блоки продукта, которые кладут файлы в Галерею. */
export const ORIGIN_KEYS = [
  'upload',       // ручная загрузка с устройства
  'trends',       // Тренды — скачанный ролик
  'analytics',    // Аналитика — «Добавить в галерею», артефакты разбора
  'text',         // Текст — транскрибации и переводы речи
  'flow',         // Google Flow (расширение)
  'omni',         // Omni Flash — генерация/правка видео, кадры, раскадровка
  'commentator',  // Комментатор
  'ugc',          // UGC-студия — сборка ролика
  'avatar',       // UGC-аватары
  'storyboard',   // Сториборд
  'hotebook',     // Hotebook / NotebookLM
  'montage',      // Монтаж — обрезка и склейка
  'autopilot',    // Автопилот трендов (авто-UGC)
] as const;

export type OriginKey = (typeof ORIGIN_KEYS)[number];

const KEYSET = new Set<string>(ORIGIN_KEYS);

/** Приводим URL к тому виду, в котором он лежит в media_assets.file_url (обычно «/uploads/...»). */
function normUrl(u?: string | null): string | null {
  if (!u || typeof u !== 'string') return null;
  const s = u.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) {
    try { return new URL(s).pathname; } catch { return s; }
  }
  return s.startsWith('/') ? s : `/${s}`;
}

/**
 * Цепочка меток для НОВОГО файла: то, через что прошли его исходники, плюс собственный блок.
 *
 * Исходники ищем по file_url — специи сборок (UGC, монтаж, сториборд) носят с собой
 * именно URL'ы галереи, id инпутов нигде не сохраняются. Что не нашлось в Галерее
 * (файл с диска, внешняя ссылка) — просто не добавляет меток.
 */
export async function chainFromUrls(
  tenantId: string,
  own: OriginKey,
  inputUrls: (string | null | undefined)[]
): Promise<OriginKey[]> {
  const urls = Array.from(new Set(inputUrls.map(normUrl).filter((x): x is string => !!x)));
  let inherited: string[] = [];
  if (urls.length) {
    try {
      const r = await pool.query(
        `SELECT origins FROM media_assets
         WHERE tenant_id = $1 AND file_url = ANY($2::text[])
         ORDER BY created_at ASC`,
        [tenantId, urls]
      );
      for (const row of r.rows as any[]) {
        for (const k of (row.origins || []) as string[]) inherited.push(k);
      }
    } catch (e) {
      // Нет колонки/БД в fallback — метки просто не наследуются, файл всё равно создаётся.
      console.warn('[media] chainFromUrls failed:', (e as Error).message);
      inherited = [];
    }
  }
  return dedupeChain([...inherited, own]);
}

/** Хронологическая цепочка без повторов; собственная метка всегда последняя. */
export function dedupeChain(keys: (string | null | undefined)[]): OriginKey[] {
  const out: OriginKey[] = [];
  for (const k of keys) {
    if (!k || !KEYSET.has(k)) continue;
    const key = k as OriginKey;
    const at = out.indexOf(key);
    if (at >= 0) out.splice(at, 1);   // повтор → переносим в конец (это текущее состояние файла)
    out.push(key);
  }
  return out;
}
