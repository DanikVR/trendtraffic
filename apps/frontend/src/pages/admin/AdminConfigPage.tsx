import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server,
  Key,
  Bot,
  Save,
  ShieldAlert,
  CheckCircle,
  Loader2,
  Check,
  AlertCircle,
  Terminal,
  CreditCard,
  Gauge,
  TrendingUp,
} from 'lucide-react';
import { AuroraCard } from '../../components/AuroraCard';
import { AuroraButton } from '../../components/AuroraButton';
import { AuroraInput } from '../../components/AuroraInput';
import { useAppStore } from '../../store/useAppStore';

type ServiceType = 'livekit' | 'telegram' | 'google' | 'googleOAuth' | 'stripe' | 'tikhub';

interface TestResult {
  status: 'idle' | 'testing' | 'success' | 'error';
  message: string;
  steps: string[];
}

export default function AdminConfigPage() {
  const navigate = useNavigate();
  const { logout, token } = useAppStore();

  const [livekitUrl,     setLivekitUrl]     = useState('');
  const [livekitKey,     setLivekitKey]     = useState('');
  const [livekitSecret,  setLivekitSecret]  = useState('');
  const [geminiApiKey,   setGeminiApiKey]   = useState('');
  const [geminiLiveModel, setGeminiLiveModel] = useState('gemini-3.1-flash-live-preview');
  const [voiceFemale, setVoiceFemale] = useState('Aoede');
  const [voiceMale,   setVoiceMale]   = useState('Charon');
  // Масштабирование видеоперевода (Gemini Live)
  const [maxConcurrentSessions, setMaxConcurrentSessions] = useState(50);
  const [extraGeminiKeys, setExtraGeminiKeys] = useState('');   // write-only ввод доп. ключей
  const [geminiKeysCount, setGeminiKeysCount] = useState(0);    // сколько доп. ключей сейчас в пуле
  const [geminiUseVertex, setGeminiUseVertex] = useState(false);
  const [vertexProject, setVertexProject] = useState('');
  const [vertexLocation, setVertexLocation] = useState('us-central1');
  const [telegramToken,  setTelegramToken]  = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');
  const [stripePublishableKey, setStripePublishableKey] = useState('');
  const [tikhubApiKey, setTikhubApiKey] = useState('');
  const [syncingProducts, setSyncingProducts] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Рендер «Собрать»: переключатель GPU + адреса воркеров (Tailscale).
  const [renderGpuTarget, setRenderGpuTarget] = useState<'home' | 'cloud' | 'off'>('home');
  const [renderWorkerUrl, setRenderWorkerUrl] = useState('');
  const [renderGpuWorkerUrl, setRenderGpuWorkerUrl] = useState('');

  // Произвольные коды сайта (cookie-consent / аналитика / пиксели)
  const [customHeadCode, setCustomHeadCode] = useState('');
  const [customBodyCode, setCustomBodyCode] = useState('');
  const [scriptsSaving, setScriptsSaving] = useState(false);
  const [scriptsSaved, setScriptsSaved] = useState(false);
  const [scriptsError, setScriptsError] = useState('');

  // Telegram-получатели уведомлений (chat_id: личка, группа, канал)
  const [tgBotUsername, setTgBotUsername] = useState<string | null>(null);
  const [tgChatIds, setTgChatIds] = useState<string[]>([]);
  const [tgBusy, setTgBusy] = useState(false);
  const [tgMessage, setTgMessage] = useState<{ kind: 'success' | 'error' | 'info'; text: string; botLink?: string | null } | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [testingService, setTestingService] = useState<ServiceType | null>(null);
  const [activeSteps, setActiveSteps] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<Record<ServiceType, TestResult>>({
    livekit:     { status: 'idle', message: '', steps: [] },
    telegram:    { status: 'idle', message: '', steps: [] },
    google:      { status: 'idle', message: '', steps: [] },
    googleOAuth: { status: 'idle', message: '', steps: [] },
    stripe:      { status: 'idle', message: '', steps: [] },
    tikhub:      { status: 'idle', message: '', steps: [] },
  });

  // Интервал «шагов» теста подключения держим в ref, чтобы гарантированно
  // очистить при размонтировании (иначе setState после unmount, если уйти со
  // страницы во время проверки).
  const testIntervalRef = useRef<number | null>(null);
  useEffect(() => () => { if (testIntervalRef.current) clearInterval(testIntervalRef.current); }, []);

  // Загрузка настроек с сервера при монтировании
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/system-settings', { headers: tgHeaders() });
        if (res.ok) {
          const data = await res.json();
          setLivekitUrl(data.livekitUrl || '');
          setLivekitKey(data.livekitKey || '');
          setLivekitSecret(data.livekitSecret || '');
          setGeminiApiKey(data.geminiApiKey || '');
          if (data.geminiLiveModel) setGeminiLiveModel(data.geminiLiveModel);
          if (data.voiceFemale) setVoiceFemale(data.voiceFemale);
          if (data.voiceMale)   setVoiceMale(data.voiceMale);
          if (typeof data.maxConcurrentTranslationSessions === 'number') setMaxConcurrentSessions(data.maxConcurrentTranslationSessions);
          if (typeof data.geminiApiKeysCount === 'number') setGeminiKeysCount(data.geminiApiKeysCount);
          if (typeof data.geminiUseVertex === 'boolean') setGeminiUseVertex(data.geminiUseVertex);
          if (data.vertexProject) setVertexProject(data.vertexProject);
          if (data.vertexLocation) setVertexLocation(data.vertexLocation);
          setTelegramToken(data.telegramToken || '');
          setGoogleClientId(data.googleClientId || '');
          setGoogleClientSecret(data.googleClientSecret || '');
          setStripeSecretKey(data.stripeSecretKey || '');
          setStripeWebhookSecret(data.stripeWebhookSecret || '');
          setStripePublishableKey(data.stripePublishableKey || '');
          setTikhubApiKey(data.tikhubApiKey || '');
          if (data.renderGpuTarget === 'home' || data.renderGpuTarget === 'cloud' || data.renderGpuTarget === 'off') setRenderGpuTarget(data.renderGpuTarget);
          if (typeof data.renderWorkerUrl === 'string') setRenderWorkerUrl(data.renderWorkerUrl);
          if (typeof data.renderGpuWorkerUrl === 'string') setRenderGpuWorkerUrl(data.renderGpuWorkerUrl);
          if (Array.isArray(data.telegramAdminChatIds)) setTgChatIds(data.telegramAdminChatIds);
        }
      } catch (err) {
        console.warn('[AdminConfig] Не удалось загрузить системные настройки:', err);
      } finally {
        setLoadingSettings(false);
      }
    })();
  }, []);

  // Загрузка произвольных кодов (cookie-consent / аналитика) — публичный эндпоинт
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/site-scripts');
        if (res.ok) {
          const data = await res.json();
          setCustomHeadCode(data.headCode || '');
          setCustomBodyCode(data.bodyCode || '');
        }
      } catch { /* silent */ }
    })();
  }, []);

  // ── Notifications: статус + действия ──
  const tgHeaders = (): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  });

  const loadTgStatus = async () => {
    try {
      const res = await fetch('/api/admin/notifications/status', { headers: tgHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setTgBotUsername(data.botUsername || null);
      if (Array.isArray(data.chatIds)) setTgChatIds(data.chatIds);
    } catch { /* silent */ }
  };

  useEffect(() => { loadTgStatus(); }, []);

  const handleTgSync = async () => {
    setTgBusy(true);
    setTgMessage(null);
    try {
      const res = await fetch('/api/admin/notifications/sync', {
        method: 'POST',
        headers: tgHeaders(),
        body: JSON.stringify({ mode: 'replace' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (Array.isArray(data.chatIds)) setTgChatIds(data.chatIds);
      const kind = data.status === 'empty' ? 'info' : 'success';
      setTgMessage({ kind, text: data.message || 'Готово' });
    } catch (err: any) {
      setTgMessage({ kind: 'error', text: err.message || 'Не удалось синхронизировать' });
    } finally {
      setTgBusy(false);
    }
  };

  const handleTgTest = async () => {
    setTgBusy(true);
    setTgMessage(null);
    try {
      const res = await fetch('/api/admin/notifications/test', {
        method: 'POST',
        headers: tgHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setTgMessage({ kind: 'error', text: data.error || `HTTP ${res.status}`, botLink: data.botLink || null });
        return;
      }
      setTgMessage({ kind: 'success', text: data.message || 'Отправлено' });
      // Бэк мог автоматически подтянуть chat_id перед отправкой — освежим статус.
      await loadTgStatus();
    } catch (err: any) {
      setTgMessage({ kind: 'error', text: err.message || 'Не удалось отправить тест' });
    } finally {
      setTgBusy(false);
    }
  };

  const handleTgTestAll = async () => {
    setTgBusy(true);
    setTgMessage(null);
    try {
      const res = await fetch('/api/admin/notifications/test-all', {
        method: 'POST',
        headers: tgHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setTgMessage({ kind: 'error', text: data.error || `HTTP ${res.status}`, botLink: data.botLink || null });
        return;
      }
      setTgMessage({ kind: 'success', text: data.message || 'Прогон выполнен.' });
      await loadTgStatus();
    } catch (err: any) {
      setTgMessage({ kind: 'error', text: err.message || 'Не удалось прогнать тесты' });
    } finally {
      setTgBusy(false);
    }
  };

  const handleTgRemove = async (chatId: string) => {
    setTgBusy(true);
    try {
      const res = await fetch(`/api/admin/notifications/chat/${encodeURIComponent(chatId)}`, {
        method: 'DELETE',
        headers: tgHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (Array.isArray(data.chatIds)) setTgChatIds(data.chatIds);
    } catch (err: any) {
      setTgMessage({ kind: 'error', text: err.message });
    } finally {
      setTgBusy(false);
    }
  };

  const [saveError, setSaveError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setSaveError('');

    try {
      const res = await fetch('/api/auth/system-settings', {
        method: 'POST',
        headers: tgHeaders(),
        body: JSON.stringify({
          livekitUrl, livekitKey, livekitSecret,
          geminiApiKey, geminiLiveModel, voiceFemale, voiceMale, telegramToken,
          maxConcurrentTranslationSessions: maxConcurrentSessions,
          geminiUseVertex, vertexProject, vertexLocation,
          // Доп. ключи шлём ТОЛЬКО если поле непустое (иначе не трогаем существующий пул).
          ...(extraGeminiKeys.trim()
            ? { geminiApiKeys: extraGeminiKeys.split('\n').map((s) => s.trim()).filter(Boolean) }
            : {}),
          googleClientId, googleClientSecret,
          stripeSecretKey, stripeWebhookSecret, stripePublishableKey,
          tikhubApiKey,
          renderGpuTarget, renderWorkerUrl, renderGpuWorkerUrl,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errData.error || `Ошибка сервера: ${res.status}`);
      }

      // Backward compatibility: сохраняем Google OAuth отдельно
      if (googleClientId && googleClientSecret && googleClientSecret !== '***' && googleClientSecret !== '********************************') {
        await fetch('/api/auth/google-settings', {
          method: 'POST',
          headers: tgHeaders(),
          body: JSON.stringify({ clientId: googleClientId, clientSecret: googleClientSecret }),
        });
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('[AdminConfig] Ошибка сохранения:', err);
      setSaveError(err.message || 'Ошибка сохранения настроек');
    } finally {
      setLoading(false);
    }
  };

  const runConnectionTest = (service: ServiceType) => {
    setTestingService(service);
    setTestResults(prev => ({ ...prev, [service]: { status: 'testing', message: 'Инициализация...', steps: [] } }));
    setActiveSteps([]);

    let testSteps: string[] = [];
    let verifyUrl = '';

    if (service === 'livekit') {
      testSteps = ['Инициализация LiveKit Client SDK...', 'Проверка API Key и API Secret...', 'Подключение к серверу WebSocket...', 'Запрос списка активных комнат...'];
      verifyUrl = '/api/auth/verify-livekit';
    } else if (service === 'telegram') {
      testSteps = ['Запрос к API Telegram (api.telegram.org)...', 'Проверка валидности токена...', 'Аутентификация бота...', 'Получение информации о боте...'];
      verifyUrl = '/api/auth/verify-telegram';
    } else if (service === 'google') {
      testSteps = ['Инициализация Google GenAI Client SDK...', 'Проверка формата API-ключа (AI Studio)...', 'Отправка тестового запроса к Gemini API...', 'Валидация доступа к модели gemini-2.5-flash...'];
      verifyUrl = '/api/auth/verify-google';
    } else if (service === 'googleOAuth') {
      testSteps = ['Инициализация Google OAuth конфигурации...', 'Проверка формата Client ID...', 'Отправка запроса валидации в Google API...', 'Проверка ответа аутентификации от Google...'];
      verifyUrl = '/api/auth/verify-google-oauth';
    } else if (service === 'stripe') {
      testSteps = ['Инициализация Stripe SDK...', 'Проверка формата API Key (sk_test_/sk_live_)...', 'Запрос Balance из Stripe API...', 'Определение режима TEST/LIVE...'];
      verifyUrl = '/api/auth/verify-stripe';
    } else if (service === 'tikhub') {
      testSteps = ['Подключение к api.tikhub.io...', 'Авторизация Bearer-токеном...', 'Запрос get_user_info...', 'Чтение статуса ключа и баланса...'];
      verifyUrl = '/api/auth/verify-tikhub';
    }

    let currentStepIndex = 0;
    const interval = window.setInterval(async () => {
      if (currentStepIndex < testSteps.length) {
        setActiveSteps(prev => [...prev, testSteps[currentStepIndex]]);
        currentStepIndex++;
      } else {
        clearInterval(interval);
        testIntervalRef.current = null;
        try {
          let bodyData: any = {};
          if (service === 'livekit') {
            bodyData = { url: livekitUrl, key: livekitKey, secret: livekitSecret };
          } else if (service === 'telegram') {
            bodyData = { token: telegramToken };
          } else if (service === 'google') {
            bodyData = { apiKey: geminiApiKey };
          } else if (service === 'googleOAuth') {
            bodyData = { clientId: googleClientId.trim(), clientSecret: googleClientSecret.trim() };
          } else if (service === 'stripe') {
            bodyData = { secretKey: stripeSecretKey };
          } else if (service === 'tikhub') {
            bodyData = { apiKey: tikhubApiKey };
          }

          const res = await fetch(verifyUrl, {
            method: 'POST',
            headers: tgHeaders(),
            body: JSON.stringify(bodyData),
          });
          // Сначала читаем тело как текст, чтобы корректно обработать пустой ответ
          // (бывает при рестарте бэкенда через tsx watch — соединение обрывается посередине)
          const rawText = await res.text();
          let data: any = {};
          if (rawText.trim()) {
            try {
              data = JSON.parse(rawText);
            } catch {
              throw new Error(`Сервер вернул не JSON (HTTP ${res.status}): ${rawText.slice(0, 120)}`);
            }
          } else {
            throw new Error(`Пустой ответ от сервера (HTTP ${res.status}). Возможно, backend перезагружался — повторите проверку через 2 секунды.`);
          }

          if (res.ok && data.status === 'success') {
            setActiveSteps(prev => [...prev, '✅ ' + (data.message || 'Проверка пройдена успешно!')]);
            setTestResults(prev => ({ ...prev, [service]: { status: 'success', message: data.message || 'Подключение успешно!', steps: [...testSteps, data.message] } }));
          } else {
            const errorMsg = data.error || `Ошибка HTTP ${res.status}`;
            setActiveSteps(prev => [...prev, '❌ ' + errorMsg]);
            setTestResults(prev => ({ ...prev, [service]: { status: 'error', message: errorMsg, steps: [...testSteps, errorMsg] } }));
          }
        } catch (err: any) {
          const errorMsg = err.message || String(err);
          setActiveSteps(prev => [...prev, '❌ ' + errorMsg]);
          setTestResults(prev => ({ ...prev, [service]: { status: 'error', message: errorMsg, steps: [...testSteps, errorMsg] } }));
        } finally {
          setTestingService(null);
        }
      }
    }, 300);
    testIntervalRef.current = interval;
  };

  // ── Sync Stripe Products/Prices ──
  const handleSyncProducts = async (currency: 'eur' | 'usd') => {
    setSyncingProducts(true);
    setSyncResult(null);
    try {
      const res = await fetch('/api/billing/sync-products', {
        method: 'POST',
        headers: tgHeaders(),
        body: JSON.stringify({ currency }),
      });
      const text = await res.text();
      let data: any = {};
      if (text.trim()) { try { data = JSON.parse(text); } catch { /* ignore */ } }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSyncResult(`${data.message} Активных тарифов: ${data.products?.length ?? 0}.`);
    } catch (err: any) {
      setSyncResult(`Ошибка: ${err.message || err}`);
    } finally {
      setSyncingProducts(false);
    }
  };

  // ── Сохранение произвольных кодов (отдельный, защищённый ролью эндпоинт) ──
  const handleSaveScripts = async () => {
    setScriptsSaving(true);
    setScriptsSaved(false);
    setScriptsError('');
    try {
      const res = await fetch('/api/auth/site-scripts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ headCode: customHeadCode, bodyCode: customBodyCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setScriptsSaved(true);
      setTimeout(() => setScriptsSaved(false), 4000);
    } catch (err: any) {
      setScriptsError(err.message || 'Ошибка сохранения кодов');
    } finally {
      setScriptsSaving(false);
    }
  };

  const renderTestBlock = (service: ServiceType) => (
    <div className="pt-4 border-t mt-2" style={{ borderColor: 'var(--border-subtle)' }}>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => runConnectionTest(service)} disabled={testingService !== null} className="btn btn-ghost btn-sm">
          {testingService === service ? (<><Loader2 size={12} className="animate-spin" /> Проверка...</>) : 'Проверить подключение'}
        </button>
        {testResults[service].status === 'success' && (<span className="text-xs font-600 flex items-center gap-1" style={{ color: 'var(--accent-green)' }}><Check size={14} strokeWidth={2.5} /> Активен</span>)}
        {testResults[service].status === 'error' && (<span className="text-xs font-600 flex items-center gap-1" style={{ color: 'var(--accent-magenta)' }}><AlertCircle size={14} strokeWidth={2} /> Ошибка</span>)}
      </div>
      {testResults[service].status === 'testing' && (
        <div className="mt-3 p-3 rounded-xl bg-black/40 border border-dashed border-zinc-800 text-xs space-y-1 font-mono">
          <div className="flex items-center gap-2 text-zinc-400"><Loader2 size={10} className="animate-spin" /><span>Запуск диагностики...</span></div>
          {activeSteps.filter(Boolean).map((step, idx) => (
            <div key={idx} className="text-zinc-300 flex items-center gap-1.5">
              <span style={{ color: (step || '').startsWith('❌') ? 'var(--accent-magenta)' : 'var(--accent-green)' }}>{(step || '').startsWith('❌') ? '✗' : '✓'}</span>
              <span>{(step || '').replace(/^[❌✅] /, '')}</span>
            </div>
          ))}
        </div>
      )}
      {testResults[service].status === 'success' && (<p className="mt-2 text-xs font-mono" style={{ color: 'var(--accent-green)' }}>{testResults[service].message}</p>)}
      {testResults[service].status === 'error' && (<p className="mt-2 text-xs font-mono" style={{ color: 'var(--accent-magenta)' }}>{testResults[service].message}</p>)}
    </div>
  );

  if (loadingSettings) {
    return (<div className="flex items-center justify-center min-h-[400px]"><Loader2 size={32} className="animate-spin" style={{ color: 'var(--text-muted)' }} /></div>);
  }

  return (
    <div className="space-y-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Шапка */}
        <div className="pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h1 className="text-xl font-800 text-aurora" style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.03em' }}>
            ⚙️ Настройки системных API
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Конфигурация интеграций: WebRTC, Telegram, Google Gemini и Google OAuth авторизация
          </p>
        </div>

        {success && (
          <div className="flex items-center gap-3 p-4 rounded-2xl text-sm animate-slide-up"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: 'var(--accent-green)' }}>
            <CheckCircle size={18} strokeWidth={1.5} />
            Системные API-ключи успешно сохранены и применены!
          </div>
        )}

        {saveError && (
          <div className="flex items-center gap-3 p-4 rounded-2xl text-sm animate-slide-up"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#F87171' }}>
            <AlertCircle size={18} strokeWidth={1.5} />
            Ошибка сохранения: {saveError}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">

          {/* AI Learning Hub — Quick Link */}
          <AuroraCard className="p-5">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }} onClick={() => navigate('/admin/dialects')}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)', flexShrink: 0 }}>
                <Bot size={24} strokeWidth={1.5} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 className="text-base font-700" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)', margin: 0 }}>AI Learning Hub — Обучение диалектам</h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Управление глоссариями и правилами перевода диалектов для Gemini Live API</p>
              </div>
              <AuroraButton variant="secondary" size="sm" id="btn-go-dialects" onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate('/admin/dialects'); }}>Перейти</AuroraButton>
            </div>
          </AuroraCard>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* LiveKit */}
            <AuroraCard className="p-6 space-y-5 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                    <Server size={16} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-base font-700" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>LiveKit WebRTC Server</h3>
                </div>
                <AuroraInput label="Server URL" value={livekitUrl} onChange={(e) => setLivekitUrl(e.target.value)} placeholder="ws://localhost:7880" inputId="admin-livekit-url" />
                <AuroraInput label="API Key" value={livekitKey} onChange={(e) => setLivekitKey(e.target.value)} placeholder="devkey" inputId="admin-livekit-key" />
                <AuroraInput label="API Secret" type="password" value={livekitSecret} onChange={(e) => setLivekitSecret(e.target.value)} placeholder="secret" inputId="admin-livekit-secret" />
              </div>
              {renderTestBlock('livekit')}
            </AuroraCard>

            {/* Telegram */}
            <AuroraCard className="p-6 space-y-5 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                    <Bot size={16} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-base font-700" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>Telegram Bot</h3>
                </div>
                <AuroraInput label="Bot API Token" type="password" value={telegramToken} onChange={(e) => setTelegramToken(e.target.value)} placeholder="123456789:ABC..." inputId="admin-telegram-token" />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Используется для авторизации шлюза Telegram REST и рассылки уведомлений.</p>

                {/* Получатели админских уведомлений */}
                <div className="mt-2 pt-4 border-t space-y-3" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-700 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                        Получатели уведомлений
                      </p>
                      {tgBotUsername && (
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          Бот: <a href={`https://t.me/${tgBotUsername}`} target="_blank" rel="noreferrer"
                                  style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}>
                            @{tgBotUsername}
                          </a>
                        </p>
                      )}
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full"
                          style={{
                            background: tgChatIds.length > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)',
                            color: tgChatIds.length > 0 ? '#10b981' : 'var(--text-muted)',
                          }}>
                      {tgChatIds.length} {tgChatIds.length === 1 ? 'чат' : 'чатов'}
                    </span>
                  </div>

                  <ol className="text-[11px] list-decimal pl-4 space-y-0.5" style={{ color: 'var(--text-muted)' }}>
                    <li>Откройте Telegram и напишите боту <code>/start</code> (или добавьте его в группу/канал и отправьте туда сообщение).</li>
                    <li>Нажмите «Синхронизировать получателей» — бот подтянет ваш chat_id.</li>
                    <li>Нажмите «Отправить тест» — должно прийти сообщение.</li>
                  </ol>

                  {tgChatIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tgChatIds.map((id) => (
                        <span key={id} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border"
                              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                          <code className="text-[10px]">{id}</code>
                          <button type="button" onClick={() => handleTgRemove(id)} disabled={tgBusy}
                                  style={{ color: 'var(--text-muted)' }} title="Удалить">×</button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Если получателей ещё нет — крупная заметная инструкция со ссылкой на бота */}
                  {tgChatIds.length === 0 && tgBotUsername && (
                    <a
                      href={`https://t.me/${tgBotUsername}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-700 transition-all duration-150"
                      style={{
                        background: 'rgba(34, 211, 238, 0.12)',
                        border: '1px solid rgba(34, 211, 238, 0.3)',
                        color: '#22d3ee',
                      }}
                    >
                      📱 Открыть @{tgBotUsername} и нажать /start
                    </a>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleTgSync} disabled={tgBusy} className="btn btn-ghost btn-sm">
                      {tgBusy ? (<><Loader2 size={12} className="animate-spin" /> Запрос…</>) : 'Синхронизировать получателей'}
                    </button>
                    <button type="button" onClick={handleTgTest} disabled={tgBusy} className="btn btn-ghost btn-sm">
                      Отправить тест
                    </button>
                  </div>

                  {/* Большая отдельная кнопка: прогон всех типов уведомлений.
                      Кнопка ВСЕГДА активна — бэк сам сделает getUpdates если получателей ещё нет. */}
                  <button
                    type="button"
                    onClick={handleTgTestAll}
                    disabled={tgBusy}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl text-sm font-700 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
                      color: '#fff',
                      boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
                    }}
                    title="Отправит 5 примеров: регистрация, оплата, докупка, админ-кредит, утренняя сводка"
                  >
                    {tgBusy ? <Loader2 size={16} className="animate-spin" /> : <span>🧪</span>}
                    <span>ТЕСТ всех уведомлений</span>
                  </button>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Прогонит 5 примеров: <b>регистрация</b>, <b>оплата подписки</b>, <b>докупка минут</b>, <b>админ-кредит</b>, <b>утренняя сводка</b>. Все придут в ваш Telegram сразу.
                  </p>

                  {tgMessage && (
                    <div className="space-y-2">
                      <p className="text-xs"
                         style={{
                           color: tgMessage.kind === 'error' ? '#ef4444'
                                : tgMessage.kind === 'success' ? '#10b981'
                                : 'var(--text-muted)',
                         }}>
                        {tgMessage.text}
                      </p>
                      {tgMessage.botLink && (
                        <a href={tgMessage.botLink} target="_blank" rel="noreferrer"
                           className="inline-flex items-center gap-1.5 text-xs font-700 px-3 py-1.5 rounded-xl"
                           style={{
                             background: '#22d3ee',
                             color: '#0f172a',
                           }}>
                          📱 Открыть бота → /start → вернуться и нажать ТЕСТ снова
                        </a>
                      )}
                      {/* Если ошибка про сессию — большая кнопка «Войти заново» */}
                      {tgMessage.kind === 'error' && (tgMessage.text.includes('Сессия истекла') || tgMessage.text.includes('Невалидный токен') || tgMessage.text.includes('Не авторизован')) && (
                        <button
                          type="button"
                          onClick={() => { logout(); navigate('/auth/login'); }}
                          className="inline-flex items-center gap-1.5 text-xs font-700 px-3 py-1.5 rounded-xl"
                          style={{ background: '#ef4444', color: '#fff' }}
                        >
                          🔐 Войти заново
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {renderTestBlock('telegram')}
            </AuroraCard>

            {/* Google OAuth */}
            <AuroraCard className="p-6 space-y-5 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor" style={{ color: 'var(--text-primary)' }}/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" style={{ color: 'var(--text-secondary)' }}/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="currentColor" style={{ color: 'var(--text-muted)' }}/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" style={{ color: 'var(--text-primary)' }}/>
                    </svg>
                  </div>
                  <h3 className="text-base font-700" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>Google OAuth Авторизация</h3>
                </div>
                <AuroraInput label="Google Client ID" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} placeholder="123456789-abc.apps.googleusercontent.com" inputId="admin-google-client-id" />
                <AuroraInput label="Google Client Secret" type="password" value={googleClientSecret} onChange={(e) => setGoogleClientSecret(e.target.value)} placeholder="GOCSPX-..." inputId="admin-google-client-secret" />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Используется для быстрой регистрации и авторизации пользователей через Google Accounts.</p>
                <div className="space-y-1.5 p-3 rounded-xl border text-[11px]" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}>
                  <div className="font-bold uppercase tracking-wider text-zinc-500" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>Разрешенные URI перенаправления (Redirect URIs):</div>
                  <div className="space-y-1 font-mono text-zinc-400" style={{ color: 'var(--text-secondary)' }}>
                    <div className="flex justify-between items-center gap-1.5 hover:text-white transition-colors"><span className="truncate select-all">{`${window.location.origin}/auth/google/callback`}</span></div>
                    <div className="flex justify-between items-center gap-1.5 hover:text-white transition-colors"><span className="truncate select-all">http://localhost:3000/api/auth/callback/google</span></div>
                  </div>
                </div>
              </div>
              {renderTestBlock('googleOAuth')}
            </AuroraCard>

            {/* Google Gemini API */}
            <AuroraCard className="p-6 space-y-5 md:col-span-2 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                    <Key size={16} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-base font-700" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>Google Gemini API (AI Studio)</h3>
                </div>
                <div className="space-y-4">
                  <AuroraInput label="Gemini API Key" type="password" value={geminiApiKey} onChange={(e) => setGeminiApiKey(e.target.value)} placeholder="AIzaSy..." inputId="admin-gemini-key" />

                  {/* Селектор модели Gemini Live (для синхронного перевода голосом) */}
                  <div className="space-y-1.5">
                    <label
                      className="text-xs font-600 uppercase"
                      style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}
                      htmlFor="admin-gemini-live-model"
                    >
                      Модель Live API (онлайн-перевод голосом)
                    </label>
                    <select
                      id="admin-gemini-live-model"
                      value={geminiLiveModel}
                      onChange={(e) => setGeminiLiveModel(e.target.value)}
                      className="w-full px-3.5 py-3 rounded-2xl text-sm font-500 outline-none transition-all"
                      style={{
                        background: 'var(--bg-tertiary)',
                        border: '1.5px solid var(--border-subtle)',
                        color: 'var(--text-primary)',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      <option value="gemini-3.1-flash-live-preview">Gemini 3.1 Flash Live Preview — новейшая (рекомендуется)</option>
                      <option value="gemini-2.5-flash-native-audio-latest">Gemini 2.5 Flash Native Audio — стабильная latest</option>
                      <option value="gemini-2.5-flash-native-audio-preview-12-2025">Gemini 2.5 Flash Native Audio — preview 12-2025</option>
                      <option value="gemini-2.5-flash-native-audio-preview-09-2025">Gemini 2.5 Flash Native Audio — preview 09-2025</option>
                    </select>
                  </div>

                  {/* v0.8.2: Voice selectors */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-700 uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                        Голос (Ж)
                      </label>
                      <select
                        value={voiceFemale}
                        onChange={(e) => setVoiceFemale(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
                      >
                        <option value="Aoede">Aoede — мягкий (дефолт)</option>
                        <option value="Kore">Kore — глубокий</option>
                        <option value="Leda">Leda — молодой</option>
                        <option value="Zephyr">Zephyr — яркий</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-700 uppercase tracking-wider block mb-1.5" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                        Голос (М)
                      </label>
                      <select
                        value={voiceMale}
                        onChange={(e) => setVoiceMale(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
                      >
                        <option value="Charon">Charon — глубокий (дефолт)</option>
                        <option value="Puck">Puck — живой</option>
                        <option value="Fenrir">Fenrir — мощный</option>
                        <option value="Orus">Orus — спокойный</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                    <p>Ключ используется одновременно: для онлайн-перевода в комнатах (модель Live API выше), для AI-помощника по субтитрам и для пост-анализа звонков (gemini-3.5-flash).</p>
                    <p><strong style={{ color: 'var(--text-secondary)' }}>3.1 Live Preview</strong> — новейшее поколение, лучшее понимание контекста. Если будут глюки — переключитесь на <strong style={{ color: 'var(--text-secondary)' }}>2.5 latest</strong>, она стабильнее.</p>
                    <p>Получить ключ:{' '}<a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors" style={{ color: 'var(--accent-orange)' }}>aistudio.google.com/api-keys</a>.</p>
                  </div>
                </div>
              </div>
              {renderTestBlock('google')}
            </AuroraCard>

            {/* Масштабирование видеоперевода: admission control + пул ключей + Vertex */}
            <AuroraCard className="p-6 space-y-5 md:col-span-2">
              <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                  <Gauge size={16} strokeWidth={1.5} />
                </div>
                <h3 className="text-base font-700" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>Масштабирование видеоперевода</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AuroraInput
                  label="Лимит одновременных переводов"
                  type="number"
                  min={1}
                  max={100000}
                  value={maxConcurrentSessions}
                  onChange={(e) => setMaxConcurrentSessions(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  placeholder="50"
                  inputId="admin-max-sessions"
                  hint="Сколько участников видеоперевода обслуживать одновременно во всём сервисе (≈ число сессий Gemini Live). Сверх лимита вход в комнату получает «сервис перегружен». Дефолт 50 — поднимайте по мере роста tier Gemini и нагрузки."
                />
                <div className="space-y-1.5">
                  <label className="text-xs font-600 uppercase" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }} htmlFor="admin-extra-gemini-keys">
                    Доп. Gemini-ключи (пул, round-robin)
                  </label>
                  <textarea
                    id="admin-extra-gemini-keys"
                    value={extraGeminiKeys}
                    onChange={(e) => setExtraGeminiKeys(e.target.value)}
                    rows={3}
                    placeholder={`по одному ключу на строку\nоставьте пустым — текущий пул не изменится`}
                    className="w-full px-3.5 py-3 rounded-2xl text-sm font-500 outline-none transition-all resize-y"
                    style={{ background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-subtle)', color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}
                  />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Сейчас в пуле доп. ключей: <strong style={{ color: 'var(--text-secondary)' }}>{geminiKeysCount}</strong>. ⚠️ Ключи должны быть из <strong style={{ color: 'var(--text-secondary)' }}>РАЗНЫХ</strong> Google-проектов — лимит сессий считается на проект, ключи одного проекта делят один потолок.
                  </p>
                </div>
              </div>

              {/* Vertex AI — режим повышенных квот */}
              <div className="space-y-3 pt-1">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={geminiUseVertex}
                    onChange={(e) => setGeminiUseVertex(e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: 'var(--accent-orange)' }}
                  />
                  <span className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
                    Использовать Vertex AI (1000 одновременных сессий + 4M TPM на проект)
                  </span>
                </label>
                {geminiUseVertex && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AuroraInput
                      label="GCP Project ID"
                      value={vertexProject}
                      onChange={(e) => setVertexProject(e.target.value)}
                      placeholder="my-gcp-project"
                      inputId="admin-vertex-project"
                    />
                    <AuroraInput
                      label="Регион (location)"
                      value={vertexLocation}
                      onChange={(e) => setVertexLocation(e.target.value)}
                      placeholder="us-central1"
                      inputId="admin-vertex-location"
                    />
                  </div>
                )}
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Vertex AI снимает узкий лимит concurrent-сессий Developer API. Требует service account на сервере (переменная окружения <code>GOOGLE_APPLICATION_CREDENTIALS</code> с путём к JSON-ключу). Применяется к глобальному трафику; Enterprise-тенанты со своим ключом остаются на Developer API. Подробности — docs/SCALING_GEMINI_LIVE.md.
                </p>
              </div>
            </AuroraCard>

            {/* Stripe — биллинг */}
            <AuroraCard className="p-6 space-y-5 md:col-span-2 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                    <CreditCard size={16} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-base font-700" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>Stripe (биллинг подписок)</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AuroraInput
                    label="Stripe Secret Key"
                    type="password"
                    value={stripeSecretKey}
                    onChange={(e) => setStripeSecretKey(e.target.value)}
                    placeholder="sk_test_... или sk_live_..."
                    inputId="admin-stripe-secret"
                  />
                  <AuroraInput
                    label="Stripe Publishable Key"
                    value={stripePublishableKey}
                    onChange={(e) => setStripePublishableKey(e.target.value)}
                    placeholder="pk_test_... или pk_live_..."
                    inputId="admin-stripe-publishable"
                  />
                </div>
                <AuroraInput
                  label="Webhook Signing Secret"
                  type="password"
                  value={stripeWebhookSecret}
                  onChange={(e) => setStripeWebhookSecret(e.target.value)}
                  placeholder="whsec_..."
                  inputId="admin-stripe-webhook"
                />
                <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                  <p>Используется для оплаты подписок (тарифы Plus, Standard) и докупки минут пользователями.</p>
                  <p>Ключи на странице <a href="https://dashboard.stripe.com/test/apikeys" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors" style={{ color: 'var(--accent-orange)' }}>Stripe Dashboard → API Keys</a>.</p>
                  <p>Webhook URL для регистрации в Stripe: <code style={{ color: 'var(--text-secondary)' }}>https://&lt;ваш-домен&gt;/api/billing/webhook</code></p>
                </div>

                {/* Синхронизация Products/Prices */}
                <div className="pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>Синхронизация тарифов с Stripe</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Создаёт Products и Prices в вашем Stripe (Plus, Standard месячный, Standard годовой). Идемпотентно — повторный запуск не плодит дубликаты.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleSyncProducts('eur')}
                      disabled={syncingProducts}
                      className="btn btn-ghost btn-sm"
                    >
                      {syncingProducts ? 'Синхронизация…' : 'Синхронизировать EUR'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSyncProducts('usd')}
                      disabled={syncingProducts}
                      className="btn btn-ghost btn-sm"
                    >
                      {syncingProducts ? 'Синхронизация…' : 'Синхронизировать USD'}
                    </button>
                  </div>
                  {syncResult && (
                    <p
                      className="mt-2 text-xs font-mono"
                      style={{ color: syncResult.startsWith('Ошибка') ? 'var(--accent-magenta)' : 'var(--accent-green)' }}
                    >
                      {syncResult}
                    </p>
                  )}
                </div>
              </div>
              {renderTestBlock('stripe')}
            </AuroraCard>

            {/* TikHub — сканирование трендов и скачивание видео (платформенный ключ) */}
            <AuroraCard className="p-6 space-y-5 md:col-span-2 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                    <TrendingUp size={16} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-base font-700" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>TikHub (тренды и скачивание видео)</h3>
                </div>
                <AuroraInput
                  label="TikHub API Key"
                  type="password"
                  value={tikhubApiKey}
                  onChange={(e) => setTikhubApiKey(e.target.value)}
                  placeholder="вставьте ключ TikHub..."
                  inputId="admin-tikhub-key"
                />
                <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                  <p>Платформенный ключ для сканирования трендов и скачивания видео (TikTok / Douyin / Instagram / YouTube). Используется всеми тенантами, кроме Enterprise — те могут задать свой ключ в настройках Enterprise.</p>
                  <p>Получить/проверить ключ и баланс: <a href="https://tikhub.io" target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors" style={{ color: 'var(--accent-orange)' }}>tikhub.io</a>. Тарификация — pay-as-you-go (списывается с баланса аккаунта за каждый запрос).</p>
                  <p>Нажмите «Проверить подключение» — backend реально дёрнет <code style={{ color: 'var(--text-secondary)' }}>get_user_info</code> и покажет статус ключа + баланс.</p>
                </div>
              </div>
              {renderTestBlock('tikhub')}
            </AuroraCard>

            {/* Рендер «Собрать»: переключатель GPU (Дом/Облако/Выкл) + адреса воркеров (Tailscale) */}
            <AuroraCard className="p-6 space-y-5 md:col-span-2 flex flex-col justify-between">
              <div className="space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
                    <Server size={16} strokeWidth={1.5} />
                  </div>
                  <h3 className="text-base font-700" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>Рендер «Собрать»: GPU и воркеры</h3>
                </div>

                <div>
                  <label className="block text-sm font-600 mb-2" style={{ color: 'var(--text-secondary)' }}>Куда слать GPU-шаги (аватар / апскейл)</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {([
                      { v: 'home', label: 'Домашний ПК', hint: 'RTX 5080 по Tailscale (бесплатно)' },
                      { v: 'cloud', label: 'Облако', hint: 'облачный GPU-фолбэк' },
                      { v: 'off', label: 'Выключить', hint: 'только бесплатный CPU' },
                    ] as const).map((o) => (
                      <button key={o.v} type="button" onClick={() => setRenderGpuTarget(o.v)}
                        className="flex-1 px-3 py-2.5 rounded-xl text-sm font-600 transition-colors text-left"
                        style={{ background: renderGpuTarget === o.v ? 'var(--btn-primary-bg)' : 'var(--bg-tertiary)', color: renderGpuTarget === o.v ? 'var(--accent-orange)' : 'var(--text-secondary)', border: `1px solid ${renderGpuTarget === o.v ? 'var(--accent-orange)' : 'var(--border-medium)'}`, cursor: 'pointer' }}>
                        <span className="flex items-center gap-1.5">{renderGpuTarget === o.v && <Check size={13} />}{o.label}</span>
                        <span className="block text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{o.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <AuroraInput label="GPU-воркер (домашний ПК, Tailscale)" value={renderGpuWorkerUrl} onChange={(e) => setRenderGpuWorkerUrl(e.target.value)} placeholder="http://100.122.182.97:8801" inputId="admin-render-gpu-url" />
                <AuroraInput label="CPU-воркер (рендер-VPS, Tailscale)" value={renderWorkerUrl} onChange={(e) => setRenderWorkerUrl(e.target.value)} placeholder="http://100.81.35.75:8800" inputId="admin-render-cpu-url" />

                <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                  <p><b style={{ color: 'var(--text-secondary)' }}>Домашний ПК</b> — тяжёлые шаги (говорящая голова, апскейл) идут на вашу RTX 5080 по Tailscale. Нужен запущенный GPU-воркер на ПК и его адрес выше. «Выключить» или пустой адрес — эти шаги пропускаются, базовый монтаж работает на CPU-воркере.</p>
                  <p><b style={{ color: 'var(--text-secondary)' }}>CPU-воркер</b> — бесплатная ffmpeg-цепочка (обрезка/формат/субтитры/озвучка/экспорт) на рендер-VPS. Пусто — рендер идёт в режиме симуляции (без файла).</p>
                  <p>Адреса — по сети Tailscale (<code style={{ color: 'var(--text-secondary)' }}>100.x</code>). Применяется после «Сохранить» и нового запуска рендера.</p>
                </div>
              </div>
            </AuroraCard>
          </div>

          <div className="flex justify-end pt-2">
            <AuroraButton type="submit" size="lg" loading={loading} icon={!loading ? <Save size={18} strokeWidth={1.5} /> : undefined} id="admin-save">
              Сохранить изменения
            </AuroraButton>
          </div>
        </form>

        {/* Аналитика и пользовательские коды (cookie-consent / GA / Pixel) */}
        <AuroraCard className="p-6 space-y-5">
          <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}>
              <Terminal size={16} strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-base font-700" style={{ fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>Аналитика и пользовательские коды</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Cookie-consent, Google Analytics, Meta Pixel, метатеги верификации, чат-виджеты
              </p>
            </div>
          </div>

          {/* Код в <head> */}
          <div className="space-y-1.5">
            <label className="text-xs font-700 uppercase tracking-wider block" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }} htmlFor="admin-custom-head">
              Код в &lt;head&gt;
            </label>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Cookie-consent (cookie-script.com / Cookiebot), Google Analytics (gtag), базовый код Meta Pixel, верификация Search Console. Вставляйте сниппеты целиком, вместе с тегами <code>&lt;script&gt;</code>.
            </p>
            <textarea
              id="admin-custom-head"
              value={customHeadCode}
              onChange={(e) => setCustomHeadCode(e.target.value)}
              spellCheck={false}
              rows={7}
              placeholder={`<!-- напр. Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-XXXX');</script>`}
              className="w-full px-3.5 py-3 rounded-2xl text-xs outline-none transition-all font-mono"
              style={{ background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-subtle)', color: 'var(--text-primary)', resize: 'vertical', minHeight: 130 }}
            />
          </div>

          {/* Код в конце <body> */}
          <div className="space-y-1.5">
            <label className="text-xs font-700 uppercase tracking-wider block" style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }} htmlFor="admin-custom-body">
              Код в конце &lt;body&gt;
            </label>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Чат-виджеты, отложенные скрипты, <code>&lt;noscript&gt;</code>-пиксели — то, что должно грузиться в конце страницы.
            </p>
            <textarea
              id="admin-custom-body"
              value={customBodyCode}
              onChange={(e) => setCustomBodyCode(e.target.value)}
              spellCheck={false}
              rows={5}
              placeholder={`<!-- напр. чат-виджет или отложенный скрипт -->`}
              className="w-full px-3.5 py-3 rounded-2xl text-xs outline-none transition-all font-mono"
              style={{ background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-subtle)', color: 'var(--text-primary)', resize: 'vertical', minHeight: 100 }}
            />
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl text-[11px]" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', color: 'var(--text-secondary)' }}>
            <ShieldAlert size={14} strokeWidth={1.5} style={{ color: '#eab308', flexShrink: 0, marginTop: 1 }} />
            <span>Код исполняется у всех посетителей сайта. Вставляйте только из доверенных источников — ошибочный или вредоносный код может сломать страницу.</span>
          </div>

          {scriptsSaved && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--accent-green)' }}>
              <CheckCircle size={14} /> Коды сохранены — применятся при следующей загрузке страницы.
            </p>
          )}
          {scriptsError && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--accent-magenta)' }}>
              <AlertCircle size={14} /> {scriptsError}
            </p>
          )}

          <div className="flex justify-end">
            <AuroraButton type="button" size="lg" loading={scriptsSaving} onClick={handleSaveScripts} icon={!scriptsSaving ? <Save size={18} strokeWidth={1.5} /> : undefined} id="admin-save-scripts">
              Сохранить коды
            </AuroraButton>
          </div>
        </AuroraCard>

      </div>
    </div>
  );
}
