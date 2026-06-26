/**
 * OMNICHANNEL Фаза 2 — раннер цепочек.
 *
 * Продвигает flow_session по графу (nodes+edges React Flow) на КАЖДОЕ входящее
 * сообщение. Чистая логика графа: отправка/ИИ/теги инъектируются через ctx.
 *
 * Узлы: start, send, ask, ai, condition, action.
 * Кнопки = ветвление: узел send/ask с options[] ЖДЁТ клик и идёт по выходу
 * нажатой кнопки (handle = optionHandleId), иначе — по выходу 'default'.
 */
import type { Flow } from './service.js';
import type { FlowSession } from './sessions.js';
import { saveSession } from './sessions.js';

export interface CarouselCard {
  imageUrl?: string;
  title?: string;
  subtitle?: string;
  buttons?: { label: string; url?: string; value?: string }[];
}

export interface ListRow { id: string; title: string; description?: string }

export interface SendIntent {
  text: string;
  options?: { label: string; value: string; url?: string; phone?: string; code?: string }[];
  /** Карусель (Instagram generic template). Доставку/деградацию решает адаптер канала. */
  cards?: CarouselCard[];
  /** Список выбора (WhatsApp interactive list, ≤10). */
  list?: { menuLabel?: string; rows: ListRow[] };
}

export interface FlowRunContext {
  channelType: string;
  send: (intent: SendIntent) => Promise<void>;
  ai: (userText: string) => Promise<string>;
  addTag?: (name: string) => Promise<void>;
  /** Картинки из ТЕКУЩЕГО входящего (для блоков-пресетов). */
  inboundImages?: { base64: string; mime: string }[];
  /** Метаданные пресета: сколько фото ждать от клиента + intake-текст. */
  getPresetMeta?: (presetKey: string) => Promise<{ clientImages: number; intake: string } | null>;
  /** Запуск пресета обработки картинки. */
  runPreset?: (
    presetKey: string,
    images: { base64: string; mime: string }[],
    text: string
  ) => Promise<{ ok: boolean; filePath?: string; url?: string; mime?: string; caption?: string; error?: string }>;
  /** Доставка готовой картинки в канал. */
  sendMedia?: (media: { filePath?: string; url?: string; mime?: string; caption?: string }) => Promise<void>;
  /** Проверка подписки клиента на аккаунт (Instagram). null = не удалось определить. */
  checkFollow?: () => Promise<boolean | null>;
}

const MAX_STEPS = 50;

function nodeById(flow: Flow, id: string | null): any {
  if (!id) return null;
  return (flow.graph.nodes || []).find((n: any) => n.id === id) || null;
}

function nextNodeId(flow: Flow, fromId: string, handle?: string | null): string | null {
  const edges = flow.graph.edges || [];
  const byHandle = handle != null ? edges.find((e: any) => e.source === fromId && e.sourceHandle === handle) : null;
  const edge = byHandle || edges.find((e: any) => e.source === fromId);
  return edge ? edge.target : null;
}

function findStart(flow: Flow): any {
  const nodes = flow.graph.nodes || [];
  return nodes.find((n: any) => n.type === 'start') || nodes[0] || null;
}

function normOptions(opts: any): { label: string; value: string; url?: string; phone?: string; code?: string }[] | undefined {
  if (!Array.isArray(opts) || opts.length === 0) return undefined;
  const mapped = opts
    .map((o: any) => ({ label: String(o?.label ?? o?.value ?? ''), value: String(o?.value ?? o?.label ?? ''), url: o?.url ? String(o.url) : undefined, phone: o?.phone ? String(o.phone) : undefined, code: o?.code ? String(o.code) : undefined }))
    .filter((o: { label: string }) => o.label);
  return mapped.length ? mapped : undefined;
}

/** Стабильный id хэндла кнопки. ДОЛЖЕН совпадать с фронтом (flowNodes.tsx optionHandleId). */
function optionHandleId(o: any, i: number): string {
  return String(o?.id ?? o?.value ?? `opt${i}`);
}

