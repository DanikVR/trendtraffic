/**
 * TrendFlow — список сценариев производства видео карточками (форк бывшей FlowPage).
 *
 *  • Карточка «+ Создать сценарий» → создаёт флоу и сразу открывает редактор.
 *  • Карточка сценария целиком кликабельна → открывает редактор.
 *  • На карточке: название (инлайн-переименование ✎), дата, ⋯-меню
 *    (дублировать / статус черновик↔активен / удалить), крупный брендовый герой.
 *  • Редактор (FlowCanvas) пока без изменений — переориентируем его под монтажные
 *    блоки на следующем этапе.
 *
 * Бот-канальные карточки (IG/TikTok/Messenger/аналитика) убраны — для монтажных
 * сценариев они не нужны.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Check, X, MoreVertical, Copy, Trash2, Power, Loader2, Mic, Cloud, Film } from 'lucide-react';
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
  updated_at?: string;
}

const menuItem: React.CSSProperties = {
  background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left',
};

function fmtDate(iso?: string): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FlowRow | null>(null);
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
            <div key={f.id} onClick={() => { setOpenedNew(false); setEditingId(f.id); }} role="button" tabIndex={0}
              className="rounded-2xl overflow-hidden flex flex-col transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)' }}>
              {/* Шапка: название + ✎ + статус + дата + ⋯ */}
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
                    <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{fmtDate(f.updated_at)}</span>
                  </div>
                </div>
                {/* ⋯ меню */}
                <div style={{ position: 'relative' }} onClick={stop}>
                  <button onClick={() => setOpenMenuId(openMenuId === f.id ? null : f.id)} title="Действия" aria-label="Действия"
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]"
                    style={{ background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    {busyId === f.id ? <Loader2 size={15} className="animate-spin" /> : <MoreVertical size={16} />}
                  </button>
                  {openMenuId === f.id && (
                    <>
                      <div onClick={() => setOpenMenuId(null)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                      <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, zIndex: 50, minWidth: 184, background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                        <button onClick={() => { setOpenMenuId(null); duplicateFlow(f); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-tertiary)]" style={menuItem}><Copy size={14} /> Дублировать</button>
                        <button onClick={() => { setOpenMenuId(null); toggleActive(f); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-tertiary)]" style={menuItem}><Power size={14} /> {f.status === 'active' ? 'Сделать черновиком' : 'Активировать'}</button>
                        <button onClick={() => { setOpenMenuId(null); setConfirmDelete(f); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--bg-tertiary)]" style={{ ...menuItem, color: '#ef4444' }}><Trash2 size={14} /> Удалить</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {/* Герой + иконки-бейджи содержимого сверху */}
              <div className="mx-3 mb-3 rounded-xl overflow-hidden" style={{ position: 'relative', aspectRatio: '3 / 4', background: '#2a0a10' }}>
                <img src={HERO} alt="" loading="lazy" className="w-full h-full object-cover"
                  onError={(e) => { const img = e.currentTarget; if (!img.src.endsWith(HERO_FALLBACK)) img.src = HERO_FALLBACK; }} />
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
    </div>
  );
}
