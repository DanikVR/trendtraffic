/**
 * OMNICHANNEL Фаза 2d-2 — визуальный редактор цепочки (React Flow), стиль Aurora.
 * Канвас + палитра добавления узлов + панель настройки + сохранение графа.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge,
  type Connection, type Node, type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Save, Plus, Trash2, Loader2, Zap } from 'lucide-react';
import { AuroraButton } from '../../components/AuroraButton';
import { useAppStore } from '../../store/useAppStore';
import { nodeTypes, edgeTypes, defaultNodeData, NODE_PALETTE, FlowChannelContext } from './flowNodes';
import { CHANNELS, channelMeta, channelCaps, ChannelIcon, type ChannelCaps } from './channels';

let idCounter = 1;
const genId = () => `n${Date.now().toString(36)}_${(idCounter++).toString(36)}`;

const fieldStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', maxWidth: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13,
  background: 'var(--bg-tertiary, rgba(255,255,255,0.05))', color: 'var(--text-primary)',
  border: '1px solid var(--border-medium, rgba(255,255,255,0.12))', outline: 'none',
};
const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--text-muted)', display: 'block', margin: '10px 0 4px' };
const iconBtn: React.CSSProperties = { padding: '4px 8px', borderRadius: 6, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-medium, rgba(255,255,255,0.12))', cursor: 'pointer' };
const addBtn: React.CSSProperties = { marginTop: 4, padding: '4px 10px', borderRadius: 6, background: 'var(--bg-tertiary, rgba(255,255,255,0.06))', color: 'var(--text-secondary)', border: '1px solid var(--border-medium, rgba(255,255,255,0.12))', cursor: 'pointer', fontSize: 12 };

export default function FlowCanvas({ flowId, onBack }: { flowId: string; onBack: () => void }) {
  const token = useAppStore((s) => s.token);
  const headers = useMemo((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [popPos, setPopPos] = useState<{ x: number; y: number }>({ x: 80, y: 90 });
  const [channel, setChannel] = useState<string | null>(null);
  const [imagePresets, setImagePresets] = useState<any[]>([]);
  const [triggers, setTriggers] = useState<any[]>([]);
  const [showTriggers, setShowTriggers] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`/api/flows/${flowId}`, { headers });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        const f = data.flow || {};
        setName(f.name || '');
        setChannel(f.channel_type || null);
        setTriggers(Array.isArray(f.graph?.triggers) ? f.graph.triggers : []);
        let gNodes: Node[] = Array.isArray(f.graph?.nodes) ? f.graph.nodes : [];
        const gEdges: Edge[] = Array.isArray(f.graph?.edges) ? f.graph.edges : [];
        if (gNodes.length === 0) gNodes = [{ id: genId(), type: 'start', position: { x: 260, y: 40 }, data: {} }];
        setNodes(gNodes);
        setEdges(gEdges.map((e) => ({ ...e, type: e.type || 'deletable' })));
      } catch (e: any) {
        setError(e?.message || 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();
  }, [flowId, headers, setNodes, setEdges]);

  // Пресеты «Блоки обработки изображений» (общие на аккаунт) — для блока «ИИ-ассистент».
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/quest-flow/image/config', { headers });
        if (!res.ok) return;
        const data = await res.json();
        const fl: Record<string, string> = {};
        (data.functions || []).forEach((f: any) => { fl[f.key] = f.label; });
        setImagePresets((data.presets || []).map((p: any) => ({
          presetKey: p.presetKey,
          label: p.label,
          functionLabel: fl[p.function] || p.function,
          intakePrompt: p.intakePrompt || '',
        })));
      } catch { /* настройки картинок недоступны — не критично */ }
    })();
  }, [headers]);

  const onConnect = useCallback((c: Connection) => setEdges((eds) => addEdge({ ...c, type: 'deletable' }, eds)), [setEdges]);

  const rfRef = useRef<any>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const addNode = (type: string) => {
    const id = genId();
    // Новый узел — в ЦЕНТРЕ текущего вьюпорта (где смотрит пользователь), в текущем масштабе.
    let position = { x: 140 + Math.random() * 120, y: 160 + Math.random() * 120 };
    try {
      const inst = rfRef.current;
      const wrap = canvasWrapRef.current;
      if (inst?.screenToFlowPosition && wrap?.getBoundingClientRect) {
        const r = wrap.getBoundingClientRect();
        const c = inst.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
        // Джиттер: несколько добавленных подряд узлов не ложатся ТОЧНО друг на друга.
        position = { x: c.x + (Math.random() * 100 - 50), y: c.y + (Math.random() * 100 - 50) };
      }
    } catch { /* fallback — случайная позиция */ }
    // Снимаем выделение с прочих + новый поверх (в конец массива) и выделен.
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })).concat({ id, type, position, data: defaultNodeData(type), selected: true }));
  };

  const updateNodeData = (id: string, patch: Record<string, any>) =>
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));

  const deleteNode = (id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setEditingNodeId(null);
  };

  const save = async () => {
    setSaving(true); setError(null); setSaved(false);
    try {
      const res = await fetch(`/api/flows/${flowId}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ graph: { nodes, edges, triggers } }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const changeChannel = async (key: string | null) => {
    setChannel(key);
    try {
      await fetch(`/api/flows/${flowId}`, { method: 'PUT', headers, body: JSON.stringify({ channelType: key }) });
    } catch { /* применится при следующем сохранении */ }
  };

  const caps = channelCaps(channel);
  const meta = channelMeta(channel);
  const palette = NODE_PALETTE.filter((p) => !meta || meta.blocks.includes(p.type));
  // Разрешённые каналу блоки (для подсветки несовместимых на поле). null = канал не выбран → всё доступно.
  const allowedBlocks = meta ? meta.blocks : null;
  const channelCtx = useMemo(() => ({ allowedBlocks }), [allowedBlocks]);

  const uploadMedia = async (file: File): Promise<{ url: string; mediaType: string } | null> => {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/flows/media-upload', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      return { url: data.url, mediaType: data.mediaType };
    } catch (e: any) {
      setError(e?.message || 'Ошибка загрузки файла');
      return null;
    }
  };

  const editingNode = nodes.find((n) => n.id === editingNodeId) || null;

  // Открыть редактор-«заметку» над блоком (по двойному клику).
  const openEditor = (n: Node) => {
    // Несовместимый с каналом блок не редактируем — его нужно удалить (мигает в углу).
    if (meta && n.type !== 'start' && n.type && !meta.blocks.includes(n.type)) return;
    let pos = { x: 80, y: 90 };
    try {
      const inst = rfRef.current;
      if (inst?.flowToScreenPosition) {
        const s = inst.flowToScreenPosition({ x: n.position.x, y: n.position.y });
        pos = { x: Math.min(Math.max(12, s.x - 40), window.innerWidth - 352), y: Math.min(Math.max(70, s.y + 60), window.innerHeight - 160) };
      }
    } catch { /* fallback — фикс. позиция */ }
    setPopPos(pos);
    setEditingNodeId(n.id);
  };

  // Открытие редактора по кнопке-шестерёнке на блоке (надёжнее двойного клика, особенно на touch).
  useEffect(() => {
    const handler = (e: Event) => {
      const nid = (e as CustomEvent).detail?.id;
      const n = nodes.find((x) => x.id === nid);
      if (n) openEditor(n);
    };
    window.addEventListener('vvflow:edit', handler);
    return () => window.removeEventListener('vvflow:edit', handler);
    // openEditor намеренно не в deps (пересоздаётся каждый рендер); nodes+channel дают актуальный guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, channel]);

  if (loading) {
    return <div style={{ padding: 48, textAlign: 'center' }}><Loader2 size={22} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)', minHeight: 480 }}>
      <style>{`@keyframes vvIconPulse{0%,100%{transform:scale(1);opacity:.88}50%{transform:scale(1.07);opacity:1}}.vv-node-icon{animation:vvIconPulse 2.8s ease-in-out infinite}@keyframes vvBlink{0%,100%{opacity:1}50%{opacity:.25}}.vv-warn-actions{animation:vvBlink .9s ease-in-out infinite}@media(max-width:768px){.react-flow__minimap{display:none!important}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <AuroraButton variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={onBack}>Назад</AuroraButton>
        <strong style={{ color: 'var(--text-primary)' }}>{name}</strong>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 8, background: 'var(--bg-tertiary, rgba(255,255,255,0.05))', border: '1px solid var(--border-medium, rgba(255,255,255,0.12))' }} title={channel ? 'Канал зафиксирован при создании цепочки (блоки и лимиты привязаны к нему)' : 'Канал цепочки'}>
          <ChannelIcon channel={channel} size={16} muted={!channel} />
          {channel ? (
            // Канал зафиксирован при создании — не переключаем (под каждый канал свои блоки/лимиты).
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {channelMeta(channel)?.label || channel}
              <span style={{ fontSize: 10, opacity: 0.5 }}>🔒</span>
            </span>
          ) : (
            <Dropdown
              compact
              menuWidth={170}
              value=""
              placeholder="— канал —"
              options={[{ value: '', label: '— канал —' }, ...CHANNELS.map((c) => ({ value: c.key, label: c.label }))]}
              onChange={(v) => changeChannel(v || null)}
            />
          )}
        </span>
        {(channel === 'instagram' || channel === 'tiktok' || channel === 'messenger') && (
          <AuroraButton variant="secondary" size="sm" icon={<Zap size={14} />} onClick={() => setShowTriggers(true)}>
            Триггеры{triggers.length ? ` (${triggers.length})` : ''}
          </AuroraButton>
        )}
        <span style={{ flex: 1 }} />
        {palette.map((p) => (
          <AuroraButton key={p.type} variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => addNode(p.type)}>{p.label}</AuroraButton>
        ))}
        <AuroraButton variant="primary" size="sm" icon={<Save size={16} />} loading={saving} onClick={save}>Сохранить</AuroraButton>
      </div>
      {error && <div style={{ color: '#ff5ca8', fontSize: 13, marginBottom: 6 }}>{error}</div>}
      {saved && <div style={{ color: '#10b981', fontSize: 13, marginBottom: 6 }}>Сохранено ✓</div>}

      <div style={{ flex: 1, minHeight: 0 }}>
        <div ref={canvasWrapRef} style={{ width: '100%', height: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-medium, rgba(255,255,255,0.12))' }}>
          <FlowChannelContext.Provider value={channelCtx}>
          <ReactFlow
            onInit={(inst) => { rfRef.current = inst; }}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{ type: 'deletable' }}
            onNodeDoubleClick={(_, n) => openEditor(n)}
            onPaneClick={() => setEditingNodeId(null)}
            zoomOnDoubleClick={false}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
            proOptions={{ hideAttribution: true }}
            style={{ background: 'var(--bg-secondary, #0e0e1b)' }}
          >
            <Background color="rgba(255,255,255,0.06)" gap={18} />
            <Controls />
            <MiniMap pannable zoomable style={{ background: 'var(--bg-tertiary, #12121f)' }} maskColor="rgba(0,0,0,0.5)" />
          </ReactFlow>
          </FlowChannelContext.Provider>
        </div>
      </div>

      {/* Редактор-«заметка» — открывается двойным кликом прямо над блоком (правой колонки больше нет). */}
      {editingNode && (
        <div style={{ position: 'fixed', left: popPos.x, top: popPos.y, width: 340, maxHeight: '74vh', overflowY: 'auto', zIndex: 50, background: 'var(--bg-elevated, #171728)', border: '1px solid var(--border-medium, rgba(255,255,255,0.2))', borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.55)', padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>Настройка: {editingNode.type}</strong>
            <button onClick={() => setEditingNodeId(null)} style={{ ...iconBtn, color: 'var(--text-muted)' }} title="Закрыть">✕</button>
          </div>
          <ConfigPanel node={editingNode} caps={caps} channel={channel} presets={imagePresets} onUploadMedia={uploadMedia} onChange={(patch) => updateNodeData(editingNode.id, patch)} onDelete={() => deleteNode(editingNode.id)} />
        </div>
      )}

      {/* Панель триггеров запуска (Instagram). */}
      {showTriggers && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '8vh 12px 12px' }} onClick={() => setShowTriggers(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 440, maxHeight: '80vh', overflowY: 'auto', background: 'var(--bg-elevated, #171728)', border: '1px solid var(--border-medium, rgba(255,255,255,0.2))', borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.55)', padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Триггеры запуска · {channelMeta(channel)?.label || channel}</strong>
              <button onClick={() => setShowTriggers(false)} style={{ ...iconBtn, color: 'var(--text-muted)' }} title="Закрыть">✕</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
              {channel === 'tiktok'
                ? <>Бот запускается по триггеру. На TikTok <b>«комментарий» = только публичный ответ</b> (авто-DM из коммента запрещён). <b>«Слово в Директе»</b> — запуск по входящему. Приветствие и рекомендованные вопросы — на странице TrendFlow (карточка TikTok).</>
                : channel === 'messenger'
                ? <>Бот запускается по триггеру. На Messenger <b>«комментарий → DM»</b> = публичный ответ + приватное сообщение. <b>«Слово в сообщениях»</b> — по входящему. Get Started / приветствие / меню — на странице TrendFlow (карточка Messenger).</>
                : <>Бот запускается по триггеру. Активен <b>«Слово в комментарии → DM»</b> (Comment-to-DM). Не забудьте «Сохранить».</>}
            </div>
            <TriggersEditor triggers={triggers} onChange={setTriggers} channel={channel} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <AuroraButton variant="primary" size="sm" icon={<Save size={14} />} loading={saving} onClick={() => { save(); setShowTriggers(false); }}>Сохранить</AuroraButton>
              <AuroraButton variant="ghost" size="sm" onClick={() => setShowTriggers(false)}>Закрыть</AuroraButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigPanel({ node, onChange, onDelete, caps, channel, presets, onUploadMedia }: { node: Node; onChange: (patch: Record<string, any>) => void; onDelete: () => void; caps: ChannelCaps; channel: string | null; presets: any[]; onUploadMedia: (file: File) => Promise<{ url: string; mediaType: string } | null> }) {
  const d: any = node.data || {};
  const type = node.type;
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const handleMediaFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    const r = await onUploadMedia(file);
    setUploadingMedia(false);
    if (r) onChange({ url: r.url, mediaType: r.mediaType, fileName: file.name });
    e.target.value = '';
  };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ color: 'var(--text-primary)', fontSize: 14 }}>Узел: {type}</strong>
        {type !== 'start' && (
          <button onClick={onDelete} style={{ ...iconBtn, color: '#ff5ca8' }} title="Удалить узел"><Trash2 size={14} /></button>
        )}
      </div>

      {(type === 'send' || type === 'ask') && (
        <>
          <label style={labelStyle}>Текст сообщения</label>
          <MessageTextarea rows={3} value={d.text || ''} onChange={(v) => onChange({ text: v })} />
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
            Антиспам-рандомизация: {'{привет|здравствуйте|добрый день}'} → случайный вариант. Переменные: {'{{имя}}'}.
          </div>
        </>
      )}
      {type === 'ask' && (
        <>
          <label style={labelStyle}>Сохранить ответ в переменную</label>
          <input value={d.variable || ''} onChange={(e) => onChange({ variable: e.target.value })} style={fieldStyle} placeholder="имя_переменной" />
        </>
      )}
      {(type === 'send' || type === 'ask') && (
        <OptionsEditor options={Array.isArray(d.options) ? d.options : []} onChange={(options) => onChange({ options })} maxButtons={caps.maxButtons} channel={channel} />
      )}
      {type === 'ai' && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.5 }}>
            Без пресета — фоновый ИИ (принимает текст/голос/фото/видео, отвечает промптом + базой знаний). С пресетом — блок выполняет обработку картинки и возвращает результат, затем фоновый ИИ из начала продолжает.
          </div>
          <label style={labelStyle}>Пресет обработки картинок (опционально)</label>
          {presets.length === 0 ? (
            <div style={{ fontSize: 11, color: '#f59e0b', margin: '4px 0', lineHeight: 1.5 }}>
              Нет блоков. Создайте «Блоки обработки изображений» в Настройках Enterprise — они общие на все каналы.
            </div>
          ) : (
            <Dropdown
              value={d.presetKey || ''}
              placeholder="— нет (фоновый ИИ) —"
              options={[
                { value: '', label: '— нет (фоновый ИИ) —' },
                ...presets.map((p: any) => ({ value: p.presetKey, label: `${p.label}${p.label !== p.functionLabel ? ` · ${p.functionLabel}` : ''}` })),
              ]}
              onChange={(pk) => {
                const p = presets.find((x: any) => x.presetKey === pk);
                onChange({ presetKey: pk, presetLabel: p?.label || '', intake: d.intake || (p?.intakePrompt || '') });
              }}
            />
          )}
          {d.presetKey ? (
            <>
              <label style={labelStyle}>Сообщение-инструкция клиенту (что прислать)</label>
              <MessageTextarea rows={2} value={d.intake || ''} onChange={(v) => onChange({ intake: v })} maxLength={1000} placeholder="Напр.: Пришлите фото в полный рост" />
            </>
          ) : (
            <>
              <label style={labelStyle}>Доп. промпт (опционально)</label>
              <textarea rows={3} value={d.prompt || ''} onChange={(e) => onChange({ prompt: e.target.value })} style={fieldStyle} placeholder="Пусто = общий промпт аккаунта" />
            </>
          )}
        </>
      )}
      {type === 'condition' && (
        <>
          <label style={labelStyle}>Переменная (пусто = последний ввод)</label>
          <input value={d.variable || ''} onChange={(e) => onChange({ variable: e.target.value })} style={fieldStyle} placeholder="lastInput" />
          <CasesEditor cases={Array.isArray(d.cases) ? d.cases : []} onChange={(cases) => onChange({ cases })} />
        </>
      )}
      {type === 'action' && (
        <>
          <label style={labelStyle}>Действие</label>
          <Dropdown
            value={d.kind || 'end'}
            options={[
              { value: 'set', label: 'Задать переменную' },
              { value: 'tag', label: 'Поставить тег' },
              { value: 'handoff', label: 'Передать оператору' },
              { value: 'end', label: 'Завершить диалог' },
            ]}
            onChange={(kind) => onChange({ kind })}
          />
          {d.kind === 'set' && (
            <>
              <label style={labelStyle}>Переменная</label>
              <input value={d.variable || ''} onChange={(e) => onChange({ variable: e.target.value })} style={fieldStyle} />
              <label style={labelStyle}>Значение</label>
              <input value={d.value || ''} onChange={(e) => onChange({ value: e.target.value })} style={fieldStyle} />
            </>
          )}
          {d.kind === 'tag' && (
            <>
              <label style={labelStyle}>Название тега</label>
              <input value={d.tag || ''} onChange={(e) => onChange({ tag: e.target.value })} style={fieldStyle} />
            </>
          )}
        </>
      )}
      {type === 'media' && (
        <>
          <label style={labelStyle}>Файл</label>
          {d.url ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--bg-tertiary, rgba(255,255,255,0.05))', border: '1px solid var(--border-medium, rgba(255,255,255,0.12))' }}>
              <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(({ image: '🖼️', video: '🎬', audio: '🎵', file: '📎' }) as Record<string, string>)[d.mediaType] || '📎'} {d.fileName || d.mediaType}
              </span>
              <button onClick={() => onChange({ url: '', mediaType: 'image', fileName: '' })} style={iconBtn} title="Убрать">✕</button>
            </div>
          ) : (
            <label style={{ ...addBtn, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: uploadingMedia ? 'wait' : 'pointer' }}>
              {uploadingMedia ? 'Загрузка…' : '⬆ Загрузить файл'}
              <input type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" style={{ display: 'none' }} onChange={handleMediaFile} disabled={uploadingMedia} />
            </label>
          )}
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
            Тип определится автоматически: изображение / видео / аудио / файл.
          </div>
          {d.url && d.mediaType !== 'audio' && (
            <>
              <label style={labelStyle}>Подпись (опционально)</label>
              <MessageTextarea rows={2} value={d.caption || ''} onChange={(v) => onChange({ caption: v })} maxLength={1000} placeholder="Текст под медиа" />
            </>
          )}
          {d.url && d.mediaType === 'audio' && (
            <div style={{ fontSize: 10.5, color: '#f59e0b', marginTop: 6 }}>У аудио подпись не поддерживается — уйдёт отдельным сообщением.</div>
          )}
        </>
      )}
      {type === 'delay' && (
        <>
          <label style={labelStyle}>Ждать</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="number" min={1} value={d.amount ?? 5} onChange={(e) => onChange({ amount: Math.max(1, parseInt(e.target.value, 10) || 1) })} style={{ ...fieldStyle, flex: 1 }} />
            <div style={{ flex: 1 }}>
              <Dropdown
                value={d.unit || 'seconds'}
                options={[
                  { value: 'seconds', label: 'секунд' },
                  { value: 'minutes', label: 'минут' },
                  { value: 'hours', label: 'часов' },
                  { value: 'days', label: 'дней' },
                ]}
                onChange={(unit) => onChange({ unit })}
              />
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
            Пауза перед следующим блоком. Длинные задержки (минуты+) — по планировщику (скоро); сейчас держится до ~30 c.
          </div>
        </>
      )}
      {type === 'link' && (
        <>
          <label style={labelStyle}>Ссылка (URL)</label>
          <input value={d.url || ''} onChange={(e) => onChange({ url: e.target.value })} style={fieldStyle} placeholder="https://…" />
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>
            Уйдёт одной ссылкой. Превью (картинка+заголовок+описание) канал берёт из SEO-тегов (OG) целевой страницы — влияем только на свои страницы.
          </div>
        </>
      )}
      {type === 'carousel' && (
        <>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.5 }}>
            Карусель из карточек (картинка + заголовок + описание + кнопки). Доступно в Instagram (прямой Graph API). Кнопки со ссылкой открывают URL; без ссылки — ветвят цепочку.
          </div>
          <CarouselEditor cards={Array.isArray(d.cards) ? d.cards : []} onChange={(cards) => onChange({ cards })} onUploadMedia={onUploadMedia} />
        </>
      )}
      {type === 'list' && (
        <>
          <label style={labelStyle}>Текст над списком</label>
          <MessageTextarea rows={2} value={d.text || ''} onChange={(v) => onChange({ text: v })} />
          <label style={labelStyle}>Подпись кнопки списка (≤20)</label>
          <input value={d.menuLabel || ''} maxLength={20} onChange={(e) => onChange({ menuLabel: e.target.value.slice(0, 20) })} style={fieldStyle} placeholder="Открыть" />
          <ListEditor rows={Array.isArray(d.rows) ? d.rows : []} onChange={(rows) => onChange({ rows })} />
          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.4 }}>WhatsApp: список выбора (до 10 пунктов). Каждый пункт — отдельный выход цепочки.</div>
        </>
      )}
      {type === 'subscribe' && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Проверяет, подписан ли клиент на аккаунт (Instagram, прямой Graph API). Два выхода: <b style={{ color: '#22c55e' }}>подписан</b> → дальше; <b style={{ color: '#f59e0b' }}>не подписан</b> → ветка «попроси подписаться». Если статус не удалось определить — идёт по «не подписан».
        </div>
      )}
      {type === 'start' && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Точка входа — настроек нет.</div>}
    </div>
  );
}

