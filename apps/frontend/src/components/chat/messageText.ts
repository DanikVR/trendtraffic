/**
 * messageText — утилиты для отображаемого текста чат-сообщений.
 *
 * Часть старых transcript-записей сохранены как JSON-объекты в поле `content`
 * (например, `{"author":"X","originalTimestamp":123}`), без текстового поля.
 * Эти бабблы нужно прятать, чтобы не было пустых «болванок».
 */

/**
 * Извлекает читаемый текст из content. Если content — это JSON-метаданные
 * без текстовых полей, возвращает null.
 */
export function extractDisplayText(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Не похоже на JSON — отдаём как есть.
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return raw;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') return parsed || null;
    if (Array.isArray(parsed)) {
      const parts: string[] = [];
      for (const item of parsed) {
        if (typeof item === 'string') parts.push(item);
        else if (item && typeof item === 'object') {
          const v = extractDisplayText(JSON.stringify(item));
          if (v) parts.push(v);
        }
      }
      return parts.length ? parts.join(' ') : null;
    }
    if (parsed && typeof parsed === 'object') {
      const keys = [
        'text', 'transcribed', 'transcript', 'content',
        'value', 'message', 'body', 'caption',
        'translatedText', 'translated', 'original', 'originalText',
      ];
      for (const k of keys) {
        const v = parsed[k];
        if (typeof v === 'string' && v.trim()) return v;
      }
      return null;
    }
    return null;
  } catch {
    // Невалидный JSON — отдаём как есть (это просто текст с фигурной скобкой)
    return raw;
  }
}

/** Есть ли у сообщения отображаемый контент (текст или медиа)?
 *
 * Показываем сообщения с любым media (audio/image/video/file) или с читаемым
 * текстом. Bubble сам решит, что отрисовать — например, для audio без расшифровки
 * MessageBubble добавит подпись «Аудио-сообщение».
 */
export function hasDisplayableContent(message: {
  content: string | null;
  mediaUrl: string | null;
  kind?: string;
}): boolean {
  const text = extractDisplayText(message.content);
  if (text && text.trim()) return true;
  if (message.mediaUrl) return true;
  return false;
}

/**
 * Извлекает оригинальный timestamp из JSON-content (поле `originalTimestamp` в мс),
 * иначе возвращает null. Используется в MessageBubble чтобы показать точное время
 * записи транскрипта, а не время сохранения batch'а в БД.
 */
export function extractOriginalTimestamp(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      const ts = parsed.originalTimestamp;
      if (typeof ts === 'number' && ts > 0 && ts < 1e15) return ts;
      // Иногда timestamp приходит строкой
      if (typeof ts === 'string') {
        const n = Number(ts);
        if (Number.isFinite(n) && n > 0 && n < 1e15) return n;
      }
    }
  } catch { /* not JSON */ }
  return null;
}
