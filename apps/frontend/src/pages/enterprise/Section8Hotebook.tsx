/**
 * Section8Hotebook — Enterprise-настройки блока «Hotebook» (Google NotebookLM).
 *
 * Подключение ПЕР-ТЕНАНТНОЕ через единое Chrome-расширение TrendTraffic
 * (apps/trendtraffic-extension). Сервера-воркера (домашний ПК) больше нет —
 * автоматизация идёт в реальном браузере пользователя под его живым входом в Google.
 * Здесь:
 *  - статус синхронизации (тот же, что питает плашку в блоке): ok / ext_offline / ext_login;
 *  - как подключить: установить расширение (Настройки → «Генерация») + войти в
 *    notebooklm.google.com в том же браузере;
 *  - счётчики генераций за сегодня.
 */

import React, { useEffect, useState } from 'react';
import {
  BookOpen, Loader2, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Info, ExternalLink, Download, Puzzle,
} from 'lucide-react';
import { AuroraCard } from '../../components/AuroraCard';
import { AuroraButton } from '../../components/AuroraButton';
import { useAppStore } from '../../store/useAppStore';
import { TT_EXT_VERSION } from '../../components/AppVersion';

interface HbConnStatus {
  configured: boolean;
  ok: boolean;
  errorKind: string | null;
  email?: string | null;
  error?: string | null;
  checkedAt?: string;
}

const KIND_TITLE: Record<string, string> = {
  ext_offline: 'Расширение Hotebook не на связи',
  ext_login: 'Нужен вход в Google (NotebookLM)',
  error: 'Синхронизация не работает',
};
const KIND_BODY: Record<string, string> = {
  ext_offline: 'Установите единое расширение TrendTraffic (Настройки → вкладка «Генерация») и держите открытой вкладку notebooklm.google.com в том же браузере, где вы залогинены в TrendTraffic. Расширение подключается автоматически.',
  ext_login: 'Расширение на связи, но вход в notebooklm.google.com не выполнен. Откройте сайт и войдите в свой Google-аккаунт — статус обновится сам.',
  error: 'Проверьте, что расширение установлено и вкладка NotebookLM открыта, затем нажмите «Проверить».',
};

