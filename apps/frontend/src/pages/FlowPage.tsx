/**
 * TrendFlow — список сценариев производства видео карточками (форк бывшей FlowPage).
 *
 *  • Карточка «+ Создать сценарий» → создаёт флоу и сразу открывает редактор.
 *  • Карточка сценария целиком кликабельна → открывает редактор.
 *  • На карточке: название (инлайн-переименование ✎), дата+время создания (цифрами),
 *    иконки действий прямо на плашке (дублировать / черновик↔активен / удалить),
 *    крупный брендовый герой.
 *  • Массовое выделение: чекбокс на обложке; при ≥1 выбранном клик по карточке
 *    тоже выделяет, сверху появляется панель «Выбрано N / Выбрать все / Удалить».
 *  • Редактор — MontageEditor (радиальная «паутина» монтажных узлов). Легаси
 *    omnichannel-редактор (FlowCanvas/flowNodes/channels) удалён в v1.6.42.
 *
 * Бот-канальные карточки (IG/TikTok/Messenger/аналитика) убраны — для монтажных
 * сценариев они не нужны.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Check, X, Copy, Trash2, Power, Loader2, Mic, Cloud, Film } from 'lucide-react';
import { AuroraCard } from '../components/AuroraCard';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAppStore } from '../store/useAppStore';

// Радиальный редактор монтажа — lazy.
const MontageEditor = React.lazy(() => import('./flow/MontageEditor'));

// Брендовый герой карточки (общий для всех сценариев). Основной — кадр higgsfield
// (человек + кинохлопушка); запасной — самохостящийся SVG в /public на случай
// недоступности CDN. Для self-contained сборки можно скачать PNG в public/ и
// заменить HERO на локальный путь.
const HERO = 'https://d8j0ntlcm91z4.cloudfront.net/user_3DRgE6GslyiDQa3PCZdIUpJkSkU/hf_20260627_055144_e5e130c2-fa4c-45d6-9bb4-84d5353194fb.png';
const HERO_FALLBACK = '/trendflow-hero.svg';

interface FlowRow {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'archived';
  channel_type: string | null;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

// Дата создания цифрами + время: «02.07.2026, 14:35».
function fmtDateTime(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

// Иконки-бейджи содержимого сценария (по графу): подкаст / Google Omni / монтаж.
function graphKinds(graph: any): string[] {
  const out: string[] = [];
  const p = graph?.podcast;
  if (p && (p.hostA?.photoUrl || p.groupPhotoUrl || p.recordingUrl || (Array.isArray(p.dialogue) && p.dialogue.length))) out.push('podcast');
  if (graph?.omni && Array.isArray(graph.omni.segments) && graph.omni.segments.some((s: any) => (s?.prompt || '').trim())) out.push('omni');
  if (Array.isArray(graph?.nodes) && graph.nodes.some((n: any) => n?.type === 'montage')) out.push('montage');
  return out.slice(0, 3);
}
const KIND_BADGE: Record<string, { icon: React.ReactNode; color: string }> = {
  podcast: { icon: <Mic size={13} />, color: '#ec4899' },
  omni: { icon: <Cloud size={13} />, color: '#4285F4' },
  montage: { icon: <Film size={13} />, color: '#818cf8' },
};

export default function FlowPage() {
  const token = useAppStore((s) => s.token);
  const headers = useCallback((): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }), [token]);

  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openedNew, setOpenedNew] = useState(false); // true — сценарий только что создан (показать пресеты)
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<FlowRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set()); // массовое выделение карточек
  const [confirmMass, setConfirmMass] = useState(false);
  const [massBusy, setMassBusy] = useState(false);
  const [flowKinds, setFlowKinds] = useState<Record<string, string[]>>({}); // иконки-бейджи содержимого по графу

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/flows', { headers: headers() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setFlows(data.flows || []);
    } catch (e: any) { setError(e?.message || 'Ошибка загрузки'); }
    finally { setLoading(false); }
  }, [headers]);
  useEffect(() => { load(); }, [load]);

  // Подтянуть графы сценариев и вычислить иконки-бейджи содержимого (для обложек).
  useEffect(() => {
    if (!flows.length) { setFlowKinds({}); return; }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(flows.map(async (f) => {
        try {
          const r = await fetch(`/api/flows/${f.id}`, { headers: headers() });
          if (!r.ok) return [f.id, [] as string[]] as const;
          const d = await r.json();
          return [f.id, graphKinds(d.flow?.graph)] as const;
        } catch { return [f.id, [] as string[]] as const; }
      }));
      if (!cancelled) setFlowKinds(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [flows, headers]);

  const createAndOpen = async () => {
    setCreating(true); setError(null);
    try {
      const res = await fetch('/api/flows', { method: 'POST', headers: headers(), body: JSON.stringify({ name: 'Новый сценарий' }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.flow?.id) { setOpenedNew(true); setEditingId(data.flow.id); } else await load();
    } catch (e: any) { setError(e?.message || 'Ошибка'); }
    finally { setCreating(false); }
  };

  const duplicateFlow = async (f: FlowRow) => {
    setBusyId(f.id); setError(null);
    try {
      const r = await fetch(`/api/flows/${f.id}`, { headers: headers() });
      const d = await r.json();
      const graph = d.flow?.graph;
      const cr = await fetch('/api/flows', { method: 'POST', headers: headers(), body: JSON.stringify({ name: `${f.name} (копия)`, channelType: f.channel_type }) });
      const cd = await cr.json();
      if (!cr.ok) throw new Error(cd.error || `HTTP ${cr.status}`);
      if (cd.flow?.id && graph) {
        await fetch(`/api/flows/${cd.flow.id}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ graph }) });
      }
      await load();
    } catch (e: any) { setError(e?.message || 'Ошибка'); }
    finally { setBusyId(null); }
  };

  const toggleActive = async (f: FlowRow) => {
    setBusyId(f.id); setError(null);
    try {
      const next = f.status === 'active' ? 'draft' : 'active';
      const res = await fetch(`/api/flows/${f.id}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ status: next, ...(next === 'active' ? { isDefault: true } : {}) }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || `HTTP ${res.status}`); }
      await load();
    } catch (e: any) { setError(e?.message || 'Ошибка'); }
    finally { setBusyId(null); }
  };

  const doDelete = async (id: string) => {
    setBusyId(id); setError(null);
    try {
      const res = await fetch(`/api/flows/${id}`, { method: 'DELETE', headers: headers() });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.ok === false) throw new Error(d.error || `Не удалось удалить (HTTP ${res.status})`);
      setConfirmDelete(null);
      await load();
    } catch (e: any) { setError(e?.message || 'Ошибка'); }
    finally { setBusyId(null); }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const massDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setMassBusy(true); setError(null);
    try {
      const results = await Promise.all(ids.map(async (id) => {
        try {
          const res = await fetch(`/api/flows/${id}`, { method: 'DELETE', headers: headers() });
          const d = await res.json().catch(() => ({}));
          return res.ok && d.ok !== false;
        } catch { return false; }
      }));
      const failed = results.filter((ok) => !ok).length;
      if (failed > 0) setError(`Не удалось удалить ${failed} из ${ids.length} сценариев`);
      setSelected(new Set());
      setConfirmMass(false);
      await load();
    } finally { setMassBusy(false); }
  };

  const renameFlow = async (id: string) => {
    const name = editName.trim();
    if (!name) { setEditingNameId(null); return; }
    setBusyId(id); setError(null);
    try {
      const res = await fetch(`/api/flows/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify({ name }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `HTTP ${res.status}`);
      setEditingNameId(null);
      await load();
    } catch (e: any) { setError(e?.message || 'Ошибка'); }
    finally { setBusyId(null); }
  };

  // ── Редактор: канвас React Flow (lazy). ──
  if (editingId) {
    return (
      <React.Suspense fallback={<div className="py-12 text-center"><Loader2 size={22} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>}>
        <MontageEditor flowId={editingId} isNew={openedNew} onBack={() => { setEditingId(null); setOpenedNew(false); load(); }} />
      </React.Suspense>
    );
  }

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="max-w-[1760px] mx-auto py-2 sm:py-3 space-y-5">
      <div className="flex items-center gap-3">
        <img src="/icons/nav-flow.png" alt="" draggable={false}
             className="w-10 h-10 flex-shrink-0" style={{ objectFit: 'contain' }} />
        <div>
          <h1 className="text-2xl font-700" style={{ color: 'var(--text-primary)' }}>TrendFlow</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Сценарии производства видео. Создайте сценарий и соберите его в редакторе.</p>
        </div>
      </div>

      {error && <AuroraCard className="p-3"><p className="text-sm" style={{ color: '#ef4444' }}>{error}</p></AuroraCard>}

      {/* Панель массовых действий — появляется при ≥1 выбранной карточке */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 flex-wrap rounded-xl px-3 py-2"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-cyan)' }}>
          <span className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>Выбрано: {selected.size}</span>
          {selected.size < flows.length && (
            <button type="button" onClick={() => setSelected(new Set(flows.map((f) => f.id)))}
              className="px-2.5 py-1 rounded-lg text-xs font-600 transition-colors hover:bg-[var(--bg-tertiary)]"
              style={{ background: 'transparent', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
              Выбрать все ({flows.length})
            </button>
          )}
          <button type="button" onClick={() => setSelected(new Set())}
            className="px-2.5 py-1 rounded-lg text-xs font-600 transition-colors hover:bg-[var(--bg-tertiary)]"
            style={{ background: 'transparent', border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Снять выделение
          </button>
          <div className="flex-1" />
          <button type="button" onClick={() => setConfirmMass(true)} disabled={massBusy}
            className="px-3 py-1.5 rounded-lg text-xs font-700 flex items-center gap-1.5 transition-opacity hover:opacity-90"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', cursor: massBusy ? 'wait' : 'pointer' }}>
            {massBusy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            Удалить ({selected.size})
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center"><Loader2 size={24} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
          {/* Создать сценарий */}
          <button type="button" onClick={createAndOpen} disabled={creating}
            className="rounded-2xl flex flex-col items-center justify-center gap-3 min-h-[248px] transition-colors hover:border-[var(--border-stronger)]"
            style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border-strong)', color: 'var(--text-secondary)', cursor: creating ? 'wait' : 'pointer' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ border: '1px solid var(--border-strong)' }}>
              {creating ? <Loader2 size={24} className="animate-spin" /> : <Plus size={26} />}
            </div>
            <span className="text-sm font-600">Создать сценарий</span>
          </button>

          {/* Карточки сценариев */}
          {flows.map((f) => (
            <div key={f.id}
              onClick={() => {
                if (selected.size > 0) { toggleSelect(f.id); return; } // режим выделения: клик = выбрать
                setOpenedNew(false); setEditingId(f.id);
              }}
              role="button" tabIndex={0}
              className="rounded-2xl overflow-hidden flex flex-col transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer"
              style={{
                background: 'var(--bg-secondary)',
                border: selected.has(f.id) ? '1px solid var(--accent-cyan)' : '1px solid var(--border-medium)',
                boxShadow: selected.has(f.id) ? '0 0 0 1px var(--accent-cyan)' : 'none',
              }}>
              {/* Шапка: название + ✎ + статус + дата+время + иконки действий */}
              <div className="px-3 pt-3 pb-2 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {editingNameId === f.id ? (
                    <div className="flex items-center gap-1" onClick={stop}>
                      <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') renameFlow(f.id); if (e.key === 'Escape') setEditingNameId(null); }}
                        className="px-2 py-1 rounded text-sm outline-none min-w-0 flex-1"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)' }} />
                      <button onClick={() => renameFlow(f.id)} title="Сохранить" style={{ color: '#10b981', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}><Check size={15} /></button>
                      <button onClick={() => setEditingNameId(null)} title="Отмена" style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 2 }}><X size={15} /></button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-700 truncate" style={{ color: 'var(--text-primary)' }} title={f.name}>{f.name}</span>
                      <button onClick={(e) => { stop(e); setEditingNameId(f.id); setEditName(f.name); }} title="Переименовать"
                        style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}><Pencil size={13} /></button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] px-1.5 py-0.5 rounded font-600"
                      style={f.status === 'active'
                        ? { background: 'rgba(16,185,129,0.12)', color: '#10b981' }
                        : { background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                      {f.status === 'active' ? 'Активен' : 'Черновик'}
                    </span>
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{fmtDateTime(f.created_at || f.updated_at)}</span>
                  </div>
                </div>
                {/* Иконки действий прямо на плашке: дублировать / активировать / удалить */}
                <div className="flex items-center" onClick={stop}>
                  {busyId === f.id ? (
                    <span className="w-7 h-7 flex items-center justify-center">
                      <Loader2 size={15} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                    </span>
                  ) : (
                    <>
                      <button onClick={() => duplicateFlow(f)} title="Дублировать" aria-label="Дублировать"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <Copy size={14} />
                      </button>
                      <button onClick={() => toggleActive(f)}
                        title={f.status === 'active' ? 'Сделать черновиком' : 'Активировать'}
                        aria-label={f.status === 'active' ? 'Сделать черновиком' : 'Активировать'}
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ background: 'transparent', border: 'none', color: f.status === 'active' ? 'var(--accent-green)' : 'var(--text-muted)', cursor: 'pointer' }}>
                        <Power size={14} />
                      </button>
                      <button onClick={() => setConfirmDelete(f)} title="Удалить" aria-label="Удалить"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {/* Герой + чекбокс выделения + иконки-бейджи содержимого сверху */}
              <div className="mx-3 mb-3 rounded-xl overflow-hidden" style={{ position: 'relative', aspectRatio: '3 / 4', background: '#2a0a10' }}>
                <img src={HERO} alt="" loading="lazy" className="w-full h-full object-cover"
                  onError={(e) => { const img = e.currentTarget; if (!img.src.endsWith(HERO_FALLBACK)) img.src = HERO_FALLBACK; }} />
                <button type="button" onClick={(e) => { stop(e); toggleSelect(f.id); }}
                  title={selected.has(f.id) ? 'Снять выделение' : 'Выбрать'} aria-label={selected.has(f.id) ? 'Снять выделение' : 'Выбрать'}
                  style={{
                    position: 'absolute', top: 6, right: 6, zIndex: 3, width: 24, height: 24, borderRadius: 7,
                    background: selected.has(f.id) ? 'var(--accent-cyan)' : 'rgba(0,0,0,0.55)',
                    border: selected.has(f.id) ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.3)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  }}>
                  {selected.has(f.id) && <Check size={15} strokeWidth={3} />}
                </button>
                {(flowKinds[f.id]?.length ?? 0) > 0 && (
                  <div style={{ position: 'absolute', top: 6, left: 6, display: 'flex', gap: 4, zIndex: 2 }}>
                    {flowKinds[f.id].map((k) => KIND_BADGE[k] && (
                      <span key={k} title={k} style={{ width: 24, height: 24, borderRadius: 7, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: KIND_BADGE[k].color, border: '1px solid rgba(255,255,255,0.15)' }}>
                        {KIND_BADGE[k].icon}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title="Удалить сценарий?"
        message={confirmDelete ? `«${confirmDelete.name}» будет удалён безвозвратно.` : ''}
        confirmLabel="Удалить"
        variant="danger"
        onConfirm={() => confirmDelete && doDelete(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmModal
        open={confirmMass}
        title={`Удалить выбранные сценарии (${selected.size})?`}
        message="Выбранные сценарии будут удалены безвозвратно."
        confirmLabel={`Удалить (${selected.size})`}
        variant="danger"
        onConfirm={massDelete}
        onCancel={() => setConfirmMass(false)}
      />
    </div>
  );
}