/** Спинтакс: {вариант1|вариант2|...} → случайный вариант (антиспам-рандомизация Meta). */
export function spintax(text: string): string {
  let out = String(text);
  for (let i = 0; i < 6 && /\{[^{}]*\|[^{}]*\}/.test(out); i++) {
    out = out.replace(/\{([^{}]*\|[^{}]*)\}/g, (_m, group: string) => {
      const opts = group.split('|');
      return opts[Math.floor(Math.random() * opts.length)] ?? '';
    });
  }
  return out;
}

/** Подстановка {{переменная}} + спинтакс {a|b} (ответы «Вопросов» + антиспам-рандомизация). */
function interpolate(text: string, vars: Record<string, any>): string {
  const sub = String(text).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
    const v = vars?.[key];
    return v == null ? '' : String(v);
  });
  return spintax(sub);
}

/** Дефолтный MIME по типу медиа (Chatwoot всё равно переопределит по content-type скачанного файла). */
function mimeForMedia(t: string): string {
  if (t === 'video') return 'video/mp4';
  if (t === 'audio') return 'audio/mpeg';
  if (t === 'file') return 'application/octet-stream';
  return 'image/png';
}

/** Сопоставляет ответ клиента с кнопкой: точное (value/label) → по номеру → частичное. */
function matchOption(opts: any[], reply: string): any | null {
  const r = String(reply ?? '').trim().toLowerCase();
  if (!r) return null;
  let m = opts.find((o) => String(o?.value ?? '').trim().toLowerCase() === r || String(o?.label ?? '').trim().toLowerCase() === r);
  if (m) return m;
  const num = parseInt(r, 10);
  if (!Number.isNaN(num) && num >= 1 && num <= opts.length) return opts[num - 1];
  m = opts.find((o) => String(o?.value ?? '').toLowerCase().includes(r) || String(o?.label ?? '').toLowerCase().includes(r));
  return m || null;
}

/** Узел «ждёт ввод» (резюмируется следующим сообщением): ask, либо любой узел с кнопками. */
/** Ветвящие кнопки = без url (url-кнопки открывают ссылку и не ведут по цепочке). */
function hasBranchOptions(d: any): boolean {
  return Array.isArray(d?.options) && d.options.some((o: any) => o && !o.url);
}

/** Ветвящие кнопки узла (без url): для carousel — собранные по всем карточкам; иначе d.options. */
function branchButtons(node: any): any[] {
  const d = node?.data || {};
  if (node?.type === 'list') {
    const rows = Array.isArray(d.rows) ? d.rows : [];
    return rows
      .map((r: any) => ({ value: String(r?.value ?? r?.title ?? ''), label: String(r?.title ?? r?.value ?? '') }))
      .filter((r: any) => r.value || r.label);
  }
  if (node?.type === 'carousel') {
    const cards = Array.isArray(d.cards) ? d.cards : [];
    return cards
      .flatMap((c: any) => (Array.isArray(c?.buttons) ? c.buttons : []))
      .filter((b: any) => b && !b.url && !b.phone && !b.code && (b.value || b.label));
  }
  // url/phone/code-кнопки — действия (открыть/позвонить/копировать), не ветвят.
  return Array.isArray(d?.options) ? d.options.filter((o: any) => o && !o.url && !o.phone && !o.code) : [];
}

function nodeWaits(node: any): boolean {
  return node?.type === 'ask' || branchButtons(node).length > 0;
}

