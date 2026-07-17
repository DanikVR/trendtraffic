/**
 * MCP-инструменты Фазы 1 — ядро TrendTraffic: тренды, Галерея, UGC-студия,
 * Публикатор, подписка. Всё переиспользует существующие сервисы и строго
 * привязано к tenantId из ctx (как в tools.ts Фазы 0). Регистрируется
 * side-effect импортом из server.ts.
 */

import { listRecentVideos, scanTrends, type ScanParams, type StoredVideo } from '../trends/service.js';
import { suggestAudience } from '../trends/audience.js';
import { listAssets, listFolder, type MediaKind } from '../media/assets.js';
import { listFlows } from '../flows/service.js';
import { listSlots, listChains, nextFreeSlotTimes } from '../publisher/service.js';
import { getFeatureAccess } from '../billing/feature_gate.js';
import { registerTool, type McpToolContext } from './registry.js';

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '').replace(/\/+$/, '');
function toAbsoluteUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  if (!PUBLIC_BASE_URL) return u;
  return `${PUBLIC_BASE_URL}${u.startsWith('/') ? '' : '/'}${u}`;
}

/** Компактная карточка видео для ответов MCP (без внутренних полей). */
function videoCard(v: StoredVideo) {
  return {
    id: v.id,
    platform: v.platform,
    author: v.authorName || v.author,
    description: (v.description || '').slice(0, 300),
    webUrl: v.webUrl || null,
    coverUrl: toAbsoluteUrl(v.coverUrl),
    fileUrl: toAbsoluteUrl(v.fileUrl),
    durationSec: v.durationSec ?? null,
    stats: v.stats,
    status: v.status,
    byLink: v.byLink === true,
  };
}

// ── trends:read — сохранённые тренд-видео тенанта ─────────────────────────────
registerTool({
  name: 'list_trend_videos',
  title: 'Видео из Галереи «Тренды»',
  description: 'Возвращает найденные сканами (и добавленные по ссылке) тренд-видео аккаунта: автор, описание, метрики, ссылки.',
  requiredScopes: ['trends:read'],
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Сколько вернуть (по умолчанию 30, макс 100).' },
      downloadedOnly: { type: 'boolean', description: 'Только скачанные (с локальным файлом).' },
      byLinkOnly: { type: 'boolean', description: 'Только добавленные прямой ссылкой.' },
    },
  },
  handler: async (ctx: McpToolContext, args) => {
    const limit = Math.max(1, Math.min(100, Number(args?.limit) || 30));
    const videos = await listRecentVideos(ctx.tenantId, limit, args?.downloadedOnly === true, args?.byLinkOnly === true);
    return { count: videos.length, videos: videos.map(videoCard) };
  },
});

// ── trends:scan — запустить сканирование трендов ──────────────────────────────
registerTool({
  name: 'scan_trends',
  title: 'Сканировать тренды',
  description: 'Запускает скан трендов по ключевику (или ленту «Горячее») на TikTok/Instagram/YouTube/X/Reddit, сохраняет находки в Галерею «Тренды» и возвращает их. Тратит запросы TikHub.',
  requiredScopes: ['trends:scan'],
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Ключевик/ниша. Обязателен для kind=keyword.' },
      kind: { type: 'string', enum: ['keyword', 'trending'], description: 'keyword — поиск по ключевику (по умолчанию), trending — лента «Горячее».' },
      platform: { type: 'string', enum: ['tiktok', 'instagram', 'youtube', 'twitter', 'reddit'], description: 'Площадка (по умолчанию tiktok).' },
      region: { type: 'string', description: 'Регион выдачи ISO-3166 alpha-2 (US, RU, DE…). Работает на TikTok и YouTube.' },
      count: { type: 'number', description: 'Сколько видео (1–30, по умолчанию 12).' },
    },
  },
  handler: async (ctx: McpToolContext, args) => {
    const kind = args?.kind === 'trending' ? 'trending' : 'keyword';
    const params: ScanParams = {
      kind,
      query: typeof args?.query === 'string' ? args.query : undefined,
      platform: args?.platform,
      region: typeof args?.region === 'string' ? args.region : undefined,
      count: Math.max(1, Math.min(30, Number(args?.count) || 12)),
    };
    const res = await scanTrends(ctx.tenantId, params);
    return { trendId: res.trendId, count: res.count, videos: res.videos.map(videoCard) };
  },
});

