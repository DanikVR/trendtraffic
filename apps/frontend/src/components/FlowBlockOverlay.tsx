/**
 * FlowBlockOverlay — блок TrendFlow (облако) ПОВЕРХ текущего экрана.
 *
 * Галерея = главный экран: блоки (Omni Flash, Hotebook, Google Flow, UGC, Редактор)
 * открываются оверлеем, НЕ уходя со страницы. Закрытие (кнопка «Назад» редактора)
 * возвращает ровно туда, откуда пришли: в тот же раздел Галереи или в просмотрщик видео.
 *
 * Выбор сценария:
 *  - src задан (видео из просмотрщика → Omni Flash) — создаётся НОВЫЙ сценарий
 *    с graph.source = {url, name, assetId};
 *  - иначе — последний сценарий тенанта (flows отсортированы по updated_at DESC),
 *    а если сценариев нет — создаётся новый.
 *
 * MontageEditor грузится лениво (динамический import) — это разрывает статический
 * цикл VideoViewer → FlowBlockOverlay → MontageEditor → VideoViewer.
 */

import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const MontageEditor = React.lazy(() => import('../pages/flow/MontageEditor'));

export interface FlowBlockRequest {
  cloud: 'omni' | 'plan' | 'editor' | 'ugc' | 'hotebook' | 'flow';
  /** Видео-источник (Omni Flash из просмотрщика): новый сценарий с этим graph.source. */
  src?: string;
  srcName?: string;
  srcAssetId?: string;
}

export function FlowBlockOverlay({ req, onClose }: { req: FlowBlockRequest; onClose: () => void }) {
  const token = useAppStore((s) => s.token);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Блокируем скролл фона, пока оверлей открыт (у него свой overflow-y).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const headers: HeadersInit = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    (async () => {
      try {
        let id: string | null = null;
        if (req.src) {
          const flowName = (req.srcName ? `${req.cloud === 'omni' ? 'Omni Flash' : 'Сценарий'} — ${req.srcName}` : 'Новый сценарий').slice(0, 120);
          const cr = await fetch('/api/flows', { method: 'POST', headers, body: JSON.stringify({ name: flowName }) });
          const cd = await cr.json();
          if (!cr.ok) throw new Error(cd.error || `HTTP ${cr.status}`);
          id = cd.flow?.id || null;
          if (id) {
            await fetch(`/api/flows/${id}`, {
              method: 'PUT', headers,
              body: JSON.stringify({ graph: { source: { url: req.src, name: req.srcName || 'Видео', ...(req.srcAssetId ? { assetId: req.srcAssetId } : {}) } } }),
            });
          }
        } else {
          const r = await fetch('/api/flows', { headers });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
          id = (d.flows || [])[0]?.id || null;
          if (!id) {
            const cr = await fetch('/api/flows', { method: 'POST', headers, body: JSON.stringify({ name: 'Новый сценарий' }) });
            const cd = await cr.json();
            if (!cr.ok) throw new Error(cd.error || `HTTP ${cr.status}`);
            id = cd.flow?.id || null;
          }
        }
        if (!cancelled) {
          if (id) setFlowId(id); else setErr('Не удалось открыть блок.');
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || 'Не удалось открыть блок.');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const spinner = (
    <div className="py-24 text-center">
      <Loader2 size={26} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[140] overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-[1760px] mx-auto px-3 sm:px-6 py-2">
        {err ? (
          <div className="py-20 text-center space-y-4">
            <p className="text-sm" style={{ color: '#ef4444' }}>{err}</p>
            <button type="button" onClick={onClose}
              className="text-sm font-600 px-4 py-2 rounded-xl"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
              Назад
            </button>
          </div>
        ) : !flowId ? spinner : (
          <React.Suspense fallback={spinner}>
            <MontageEditor key={flowId} flowId={flowId} initialCloud={req.cloud} onBack={onClose} />
          </React.Suspense>
        )}
      </div>
    </div>
  );
}

export default FlowBlockOverlay;