/** Карточки карусели с подстановкой {{переменных}}. */
function buildCards(d: any, vars: Record<string, any>): CarouselCard[] {
  const cards = Array.isArray(d?.cards) ? d.cards : [];
  return cards
    .map((c: any) => ({
      imageUrl: c?.url ? String(c.url) : undefined,
      title: c?.title ? interpolate(String(c.title), vars) : undefined,
      subtitle: c?.subtitle ? interpolate(String(c.subtitle), vars) : undefined,
      buttons: (Array.isArray(c?.buttons) ? c.buttons : [])
        .map((b: any) => ({ label: interpolate(String(b?.label || ''), vars), url: b?.url ? String(b.url) : undefined, value: b?.value ? String(b.value) : undefined }))
        .filter((b: { label: string }) => b.label),
    }))
    .filter((c: CarouselCard) => c.imageUrl || c.title || (c.buttons && c.buttons.length > 0));
}

/** Список выбора (WhatsApp) с подстановкой {{переменных}}. */
function buildList(d: any, vars: Record<string, any>): { menuLabel?: string; rows: ListRow[] } {
  const rows = (Array.isArray(d?.rows) ? d.rows : [])
    .map((r: any) => ({ id: String(r?.value ?? r?.title ?? ''), title: interpolate(String(r?.title || ''), vars), description: r?.description ? interpolate(String(r.description), vars) : undefined }))
    .filter((r: ListRow) => r.title && r.id);
  return { menuLabel: d?.menuLabel ? interpolate(String(d.menuLabel), vars) : undefined, rows };
}

function evalCondition(d: any, session: FlowSession): string | null {
  const subject = String((d?.variable ? session.variables[d.variable] : session.variables.lastInput) ?? '')
    .trim()
    .toLowerCase();
  const cases: any[] = Array.isArray(d?.cases) ? d.cases : [];
  for (const c of cases) {
    const val = String(c?.value ?? '').trim().toLowerCase();
    if (!val) continue;
    if (subject === val || subject.includes(val)) return String(c?.handle ?? c?.value ?? '') || null;
  }
  return d?.defaultHandle ?? 'default';
}

export async function runFlow(flow: Flow, session: FlowSession, inboundText: string, ctx: FlowRunContext): Promise<boolean> {
  session.variables = session.variables || {};
  session.variables.lastInput = inboundText;

  const current = nodeById(flow, session.current_node_id);
  let startId: string | null;

  const pendPreset: any = session.variables.__preset;
  if (current && current.type === 'ai' && pendPreset && pendPreset.node === current.id) {
    // Резюме блока-пресета: повторно входим в этот узел (собрать входы / выполнить).
    startId = current.id;
  } else if (current && nodeWaits(current)) {
    // Резюме: входящее — ответ/нажатая кнопка.
    const d = current.data || {};
    const opts: any[] = branchButtons(current);
    if (opts.length > 0) {
      // Кнопочное меню: ветвимся по нажатой кнопке.
      const matched = matchOption(opts, inboundText);
      if (current.type === 'ask' && d.variable) {
        session.variables[d.variable] = matched ? (matched.value ?? matched.label ?? inboundText) : inboundText;
      }
      const handle = matched ? optionHandleId(matched, opts.indexOf(matched)) : 'default';
      startId = nextNodeId(flow, current.id, handle);
    } else {
      // Свободный ответ: сохраняем в переменную, идём по единственному выходу.
      if (current.type === 'ask' && d.variable) session.variables[d.variable] = inboundText;
      startId = nextNodeId(flow, current.id, null);
    }
  } else if (current) {
    startId = nextNodeId(flow, current.id, null);
  } else {
    const start = findStart(flow);
    if (!start) { session.status = 'aborted'; session.current_node_id = null; await saveSession(session); return false; }
    startId = start.type === 'start' ? nextNodeId(flow, start.id, null) : start.id;
  }

  // Антифлуд (правило Meta «не более ~3 сообщений подряд»): мягкий предохранитель от
  // случайного «потока» сообщений за один прогон. Легитимные цепочки ждут на ask/кнопках.
  const guard = { sends: 0 };
  const cctx: FlowRunContext = {
    ...ctx,
    send: async (i) => { guard.sends++; return ctx.send(i); },
    sendMedia: ctx.sendMedia ? async (m) => { guard.sends++; return ctx.sendMedia!(m); } : undefined,
  };
  await walk(flow, session, startId, cctx, guard);
  return true;
}

