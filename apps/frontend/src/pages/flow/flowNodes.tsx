/**
 * OMNICHANNEL Фаза 2d — кастомные узлы + рёбра React Flow в стиле Aurora.
 * Узлы: start / send / ask / ai / condition / action.
 * - Угловой тулбар (правый верх) при наведении/выделении: дублировать + удалить.
 * - Кастомное ребро (deletable) с кнопкой ✕ посередине — удаляет связь, узлы остаются.
 * - Дубль появляется поверх (addNodes в конец) и сразу выделен.
 */
import React from 'react';
import {
  Handle, Position, useReactFlow,
  BaseEdge, EdgeLabelRenderer, getBezierPath,
  type NodeProps, type EdgeProps,
} from '@xyflow/react';
import { Play, MessageSquare, HelpCircle, Sparkles, GitBranch, Flag, Copy, Trash2, Image as ImageIcon, Clock, Link2, Pencil, LayoutGrid, UserCheck, List } from 'lucide-react';

/** Текущий канал цепочки → какие типы блоков ему доступны. null = канал не выбран (всё доступно). */
export const FlowChannelContext = React.createContext<{ allowedBlocks: string[] | null }>({ allowedBlocks: null });

interface NodeMeta { label: string; icon: React.ComponentType<any>; color: string; }
const META: Record<string, NodeMeta> = {
  start:     { label: 'Старт',     icon: Play,          color: '#22d3ee' },
  send:      { label: 'Сообщение', icon: MessageSquare, color: '#7c5cff' },
  ask:       { label: 'Вопрос',    icon: HelpCircle,    color: '#5b7cff' },
  ai:        { label: 'ИИ-ассистент', icon: Sparkles,   color: '#ff5ca8' },
  condition: { label: 'Условие',   icon: GitBranch,     color: '#f59e0b' },
  action:    { label: 'Действие',  icon: Flag,          color: '#10b981' },
  media:     { label: 'Медиа',     icon: ImageIcon,     color: '#0ea5e9' },
  delay:     { label: 'Ждать',     icon: Clock,         color: '#a78bfa' },
  link:      { label: 'Ссылка',    icon: Link2,         color: '#14b8a6' },
  carousel:  { label: 'Карусель',  icon: LayoutGrid,    color: '#ec4899' },
  subscribe: { label: 'Подписка',  icon: UserCheck,     color: '#22c55e' },
  list:      { label: 'Список',    icon: List,          color: '#0891b2' },
};

