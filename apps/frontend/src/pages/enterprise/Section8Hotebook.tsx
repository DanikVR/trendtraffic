/**
 * Section8Hotebook — Enterprise-настройки блока «Hotebook» (Google NotebookLM).
 *
 * Подключение ПЕР-ТЕНАНТНОЕ: у каждого Enterprise-аккаунта свой Google-аккаунт
 * (профиль = tenantId на воркере), свои лимиты и блокноты. Здесь:
 *  - статус синхронизации (тот же, что питает плашку в блоке): ok / auth /
 *    api_changed / quota / offline / not_configured + почта аккаунта;
 *  - кнопка «Проверить подключение» (живой вызов NotebookLM через воркер);
 *  - импорт сессии: вставить свой storage_state.json — доступно любому Enterprise;
 *  - кнопка «Открыть окно входа Google» (Chromium на машине воркера) — только
 *    superadmin, чья это машина; клиенты подключаются вставкой сессии;
 *  - счётчики генераций за сегодня.
 *
 * Рекомендуется ОТДЕЛЬНЫЙ Google-аккаунт с планом Google AI (лимиты — суточные, на аккаунт).
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen, Loader2, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  KeyRound, Upload, Info, X, MonitorSmartphone,
} from 'lucide-react';
import { AuroraCard } from '../../components/AuroraCard';
import { AuroraButton } from '../../components/AuroraButton';
import { useAppStore } from '../../store/useAppStore';

interface HbConnStatus {
  configured: boolean;
  ok: boolean;
  errorKind: string | null;
  email?: string | null;
  error?: string | null;
  checkedAt?: string;
}

const KIND_TITLE: Record<string, string> = {
  auth: 'Синхронизация с Google нарушена — сессия аккаунта истекла',
  api_changed: 'Google изменил внутренний API NotebookLM — идёт рассинхронизация',
  quota: 'Суточный лимит Google-аккаунта исчерпан',
  offline: 'Hotebook-воркер недоступен',
  not_configured: 'Hotebook-воркер не настроен',
  network: 'Сбой сети между воркером и Google',
};
const KIND_BODY: Record<string, string> = {
  auth: 'Переподключите аккаунт: выполните «notebooklm login» у себя и вставьте свежий storage_state.json ниже (суперадмин может нажать «Открыть окно входа»).',
  api_changed: 'Обычно лечится обновлением библиотеки: на воркере выполните «pip install -U notebooklm-py» и перезапустите сервис.',
  quota: 'Генерации возобновятся после сброса лимита (обычно на следующий день). Либо повысите план Google AI на аккаунте.',
  offline: 'Включите машину воркера и проверьте Tailscale. Сервис: systemctl status trendtraffic-notebooklm.',
  not_configured: 'Задайте NOTEBOOKLM_WORKER_URL (адрес воркера по Tailscale, порт 8801) в админ-панели или .env бэкенда и перезапустите его.',
  network: 'Проверьте интернет на машине воркера.',
};

export function Section8Hotebook() {
  const { token, user } = useAppStore();
  const isSuperadmin = user?.role === 'superadmin';
  const headers = (): HeadersInit => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) });

  const [status, setStatus] = useState<HbConnStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [counters, setCounters] = useState<Record<string, number>>({});
  const [ssInput, setSsInput] = useState('');
  const [importing, setImporting] = useState(false);
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

  /** Открыть окно входа Google на машине воркера (Chromium через WSLg) — вход в 2 клика отсюда. */
  const [loginOpening, setLoginOpening] = useState(false);
  const doLoginWindow = async () => {
    if (loginOpening) return;
    setLoginOpening(true); setNote(null);
    try {
      const r = await fetch('/api/notebooklm/auth/login-window', { method: 'POST', headers: headers() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Ошибка ${r.status}`);
      setNote({ ok: true, text: 'Окно Chromium открыто на машине воркера — войдите в Google-аккаунт, затем нажмите «Проверить подключение».' });
    } catch (e: any) { setNote({ ok: false, text: e?.message || 'Не удалось открыть окно входа' }); }
    finally { setLoginOpening(false); }
  };

  // ── Потоковое окно входа Google прямо в приложении (без файла, без установок) ──
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginW, setLoginW] = useState(1100);
  const [loginH, setLoginH] = useState(760);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginMsg, setLoginMsg] = useState<string | null>(null);
  const loginSidRef = useRef<string | null>(null);
  const frameUrlRef = useRef<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const timersRef = useRef<{ frame?: number; poll?: number }>({});
  const moveTsRef = useRef(0);

  const stopLoginLoops = () => {
    if (timersRef.current.frame) { clearInterval(timersRef.current.frame); timersRef.current.frame = undefined; }
    if (timersRef.current.poll) { clearInterval(timersRef.current.poll); timersRef.current.poll = undefined; }
    if (frameUrlRef.current) { URL.revokeObjectURL(frameUrlRef.current); frameUrlRef.current = null; }
  };
  const closeLogin = async (silent = false) => {
    stopLoginLoops();
    const sid = loginSidRef.current; loginSidRef.current = null;
    setLoginOpen(false);
    if (sid && !silent) {
      try { await fetch(`/api/notebooklm/auth/login-remote/stop?sid=${encodeURIComponent(sid)}`, { method: 'POST', headers: headers() }); } catch { /* ok */ }
    }
  };
  const sendInput = (payload: any) => {
    const sid = loginSidRef.current;
    if (!sid) return;
    // fire-and-forget; ошибки ввода не критичны
    void fetch(`/api/notebooklm/auth/login-remote/input?sid=${encodeURIComponent(sid)}`, {
      method: 'POST', headers: headers(), body: JSON.stringify(payload),
    }).catch(() => {});
  };
  const scaleCoords = (e: React.MouseEvent) => {
    const el = imgRef.current; if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    return { x: (e.clientX - r.left) * (loginW / r.width), y: (e.clientY - r.top) * (loginH / r.height) };
  };
  const onFrameMove = (e: React.MouseEvent) => {
    const now = Date.now(); if (now - moveTsRef.current < 60) return; moveTsRef.current = now;
    const c = scaleCoords(e); if (c) sendInput({ kind: 'move', x: c.x, y: c.y });
  };
  const onFrameClick = (e: React.MouseEvent) => { const c = scaleCoords(e); if (c) sendInput({ kind: 'click', x: c.x, y: c.y }); };
  const onFrameWheel = (e: React.WheelEvent) => { sendInput({ kind: 'scroll', dy: e.deltaY }); };

  const startRemoteLogin = async () => {
    if (loginBusy) return;
    setLoginBusy(true); setNote(null); setLoginMsg('Запускаю окно входа…');
    try {
      const r = await fetch('/api/notebooklm/auth/login-remote/start', { method: 'POST', headers: headers() });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Ошибка ${r.status}`);
      loginSidRef.current = d.sessionId;
      setLoginW(d.width || 1100); setLoginH(d.height || 760);
      setLoginOpen(true); setLoginMsg('Войдите в свой Google-аккаунт в окне ниже.');
      // Поток кадров: тянем JPEG с авторизацией → objectURL в <img>.
      const pull = async () => {
        const sid = loginSidRef.current; if (!sid) return;
        try {
          const fr = await fetch(`/api/notebooklm/auth/login-remote/frame?sid=${encodeURIComponent(sid)}`, { headers: headers() });
          if (fr.ok) {
            const blob = await fr.blob();
            const u = URL.createObjectURL(blob);
            if (imgRef.current) imgRef.current.src = u;
            if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
            frameUrlRef.current = u;
          }
        } catch { /* кадр пропущен */ }
      };
      timersRef.current.frame = window.setInterval(pull, 260);
      void pull();
      // Поллинг готовности входа.
      timersRef.current.poll = window.setInterval(async () => {
        const sid = loginSidRef.current; if (!sid) return;
        try {
          const pr = await fetch(`/api/notebooklm/auth/login-remote/poll?sid=${encodeURIComponent(sid)}`, { headers: headers() });
          const pd = await pr.json().catch(() => ({}));
          if (pd?.done) {
            await closeLogin(true);
            if (pd.ok) {
              setStatus(pd.status || null);
              setNote({ ok: true, text: `Google-аккаунт подключён${pd.email ? ` (${pd.email})` : ''} — синхронизация работает.` });
              void loadCounters();
            } else {
              setNote({ ok: false, text: pd.error || 'Вход не завершился. Попробуйте ещё раз.' });
            }
          }
        } catch { /* повторим на следующем тике */ }
      }, 1600);
    } catch (e: any) {
      setNote({ ok: false, text: e?.message || 'Не удалось открыть окно входа' });
      setLoginOpen(false);
    } finally { setLoginBusy(false); }
  };

  // Клавиатура окна входа: печатаем в удалённый браузер, пока модалка открыта.
  useEffect(() => {
    if (!loginOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (!loginSidRef.current) return;
      const NAMED: Record<string, string> = {
        Enter: 'Enter', Backspace: 'Backspace', Tab: 'Tab', Delete: 'Delete', Escape: 'Escape',
        ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
        Home: 'Home', End: 'End',
      };
      if (e.key.length === 1) { e.preventDefault(); sendInput({ kind: 'char', text: e.key }); }
      else if (NAMED[e.key]) { e.preventDefault(); sendInput({ kind: 'key', key: NAMED[e.key] }); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginOpen]);
  // Уборка при размонтировании секции.
  useEffect(() => () => { stopLoginLoops(); if (loginSidRef.current) { void fetch(`/api/notebooklm/auth/login-remote/stop?sid=${encodeURIComponent(loginSidRef.current)}`, { method: 'POST', headers: headers() }).catch(() => {}); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const doImport = async () => {
    const raw = ssInput.trim();
    if (!raw || importing) return;
    setImporting(true); setNote(null);
    try {
      let parsed: any;
      try { parsed = JSON.parse(raw); } catch { throw new Error('Это не JSON. Вставьте содержимое файла storage_state.json целиком.'); }
      const r = await fetch('/api/notebooklm/auth/import', { method: 'POST', headers: headers(), body: JSON.stringify({ storageState: parsed }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Ошибка ${r.status}`);
      setStatus(d.status || null);
      setSsInput('');
      setNote(d.status?.ok ? { ok: true, text: 'Google-аккаунт подключён — синхронизация работает.' } : { ok: false, text: 'Куки записаны, но сессия не подтвердилась. Проверьте, что файл свежий.' });
    } catch (e: any) { setNote({ ok: false, text: e?.message || 'Не удалось импортировать' }); }
    finally { setImporting(false); }
  };

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
            <h3 className="text-base font-700" style={{ color: 'var(--text-primary)' }}>Hotebook — подключение Google (NotebookLM)</h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Ваш личный Google-аккаунт для блока «Hotebook». У каждого Enterprise-аккаунта своё подключение и свои лимиты.
            </p>
          </div>
          {status && (
            status.ok ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-700 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                <CheckCircle2 size={14} /> Подключено{status.email ? ` · ${status.email}` : ''}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-700 px-2.5 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>
                <XCircle size={14} /> {kind === 'not_configured' ? 'Не настроено' : 'Нет синхронизации'}
              </span>
            )
          )}
          <AuroraButton variant="secondary" onClick={() => { void loadStatus(true); void loadCounters(); }} disabled={checking}
            icon={checking ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}>
            Проверить подключение
          </AuroraButton>
        </div>

        {/* Плашка синхронизации — та же логика, что в блоке Hotebook сценария */}
        {status && !status.ok && (
          <div className="rounded-xl p-3.5 flex items-start gap-2.5 mb-3" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.45)' }}>
            <AlertTriangle size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
            <div className="min-w-0">
              <div className="text-sm font-700" style={{ color: '#f59e0b' }}>{KIND_TITLE[kind] || 'Синхронизация не работает'}</div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{KIND_BODY[kind] || status.error || ''}</p>
              {status.error && KIND_BODY[kind] && <p className="text-[11px] mt-1 opacity-70" style={{ color: 'var(--text-muted)' }}>Техподробности: {status.error}</p>}
            </div>
          </div>
        )}

        {status?.checkedAt && (
          <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
            Последняя проверка: {new Date(status.checkedAt).toLocaleString('ru-RU')} · Сегодня генераций: {totalToday}
            {totalToday > 0 && ` (${Object.entries(counters).map(([k, v]) => `${k}: ${v}`).join(', ')})`}
          </p>
        )}
      </AuroraCard>

      {/* Как подключить аккаунт */}
      <AuroraCard className="p-5">
        <h4 className="text-sm font-700 mb-2 inline-flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <KeyRound size={15} style={{ color: '#22d3ee' }} /> Как подключить / переподключить Google-аккаунт
        </h4>
        {/* Главный путь для ЛЮБОГО клиента: вход прямо в окне приложения, без файла и установок. */}
        <div className="rounded-xl p-3.5 mb-3 flex items-center gap-3 flex-wrap" style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.12), rgba(34,211,238,0.05))', border: '1px solid rgba(34,211,238,0.45)' }}>
          <AuroraButton onClick={() => void startRemoteLogin()} disabled={loginBusy}
            icon={loginBusy ? <Loader2 size={15} className="animate-spin" /> : <MonitorSmartphone size={15} />}>
            Подключить Google
          </AuroraButton>
          <p className="text-[11px] flex-1 min-w-[220px]" style={{ color: 'var(--text-secondary)' }}>
            <b>Рекомендуемый способ:</b> откроется окно входа прямо здесь — войдите в свой Google-аккаунт как обычно.
            Ничего скачивать, устанавливать или вставлять не нужно. Сессия сохранится только в вашем аккаунте.
          </p>
        </div>
        {/* Окно входа на машине воркера — только суперадмину (его ПК = воркер). */}
        {isSuperadmin && (
          <div className="rounded-xl p-3.5 mb-3 flex items-center gap-3 flex-wrap" style={{ background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.3)' }}>
            <AuroraButton onClick={() => void doLoginWindow()} disabled={loginOpening}
              icon={loginOpening ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} />}>
              Открыть окно входа Google
            </AuroraButton>
            <p className="text-[11px] flex-1 min-w-[220px]" style={{ color: 'var(--text-secondary)' }}>
              <b>Только для вас (суперадмин):</b> окно Chromium появится на экране машины воркера (домашний ПК).
              Войдите в Google — и нажмите «Проверить подключение» выше. Клиенты подключают аккаунт вставкой сессии (ниже).
            </p>
          </div>
        )}
        <p className="text-xs mb-2 font-600" style={{ color: 'var(--text-secondary)' }}>
          Запасной способ (если окно входа не подходит) — вставить файл сессии:
        </p>
        <ol className="text-xs space-y-1.5 mb-4 list-decimal list-inside" style={{ color: 'var(--text-secondary)' }}>
          <li>На своём компьютере установите клиент: <code className="px-1 rounded" style={{ background: 'var(--bg-tertiary)' }}>pip install "notebooklm-py[browser]"</code></li>
          <li>Выполните <code className="px-1 rounded" style={{ background: 'var(--bg-tertiary)' }}>notebooklm login</code> — откроется браузер, войдите в свой Google-аккаунт.</li>
          <li>Откройте файл <code className="px-1 rounded" style={{ background: 'var(--bg-tertiary)' }}>~/.notebooklm/profiles/default/storage_state.json</code> и вставьте его содержимое ниже.</li>
        </ol>
        <div className="rounded-xl p-3 mb-3 flex items-start gap-2" style={{ background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.25)' }}>
          <Info size={14} style={{ color: '#22d3ee', flexShrink: 0, marginTop: 1 }} />
          <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            Это <b>ваш</b> аккаунт с <b>вашими</b> лимитами и блокнотами — они не пересекаются с другими клиентами.
            Рекомендуется отдельный Google-аккаунт (библиотека работает через недокументированный API);
            суточные лимиты NotebookLM (аудио/видео/чат) считаются на аккаунт — для активной работы включите план Google AI (Plus/Pro/Ultra).
          </p>
        </div>
        <textarea value={ssInput} onChange={(e) => setSsInput(e.target.value)} rows={5}
          placeholder='Вставьте JSON целиком: {"cookies":[{"name":"SID",...}], ...}'
          className="w-full px-3 py-2.5 rounded-xl text-xs outline-none resize-y mb-2 font-mono"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }} />
        <div className="flex items-center gap-3 flex-wrap">
          <AuroraButton onClick={() => void doImport()} disabled={importing || !ssInput.trim()}
            icon={importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}>
            Подключить мой аккаунт
          </AuroraButton>
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Сессия применяется только к вашему Enterprise-аккаунту.</span>
        </div>
        {note && (
          <p className="text-xs mt-2 inline-flex items-center gap-1.5" style={{ color: note.ok ? '#10b981' : '#ef4444' }}>
            {note.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {note.text}
          </p>
        )}
      </AuroraCard>

      {/* Модалка потокового окна входа Google — интерактивный браузер прямо в приложении. */}
      {loginOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
          <div style={{ width: '100%', maxWidth: loginW + 40, background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 16, padding: 14 }}>
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-2 text-sm font-700" style={{ color: 'var(--text-primary)' }}>
                <MonitorSmartphone size={16} style={{ color: '#22d3ee' }} /> Вход в Google (NotebookLM)
              </span>
              <button onClick={() => void closeLogin()} title="Закрыть" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <p className="text-[11px] mb-2 inline-flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Info size={12} style={{ color: '#22d3ee' }} /> {loginMsg || 'Войдите как в обычном окне браузера. По завершении окно закроется само.'}
            </p>
            {/* Кадр удалённого браузера: клики/движения/колесо/клавиатура пробрасываются. */}
            <div style={{ position: 'relative', width: '100%', aspectRatio: `${loginW} / ${loginH}`, background: '#000', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-medium)' }}>
              <img ref={imgRef} alt="Окно входа Google" draggable={false}
                onMouseMove={onFrameMove} onClick={onFrameClick} onWheel={onFrameWheel}
                style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'crosshair', userSelect: 'none' }} />
              <div className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                <Loader2 size={10} className="animate-spin" /> прямой эфир
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Кликайте и печатайте прямо в кадре. Изображение может обновляться с небольшой задержкой.
              </span>
              <button onClick={() => void closeLogin()} className="text-xs font-600 px-3 py-1.5 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-medium)', cursor: 'pointer' }}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Section8Hotebook;