function OptionsEditor({ options, onChange, maxButtons, channel }: { options: any[]; onChange: (o: any[]) => void; maxButtons: number; channel?: string | null }) {
  const set = (i: number, patch: any) => onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  if (maxButtons === 0) {
    return (
      <div style={{ fontSize: 11.5, color: '#f59e0b', marginTop: 10, lineHeight: 1.5 }}>
        Этот канал не поддерживает кнопки — клиент отвечает текстом. Для ветвления используйте узел «Условие».
      </div>
    );
  }
  return (
    <div>
      <label style={labelStyle}>Кнопки (быстрые ответы)</label>
      {options.map((o, i) => (
        <div key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px dashed var(--border-subtle, rgba(255,255,255,0.08))' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 10, background: 'rgba(124,92,255,0.16)', color: '#7c5cff', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
            <input value={o.label || ''} maxLength={20} onChange={(e) => set(i, { label: e.target.value.slice(0, 20), value: (o.value || e.target.value).slice(0, 20) })} style={{ ...fieldStyle, flex: 1 }} placeholder="Текст кнопки (до 20)" />
            <button onClick={() => onChange(options.filter((_, idx) => idx !== i))} style={iconBtn} title="Удалить кнопку">✕</button>
          </div>
          <input value={o.url || ''} onChange={(e) => set(i, { url: e.target.value })} style={{ ...fieldStyle, marginTop: 4, fontSize: 11 }} placeholder="Ссылка (опц.): кнопка откроет её и НЕ пойдёт по цепочке" />
          {channel === 'whatsapp' && (
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <input value={o.phone || ''} onChange={(e) => set(i, { phone: e.target.value })} style={{ ...fieldStyle, flex: 1, fontSize: 11 }} placeholder="📞 Звонок: телефон" />
              <input value={o.code || ''} onChange={(e) => set(i, { code: e.target.value })} style={{ ...fieldStyle, flex: 1, fontSize: 11 }} placeholder="🏷 Промокод: код" />
            </div>
          )}
        </div>
      ))}
      <button onClick={() => onChange([...options, { id: 'b' + Math.random().toString(36).slice(2, 9), label: '', value: '' }])} style={addBtn}>+ кнопка</button>
      {options.length > maxButtons && <div style={{ fontSize: 10, color: '#f59e0b', marginTop: 4 }}>Этот канал доставит до {maxButtons} кнопок; остальные уедут текстом-списком.</div>}
    </div>
  );
}