const genId = () => `n${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;
function clip(s: any, n = 60): string {
  const str = String(s ?? '').trim();
  return str.length > n ? str.slice(0, n) + '…' : str;
}

const cornerBtn: React.CSSProperties = {
  display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 5,
  background: 'transparent', border: 'none', color: 'var(--text-secondary, #c8cad8)', cursor: 'pointer', padding: 0,
};

/** Стабильный id хэндла кнопки (для рёбер). ДОЛЖЕН совпадать с раннером (runner.ts optionHandleId). */
function optionHandleId(o: any, i: number): string {
  return String(o?.id ?? o?.value ?? `opt${i}`);
}

/** Выходные хэндлы: по одному на кнопку + «иначе» (произвольный ответ). */
function OptionHandles({ options, color }: { options: any[]; color: string }) {
  // Кнопки-ссылки (url) не ветвят. Подпись выхода = номер кнопки (исходный индекс) — не налезает на текст.
  const handles = [
    ...options
      .map((o: any, i: number) => ({ o, i }))
      .filter((x) => x.o && !x.o.url)
      .map((x) => ({ id: optionHandleId(x.o, x.i), label: String(x.i + 1) })),
    { id: 'default', label: 'иначе' },
  ];
  return (
    <div style={{ position: 'relative', height: 16, marginTop: 10 }}>
      {handles.map((h, i) => {
        const left = `${((i + 1) / (handles.length + 1)) * 100}%`;
        return (
          <React.Fragment key={h.id || i}>
            <span style={{ position: 'absolute', left, transform: 'translateX(-50%)', fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h.label}</span>
            <Handle type="source" id={h.id} position={Position.Bottom} style={{ left, background: color, width: 8, height: 8, border: 'none' }} />
          </React.Fragment>
        );
      })}
    </div>
  );
}

function NodeShell({ type, id, selected, body, children }: {
  type: string; id?: string; selected?: boolean; body?: React.ReactNode; children?: React.ReactNode;
}) {
  const meta = META[type] || META.send;
  const Icon = meta.icon;
  const rf = useReactFlow();
  const { allowedBlocks } = React.useContext(FlowChannelContext);
  const [hover, setHover] = React.useState(false);
  // Блок несовместим с выбранным каналом: есть на поле, но канал его не поддерживает.
  const incompatible = !!allowedBlocks && type !== 'start' && !allowedBlocks.includes(type);
  // У несовместимого — тулбар виден всегда (иконки мигают, подсказывая «удалить»).
  const showActions = type !== 'start' && !!id && (hover || !!selected || incompatible);

  const duplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const n = rf.getNode(id!);
    if (!n) return;
    rf.addNodes({
      ...n,
      id: genId(),
      position: { x: (n.position?.x || 0) + 44, y: (n.position?.y || 0) + 44 },
      selected: true, // появляется поверх и выделен
    } as any);
  };
  const remove = (e: React.MouseEvent) => {
    e.stopPropagation();
    rf.deleteElements({ nodes: [{ id: id! }] });
  };
  const edit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (id) window.dispatchEvent(new CustomEvent('vvflow:edit', { detail: { id } }));
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', minWidth: 170, maxWidth: 240, borderRadius: 12, padding: 10,
        background: 'var(--bg-elevated, #171728)',
        border: `1px solid ${incompatible ? '#f59e0b' : selected ? meta.color : 'var(--border-medium, rgba(255,255,255,0.14))'}`,
        boxShadow: incompatible ? '0 0 0 2px rgba(245,158,11,0.55)' : selected ? `0 0 0 2px ${meta.color}55` : '0 6px 16px rgba(0,0,0,0.35)',
        opacity: incompatible ? 0.9 : 1,
        color: 'var(--text-primary, #eef0f7)',
      }}
    >
      {showActions && (
        <div className={`nodrag${incompatible ? ' vv-warn-actions' : ''}`} style={{
          position: 'absolute', top: 4, right: 4, display: 'flex', gap: 2, zIndex: 5,
          background: 'var(--bg-elevated, #171728)', border: `1px solid ${incompatible ? '#f59e0b' : 'var(--border-medium, rgba(255,255,255,0.18))'}`,
          borderRadius: 7, padding: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          <button onClick={edit} title="Настроить" style={cornerBtn}><Pencil size={13} /></button>
          <button onClick={duplicate} title="Дублировать" style={cornerBtn}><Copy size={13} /></button>
          <button onClick={remove} title="Удалить" style={{ ...cornerBtn, color: '#ff5ca8' }}><Trash2 size={13} /></button>
        </div>
      )}
      {type !== 'start' && <Handle type="target" position={Position.Top} style={{ background: meta.color, width: 8, height: 8, border: 'none' }} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingRight: showActions ? 52 : 0 }}>
        <span className="vv-node-icon" style={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: 6, background: `${meta.color}22`, color: meta.color }}>
          <Icon size={14} />
        </span>
        <span style={{ fontWeight: 600, fontSize: 12.5 }}>{meta.label}</span>
      </div>
      {incompatible && (
        <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>⚠ не для этого канала — удалите</div>
      )}
      {body !== undefined && body !== null && body !== '' && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted, #a4a7c0)', marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{body}</div>
      )}
      {children}
    </div>
  );
}

export function StartNode({ id, selected }: NodeProps) {
  return (
    <NodeShell type="start" id={id} selected={selected} body="Точка входа диалога">
      <Handle type="source" position={Position.Bottom} style={{ background: META.start.color, width: 8, height: 8, border: 'none' }} />
    </NodeShell>
  );
}

export function SendNode({ id, data, selected }: NodeProps) {
  const d: any = data || {};
  const opts: any[] = Array.isArray(d.options) ? d.options : [];
  return (
    <NodeShell type="send" id={id} selected={selected} body={clip(d.text) || '— пустое сообщение —'}>
      {opts.length > 0
        ? <OptionHandles options={opts} color={META.send.color} />
        : <Handle type="source" position={Position.Bottom} style={{ background: META.send.color, width: 8, height: 8, border: 'none' }} />}
    </NodeShell>
  );
}

export function AskNode({ id, data, selected }: NodeProps) {
  const d: any = data || {};
  const opts: any[] = Array.isArray(d.options) ? d.options : [];
  return (
    <NodeShell type="ask" id={id} selected={selected} body={clip(d.text) || '— вопрос —'}>
      <div style={{ fontSize: 10.5, color: META.ask.color, marginTop: 4 }}>→ {d.variable || 'переменная'}</div>
      {opts.length > 0
        ? <OptionHandles options={opts} color={META.ask.color} />
        : <Handle type="source" position={Position.Bottom} style={{ background: META.ask.color, width: 8, height: 8, border: 'none' }} />}
    </NodeShell>
  );
}

export function AiNode({ id, data, selected }: NodeProps) {
  const d: any = data || {};
  const body = d.presetKey
    ? `🎨 Пресет: ${clip(d.presetLabel || d.presetKey, 40)}`
    : (d.prompt ? clip(d.prompt) : 'Фоновый ИИ: принимает текст/медиа, отвечает');
  return (
    <NodeShell type="ai" id={id} selected={selected} body={body}>
      <Handle type="source" position={Position.Bottom} style={{ background: META.ai.color, width: 8, height: 8, border: 'none' }} />
    </NodeShell>
  );
}

export function ConditionNode({ id, data, selected }: NodeProps) {
  const d: any = data || {};
  const cases: any[] = Array.isArray(d.cases) ? d.cases : [];
  const handles = [
    ...cases.map((c: any, i: number) => ({ id: String(c?.handle ?? c?.value ?? ''), label: String(i + 1) })),
    { id: 'default', label: 'иначе' },
  ];
  return (
    <NodeShell type="condition" id={id} selected={selected} body={d.variable ? `по «${d.variable}»` : 'по последнему вводу'}>
      <div style={{ position: 'relative', height: 16, marginTop: 8 }}>
        {handles.map((h, i) => {
          const left = `${((i + 1) / (handles.length + 1)) * 100}%`;
          return (
            <React.Fragment key={h.id || i}>
              <span style={{ position: 'absolute', left, transform: 'translateX(-50%)', fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h.label}</span>
              <Handle type="source" id={h.id || `h${i}`} position={Position.Bottom} style={{ left, background: META.condition.color, width: 8, height: 8, border: 'none' }} />
            </React.Fragment>
          );
        })}
      </div>
    </NodeShell>
  );
}

export function ActionNode({ id, data, selected }: NodeProps) {
  const d: any = data || {};
  const kind = d.kind || 'end';
  const labels: Record<string, string> = {
    set: `Задать ${d.variable ? `«${d.variable}»` : 'переменную'}`,
    tag: `Тег ${d.tag ? `«${d.tag}»` : ''}`,
    handoff: 'Передать оператору',
    end: 'Завершить диалог',
  };
  const isTerminal = kind === 'end' || kind === 'handoff';
  return (
    <NodeShell type="action" id={id} selected={selected} body={labels[kind] || kind}>
      {!isTerminal && <Handle type="source" position={Position.Bottom} style={{ background: META.action.color, width: 8, height: 8, border: 'none' }} />}
    </NodeShell>
  );
}

export function MediaNode({ id, data, selected }: NodeProps) {
  const d: any = data || {};
  const labels: Record<string, string> = { image: 'Изображение', video: 'Видео', audio: 'Аудио', file: 'Файл' };
  const kind = labels[d.mediaType] || 'Медиа';
  const detail = d.url ? (d.fileName ? `: ${clip(d.fileName, 28)}` : ' · файл загружен') : ' — не загружено';
  return (
    <NodeShell type="media" id={id} selected={selected} body={`${kind}${detail}`}>
      <Handle type="source" position={Position.Bottom} style={{ background: META.media.color, width: 8, height: 8, border: 'none' }} />
    </NodeShell>
  );
}

export function DelayNode({ id, data, selected }: NodeProps) {
  const d: any = data || {};
  const units: Record<string, string> = { seconds: 'сек', minutes: 'мин', hours: 'ч', days: 'дн' };
  return (
    <NodeShell type="delay" id={id} selected={selected} body={`Ждать ${d.amount ?? 0} ${units[d.unit] || 'сек'}`}>
      <Handle type="source" position={Position.Bottom} style={{ background: META.delay.color, width: 8, height: 8, border: 'none' }} />
    </NodeShell>
  );
}

export function LinkNode({ id, data, selected }: NodeProps) {
  const d: any = data || {};
  return (
    <NodeShell type="link" id={id} selected={selected} body={d.url ? clip(d.url, 40) : '— ссылка не задана —'}>
      <Handle type="source" position={Position.Bottom} style={{ background: META.link.color, width: 8, height: 8, border: 'none' }} />
    </NodeShell>
  );
}

/** Карусель (Instagram): несколько карточек (картинка+заголовок+описание+кнопки).
 *  Ветвящие кнопки (без url) дают выходы — как у «Сообщения». */
export function CarouselNode({ id, data, selected }: NodeProps) {
  const d: any = data || {};
  const cards: any[] = Array.isArray(d.cards) ? d.cards : [];
  const branch = cards.flatMap((c: any) => (Array.isArray(c?.buttons) ? c.buttons : [])).filter((b: any) => b && !b.url && (b.value || b.label));
  const n = cards.length;
  const word = n === 1 ? 'карточка' : n <= 4 ? 'карточки' : 'карточек';
  return (
    <NodeShell type="carousel" id={id} selected={selected} body={n ? `🖼️ ${n} ${word}` : '— пустая карусель —'}>
      {branch.length > 0
        ? <OptionHandles options={branch} color={META.carousel.color} />
        : <Handle type="source" position={Position.Bottom} style={{ background: META.carousel.color, width: 8, height: 8, border: 'none' }} />}
    </NodeShell>
  );
}

/** Гейт подписки (Instagram): проверяет is_user_follow_business → выходы «подписан»/«не подписан». */
export function SubscribeNode({ id, selected }: NodeProps) {
  const handles = [{ id: 'yes', label: 'подписан' }, { id: 'no', label: 'не подписан' }];
  return (
    <NodeShell type="subscribe" id={id} selected={selected} body="Проверка подписки на аккаунт">
      <div style={{ position: 'relative', height: 16, marginTop: 8 }}>
        {handles.map((h, i) => {
          const left = `${((i + 1) / (handles.length + 1)) * 100}%`;
          return (
            <React.Fragment key={h.id}>
              <span style={{ position: 'absolute', left, transform: 'translateX(-50%)', fontSize: 9, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{h.label}</span>
              <Handle type="source" id={h.id} position={Position.Bottom} style={{ left, background: META.subscribe.color, width: 8, height: 8, border: 'none' }} />
            </React.Fragment>
          );
        })}
      </div>
    </NodeShell>
  );
}

/** Список выбора (WhatsApp interactive list, ≤10). Строки = выходы (как кнопки). */
export function ListNode({ id, data, selected }: NodeProps) {
  const d: any = data || {};
  const rows: any[] = Array.isArray(d.rows) ? d.rows : [];
  const opts = rows.filter((r) => r && (r.value || r.title)).map((r) => ({ value: String(r.value || r.title), label: String(r.title || r.value) }));
  const n = opts.length;
  const word = n === 1 ? 'пункт' : n <= 4 ? 'пункта' : 'пунктов';
  return (
    <NodeShell type="list" id={id} selected={selected} body={n ? `📋 ${n} ${word}` : '— пустой список —'}>
      {n > 0
        ? <OptionHandles options={opts} color={META.list.color} />
        : <Handle type="source" position={Position.Bottom} style={{ background: META.list.color, width: 8, height: 8, border: 'none' }} />}
    </NodeShell>
  );
}

export const nodeTypes = {
  start: StartNode,
  send: SendNode,
  ask: AskNode,
  ai: AiNode,
  condition: ConditionNode,
  action: ActionNode,
  media: MediaNode,
  delay: DelayNode,
  link: LinkNode,
  carousel: CarouselNode,
  subscribe: SubscribeNode,
  list: ListNode,
};

// ── Кастомное ребро с кнопкой удаления (✕ посередине) ──
export function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected }: EdgeProps) {
  const rf = useReactFlow();
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke: selected ? '#ff5ca8' : 'var(--border-strong, rgba(255,255,255,0.35))', strokeWidth: selected ? 2 : 1.5 }} />
      <EdgeLabelRenderer>
        <button
          className="nodrag nopan"
          title="Удалить связь"
          onClick={(e) => { e.stopPropagation(); rf.deleteElements({ edges: [{ id }] }); }}
          style={{
            position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all', width: 20, height: 20, borderRadius: '50%',
            background: 'var(--bg-elevated, #171728)', border: '1px solid var(--border-medium, rgba(255,255,255,0.22))',
            color: '#ff5ca8', cursor: 'pointer', display: 'grid', placeItems: 'center', fontSize: 11, lineHeight: 1,
          }}
        >✕</button>
      </EdgeLabelRenderer>
    </>
  );
}

export const edgeTypes = { deletable: DeletableEdge };

/** Дефолтные data для нового узла каждого типа. */
export function defaultNodeData(type: string): Record<string, any> {
  switch (type) {
    case 'send': return { text: 'Привет! 👋', options: [] };
    case 'ask': return { text: 'Как вас зовут?', variable: 'name', options: [] };
    case 'ai': return { prompt: '', presetKey: '', presetLabel: '', intake: '' };
    case 'condition': return { variable: '', cases: [{ value: 'да', handle: 'yes' }] };
    case 'action': return { kind: 'end' };
    case 'media': return { mediaType: 'image', url: '', caption: '', fileName: '' };
    case 'delay': return { amount: 5, unit: 'seconds' };
    case 'link': return { url: '' };
    case 'carousel': return { cards: [{ url: '', title: '', subtitle: '', buttons: [] }] };
    case 'subscribe': return {};
    case 'list': return { text: 'Выберите вариант:', menuLabel: 'Открыть', rows: [{ title: '', description: '', value: '' }] };
    default: return {};
  }
}

export const NODE_PALETTE: { type: string; label: string }[] = [
  { type: 'send', label: 'Сообщение' },
  { type: 'ask', label: 'Вопрос' },
  { type: 'ai', label: 'ИИ-ассистент' },
  { type: 'condition', label: 'Условие' },
  { type: 'action', label: 'Действие' },
  { type: 'media', label: 'Медиа' },
  { type: 'delay', label: 'Ждать' },
  { type: 'link', label: 'Ссылка' },
  { type: 'carousel', label: 'Карусель' },
  { type: 'subscribe', label: 'Подписка' },
  { type: 'list', label: 'Список' },
];