const MAX_SENDS_PER_RUN = 8;

async function walk(flow: Flow, session: FlowSession, startId: string | null, ctx: FlowRunContext, guard: { sends: number }): Promise<void> {
  let nodeId = startId;
  let steps = 0;

  while (nodeId && steps < MAX_STEPS) {
    if (guard.sends >= MAX_SENDS_PER_RUN) { console.warn('[flow] лимит отправок за шаг достигнут — стоп (антифлуд)'); break; }
    steps++;
    const node = nodeById(flow, nodeId);
    if (!node) break;
    const d = node.data || {};

    switch (node.type) {
      case 'send': {
        if (d.text) await ctx.send({ text: interpolate(String(d.text), session.variables), options: normOptions(d.options) });
        if (hasBranchOptions(d)) {
          // Есть ветвящие кнопки — ждём выбор клиента (url-кнопки и пустой список не ждут → проход дальше).
          session.current_node_id = node.id;
          session.status = 'active';
          await saveSession(session);
          return;
        }
        nodeId = nextNodeId(flow, node.id, null);
        break;
      }
      case 'ai': {
        const presetKey = String(d.presetKey || '').trim();
        if (!presetKey) {
          // Фоновый ИИ — отвечает по промпту + базе знаний, идёт дальше.
          const reply = await ctx.ai(String(session.variables.lastInput || ''));
          if (reply) await ctx.send({ text: reply });
          nodeId = nextNodeId(flow, node.id, null);
          break;
        }
        // Блок с пресетом обработки картинок.
        const pend: any = session.variables.__preset;
        const resuming = pend && pend.node === node.id;
        if (!resuming) {
          // Первый заход: шлём intake-инструкцию, ставим ожидание входов.
          const meta = ctx.getPresetMeta ? await ctx.getPresetMeta(presetKey) : null;
          const expected = meta?.clientImages ?? 1;
          const intake = String(d.intake || meta?.intake || 'Пришлите данные для обработки.');
          if (intake) await ctx.send({ text: intake });
          session.variables.__preset = { node: node.id, presetKey, expected, images: [] };
          session.current_node_id = node.id;
          session.status = 'active';
          await saveSession(session);
          return;
        }
        // Резюме: пришли данные клиента — накапливаем картинки.
        const incoming = Array.isArray(ctx.inboundImages) ? ctx.inboundImages : [];
        pend.images.push(...incoming);
        const need = Number(pend.expected) || 0;
        const enough = need === 0
          ? true
          : (pend.images.length >= need || (incoming.length === 0 && pend.images.length >= 1));
        if (!enough) {
          session.variables.__preset = pend;
          session.current_node_id = node.id;
          await saveSession(session);
          return; // ждём ещё картинки (коллаж)
        }
        // Выполняем пресет и доставляем результат; фоновый ИИ снова станет активен.
        const reqText = String(session.variables.lastInput || '');
        const result = ctx.runPreset
          ? await ctx.runPreset(pend.presetKey, pend.images, reqText)
          : { ok: false, error: 'Обработка картинок недоступна.' };
        delete session.variables.__preset;
        if (result.ok && (result.filePath || result.url) && ctx.sendMedia) {
          await ctx.sendMedia({ filePath: result.filePath, url: result.url, mime: result.mime, caption: result.caption });
        } else if (result.error) {
          await ctx.send({ text: result.error });
        } else if (result.caption) {
          await ctx.send({ text: result.caption });
        }
        nodeId = nextNodeId(flow, node.id, null);
        break;
      }
      case 'ask': {
        if (d.text) await ctx.send({ text: interpolate(String(d.text), session.variables), options: normOptions(d.options) });
        session.current_node_id = node.id;
        session.status = 'active';
        await saveSession(session);
        return; // ждём следующего входящего
      }
      case 'media': {
        const mUrl = interpolate(String(d.url || ''), session.variables).trim();
        const mCaption = interpolate(String(d.caption || ''), session.variables);
        const isAudio = d.mediaType === 'audio';
        if (mUrl && ctx.sendMedia) {
          await ctx.sendMedia({ url: mUrl, caption: isAudio ? undefined : (mCaption || undefined), mime: mimeForMedia(String(d.mediaType || 'image')) });
          if (isAudio && mCaption) await ctx.send({ text: mCaption }); // у аудио подпись — отдельным сообщением
        } else if (mCaption) {
          await ctx.send({ text: mCaption });
        }
        nodeId = nextNodeId(flow, node.id, null);
        break;
      }
      case 'delay': {
        const unitMs: Record<string, number> = { seconds: 1000, minutes: 60000, hours: 3600000, days: 86400000 };
        const ms = (Number(d.amount) || 0) * (unitMs[d.unit] || 1000);
        if (ms > 0) await new Promise((r) => setTimeout(r, Math.min(ms, 30000))); // кап 30с; длинные задержки — планировщик (Фаза позже)
        nodeId = nextNodeId(flow, node.id, null);
        break;
      }
      case 'link': {
        const lUrl = interpolate(String(d.url || ''), session.variables).trim();
        if (lUrl) await ctx.send({ text: lUrl });
        nodeId = nextNodeId(flow, node.id, null);
        break;
      }
      case 'carousel': {
        const cards = buildCards(d, session.variables);
        if (cards.length > 0) await ctx.send({ text: interpolate(String(d.text || ''), session.variables), cards });
        if (branchButtons(node).length > 0) {
          // Ветвящие кнопки в карточках — ждём выбор клиента.
          session.current_node_id = node.id;
          session.status = 'active';
          await saveSession(session);
          return;
        }
        nodeId = nextNodeId(flow, node.id, null);
        break;
      }
      case 'list': {
        const lst = buildList(d, session.variables);
        if (lst.rows.length > 0) await ctx.send({ text: interpolate(String(d.text || ''), session.variables), list: lst });
        if (branchButtons(node).length > 0) {
          // Строки списка = ветви, ждём выбор клиента.
          session.current_node_id = node.id;
          session.status = 'active';
          await saveSession(session);
          return;
        }
        nodeId = nextNodeId(flow, node.id, null);
        break;
      }
      case 'subscribe': {
        let followed: boolean | null = null;
        if (ctx.checkFollow) { try { followed = await ctx.checkFollow(); } catch { followed = null; } }
        // null (не определилось) → «не подписан»: гейт не пропускает без подтверждения.
        nodeId = nextNodeId(flow, node.id, followed === true ? 'yes' : 'no');
        break;
      }
      case 'condition': {
        nodeId = nextNodeId(flow, node.id, evalCondition(d, session));
        break;
      }
      case 'action': {
        const kind = d.kind || 'end';
        if (kind === 'set' && d.variable) session.variables[d.variable] = d.value;
        else if (kind === 'tag' && d.tag && ctx.addTag) { try { await ctx.addTag(String(d.tag)); } catch { /* best-effort */ } }
        else if (kind === 'handoff') {
          // Handover Protocol: бот замолкает на 24 ч (передача живому оператору). Сессия
          // остаётся «активной», но адаптер канала игнорирует входящие в окне (см. __handoffUntil).
          session.variables.__handoff = true;
          session.variables.__handoffUntil = Date.now() + 24 * 60 * 60 * 1000;
          session.current_node_id = node.id;
          session.status = 'active';
          await saveSession(session);
          return;
        }
        if (kind === 'end') {
          session.status = 'completed';
          session.current_node_id = null;
          await saveSession(session);
          return;
        }
        nodeId = nextNodeId(flow, node.id, null);
        break;
      }
      case 'start':
      default:
        nodeId = nextNodeId(flow, node.id, null);
        break;
    }
  }

  session.status = 'completed';
  session.current_node_id = null;
  await saveSession(session);
}