function TriggersEditor({ triggers, onChange, channel }: { triggers: any[]; onChange: (t: any[]) => void; channel?: string | null }) {
  const set = (i: number, patch: any) => onChange(triggers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  // TikTok/Messenger: comment + dm_keyword (story — только Instagram).
  const typeOpts = (channel === 'tiktok' || channel === 'messenger')
    ? [
        { value: 'comment', label: channel === 'messenger' ? 'Слово в комментарии → DM' : 'Слово в комментарии (публичный ответ)' },
        { value: 'dm_keyword', label: 'Слово в сообщениях' },
      ]
    : [
        { value: 'comment', label: 'Слово в комментарии → DM' },
        { value: 'dm_keyword', label: 'Слово в Директе' },
        { value: 'story_reply', label: 'Ответ на сторис' },
        { value: 'story_mention', label: 'Упоминание в сторис' },
      ];
  return (
    <div>
      {triggers.length === 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8 }}>Пока нет триггеров. Добавьте, чтобы бот запускался по слову в комментарии или Директе.</div>
      )}
      {triggers.map((t, i) => (
        <div key={t.id || i} style={{ border: '1px solid var(--border-medium, rgba(255,255,255,0.14))', borderRadius: 8, padding: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 6 }}>
            <div style={{ flex: 1 }}>
              <Dropdown
                value={t.type || 'comment'}
                options={typeOpts}
                onChange={(type) => set(i, { type })}
              />
            </div>
            <button onClick={() => onChange(triggers.filter((_, idx) => idx !== i))} style={iconBtn} title="Удалить триггер">✕</button>
          </div>
          {(t.type === 'comment' || t.type === 'dm_keyword' || t.type === 'story_reply' || !t.type) && (
            <>
              <label style={labelStyle}>Ключевые слова (через запятую){t.type === 'story_reply' ? ' — опц.' : ''}</label>
              <input value={Array.isArray(t.keywords) ? t.keywords.join(', ') : ''} onChange={(e) => set(i, { keywords: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} style={fieldStyle} placeholder="гайд, прайс, хочу" />
            </>
          )}
          {t.type === 'comment' && (
            <>
              <label style={labelStyle}>ID поста/видео (пусто = любой)</label>
              <input value={t.postId || ''} onChange={(e) => set(i, { postId: e.target.value.trim() })} style={fieldStyle} placeholder="необязательно" />
              <label style={labelStyle}>Ответ в комментарии</label>
              <input value={t.publicReply || ''} onChange={(e) => set(i, { publicReply: e.target.value })} style={fieldStyle} placeholder="Отправил в Директ! 😉" />
            </>
          )}
          {(t.type === 'story_reply' || t.type === 'story_mention') && (
            <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.5 }}>Запускает цепочку <b>свежим входом</b>. Ветвите узлом «Условие» по переменной <b>entry</b> (значения: story_reply / story_mention).</div>
          )}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={t.enabled !== false} onChange={(e) => set(i, { enabled: e.target.checked })} /> Включён
          </label>
        </div>
      ))}
      <button onClick={() => onChange([...triggers, { id: 't' + Math.random().toString(36).slice(2, 8), type: 'comment', keywords: [], postId: '', publicReply: '', enabled: true }])} style={addBtn}>+ триггер</button>
    </div>
  );
}