// ── audience:suggest — ИИ-подсказка ЦА и ключевиков ──────────────────────────
registerTool({
  name: 'suggest_audience',
  title: 'Подсказать ЦА и ключевики',
  description: 'По описанию продукта ИИ (Claude) формулирует базовую целевую аудиторию и 8–12 затравочных ключевиков. Требует ключ Claude в настройках аккаунта.',
  requiredScopes: ['audience:suggest'],
  inputSchema: {
    type: 'object',
    properties: {
      product: { type: 'string', description: 'Что продвигаем — продукт/оффер своими словами.' },
      platform: { type: 'string', description: 'Площадка (tiktok по умолчанию).' },
      language: { type: 'string', description: 'Язык(и) ключевиков, напр. «русский, английский».' },
      region: { type: 'string', description: 'Приоритетный регион ISO alpha-2 (опц.).' },
    },
    required: ['product'],
  },
  handler: async (ctx: McpToolContext, args) => {
    return await suggestAudience(ctx.tenantId, {
      product: String(args?.product || ''),
      platform: typeof args?.platform === 'string' ? args.platform : undefined,
      language: typeof args?.language === 'string' ? args.language : undefined,
      region: typeof args?.region === 'string' ? args.region : undefined,
    });
  },
});

// ── media:read — файлы Галереи ────────────────────────────────────────────────
registerTool({
  name: 'list_gallery',
  title: 'Файлы Галереи',
  description: 'Возвращает файлы Галереи аккаунта: kind=reference (медиафайлы) или audio; либо конкретную папку (например analyzed — «Из анализа», auto-ugc — авто-ролики конвейера).',
  requiredScopes: ['media:read'],
  inputSchema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['reference', 'audio'], description: 'Тип ассетов (по умолчанию reference). Игнорируется, если задан folder.' },
      folder: { type: 'string', description: 'Конкретная папка: analyzed, auto-ugc или своя.' },
      limit: { type: 'number', description: 'Сколько вернуть (по умолчанию 50, макс 200).' },
    },
  },
  handler: async (ctx: McpToolContext, args) => {
    const limit = Math.max(1, Math.min(200, Number(args?.limit) || 50));
    const folder = typeof args?.folder === 'string' && args.folder.trim() ? args.folder.trim() : null;
    const kind: MediaKind = args?.kind === 'audio' ? 'audio' : 'reference';
    const assets = folder ? await listFolder(ctx.tenantId, folder) : await listAssets(ctx.tenantId, kind);
    return {
      count: Math.min(assets.length, limit),
      assets: assets.slice(0, limit).map((a) => ({
        id: a.id,
        kind: a.kind,
        mediaType: a.mediaType,
        name: a.originalName || null,
        fileUrl: toAbsoluteUrl(a.fileUrl),
        mime: a.mime || null,
        size: a.size ?? null,
        folder: a.folder || null,
        hasAnalysis: a.hasAnalysis === true || undefined,
      })),
    };
  },
});

// ── flows:read — сценарии/шаблоны UGC-студии ──────────────────────────────────
registerTool({
  name: 'list_flows',
  title: 'Сценарии UGC-студии',
  description: 'Возвращает сценарии (flows) аккаунта: имя, статус, какие блоки настроены (ugc/podcast/omni…), даты.',
  requiredScopes: ['flows:read'],
  inputSchema: { type: 'object', properties: {} },
  handler: async (ctx: McpToolContext) => {
    const flows = await listFlows(ctx.tenantId);
    const SERVICE_KEYS = new Set(['nodes', 'edges', 'triggers', 'source', 'cloud', 'cloudEdges', 'brief']);
    return {
      count: flows.length,
      flows: flows.map((f) => ({
        id: f.id,
        name: f.name,
        status: f.status,
        isDefault: f.is_default,
        blocks: Object.keys(f.graph || {}).filter((k) => !SERVICE_KEYS.has(k) && (f.graph as any)[k]),
        updatedAt: f.updated_at,
      })),
    };
  },
});

// ── publisher:read — слоты расписания и цепочки автопубликации ───────────────
registerTool({
  name: 'list_publisher_schedule',
  title: 'Расписание Публикатора',
  description: 'Возвращает слоты «Моё расписание» (dow/hh/mm в UTC; dow 0=Вс…6=Сб) и ближайшие 5 свободных времён публикации.',
  requiredScopes: ['publisher:read'],
  inputSchema: { type: 'object', properties: {} },
  handler: async (ctx: McpToolContext) => {
    const slots = await listSlots(ctx.tenantId);
    const next = slots.length ? await nextFreeSlotTimes(ctx.tenantId, 5) : [];
    return { slots, nextFree: next.map((d) => d.toISOString()) };
  },
});

