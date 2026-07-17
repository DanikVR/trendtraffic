/**
 * Скоупы MCP — права, которые несёт per-tenant MCP-ключ.
 * Принцип наименьших прав: по умолчанию выдаём только read-скоупы; write — явно.
 *
 * Каждый MCP-инструмент объявляет нужные скоупы; tools/list для конкретного ключа
 * показывает только те тулзы, чьи скоупы ⊆ скоупов ключа.
 */

export const MCP_SCOPES: Record<string, string> = {
  'clients:read': 'Читать список клиентов/лидов',
  'dialogs:read': 'Читать историю диалогов',
  'messages:write': 'Отправлять сообщения клиентам',
  'images:read': 'Читать каталог пресетов изображений',
  'images:generate': 'Генерировать/обрабатывать изображения',
  'tags:read': 'Читать теги потребностей',
  // ── TrendTraffic Фаза 1 (тулзы в tools_tt.ts) ──
  'trends:read': 'Читать найденные тренды (Галерея «Тренды»)',
  'trends:scan': 'Запускать сканирование трендов (тратит запросы TikHub)',
  'audience:suggest': 'ИИ-подсказка ЦА и ключевиков по продукту',
  'media:read': 'Читать файлы Галереи (медиатека)',
  'flows:read': 'Читать сценарии и шаблоны UGC-студии',
  'publisher:read': 'Читать слоты и цепочки Публикатора',
  'billing:read': 'Читать статус подписки',
};

export type McpScope = keyof typeof MCP_SCOPES;

export const ALL_SCOPES: McpScope[] = Object.keys(MCP_SCOPES);

/** Скоупы по умолчанию при создании ключа без явного выбора — только чтение. */
export const DEFAULT_SCOPES: McpScope[] = [
  'clients:read', 'dialogs:read', 'images:read', 'tags:read',
  'trends:read', 'media:read', 'flows:read', 'publisher:read', 'billing:read',
];

export function isScope(v: unknown): v is McpScope {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(MCP_SCOPES, v);
}

/** Чистит произвольный вход в валидный набор скоупов (уникальные, известные). */
export function sanitizeScopes(raw: unknown): McpScope[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<McpScope>();
  for (const s of raw) if (isScope(s)) out.add(s);
  return Array.from(out);
}

/** true, если набор скоупов ключа покрывает все требуемые тулзой. */
export function hasScopes(keyScopes: string[], required: McpScope[]): boolean {
  return required.every((s) => keyScopes.includes(s));
}