function ListEditor({ rows, onChange }: { rows: any[]; onChange: (r: any[]) => void }) {
  const set = (i: number, patch: any) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <div>
      <label style={labelStyle}>Пункты списка (до 10)</label>
      {rows.map((r, i) => (
        <div key={i} style={{ marginBottom: 6, paddingBottom: 6, borderBottom: '1px dashed var(--border-subtle, rgba(255,255,255,0.08))' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 10, background: 'rgba(8,145,178,0.18)', color: '#0891b2', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
            <input value={r.title || ''} maxLength={24} onChange={(e) => set(i, { title: e.target.value.slice(0, 24), value: (r.value || e.target.value).slice(0, 200) })} style={{ ...fieldStyle, flex: 1 }} placeholder="Пункт (до 24)" />
            <button onClick={() => onChange(rows.filter((_, idx) => idx !== i))} style={iconBtn} title="Удалить пункт">✕</button>
          </div>
          <input value={r.description || ''} maxLength={72} onChange={(e) => set(i, { description: e.target.value.slice(0, 72) })} style={{ ...fieldStyle, marginTop: 3, fontSize: 11 }} placeholder="Описание (опц., до 72)" />
        </div>
      ))}
      {rows.length < 10 && (
        <button onClick={() => onChange([...rows, { title: '', description: '', value: '' }])} style={addBtn}>+ пункт</button>
      )}
    </div>
  );
}

function CarouselEditor({ cards, onChange, onUploadMedia }: { cards: any[]; onChange: (c: any[]) => void; onUploadMedia: (file: File) => Promise<{ url: string; mediaType: string } | null> }) {
  const [uploading, setUploading] = useState<number | null>(null);
  const setCard = (ci: number, patch: any) => onChange(cards.map((c, i) => (i === ci ? { ...c, ...patch } : c)));
  const setButtons = (ci: number, buttons: any[]) => setCard(ci, { buttons });
  const upload = async (ci: number, file: File) => {
    setUploading(ci);
    const r = await onUploadMedia(file);
    setUploading(null);
    if (r) setCard(ci, { url: r.url });
  };
  return (
    <div>
      <label style={labelStyle}>Карточки (для карусели 2–10; 1 = одна карточка)</label>
      {cards.map((c, ci) => {
        const buttons: any[] = Array.isArray(c.buttons) ? c.buttons : [];
        return (
          <div key={ci} style={{ border: '1px solid var(--border-medium, rgba(255,255,255,0.14))', borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Карточка {ci + 1}</span>
              <button onClick={() => onChange(cards.filter((_, i) => i !== ci))} style={iconBtn} title="Удалить карточку">✕</button>
            </div>
            {c.url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-tertiary, rgba(255,255,255,0.05))', border: '1px solid var(--border-medium, rgba(255,255,255,0.12))' }}>
                <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🖼️ картинка загружена</span>
                <button onClick={() => setCard(ci, { url: '' })} style={iconBtn} title="Убрать">✕</button>
              </div>
            ) : (
              <label style={{ ...addBtn, display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 6, cursor: uploading === ci ? 'wait' : 'pointer' }}>
                {uploading === ci ? 'Загрузка…' : '⬆ Картинка'}
                <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading === ci} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(ci, f); e.target.value = ''; }} />
              </label>
            )}
            <input value={c.title || ''} maxLength={80} onChange={(e) => setCard(ci, { title: e.target.value.slice(0, 80) })} style={{ ...fieldStyle, marginBottom: 4 }} placeholder="Заголовок (до 80)" />
            <input value={c.subtitle || ''} maxLength={80} onChange={(e) => setCard(ci, { subtitle: e.target.value.slice(0, 80) })} style={{ ...fieldStyle, marginBottom: 4 }} placeholder="Описание (до 80)" />
            {buttons.map((b, bi) => (
              <div key={bi} style={{ marginBottom: 4, paddingTop: 4, borderTop: '1px dashed var(--border-subtle, rgba(255,255,255,0.08))' }}>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 9, background: 'rgba(236,72,153,0.18)', color: '#ec4899', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{bi + 1}</span>
                  <input value={b.label || ''} maxLength={20} onChange={(e) => setButtons(ci, buttons.map((x, i) => (i === bi ? { ...x, label: e.target.value.slice(0, 20), value: (x.value || e.target.value).slice(0, 20) } : x)))} style={{ ...fieldStyle, flex: 1 }} placeholder="Кнопка (до 20)" />
                  <button onClick={() => setButtons(ci, buttons.filter((_, i) => i !== bi))} style={iconBtn}>✕</button>
                </div>
                <input value={b.url || ''} onChange={(e) => setButtons(ci, buttons.map((x, i) => (i === bi ? { ...x, url: e.target.value } : x)))} style={{ ...fieldStyle, marginTop: 3, fontSize: 11 }} placeholder="Ссылка (опц.) — пусто = ветвление" />
              </div>
            ))}
            {buttons.length < 3 && (
              <button onClick={() => setButtons(ci, [...buttons, { id: 'b' + Math.random().toString(36).slice(2, 9), label: '', value: '' }])} style={{ ...addBtn, marginTop: 4 }}>+ кнопка</button>
            )}
          </div>
        );
      })}
      {cards.length < 10 && (
        <button onClick={() => onChange([...cards, { url: '', title: '', subtitle: '', buttons: [] }])} style={addBtn}>+ карточка</button>
      )}
    </div>
  );
}