registerTool({
  name: 'list_publisher_chains',
  title: 'Цепочки Публикатора',
  description: 'Возвращает цепочки автопубликации аккаунта: имя, ручная/авто, включена ли, формат-фильтр, статистика постов.',
  requiredScopes: ['publisher:read'],
  inputSchema: { type: 'object', properties: {} },
  handler: async (ctx: McpToolContext) => {
    const chains = await listChains(ctx.tenantId);
    return {
      count: chains.length,
      chains: chains.map((c: any) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        enabled: c.enabled === true,
        formatFilter: c.format_filter || null,
        dailyCap: c.daily_cap ?? null,
        stats: c.stats || {},
        lastError: c.last_error || null,
        lastRunAt: c.last_run_at || null,
        createdAt: c.created_at,
      })),
    };
  },
});

// ── billing:read — статус подписки ────────────────────────────────────────────
registerTool({
  name: 'get_subscription',
  title: 'Статус подписки',
  description: 'Возвращает тариф и статус подписки аккаунта (tier, status, есть ли полный доступ к фичам).',
  requiredScopes: ['billing:read'],
  inputSchema: { type: 'object', properties: {} },
  handler: async (ctx: McpToolContext) => {
    const a = await getFeatureAccess(ctx.tenantId);
    return { tier: a.tier, status: a.status, fullAccess: a.enterprise };
  },
});

// ── skills:use — три скилла (найди-виралку / антиклише / формула-подписи) ─────
// Ядро — modules/skills/service.ts (то же, что у /api/skills). Описания тулз
// повторяют триггеры SKILL.md, чтобы Claude у пользователя звал их по смыслу.
import { runFindViral, runAnticliche, runCaption } from '../skills/service.js';

registerTool({
  name: 'find_viral',
  title: 'Найди виралку',
  description: 'Find-only поиск виральных роликов по теме: ранжированный список ссылок с метриками (TikTok, ключ TikHub аккаунта). Ничего не скачивает и не генерит. Триггеры: «найди виралку про X», «дай ссылки на виралки».',
  requiredScopes: ['skills:use'],
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Тема/ниша поиска.' },
      minViews: { type: 'number', description: 'Мин. просмотры (опц.).' },
      days: { type: 'number', description: 'Свежесть в днях (опц.).' },
      region: { type: 'string', description: 'Регион ISO alpha-2 (опц.).' },
      limit: { type: 'number', description: 'Сколько вернуть (по умолчанию 10, макс 30).' },
    },
    required: ['topic'],
  },
  handler: async (ctx: McpToolContext, args) => runFindViral(ctx.tenantId, {
    topic: String(args?.topic || ''),
    minViews: Number.isFinite(Number(args?.minViews)) ? Number(args.minViews) : undefined,
    days: Number.isFinite(Number(args?.days)) ? Number(args.days) : undefined,
    region: typeof args?.region === 'string' ? args.region : undefined,
    limit: Number.isFinite(Number(args?.limit)) ? Number(args.limit) : undefined,
  }),
});

registerTool({
  name: 'anticliche',
  title: 'Антиклише',
  description: 'Вычищает из текста нейросетевые клише (11 категорий: ложная глубина, фальшивая близость, канцелярит, рубленые фразы, длинные тире и др.) и переписывает в живой человеческий текст, НЕ выдумывая фактов. Возвращает чистый текст + таблицу правок «Было/Стало». Триггеры: «прогони через антиклише», «сделай текст человечным».',
  requiredScopes: ['skills:use'],
  inputSchema: {
    type: 'object',
    properties: { text: { type: 'string', description: 'Текст для зачистки (20–12000 символов).' } },
    required: ['text'],
  },
  handler: async (ctx: McpToolContext, args) => runAnticliche(ctx.tenantId, String(args?.text || '')),
});

registerTool({
  name: 'caption_formula',
  title: 'Формула подписи',
  description: 'Пишет подпись (caption) к посту/рилсу по структуре: хук → личный опыт → что решает → CTA с ЗАГЛАВНЫМ кодовым словом; до 1000 символов, ≤5 хэштегов, плюс 3 варианта хука. Триггеры: «напиши подпись», «сделай caption».',
  requiredScopes: ['skills:use'],
  inputSchema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Тема/бриф поста.' },
      codeWord: { type: 'string', description: 'Кодовое слово CTA (опц. — придумает сам).' },
      link: { type: 'string', description: 'Ссылка для финала подписи (опц.).' },
      language: { type: 'string', description: 'Язык подписи (по умолчанию русский).' },
    },
    required: ['topic'],
  },
  handler: async (ctx: McpToolContext, args) => runCaption(ctx.tenantId, {
    topic: String(args?.topic || ''),
    codeWord: typeof args?.codeWord === 'string' ? args.codeWord : undefined,
    link: typeof args?.link === 'string' ? args.link : undefined,
    language: typeof args?.language === 'string' ? args.language : undefined,
  }),
});
