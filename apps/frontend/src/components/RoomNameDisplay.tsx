/**
 * RoomNameDisplay / formatRoomName — рендер имени комнаты.
 *
 * Имена комнат бывают двух видов:
 *
 *  1. **Дефолтные** — генерируются автоматически при создании комнаты в формате
 *     `__DEFAULT_ROOM__|{userName}|{ISO-timestamp}`. Они рендерятся локалью
 *     просматривающего: «Комната Pavel · 28 мая, 08:25» по-русски, «Room Pavel
 *     · May 28, 08:25 AM» по-английски, «Sala Pavel · 28 de mayo, 08:25» по
 *     испански и т.д. Локализация делается через t('defaultRoom.namePattern') +
 *     Intl.DateTimeFormat — то есть автоматически 108 языков.
 *
 *  2. **Пользовательские** — после переименования через UI. Хранятся как
 *     обычная строка. Возвращаются как есть, без обработки локалью.
 *
 * Контракт токена дефолтного имени строго: `__DEFAULT_ROOM__|userName|ISO`.
 * Если parsing не удался — fallback к исходной строке.
 */

import { useTranslation } from 'react-i18next';

const TOKEN_PREFIX = '__DEFAULT_ROOM__|';

interface ParsedDefault {
  userName: string;
  isoTimestamp: string;
}

/** Пытается разобрать `__DEFAULT_ROOM__|userName|ISO`. Внутренний помощник
 *  (используется только formatRoomName в этом же файле). */
function parseDefaultRoomName(name: string): ParsedDefault | null {
  if (!name || !name.startsWith(TOKEN_PREFIX)) return null;
  const rest = name.slice(TOKEN_PREFIX.length);
  const idx = rest.lastIndexOf('|');
  if (idx === -1) return null;
  return {
    userName: rest.slice(0, idx),
    isoTimestamp: rest.slice(idx + 1),
  };
}

/** Конструирует токен для сохранения в БД. */
export function buildDefaultRoomNameToken(userName: string, date: Date = new Date()): string {
  return `${TOKEN_PREFIX}${userName}|${date.toISOString()}`;
}

/** Чисто-функциональный форматер (можно использовать вне React-дерева — например
 *  при сохранении дефолтного имени в форме создания комнаты). */
export function formatRoomName(
  name: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
  lang: string,
): string {
  const parsed = parseDefaultRoomName(name);
  if (!parsed) return name;
  const date = new Date(parsed.isoTimestamp);
  if (isNaN(date.getTime())) return name;
  const dateStr = date.toLocaleDateString(lang, { day: '2-digit', month: 'short' });
  const timeStr = date.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
  return t('defaultRoom.namePattern', {
    name: parsed.userName || t('defaultRoom.guestName'),
    date: dateStr,
    time: timeStr,
  });
}

/** React-компонент для рендера. Подписан на i18n.language через useTranslation. */
export function RoomNameDisplay({ name }: { name: string }) {
  const { t, i18n } = useTranslation('common');
  return <>{formatRoomName(name, t, i18n.language || 'en')}</>;
}