function CasesEditor({ cases, onChange }: { cases: any[]; onChange: (c: any[]) => void }) {
  const set = (i: number, patch: any) => onChange(cases.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  return (
    <div>
      <label style={labelStyle}>Ветки (если ввод совпал)</label>
      {cases.map((c, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 10, background: 'rgba(245,158,11,0.18)', color: '#f59e0b', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
          <input value={c.value || ''} onChange={(e) => set(i, { value: e.target.value, handle: c.handle || e.target.value })} style={{ ...fieldStyle, flex: 1 }} placeholder="значение (напр. да)" />
          <button onClick={() => onChange(cases.filter((_, idx) => idx !== i))} style={iconBtn}>✕</button>
        </div>
      ))}
      <button onClick={() => onChange([...cases, { value: '', handle: '' }])} style={addBtn}>+ ветка</button>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Выход «иначе» добавляется автоматически.</div>
    </div>
  );
}

// Курируемый набор эмодзи для бизнес-сообщений (без тяжёлых зависимостей).
const EMOJIS = ['😀','😊','😍','🤩','🥳','😎','😉','🤔','👍','👏','🙏','🤝','🙌','🔥','✨','🎉','💯','✅','❌','⚠️','❤️','💜','🎁','🛒','📦','💳','💰','📞','📩','📲','⏰','📍','🚀','⭐','💡','👇','👉','🆕','🔝','😢'];

/** Кнопка-пикер эмодзи: вставляет символ в позицию курсора текстового поля. */
function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div ref={ref} className="nodrag" style={{ position: 'absolute', right: 6, bottom: 6 }}>
      <button type="button" onClick={() => setOpen((v) => !v)} title="Вставить эмодзи"
        style={{ background: 'var(--bg-tertiary, rgba(255,255,255,0.08))', border: '1px solid var(--border-medium, rgba(255,255,255,0.14))', borderRadius: 6, cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '2px 5px' }}>😊</button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 70, width: 200, padding: 6, display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2, background: 'var(--bg-elevated, #171728)', border: '1px solid var(--border-medium, rgba(255,255,255,0.18))', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.45)' }}>
          {EMOJIS.map((em) => (
            <button key={em} type="button" onClick={() => { onPick(em); setOpen(false); }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 3, borderRadius: 4 }}>{em}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Текстовое поле сообщения с пикером эмодзи (вставка в курсор) + опц. лимитом символов. */
function MessageTextarea({ value, onChange, rows = 3, placeholder, maxLength }: { value: string; onChange: (v: string) => void; rows?: number; placeholder?: string; maxLength?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const cap = (s: string) => (maxLength ? s.slice(0, maxLength) : s);
  const insert = (emoji: string) => {
    const el = ref.current;
    const cur = value || '';
    if (!el) { onChange(cap(cur + emoji)); return; }
    const start = el.selectionStart ?? cur.length;
    const end = el.selectionEnd ?? cur.length;
    const next = cap(cur.slice(0, start) + emoji + cur.slice(end));
    onChange(next);
    requestAnimationFrame(() => { try { el.focus(); const p = Math.min(start + emoji.length, next.length); el.setSelectionRange(p, p); } catch { /* noop */ } });
  };
  return (
    <div style={{ position: 'relative' }}>
      <textarea ref={ref} rows={rows} value={value} onChange={(e) => onChange(cap(e.target.value))} style={{ ...fieldStyle, paddingRight: 34 }} placeholder={placeholder} />
      <EmojiPicker onPick={insert} />
    </div>
  );
}

/** Кастомный дропдаун (вместо native select): список ограничен шириной и не вылезает за панель.
 *  compact — инлайн-вид (для шапки: выбор канала); иначе — на всю ширину поля. */
function Dropdown({ value, options, onChange, placeholder, compact, menuWidth }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; placeholder?: string; compact?: boolean; menuWidth?: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as HTMLElement)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const selected = options.find((o) => o.value === value);
  const label = selected ? selected.label : (placeholder || '—');
  return (
    <div ref={ref} style={{ position: 'relative', ...(compact ? { display: 'inline-block' } : {}) }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={compact
          ? { background: 'transparent', color: 'var(--text-primary)', border: 'none', outline: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0 }
          : { ...fieldStyle, textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ flexShrink: 0, opacity: 0.6, fontSize: 9 }}>▼</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', zIndex: 60, maxHeight: 260, overflowY: 'auto', background: 'var(--bg-elevated, #171728)', border: '1px solid var(--border-medium, rgba(255,255,255,0.18))', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.45)', ...(compact ? { right: 0, minWidth: menuWidth || 160 } : { left: 0, right: 0 }) }}>
          {options.map((o) => (
            <button key={o.value || '_none'} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 12.5, lineHeight: 1.35, background: o.value === value ? 'var(--bg-tertiary, rgba(255,255,255,0.06))' : 'transparent', color: 'var(--text-primary)', border: 'none', cursor: 'pointer', whiteSpace: 'normal', wordBreak: 'break-word' }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