export function Section8Hotebook() {
  const { token } = useAppStore();
  const headers = (): HeadersInit => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });

  const [status, setStatus] = useState<HbConnStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [counters, setCounters] = useState<Record<string, number>>({});
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const loadStatus = async (force = false) => {
    setChecking(true);
    try {
      const r = await fetch(`/api/notebooklm/status${force ? '?force=1' : ''}`, { headers: headers() });
      const d = await r.json().catch(() => ({}));
      if (r.ok) setStatus(d.status || null);
      else setNote({ ok: false, text: d.error || `Ошибка ${r.status}` });
    } catch { setNote({ ok: false, text: 'Бэкенд недоступен' }); }
    finally { setChecking(false); }
  };
  const loadCounters = async () => {
    try {
      const r = await fetch('/api/notebooklm/counters', { headers: headers() });
      if (r.ok) setCounters((await r.json()).counters || {});
    } catch { /* не критично */ }
  };
  useEffect(() => { void loadStatus(); void loadCounters(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const kind = status?.errorKind || '';
  const totalToday = Object.values(counters).reduce((s, n) => s + (n || 0), 0);

  return (
    <div className="space-y-4">
      {/* Статус подключения */}
      <AuroraCard className="p-5">
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <span className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(34,211,238,0.12)', color: '#22d3ee' }}>
            <BookOpen size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-700" style={{ color: 'var(--text-primary)' }}>Hotebook — подключение через расширение</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Работает через единое Chrome-расширение TrendTraffic в вашем браузере под вашим входом в Google. У каждого Enterprise-аккаунта своё подключение и свои лимиты.
            </p>
          </div>
          {status && (
            status.ok ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-700 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                <CheckCircle2 size={14} /> Подключено
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-700 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
                <XCircle size={14} /> {kind === 'ext_offline' ? 'Расширение офлайн' : kind === 'ext_login' ? 'Нужен вход' : 'Нет синхронизации'}
              </span>
            )
          )}
          <AuroraButton variant="secondary" onClick={() => { void loadStatus(true); void loadCounters(); }} disabled={checking}
            icon={checking ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}>
            Проверить
          </AuroraButton>
        </div>

        {/* Плашка синхронизации — та же логика, что в блоке Hotebook сценария */}
        {status && !status.ok && (
          <div className="rounded-xl p-3.5 flex items-start gap-2.5 mb-3" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.45)' }}>
            <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
            <div className="min-w-0">
              <div className="text-sm font-700" style={{ color: '#f59e0b' }}>{KIND_TITLE[kind] || 'Синхронизация не работает'}</div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{KIND_BODY[kind] || status.error || ''}</p>
            </div>
          </div>
        )}

        {status?.checkedAt && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Последняя проверка: {new Date(status.checkedAt).toLocaleString('ru-RU')} · Сегодня генераций: {totalToday}
            {totalToday > 0 && ` (${Object.entries(counters).map(([k, v]) => `${k}: ${v}`).join(', ')})`}
          </p>
        )}
        {note && (
          <p className="text-xs mt-2 inline-flex items-center gap-1.5" style={{ color: note.ok ? '#10b981' : '#ef4444' }}>
            {note.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {note.text}
          </p>
        )}
      </AuroraCard>

      {/* Как подключить */}
      <AuroraCard className="p-5">
        <h4 className="text-sm font-700 mb-3 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Puzzle size={15} style={{ color: '#22d3ee' }} /> Как подключить (один раз)
        </h4>
        <ol className="text-xs space-y-2 mb-4 list-decimal list-inside" style={{ color: 'var(--text-secondary)' }}>
          <li>
            Установите единое расширение TrendTraffic (v{TT_EXT_VERSION}) — оно на вкладке
            <b> «Генерация»</b> этих настроек, кнопка «Скачать расширение». Оно же обслуживает блок «Google Flow».
          </li>
          <li>Откройте <b>notebooklm.google.com</b> и войдите в свой Google-аккаунт (как обычно в браузере).</li>
          <li>Справа снизу появится панель <b>«TrendTraffic → Hotebook»</b>. Когда «бежит лента» — подключено и работает.</li>
          <li>Держите эту вкладку NotebookLM открытой во время работы блока (источники/чат/генерации выполняются в ней).</li>
        </ol>
        <div className="flex items-center gap-2 flex-wrap">
          <a href="/trendtraffic-extension.zip" download
            className="inline-flex items-center gap-2 text-[13px] font-700 px-4 py-2 rounded-xl"
            style={{ background: '#22d3ee', color: '#062730', textDecoration: 'none' }}>
            <Download size={15} /> Скачать расширение
          </a>
          <button onClick={() => window.open('https://notebooklm.google.com', '_blank', 'noopener')}
            className="inline-flex items-center gap-1.5 text-[13px] font-600 px-3 py-2 rounded-xl"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>
            <ExternalLink size={15} /> Открыть NotebookLM
          </button>
        </div>
        <div className="rounded-xl p-3 mt-3 flex items-start gap-2" style={{ background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.25)' }}>
          <Info size={14} style={{ color: '#22d3ee', flexShrink: 0, marginTop: 1 }} />
          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            Это <b>ваш</b> Google-аккаунт с <b>вашими</b> лимитами и блокнотами — они не пересекаются с другими клиентами.
            Рекомендуется отдельный аккаунт с планом Google AI (Plus/Pro/Ultra): суточные лимиты NotebookLM (аудио/видео/чат)
            считаются на аккаунт. Платформа <b>не хранит</b> ваши Google-куки — вход остаётся в вашем браузере.
          </p>
        </div>
      </AuroraCard>
    </div>
  );
}

export default Section8Hotebook;
