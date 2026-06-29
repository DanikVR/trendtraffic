/**
 * RoomPage — комнаты перевода (Abyss Aurora, полная переработка v2).
 *
 * ╔══════════════════════════════════════════════════════════╗
 * ║  ВСЯ БИЗНЕС-ЛОГИКА СОХРАНЕНА БЕЗ ИЗМЕНЕНИЙ:           ║
 * ║  - fetch /api/rooms/validate/:roomId                    ║
 * ║  - fetch /api/rooms/create                              ║
 * ║  - sessionStorage для имени и языка гостя               ║
 * ║  - Picture-in-Picture drag-and-drop (mouse + touch)     ║
 * ║  - Симуляция диалога субтитров по таймеру               ║
 * ║  - navigate('/room/:roomId') / ('/')                    ║
 * ║                                                         ║
 * ║  ПОЛНАЯ ПЕРЕРАБОТКА UI:                                 ║
 * ║  - Мобильная сетка видео (1×1 / PiP)                    ║
 * ║  - Enhanced Glassmorphism субтитры                       ║
 * ║  - Scrim-эффекты (верх 100px, низ 160px)                ║
 * ║  - Умная локализация UI (navigator.language)            ║
 * ║  - Тёмный/светлый режим без грязных рамок               ║
 * ║  - 100+ языков                                          ║
 * ╚══════════════════════════════════════════════════════════╝
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Languages, Plus, Users, Mic, MicOff, Video, VideoOff,
  PhoneOff, Volume2, AlertTriangle, Loader2,
  Monitor, MonitorOff, Languages as LanguagesIcon, Subtitles, MoreHorizontal, X as XIcon, Maximize2,
  Pencil, Trash2,
  Sparkles, Pin, Copy, X, Lightbulb, Send,
  Search, Workflow,
} from 'lucide-react';
import {
  Room,
  RoomEvent,
  Track,
  ConnectionQuality,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type Participant,
} from 'livekit-client';
import { AuroraButton } from '../components/AuroraButton';
import { StatusPill } from '../components/StatusPill';
import { AvatarCircle } from '../components/AvatarCircle';
import { PaywallModal } from '../components/PaywallModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { showToast } from '../components/Toast';
import { VibeVoxIcon } from '../components/VibeVoxIcon';
import { VibeVoxLogo } from '../components/VibeVoxLogo';
import { ChevronForward } from '../components/Chevron';
import { RoomLobbyPage } from './RoomLobbyPage';
import { useAppStore } from '../store/useAppStore';
import { useIsEnterprise } from '../hooks/useIsEnterprise';
import { NeedTagBadge } from '../components/enterprise/NeedTagBadge';
import { buildDefaultRoomNameToken, formatRoomName } from '../components/RoomNameDisplay';
import { MessageSquare } from 'lucide-react';
import type { ApiRoom, RoomsResponse } from '../types/api';

const TRANSLATOR_BOT_IDENTITY = 'vibevox-translator';

interface SubtitleEntry {
  id: string;
  speakerIdentity: string;
  speakerLanguage: string;
  targetLanguage: string;
  text: string;
  timestamp: number;
  isFinal: boolean;
}

interface CoachResult {
  subtitleId: string;
  subtitleText: string;
  prompt: string;
  answer: string;
  loading: boolean;
  pinned: boolean;
}

// Быстрые пресеты-чипы для поля «промт» в AI Coach. Лейблы и промты берутся из
// i18n (common: coach.tones.*, coach.tonePrompts.*) — это даёт нам автоматический
// перевод на 100+ языков и единый источник правды с языком интерфейса.
function useCoachPresets(): { label: string; prompt: string }[] {
  const { t } = useTranslation('common');
  return useMemo(() => [
    { label: t('coach.tones.neutral'),    prompt: '' },
    { label: t('coach.tones.joke'),       prompt: t('coach.tonePrompts.joke') },
    { label: t('coach.tones.formal'),     prompt: t('coach.tonePrompts.formal') },
    { label: t('coach.tones.short'),      prompt: t('coach.tonePrompts.short') },
    { label: t('coach.tones.deep'),       prompt: t('coach.tonePrompts.deep') },
    { label: t('coach.tones.scientific'), prompt: t('coach.tonePrompts.scientific') },
    { label: t('coach.tones.empathic'),   prompt: t('coach.tonePrompts.empathic') },
  ], [t]);
}

/** Убирает markdown-разметку (**bold**, *italic*, `code`, ###) из строки,
 *  чтобы AI-ответ показывался как обычный читаемый текст. */
function stripMarkdown(text: string): string {
  if (!text) return text;
  return text
    .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')   // ***bold italic***
    .replace(/\*\*([^*]+)\*\*/g, '$1')       // **bold**
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1') // *italic*
    .replace(/__([^_]+)__/g, '$1')           // __bold__
    .replace(/`([^`]+)`/g, '$1')             // `code`
    .replace(/^#{1,6}\s+/gm, '')             // # headings
    .replace(/^\s*[-*]\s+/gm, '');           // bullet list markers
}

// ══════════════════════════════════════
// ЛОКАЛИЗАЦИЯ UI ДЛЯ ЭКРАНА ЗВОНКА
// ══════════════════════════════════════

interface CallUIStrings {
  aiSubtitles: string;
  waitingSubtitle: string;
  speaksLang: string;
  you: string;
  muted: string;
  autoAI: string;
  geminiLive: string;
  toPlayground: string;
  sentToPlayground: string;
  normalView: string;
  focusPiP: string;
  micOn: string;
  micOff: string;
  camOn: string;
  camOff: string;
  hangUp: string;
  // Список комнат
  roomsTitle: string;
  roomsSubtitle: string;
  createRoom: string;
  noRooms: string;
  noRoomsHint: string;
  participants: string;
  live: string;
  closed: string;
  // Валидация
  validating: string;
  accessDenied: string;
  backToRooms: string;
  // Live-статусы
  connecting: string;
  connected: string;
  connectionError: string;
  translatorJoining: string;
  translatorReady: string;
  cameraBlocked: string;
  // AI Coach
  coachHelp: string;
  coachTitle: string;
  coachPromptLabel: string;
  coachPromptPlaceholder: string;
  coachAsk: string;
  coachThinking: string;
  coachYourReply: string;
  coachCopy: string;
  coachCopied: string;
  coachPin: string;
  coachClose: string;
  // Качество связи
  connGood: string;
  connMedium: string;
  connPoor: string;
  connLost: string;
  // Дополнительные UI-строки звонка
  more: string;
  screenshareOn: string;
  screenshareOff: string;
  waitingPeer: string;
  roomFull: string;
  playgroundTip: string;
  normalViewSub: string;
  expandPeer: string;
  expandPeerSub: string;
  // Room actions (бottom-sheet «Ещё»)
  raTranslationEnable: string;
  raTranslationDisable: string;
  raTranslationEnableSub: string;
  raTranslationDisableSub: string;
  raSubtitlesShow: string;
  raSubtitlesHide: string;
  raSubtitlesSub: string;
  raCopyLink: string;
  raCopyLinkSub: string;
  raDelete: string;
  raDeleteSub: string;
  // Confirm delete dialog
  deleteConfirmTitle: string;
  deleteConfirmMessage: string;
  deleteConfirmAction: string;
  // Toasts
  toastJoined: string;
  toastLinkCopied: string;
  toastRenameFailed: string;
  toastDeleteFailed: string;
  // Paywall / billing
  paywallNoSub: string;
  paywallLowBalance: string;
  createRoomFailed: string;
  createRoomError: string;
}

// useCallUI собирает интерфейс CallUIStrings из i18next-ключей
// common.call.*, common.rooms.*, common.coach.* — это даёт:
//   • автоматическую смену языка через LanguageSwitcher (а не navigator);
//   • поддержку 100+ языков (старый CALL_UI содержал только ru/en);
//   • работу с RTL (направление выставляет i18n config).
function useCallUI(): CallUIStrings {
  const { t } = useTranslation('common');
  return useMemo<CallUIStrings>(() => ({
    aiSubtitles:        t('call.aiSubtitles'),
    waitingSubtitle:    t('call.waitingSubtitle'),
    speaksLang:         t('call.speaksLang'),
    you:                t('call.you'),
    muted:              t('call.muted'),
    autoAI:             t('call.autoAI'),
    geminiLive:         t('call.geminiLive'),
    toPlayground:       t('call.toPlayground'),
    sentToPlayground:   t('call.sentToPlayground'),
    normalView:         t('call.normalView'),
    focusPiP:           t('call.focusPiP'),
    micOn:              t('call.micOn'),
    micOff:             t('call.micOff'),
    camOn:              t('call.camOn'),
    camOff:             t('call.camOff'),
    hangUp:             t('call.hangUp'),
    roomsTitle:         t('rooms.title'),
    roomsSubtitle:      t('rooms.subtitle'),
    createRoom:         t('rooms.create'),
    noRooms:            t('rooms.empty'),
    noRoomsHint:        t('rooms.emptyHint'),
    participants:       t('rooms.participants'),
    live:               t('rooms.live'),
    closed:             t('rooms.closed'),
    validating:         t('call.validating'),
    accessDenied:       t('call.accessDenied'),
    backToRooms:        t('call.backToRooms'),
    connecting:         t('call.connecting'),
    connected:          t('call.connected'),
    connectionError:    t('call.connectionError'),
    translatorJoining:  t('call.translatorJoining'),
    translatorReady:    t('call.translatorReady'),
    cameraBlocked:      t('call.cameraBlocked'),
    coachHelp:          t('coach.help'),
    coachTitle:         t('coach.title'),
    coachPromptLabel:   t('coach.promptLabel'),
    coachPromptPlaceholder: t('coach.promptPlaceholder'),
    coachAsk:           t('coach.ask'),
    coachThinking:      t('coach.thinking'),
    coachYourReply:     t('coach.yourReply'),
    coachCopy:          t('coach.copy'),
    coachCopied:        t('coach.copied'),
    coachPin:           t('coach.pin'),
    coachClose:         t('coach.close'),
    connGood:           t('call.connGood'),
    connMedium:         t('call.connMedium'),
    connPoor:           t('call.connPoor'),
    connLost:           t('call.connLost'),
    more:               t('call.more'),
    screenshareOn:      t('call.screenshareOn'),
    screenshareOff:     t('call.screenshareOff'),
    waitingPeer:        t('call.waitingPeer'),
    roomFull:           t('call.roomFull'),
    playgroundTip:      t('call.playgroundTip'),
    normalViewSub:      t('call.normalViewSub'),
    expandPeer:         t('call.expandPeer'),
    expandPeerSub:      t('call.expandPeerSub'),
    raTranslationEnable:     t('roomActions.translation.enable'),
    raTranslationDisable:    t('roomActions.translation.disable'),
    raTranslationEnableSub:  t('roomActions.translation.enableSub'),
    raTranslationDisableSub: t('roomActions.translation.disableSub'),
    raSubtitlesShow:    t('roomActions.subtitles.show'),
    raSubtitlesHide:    t('roomActions.subtitles.hide'),
    raSubtitlesSub:     t('roomActions.subtitles.sub'),
    raCopyLink:         t('roomActions.copyLink'),
    raCopyLinkSub:      t('roomActions.copyLinkSub'),
    raDelete:           t('roomActions.delete'),
    raDeleteSub:        t('roomActions.deleteSub'),
    deleteConfirmTitle: t('rooms.confirmDelete.title'),
    deleteConfirmMessage: t('rooms.confirmDelete.message'),
    deleteConfirmAction: t('rooms.confirmDelete.confirm'),
    toastJoined:        t('rooms.toasts.joined', { room: '{{room}}' }),
    toastLinkCopied:    t('rooms.toasts.linkCopied'),
    toastRenameFailed:  t('rooms.toasts.renameFailed'),
    toastDeleteFailed:  t('rooms.toasts.deleteFailed'),
    paywallNoSub:       t('billing.paywallNoSub'),
    paywallLowBalance:  t('billing.paywallLowBalance'),
    createRoomFailed:   t('billing.createRoomFailed'),
    createRoomError:    t('billing.createRoomError'),
  }), [t]);
}

// ──────────────────────────────────
// Типы
// ──────────────────────────────────
interface RoomItem {
  id: string;
  name: string;
  langs?: string;
  users: number;
  active: boolean;
  isMine?: boolean;
  // ENTERPRISE v0.10.0
  kind?: 'video' | 'telegram_chat';
  telegramUsername?: string | null;
  telegramDisplayName?: string | null;
  tags?: Array<{ id: string; name: string; color: string | null; confidence: number | null }>;
}

// ══════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════
export function RoomPage() {
  const { roomId }  = useParams<{ roomId?: string }>();
  const navigate    = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { token, user, translationBalance } = useAppStore();
  const t = useCallUI();
  const { t: tc, i18n } = useTranslation('common');
  const coachPresets = useCoachPresets();

  // ── v0.9.0: Реальный список комнат с polling и live-индикацией ──
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const prevParticipantCountsRef = useRef<Map<string, number>>(new Map());
  // Inline rename state
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  // Delete confirm
  const [deletingRoom, setDeletingRoom] = useState<RoomItem | null>(null);
  // Toast «копировано» + «новый участник»
  const [roomsToast, setRoomsToast] = useState<{ kind: 'copy' | 'join'; text: string } | null>(null);
  // Highlight new-arrival rooms (для glow-анимации)
  const [highlightedRoomIds, setHighlightedRoomIds] = useState<Set<string>>(new Set());

  // Поиск по комнатам
  const [searchQuery, setSearchQuery] = useState('');
  // Активная вкладка списка комнат (показывается только если подключён Quest Flow или VibeAdd)
  const [activeRoomTab, setActiveRoomTab] = useState<'video' | 'quest' | 'vibeadd'>('video');
  // Признак "Quest Flow подключён" — есть хотя бы один активный API-ключ
  const [questFlowConnected, setQuestFlowConnected] = useState(false);
  // VibeAdd — будущая функция, пока всегда выключено
  const vibeAddConnected = false;
  const showRoomTabs = questFlowConnected || vibeAddConnected;

  /** Достаёт список моих комнат с бэка. Безопасно при отсутствии токена. */
  const loadRooms = async (signal?: AbortSignal) => {
    if (!token) return;
    try {
      const res = await fetch('/api/rooms', {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!res.ok) return;
      const data: RoomsResponse = await res.json();
      const arr: ApiRoom[] = data.rooms || [];
      const next: RoomItem[] = arr.map((r) => ({
        id: r.id,
        name: r.name,
        users: r.participantsCount || 0,
        active: !!r.isLive,
        isMine: true,
        // ENTERPRISE v0.10.0
        kind: r.kind || 'video',
        telegramUsername: r.telegramUsername || null,
        telegramDisplayName: r.telegramDisplayName || null,
        tags: Array.isArray(r.tags) ? r.tags : [],
      }));

      // Detect new arrivals — где participantsCount стал > предыдущего значения.
      const prev = prevParticipantCountsRef.current;
      const newArrivals: RoomItem[] = [];
      for (const r of next) {
        const prevCount = prev.get(r.id) ?? null;
        // Игнорируем первый запуск (prev пустой)
        if (prevCount !== null && r.users > prevCount) {
          newArrivals.push(r);
        }
      }
      // Обновляем prev
      const nextMap = new Map<string, number>();
      next.forEach((r) => nextMap.set(r.id, r.users));
      prevParticipantCountsRef.current = nextMap;

      if (newArrivals.length > 0) {
        const room = newArrivals[0];
        setRoomsToast({ kind: 'join', text: tc('rooms.toasts.joined', { room: formatRoomName(room.name, tc, i18n.language || 'en') }) });
        // Звук «pop» — короткий beep через Web Audio API (без файла).
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = 880; osc.type = 'sine';
          gain.gain.setValueAtTime(0.0001, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.35);
          setTimeout(() => ctx.close().catch(() => {}), 500);
        } catch { /* tab inactive — browser blocks audio */ }
        // Highlight
        setHighlightedRoomIds((set) => {
          const ns = new Set(set);
          newArrivals.forEach((r) => ns.add(r.id));
          return ns;
        });
        setTimeout(() => {
          setHighlightedRoomIds((set) => {
            const ns = new Set(set);
            newArrivals.forEach((r) => ns.delete(r.id));
            return ns;
          });
        }, 4000);
        setTimeout(() => setRoomsToast(null), 4000);
      }

      setRooms(next);
    } catch (e: any) {
      if (e?.name !== 'AbortError') console.warn('[Rooms] load error:', e);
    }
  };

  // Initial load + polling каждые 8 сек, только когда juzer на странице /room (не внутри конкретной комнаты)
  useEffect(() => {
    if (roomId) return; // на странице комнаты не polling'ом
    const ac = new AbortController();
    setRoomsLoading(true);
    loadRooms(ac.signal).finally(() => setRoomsLoading(false));
    const id = setInterval(() => loadRooms(), 8000);
    return () => { ac.abort(); clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, roomId]);

  /** Rename — inline edit submit */
  const submitRename = async (id: string) => {
    const name = editingName.trim();
    if (!name) { setEditingRoomId(null); return; }
    try {
      const res = await fetch(`/api/rooms/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      setRooms((arr) => arr.map((r) => r.id === id ? { ...r, name } : r));
    } catch (e: any) {
      showToast(e.message || t.toastRenameFailed, 'error');
    } finally {
      setEditingRoomId(null);
    }
  };

  /** Hard delete. 404 трактуем как успех — комнаты уже нет на сервере. */
  const submitDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/rooms/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404 || res.ok) {
        // Уже нет / удалили только что — просто убираем из локального списка.
        setRooms((arr) => arr.filter((r) => r.id !== id));
      } else {
        throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      }
    } catch (e: any) {
      showToast(e.message || t.toastDeleteFailed, 'error');
    } finally {
      setDeletingRoom(null);
    }
  };

  /** Copy room link */
  const copyRoomLink = async (id: string) => {
    const url = `${window.location.origin}/room/${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
    }
    setRoomsToast({ kind: 'copy', text: t.toastLinkCopied });
    setTimeout(() => setRoomsToast(null), 2500);
  };

  /**
   * «Чат» → бесшовный вход в Chatwoot (SSO).
   *
   * Спрашиваем мост: если он настроен (Platform App token задан в супер-админке) —
   * открываем SSO-ссылку Chatwoot в новой вкладке (агент уже залогинен; для
   * видеозвонка автоматически создаётся диалог-канал «видеозвонок»). Если мост не
   * настроен / провижининг не удался — откатываемся на внутренний чат VibeVox.
   *
   * Пустую вкладку открываем СИНХРОННО на клик (иначе popup-blocker заблокирует
   * window.open после await) и заполняем URL уже после ответа моста.
   */
  const openChat = async (room: { id: string }) => {
    const win = window.open('', '_blank');
    try {
      // Передаём выбранный в VibeVox язык → Chatwoot откроется на нём (маппинг на его локали).
      const lng = encodeURIComponent(i18n.language || 'en');
      const res = await fetch(`/api/chatwoot-bridge/open?roomId=${room.id}&lang=${lng}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({} as any));
      if (res.ok && data?.configured && data?.url) {
        if (win) win.location.href = data.url;
        else window.location.href = data.url; // вкладка заблокирована — откроем в текущей
        return;
      }
    } catch { /* откат на внутренний чат ниже */ }
    if (win) win.close();
    navigate(`/room/${room.id}/chat`);
  };

  // ── Состояния валидации ──
  const [isValidating,   setIsValidating]   = useState(false);
  const [validationError,setValidationError] = useState<string | null>(null);
  const [roomName,       setRoomName]        = useState('');

  // ── Состояния звонка ──
  const [joined,       setJoined]       = useState(false);
  const [guestName,    setGuestName]    = useState(sessionStorage.getItem('vibevox_guest_name') || user?.name || '');
  const [targetLang,   setTargetLang]   = useState('ru');
  const [micActive,    setMicActive]    = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [activeSpeaker,setActiveSpeaker]= useState<'local' | 'remote'>('remote');
  const [playgroundToast, setPlaygroundToast] = useState(false);

  // Paywall: открывается, когда бэк отвечает 402 на /api/rooms/create
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallTitle, setPaywallTitle] = useState<string | undefined>(undefined);

  // Кастомный confirm-диалог (вместо браузерного confirm())
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message?: React.ReactNode;
    confirmLabel?: string;
    variant?: 'primary' | 'danger';
    onConfirm: () => void;
  } | null>(null);

  // ── Picture-in-Picture ──
  const [focusMode, setFocusMode] = useState(false);
  const [pipPos,    setPipPos]    = useState({ x: 16, y: 100 });
  const isDraggingRef  = useRef(false);
  const dragStartRef   = useRef({ x: 0, y: 0 });
  const pipStartPosRef = useRef({ x: 16, y: 100 });

  // ── LiveKit состояние ──
  type LiveStatus = 'idle' | 'connecting' | 'connected' | 'translatorStarting' | 'translatorReady' | 'error';
  type LinkQuality = 'good' | 'medium' | 'poor' | 'lost';
  const [liveStatus,   setLiveStatus]   = useState<LiveStatus>('idle');
  const [liveError,    setLiveError]    = useState<string | null>(null);
  const [lobbyError,   setLobbyError]   = useState<string | null>(null);
  const [remoteName,   setRemoteName]   = useState<string>('');
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [hasLocalVideo,  setHasLocalVideo]  = useState(false);
  const [linkQuality, setLinkQuality] = useState<LinkQuality>('good');
  const roomRef          = useRef<Room | null>(null);
  const localVideoRef    = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef   = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef   = useRef<HTMLAudioElement | null>(null);

  // ── Субтитры (data channel feed) ──
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [pendingSubtitle, setPendingSubtitle] = useState<string>('');
  const subtitleSeqRef = useRef(0);

  // ── AI Coach ──
  const [coachResult, setCoachResult] = useState<CoachResult | null>(null);
  const [coachPromptDraft, setCoachPromptDraft] = useState<string>('');
  const coachAbortRef = useRef<AbortController | null>(null);

  // ── Billing уведомления (low_balance / quota_exhausted) ──
  const [billingNotice, setBillingNotice] = useState<{ kind: 'low_balance' | 'quota_exhausted'; remainingMinutes: number } | null>(null);
  const [topupBusy, setTopupBusy] = useState(false);

  // ── v0.8.0: creator info + room settings + screen share + insights ──
  const [creatorTenantId, setCreatorTenantId] = useState<string | null>(null);
  const [roomSettings, setRoomSettings] = useState<{ translationEnabled: boolean; subtitlesEnabled: boolean }>({
    translationEnabled: true,
    subtitlesEnabled: true,
  });
  const [localScreenShareOn, setLocalScreenShareOn] = useState(false);
  const [remoteScreenShareIdentity, setRemoteScreenShareIdentity] = useState<string | null>(null);
  const localScreenShareVideoRef = useRef<HTMLVideoElement>(null);
  const remoteScreenShareVideoRef = useRef<HTMLVideoElement>(null);
  // Транскрипт для post-call insights (Enterprise only)
  const transcriptBufferRef = useRef<Array<{ author: string; text: string; ts: number; isFinal: boolean }>>([]);
  const [insightsModalOpen, setInsightsModalOpen] = useState(false);
  const [insightsData, setInsightsData] = useState<any>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  // v0.8.2: bottom-sheet overflow для второстепенных кнопок (mobile-friendly).
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  // v0.8.3: длительность звонка (с момента успешного подключения к LiveKit).
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [callDurationSec, setCallDurationSec] = useState(0);

  const isCreator = !!user?.tenantId && !!creatorTenantId && user.tenantId === creatorTenantId;
  // ENTERPRISE v0.10.0 — реактивный hook вместо хардкод-superadmin
  const isEnterprise = useIsEnterprise();

  // ── Проверка подключения Quest Flow (есть ли активный API-ключ) ──
  // Запускается один раз на маунт списка комнат — вкладки появляются мгновенно,
  // даже если у пользователя ещё нет ни одной QF-комнаты.
  useEffect(() => {
    if (roomId || !token || !isEnterprise) {
      setQuestFlowConnected(false);
      return;
    }
    const ac = new AbortController();
    fetch('/api/quest-flow/keys', {
      headers: { Authorization: `Bearer ${token}` },
      signal: ac.signal,
    })
      .then((r) => (r.ok ? r.json() : { keys: [] }))
      .then((d) => {
        const active = (d.keys || []).some((k: any) => !k.revokedAt);
        setQuestFlowConnected(active);
      })
      .catch(() => { /* offline / 401 → tabs просто не появятся */ });
    return () => ac.abort();
  }, [roomId, token, isEnterprise]);

  // Если вкладки исчезли — вернуть активную вкладку на video.
  useEffect(() => {
    if (!showRoomTabs && activeRoomTab !== 'video') setActiveRoomTab('video');
  }, [showRoomTabs, activeRoomTab]);

  // Отфильтрованный список — по активной вкладке и поисковому запросу.
  const filteredRooms = useMemo(() => {
    let result = rooms;
    if (showRoomTabs) {
      if (activeRoomTab === 'video') {
        result = result.filter((r) => !r.kind || r.kind === 'video');
      } else if (activeRoomTab === 'quest') {
        result = result.filter((r) => r.kind === 'telegram_chat');
      } else if (activeRoomTab === 'vibeadd') {
        // VibeAdd — будущая функция, пока никакая kind не подходит → пустой список.
        result = [];
      }
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        (r.telegramDisplayName?.toLowerCase().includes(q) ?? false) ||
        (r.telegramUsername?.toLowerCase().includes(q) ?? false) ||
        (r.langs?.toLowerCase().includes(q) ?? false) ||
        (r.tags?.some((tg) => tg.name.toLowerCase().includes(q)) ?? false)
      );
    }
    return result;
  }, [rooms, activeRoomTab, searchQuery, showRoomTabs]);

  // ── Валидация комнаты при наличии roomId ──
  useEffect(() => {
    if (!roomId) { setJoined(false); return; }
    // cancelled-guard: при быстрой смене roomId или размонтировании ответ
    // старого fetch не должен делать setState (race + setState-after-unmount).
    let cancelled = false;
    setIsValidating(true);
    setValidationError(null);

    fetch(`/api/rooms/validate/${roomId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Ссылка на комнату недействительна или срок действия (24 часа) истёк');
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setRoomName(data.roomName);
        setCreatorTenantId(data.creatorTenantId || null);
        if (data.settings) setRoomSettings(data.settings);
        const savedName = sessionStorage.getItem('vibevox_guest_name');
        const savedLang = sessionStorage.getItem('vibevox_target_lang');
        if (savedName && savedLang) {
          setGuestName(savedName);
          setTargetLang(savedLang);
          setJoined(true);
        }
        setIsValidating(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setValidationError(err.message || 'Ошибка валидации комнаты');
        setIsValidating(false);
      });
    return () => { cancelled = true; };
  }, [roomId]);

  // ── v0.8.3: Тикер длительности звонка (раз в секунду) ──
  useEffect(() => {
    if (!callStartTime) return;
    setCallDurationSec(Math.floor((Date.now() - callStartTime) / 1000));
    const id = setInterval(() => {
      setCallDurationSec(Math.floor((Date.now() - callStartTime) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [callStartTime]);

  // ── Синхронизация имени пользователя ──
  useEffect(() => {
    const savedName = sessionStorage.getItem('vibevox_guest_name');
    if (user?.name && !savedName) {
      setGuestName(user.name);
    }
  }, [user?.name]);

  // ── Реальное подключение к LiveKit ──
  useEffect(() => {
    if (!joined || !roomId) return;

    let cancelled = false;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    // Подписки на события удалённых треков
    const attachTrack = (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      // Бот-переводчик публикует аудио → подключаем к скрытому <audio>
      if (participant.identity === TRANSLATOR_BOT_IDENTITY) {
        if (track.kind === Track.Kind.Audio && remoteAudioRef.current) {
          track.attach(remoteAudioRef.current);
        }
        return;
      }
      // Screen share remote — отдельная большая плитка
      if (publication.source === Track.Source.ScreenShare && track.kind === Track.Kind.Video) {
        if (remoteScreenShareVideoRef.current) track.attach(remoteScreenShareVideoRef.current);
        setRemoteScreenShareIdentity(participant.identity);
        return;
      }
      // Обычный участник: видео в основной экран, аудио — для голоса собеседника
      if (track.kind === Track.Kind.Video && remoteVideoRef.current) {
        track.attach(remoteVideoRef.current);
        setHasRemoteVideo(true);
      }
      if (track.kind === Track.Kind.Audio && remoteAudioRef.current) {
        track.attach(remoteAudioRef.current);
      }
      setRemoteName(participant.name || participant.identity);
    };

    room
      .on(RoomEvent.TrackSubscribed, (track, pub, participant) => attachTrack(track, pub, participant))
      .on(RoomEvent.TrackUnsubscribed, (track, publication) => {
        track.detach();
        if (publication.source === Track.Source.ScreenShare) {
          setRemoteScreenShareIdentity(null);
        } else if (track.kind === Track.Kind.Video) {
          setHasRemoteVideo(false);
        }
      })
      .on(RoomEvent.ParticipantConnected, (participant) => {
        if (participant.identity === TRANSLATOR_BOT_IDENTITY) {
          setLiveStatus('translatorReady');
        } else {
          setRemoteName(participant.name || participant.identity);
        }
      })
      .on(RoomEvent.ParticipantDisconnected, (participant) => {
        if (participant.identity === TRANSLATOR_BOT_IDENTITY) {
          setLiveStatus('connected');
        } else {
          setRemoteName('');
          setHasRemoteVideo(false);
        }
      })
      .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        if (speakers.length === 0) return;
        // Игнорируем бота при детекте активного говорящего
        const real = speakers.find((s) => s.identity !== TRANSLATOR_BOT_IDENTITY);
        if (!real) return;
        setActiveSpeaker(real.isLocal ? 'local' : 'remote');
      })
      .on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
        // Настройки комнаты — приходят от backend (PATCH /api/rooms/:id/settings → broadcast)
        if (topic === 'room-settings') {
          try {
            const json = JSON.parse(new TextDecoder().decode(payload));
            setRoomSettings({
              translationEnabled: json.translationEnabled !== false,
              subtitlesEnabled: json.subtitlesEnabled !== false,
            });
          } catch { /* ignore */ }
          return;
        }
        // Билинговые уведомления от бота
        if (topic === 'billing') {
          try {
            const json = JSON.parse(new TextDecoder().decode(payload));
            if (json.type === 'billing' && (json.kind === 'low_balance' || json.kind === 'quota_exhausted')) {
              setBillingNotice({ kind: json.kind, remainingMinutes: json.remainingMinutes ?? 0 });
            }
          } catch { /* ignore */ }
          return;
        }
        // Принимаем только субтитры от бота-переводчика
        if (topic !== 'subtitle') return;
        if (participant && participant.identity !== TRANSLATOR_BOT_IDENTITY) return;
        try {
          const json = JSON.parse(new TextDecoder().decode(payload));
          if (json.type !== 'subtitle') return;
          if (json.isFinal) {
            // Финал реплики — пушим в feed, чистим pending
            const finalText = (json.fullText || '').trim();
            if (finalText) {
              subtitleSeqRef.current += 1;
              const entry: SubtitleEntry = {
                id: `sub-${Date.now()}-${subtitleSeqRef.current}`,
                speakerIdentity: json.speakerIdentity,
                speakerLanguage: json.speakerLanguage,
                targetLanguage: json.targetLanguage,
                text: finalText,
                timestamp: json.timestamp || Date.now(),
                isFinal: true,
              };
              setSubtitles((prev) => [...prev.slice(-19), entry]);
              // Транскрипт для post-call insights (Enterprise)
              transcriptBufferRef.current.push({
                author: json.speakerIdentity || 'speaker',
                text: finalText,
                ts: json.timestamp || Date.now(),
                isFinal: true,
              });
              if (transcriptBufferRef.current.length > 5000) {
                transcriptBufferRef.current = transcriptBufferRef.current.slice(-5000);
              }
            }
            setPendingSubtitle('');
          } else {
            // Streaming chunk — обновляем pending
            setPendingSubtitle((json.fullText || '').trim());
          }
        } catch (parseErr) {
          console.warn('[Room] Не удалось распарсить subtitle payload:', parseErr);
        }
      })
      .on(RoomEvent.ConnectionQualityChanged, (quality, lkParticipant) => {
        // Слушаем качество только своей связи (локального участника)
        if (!lkParticipant.isLocal) return;
        switch (quality) {
          case ConnectionQuality.Excellent:
          case ConnectionQuality.Good:
            setLinkQuality('good'); break;
          case ConnectionQuality.Poor:
            setLinkQuality('poor'); break;
          case ConnectionQuality.Lost:
            setLinkQuality('lost'); break;
          default:
            setLinkQuality('medium');
        }
      })
      .on(RoomEvent.Disconnected, () => {
        setLiveStatus('idle');
        setLinkQuality('lost');
      });

    (async () => {
      try {
        setLiveStatus('connecting');
        setLiveError(null);

        // 1. Токен + URL от бэкенда
        const identity = `${guestName || 'guest'}-${Math.random().toString(36).slice(2, 8)}`;
        const tokenRes = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: roomId,
            identity,
            nativeLanguage: targetLang,
            voiceGender: 'female',
          }),
        });
        if (!tokenRes.ok) {
          const err = await tokenRes.json().catch(() => ({}));
          if (tokenRes.status === 403 && err.error === 'room_full') {
            setLobbyError('room_full');
            setJoined(false);
            return;
          }
          // Admission control: сервис перевода перегружен (глобальный лимит сессий).
          if (tokenRes.status === 503 && err.error === 'service_overloaded') {
            setLobbyError('service_overloaded');
            setJoined(false);
            return;
          }
          throw new Error(err.error || `LiveKit token error: HTTP ${tokenRes.status}`);
        }
        const { token: lkToken, url: lkUrl } = await tokenRes.json();
        if (cancelled) return;

        // 2. Подключение к комнате
        await room.connect(lkUrl, lkToken);
        if (cancelled) { await room.disconnect(); return; }
        setLiveStatus('connected');
        setCallStartTime(Date.now()); // v0.8.3: засекаем время звонка

        // 3. Публикация микрофона и камеры
        // v0.8.2: возвращаем echoCancellation + noiseSuppression (это безопасно), но УБИРАЕМ
        // autoGainControl — он усиливает тишину между словами, Gemini трактует это как ровный
        // continuous input и «тянет» гласные/согласные. Без него перевод звучит естественно.
        try {
          await room.localParticipant.setMicrophoneEnabled(true, {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false,
          });
          await room.localParticipant.setCameraEnabled(true);
          setHasLocalVideo(true);
          if (localVideoRef.current) {
            const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
            camPub?.videoTrack?.attach(localVideoRef.current);
          }
        } catch (mediaErr) {
          console.warn('[Room] Не удалось получить медиа:', mediaErr);
          setLiveError(t.cameraBlocked);
        }

        // 4. Запуск бота-переводчика (idempotent — backend вернёт 409 если уже запущен)
        setLiveStatus('translatorStarting');
        try {
          const startRes = await fetch('/api/translation/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomName: roomId }),
          });
          if (startRes.ok || startRes.status === 409) {
            setLiveStatus('translatorReady');
          } else {
            const err = await startRes.json().catch(() => ({}));
            console.warn('[Room] Не удалось запустить переводчика:', err);
            setLiveStatus('connected');
          }
        } catch (translatorErr) {
          console.warn('[Room] Ошибка запуска переводчика:', translatorErr);
          setLiveStatus('connected');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[Room] Ошибка подключения к LiveKit:', err);
        setLiveError((err as Error).message || t.connectionError);
        setLiveStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      try { room.disconnect(); } catch { /* ignore */ }
      roomRef.current = null;
      setHasRemoteVideo(false);
      setHasLocalVideo(false);
      setRemoteName('');
    };
  }, [joined, roomId, guestName, targetLang, t.cameraBlocked, t.connectionError]);

  // ── Реакция на тогглы микрофона/камеры ──
  useEffect(() => {
    const room = roomRef.current;
    if (!room || liveStatus === 'idle' || liveStatus === 'connecting') return;
    room.localParticipant.setMicrophoneEnabled(micActive).catch((err) => {
      console.warn('[Room] setMicrophoneEnabled error:', err);
    });
  }, [micActive, liveStatus]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || liveStatus === 'idle' || liveStatus === 'connecting') return;
    room.localParticipant.setCameraEnabled(cameraActive).then(() => {
      setHasLocalVideo(cameraActive);
      if (cameraActive && localVideoRef.current) {
        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        camPub?.videoTrack?.attach(localVideoRef.current);
      }
    }).catch((err) => {
      console.warn('[Room] setCameraEnabled error:', err);
    });
  }, [cameraActive, liveStatus]);

  // ── Создание комнаты ──
  // v0.9.1: создание комнаты идёт через модал с полем имени.
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  // Защита от двойного вызова ?create=true — React StrictMode в dev запускает эффекты дважды.
  // useRef сохраняет значение между двумя запусками эффекта StrictMode (до полного размонтирования),
  // при настоящем unmount → remount (навигация) компонент пересоздаётся и ref сбрасывается.
  const createRoomFiredRef = useRef(false);

  /** Сформировать дефолтное имя как токен `__DEFAULT_ROOM__|userName|ISO`.
   *  Рендеринг во view-слое (formatRoomName) подставит локализованную дату и
   *  слово «Комната»/«Room»/«Sala»/… согласно UI-языку просматривающего. */
  const defaultRoomName = (): string =>
    buildDefaultRoomNameToken(user?.name || tc('defaultRoom.guestName'));

  /**
   * Создаёт комнату немедленно (без промежуточного модала «Новая комната»)
   * и переходит в лобби. Если баланса нет — показывает paywall.
   */
  const handleCreateRoom = async () => {
    if (translationBalance <= 0) {
      setPaywallTitle(t.paywallLowBalance);
      setPaywallOpen(true);
      return;
    }
    const name = defaultRoomName();
    setCreating(true);
    const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({ name }),
      });
      if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        setPaywallTitle(
          data.reason === 'no_subscription'
            ? t.paywallNoSub
            : t.paywallLowBalance
        );
        setPaywallOpen(true);
        return;
      }
      if (!res.ok) throw new Error(t.createRoomFailed);
      const data = await res.json();
      navigate(`/room/${data.roomId}`);
    } catch (err) {
      showToast((err as Error).message || t.createRoomError, 'error');
    } finally {
      setCreating(false);
    }
  };

  // Триггер создания по query-параметру ?create=true (приходит с мобильных CTA).
  useEffect(() => {
    if (roomId) return;
    if (searchParams.get('create') !== 'true') return;
    // StrictMode guard: ref остаётся true между двумя запусками одного mount-цикла,
    // но сбрасывается при настоящем unmount (навигация) — второй вызов блокируется.
    if (createRoomFiredRef.current) return;
    createRoomFiredRef.current = true;
    handleCreateRoom();
    // Сразу убираем параметр, чтобы повторно не сработало при ре-рендере.
    const next = new URLSearchParams(searchParams);
    next.delete('create');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, roomId, translationBalance]);

  /** Реальный POST после подтверждения имени в модале. */
  const submitCreateRoom = async () => {
    const finalName = (createName || '').trim() || defaultRoomName();
    setCreating(true);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: finalName }),
      });

      if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        setPaywallTitle(
          data.reason === 'no_subscription'
            ? t.paywallNoSub
            : t.paywallLowBalance
        );
        setPaywallOpen(true);
        setCreateModalOpen(false);
        return;
      }

      if (!res.ok) throw new Error(t.createRoomFailed);
      const data = await res.json();
      setCreateModalOpen(false);
      navigate(`/room/${data.roomId}`);
    } catch (err) {
      showToast((err as Error).message || t.createRoomError, 'error');
    } finally {
      setCreating(false);
    }
  };

  /** Пустые комнаты пользователя (≤ 0 участников) — для предложения «у вас есть свободная». */
  const emptyRooms = rooms.filter((r) => r.users === 0).slice(0, 3);

  const handleJoinFromLobby = (name: string, lang: string) => {
    setLobbyError(null);
    setGuestName(name);
    setTargetLang(lang);
    setJoined(true);
  };

  const handleHangUp = async () => {
    const room = roomRef.current;
    if (room) {
      try { room.disconnect(); } catch { /* ignore */ }
      roomRef.current = null;
    }
    if (roomId) {
      fetch('/api/translation/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: roomId }),
      }).catch(() => { /* silent */ });
    }

    // Если creator + Enterprise + есть транскрипт → сохраняем и предлагаем анализ.
    const transcript = transcriptBufferRef.current;
    const shouldOfferInsights = isCreator && isEnterprise && roomId && transcript.length >= 2;
    if (shouldOfferInsights) {
      // НЕ редиректим сразу — оставляем юзера в комнате, показываем модал с insights.
      try {
        await fetch(`/api/rooms/${roomId}/transcripts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ transcripts: transcript }),
        });
      } catch { /* ignore */ }
      setInsightsModalOpen(true);
      setInsightsLoading(true);
      setInsightsError(null);
      try {
        const res = await fetch(`/api/insights/analyze/${roomId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setInsightsData(data.insights);
      } catch (e: any) {
        setInsightsError(e.message || 'Не удалось проанализировать разговор');
      } finally {
        setInsightsLoading(false);
      }
      // Дальше: при закрытии модала выходим (cleanup ниже).
      return;
    }

    cleanupAndExit();
  };

  /** Полный cleanup state + navigate /room. Вызывается из handleHangUp или из закрытия insights-модала. */
  const cleanupAndExit = () => {
    setJoined(false);
    setLiveStatus('idle');
    setLinkQuality('good');
    setHasRemoteVideo(false);
    setHasLocalVideo(false);
    setRemoteName('');
    setSubtitles([]);
    setPendingSubtitle('');
    setCoachResult(null);
    setCoachPromptDraft('');
    transcriptBufferRef.current = [];
    setInsightsModalOpen(false);
    setInsightsData(null);
    setInsightsError(null);
    setCallStartTime(null);
    setCallDurationSec(0);
    if (coachAbortRef.current) { coachAbortRef.current.abort(); coachAbortRef.current = null; }
    sessionStorage.removeItem('vibevox_guest_name');
    sessionStorage.removeItem('vibevox_target_lang');
    navigate('/');
  };

  // ── Screen Share ──
  const handleToggleScreenShare = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      const next = !localScreenShareOn;
      await room.localParticipant.setScreenShareEnabled(next);
      setLocalScreenShareOn(next);
      // Локальный track screenshare прикрепим к нашему video для отображения
      if (next) {
        setTimeout(() => {
          const pub = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
          if (pub?.videoTrack && localScreenShareVideoRef.current) {
            pub.videoTrack.attach(localScreenShareVideoRef.current);
          }
        }, 100);
      }
    } catch (err) {
      console.warn('[Room] screen share toggle error:', err);
      showToast((err as Error).message || 'Не удалось включить демонстрацию экрана', 'error');
    }
  };

  // ── Toggle перевода / субтитров (только creator) ──
  const updateRoomSettings = async (patch: { translationEnabled?: boolean; subtitlesEnabled?: boolean }) => {
    if (!isCreator || !roomId) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setRoomSettings(data.settings);
      // Если только что включили перевод — заново запускаем bridge
      if (patch.translationEnabled === true) {
        setLiveStatus('translatorStarting');
        await fetch('/api/translation/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ roomName: roomId, targetLanguage: targetLang, voiceGender: 'female' }),
        }).catch(() => {});
      } else if (patch.translationEnabled === false) {
        setLiveStatus('connected'); // комната без бота — обычный видеозвонок
      }
    } catch (err: any) {
      showToast(err.message || 'Не удалось обновить настройки комнаты', 'error');
    }
  };

  // ── AI Coach: запуск streaming запроса ──
  const askCoach = async (subtitle: SubtitleEntry, customPrompt: string) => {
    if (coachAbortRef.current) coachAbortRef.current.abort();
    const controller = new AbortController();
    coachAbortRef.current = controller;

    setCoachResult({
      subtitleId: subtitle.id,
      subtitleText: subtitle.text,
      prompt: customPrompt,
      answer: '',
      loading: true,
      pinned: false,
    });

    // Если пользователь ввёл развёрнутый запрос (>12 символов) — трактуем его
    // как свободный вопрос, а не как модификатор тона. AI получает customPrompt
    // как основной subject и отвечает именно на него.
    const trimmedPrompt = customPrompt.trim();
    const isFreeForm = trimmedPrompt.length > 12;
    const finalSubjectText = isFreeForm ? trimmedPrompt : subtitle.text;
    const finalToneInstruction = isFreeForm ? undefined : trimmedPrompt;

    try {
      const res = await fetch('/api/coach/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtitleText: finalSubjectText,
          speakerLanguage: subtitle.speakerLanguage,
          myLanguage: targetLang,
          customPrompt: finalToneInstruction || undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setCoachResult((prev) => prev && prev.subtitleId === subtitle.id ? { ...prev, answer: acc } : prev);
      }
      setCoachResult((prev) => prev && prev.subtitleId === subtitle.id ? { ...prev, loading: false } : prev);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[Coach] Ошибка:', err);
      setCoachResult((prev) => prev && prev.subtitleId === subtitle.id
        ? { ...prev, loading: false, answer: prev.answer + `\n\n[Ошибка: ${err.message || String(err)}]` }
        : prev);
    } finally {
      if (coachAbortRef.current === controller) coachAbortRef.current = null;
    }
  };

  // ── Быстрая докупка минут прямо из комнаты ──
  const handleQuickTopup = async (minutes: number) => {
    setTopupBusy(true);
    try {
      const res = await fetch('/api/billing/topup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ minutes, currency: 'eur', returnUrl: window.location.href }),
      });
      const text = await res.text();
      let data: any = {};
      if (text.trim()) { try { data = JSON.parse(text); } catch { /* */ } }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('Stripe Checkout URL не получен');
      }
    } catch (err: any) {
      showToast(`Не удалось открыть докупку: ${err.message || err}`, 'error');
      setTopupBusy(false);
    }
  };

  // ── Открытие AI Coach по клику на субтитр (premium-фича: только creator комнаты) ──
  const openCoachFor = (subtitle: SubtitleEntry) => {
    if (!isCreator) return; // гости не имеют доступа к AI Coach
    setCoachPromptDraft('');
    askCoach(subtitle, '');
  };

  // ── Авто-скрытие неприбитой подсказки через 30 секунд ──
  useEffect(() => {
    if (!coachResult || coachResult.loading || coachResult.pinned) return;
    const timer = setTimeout(() => {
      setCoachResult((prev) => prev && !prev.pinned ? null : prev);
    }, 30000);
    return () => clearTimeout(timer);
  }, [coachResult?.subtitleId, coachResult?.loading, coachResult?.pinned]);

  // ── Отмена стриминга AI-коуча при размонтировании ──
  // cleanupAndExit() отменяет coachAbortRef при штатном выходе из комнаты, но
  // при размонтировании иным путём (смена роута) стриминг-fetch продолжался бы
  // и делал setState после unmount. Гарантируем отмену.
  useEffect(() => {
    return () => { coachAbortRef.current?.abort(); };
  }, []);

  // ── Drag-and-Drop для PiP ──
  const onDragStart = (clientY: number, clientX: number) => {
    isDraggingRef.current = true;
    dragStartRef.current   = { x: clientX, y: clientY };
    pipStartPosRef.current = { ...pipPos };
  };
  const onDragMove = (clientY: number, clientX: number) => {
    if (!isDraggingRef.current) return;
    const dx   = clientX - dragStartRef.current.x;
    const dy   = clientY - dragStartRef.current.y;
    const pad  = 8;
    const newX = Math.max(pad, Math.min(window.innerWidth  - 150 - pad, pipStartPosRef.current.x - dx));
    const newY = Math.max(pad, Math.min(window.innerHeight - 200 - pad, pipStartPosRef.current.y - dy));
    setPipPos({ x: newX, y: newY });
  };
  const onDragEnd = () => { isDraggingRef.current = false; };

  // ────────────────────────────────────
  // РЕНДЕР 1: Валидация
  // ────────────────────────────────────
  if (isValidating) {
    return (
      <div
        className="min-h-[100dvh] flex flex-col items-center justify-center gap-4"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div
          className="w-16 h-16 rounded-3xl flex items-center justify-center"
          style={{ background: 'rgba(59,130,246,0.10)' }}
        >
          <Loader2 size={28} strokeWidth={1.5} className="animate-spin" style={{ color: '#3B82F6' }} />
        </div>
        <p className="text-sm font-500" style={{ color: 'var(--text-muted)' }}>
          {t.validating}
        </p>
      </div>
    );
  }

  // ────────────────────────────────────
  // РЕНДЕР 2: Ошибка валидации
  // ────────────────────────────────────
  if (roomId && validationError) {
    return (
      <div
        className="min-h-[100dvh] flex items-center justify-center p-4"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div
          className="w-full max-w-sm text-center p-8 rounded-3xl"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid rgba(239,68,68,0.15)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(239,68,68,0.10)', color: '#FCA5A5' }}
          >
            <AlertTriangle size={32} strokeWidth={1.5} />
          </div>
          <h2
            className="text-xl font-700 mb-2"
            style={{ fontFamily: 'Geist Sans, sans-serif', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
          >
            {t.accessDenied}
          </h2>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {validationError}
          </p>
          <AuroraButton fullWidth onClick={() => navigate('/')} id="lobby-error-back">
            {t.backToRooms}
          </AuroraButton>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────
  // РЕНДЕР 3: Лобби
  // ────────────────────────────────────
  if (roomId && !joined) {
    return <RoomLobbyPage roomName={roomName} onJoin={handleJoinFromLobby} isCreator={isCreator} onClose={() => navigate('/')} lobbyError={lobbyError} />;
  }

  // ────────────────────────────────────
  // РЕНДЕР 4: Активный звонок
  // ────────────────────────────────────
  if (roomId && joined) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col overflow-hidden select-none"
        style={{ background: '#030308' }}
      >
        {/* ═══════════════════════════════════
            ВЕРХНИЙ SCRIM (100px) — защита текста
            ═══════════════════════════════════ */}
        <div
          className="absolute top-0 left-0 right-0 pointer-events-none"
          style={{
            height: '100px',
            zIndex: 15,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.08) 75%, transparent 100%)',
          }}
        />

        {/* Верхний статус-бар убран в v0.10.21 — мини-индикаторы (язык/таймер/связь)
            теперь живут одной строкой под логотипом «VIBEVOX» поверх ленты субтитров. */}

        {/* ═══════════════════════════════════
            ВИДЕОПОТОКИ — мобильная сетка
            ═══════════════════════════════════ */}
        <div className="flex-1 w-full h-full relative flex flex-col md:flex-row gap-1.5 p-1.5 overflow-hidden">

          {/* Remote видео — основной экран */}
          <div
            onClick={() => setFocusMode(!focusMode)}
            className={`relative rounded-3xl overflow-hidden cursor-pointer transition-all duration-300 ${
              focusMode
                ? 'absolute inset-0 z-10 m-0 rounded-none'
                : 'flex-1'
            }`}
            style={{
              background: 'linear-gradient(180deg, #0D0D1A 0%, #06060F 100%)',
              border: activeSpeaker === 'remote'
                ? '2px solid rgba(59,130,246,0.50)'
                : '1px solid rgba(255,255,255,0.03)',
              boxShadow: activeSpeaker === 'remote' ? '0 0 32px rgba(59,130,246,0.15)' : 'none',
            }}
          >
            {/* Реальное видео удалённого участника (LiveKit attach) */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              style={{ display: hasRemoteVideo ? 'block' : 'none' }}
            />
            {/* Скрытый аудио-элемент: голос собеседника + переведённое аудио бота */}
            <audio ref={remoteAudioRef} autoPlay />
            {/* Fallback: аватар, если видео ещё не пришло */}
            {!hasRemoteVideo && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="relative inline-block">
                    <AvatarCircle
                      name={remoteName || 'Participant'}
                      size="xl"
                      status={activeSpeaker === 'remote' ? 'live' : 'online'}
                      className="mx-auto"
                    />
                    {activeSpeaker === 'remote' && (
                      <div
                        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: '#3B82F6', boxShadow: '0 0 16px rgba(59,130,246,0.50)' }}
                      >
                        <Volume2 size={13} strokeWidth={2} className="text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-600 text-white text-scrim mt-3">
                    {remoteName || (liveStatus === 'connected' || liveStatus === 'translatorReady' ? t.waitingPeer : t.connecting)}
                  </p>
                </div>
              </div>
            )}
            {/* Бейдж имени */}
            {remoteName && (
              <div
                className="absolute bottom-3 left-3 px-2.5 py-1 rounded-xl text-xs font-600 text-white text-scrim"
                style={{
                  background: 'rgba(0,0,0,0.50)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                {remoteName}
              </div>
            )}
          </div>

          {/* Local видео — PiP или половина экрана.
              v0.8.2 UX: одиночный клик по своей плитке в обычном режиме = войти в focus mode
                        (собеседник во весь экран, своё PiP). В focus mode клик по PiP = выйти. */}
          <div
            onClick={() => {
              // Если это был drag — не считаем как клик
              if (isDraggingRef.current) return;
              setFocusMode((f) => !f);
            }}
            onMouseDown={(e) => {
              if (!focusMode) return;
              onDragStart(e.clientY, e.clientX);
              const move = (ev: MouseEvent) => onDragMove(ev.clientY, ev.clientX);
              const up   = () => { onDragEnd(); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
              window.addEventListener('mousemove', move);
              window.addEventListener('mouseup',   up);
            }}
            onTouchStart={(e) => { if (focusMode) onDragStart(e.touches[0].clientY, e.touches[0].clientX); }}
            onTouchMove={(e)  => { if (focusMode) onDragMove(e.touches[0].clientY,  e.touches[0].clientX); }}
            onTouchEnd={()    => { if (focusMode) onDragEnd(); }}
            className={`relative overflow-hidden transition-all duration-300 cursor-pointer ${
              focusMode ? 'rounded-2xl shadow-2xl' : 'flex-1 rounded-3xl'
            }`}
            title={focusMode ? 'Свернуть и вернуться к обычному виду' : 'Развернуть собеседника на весь экран'}
            style={focusMode ? {
              position: 'absolute',
              right:  `${pipPos.x}px`,
              bottom: `${pipPos.y}px`,
              width: '120px', height: '165px',
              zIndex: 30,
              cursor: isDraggingRef.current ? 'grabbing' : 'grab',
              transition: isDraggingRef.current ? 'none' : 'transform 0.15s',
              background: 'linear-gradient(180deg, #0D0D1A 0%, #06060F 100%)',
              border: '2px solid rgba(59,130,246,0.40)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.60)',
            } : {
              background: 'linear-gradient(180deg, #0D0D1A 0%, #06060F 100%)',
              border: activeSpeaker === 'local'
                ? '2px solid rgba(59,130,246,0.50)'
                : '1px solid rgba(255,255,255,0.03)',
            }}
          >
            {/* Реальное видео локального участника */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ display: cameraActive && hasLocalVideo ? 'block' : 'none', transform: 'scaleX(-1)' }}
            />
            {/* Fallback: аватар когда камера выключена или видео ещё не пришло */}
            {(!cameraActive || !hasLocalVideo) && (
              <div className="absolute inset-0 flex items-center justify-center">
                {cameraActive ? (
                  <div className="text-center">
                    <div className="relative inline-block">
                      <AvatarCircle
                        name={guestName}
                        size={focusMode ? 'sm' : 'lg'}
                        status={activeSpeaker === 'local' ? 'live' : 'online'}
                      />
                      {!focusMode && activeSpeaker === 'local' && (
                        <div
                          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: '#3B82F6', boxShadow: '0 0 12px rgba(59,130,246,0.50)' }}
                        >
                          <Volume2 size={11} strokeWidth={2} className="text-white" />
                        </div>
                      )}
                    </div>
                    {!focusMode && <p className="text-xs font-600 text-white text-scrim mt-2">{guestName}</p>}
                  </div>
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.04)' }}
                  >
                    <VideoOff size={20} strokeWidth={1.5} style={{ color: 'rgba(255,255,255,0.25)' }} />
                  </div>
                )}
              </div>
            )}
            {/* Метка */}
            {!focusMode && (
              <div
                className="absolute bottom-3 left-3 px-2.5 py-1 rounded-xl text-xs font-600 text-white text-scrim"
                style={{
                  background: 'rgba(0,0,0,0.50)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                }}
              >
                {guestName} ({t.you}){!micActive && <span style={{ color: '#FCA5A5' }}> · {t.muted}</span>}
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════
            СУБТИТРЫ — синяя плашка, кликабельная
            ═══════════════════════════════════ */}
        <div className="absolute bottom-32 left-4 right-4 z-20 flex justify-center">
          <div
            className="inline-block px-5 py-3.5 max-w-lg rounded-2xl pointer-events-auto"
            style={{
              background: 'rgba(0, 0, 0, 0.50)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
            }}
          >
            {/* Логотип над меткой статуса — экран звонка ВСЕГДА тёмный, форсим dark-вариант */}
            <div className="flex justify-center mb-1">
              <VibeVoxLogo height={20} variant="dark" />
            </div>
            {/* Компактный статус: ●  RU → AUTO  ·  02:16  ·  ▍▌▍ */}
            <div className="flex items-center justify-center gap-2 mb-1.5 text-[10px] font-600 tabular-nums"
                 style={{ color: 'rgba(255,255,255,0.78)', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
              {/* Пульсирующий dot — индикатор активности */}
              <span
                className={liveStatus === 'translatorReady' ? 'animate-pulse' : ''}
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: liveStatus === 'translatorReady' ? '#34D399'
                            : liveStatus === 'error' ? '#EF4444'
                            : '#FBBF24',
                  boxShadow: liveStatus === 'translatorReady' ? '0 0 6px rgba(52,211,153,0.7)' : 'none',
                  flexShrink: 0,
                }}
              />
              {/* RU → AUTO */}
              <span className="uppercase tracking-wider" style={{ letterSpacing: '0.06em' }}>
                {targetLang.toUpperCase()} → AUTO
              </span>
              {/* divider */}
              <span style={{ opacity: 0.4 }}>·</span>
              {/* Таймер */}
              {callStartTime ? (
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>
                  {Math.floor(callDurationSec / 3600) > 0
                    ? `${String(Math.floor(callDurationSec / 3600)).padStart(2,'0')}:${String(Math.floor((callDurationSec % 3600) / 60)).padStart(2,'0')}:${String(callDurationSec % 60).padStart(2,'0')}`
                    : `${String(Math.floor(callDurationSec / 60)).padStart(2,'0')}:${String(callDurationSec % 60).padStart(2,'0')}`}
                </span>
              ) : (
                <span style={{ opacity: 0.5 }}>--:--</span>
              )}
              {/* divider */}
              <span style={{ opacity: 0.4 }}>·</span>
              {/* Wifi bars — 3 деления по качеству связи */}
              <span
                className="inline-flex items-end gap-[2px]"
                title={
                  linkQuality === 'good' ? t.connGood :
                  linkQuality === 'medium' ? t.connMedium :
                  linkQuality === 'poor' ? t.connPoor : t.connLost
                }
              >
                {[4, 6, 8].map((h, i) => {
                  const activeBars =
                    linkQuality === 'good' ? 3 :
                    linkQuality === 'medium' ? 2 :
                    linkQuality === 'poor' ? 1 : 0;
                  const color =
                    linkQuality === 'good' ? '#34D399' :
                    linkQuality === 'medium' ? '#FBBF24' : '#FCA5A5';
                  const isActive = i < activeBars;
                  return (
                    <span
                      key={i}
                      style={{
                        width: 2,
                        height: h,
                        borderRadius: 1,
                        background: isActive ? color : 'rgba(255,255,255,0.18)',
                        display: 'inline-block',
                      }}
                    />
                  );
                })}
              </span>
            </div>

            {/* Текущий streaming-субтитр (если есть) */}
            {pendingSubtitle && (
              <p
                className="text-sm leading-relaxed font-500 text-center mb-2"
                style={{ color: '#FFFFFF', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
              >
                {pendingSubtitle}
              </p>
            )}

            {/* Последние N финальных субтитров (кликабельные → AI Coach) */}
            {subtitles.length === 0 && !pendingSubtitle && (
              <p
                className="text-sm leading-relaxed font-500 text-center"
                style={{ color: '#FFFFFF', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
              >
                {liveStatus === 'error'
                  ? (liveError === 'room_full' ? t.roomFull : (liveError || t.connectionError))
                  : liveStatus === 'connecting'
                    ? t.connecting
                    : liveStatus === 'translatorStarting'
                      ? t.translatorJoining
                      : t.waitingSubtitle}
              </p>
            )}
            {subtitles.length > 0 && (
              <div
                className="flex flex-col gap-1.5 overflow-y-auto hide-scrollbar"
                style={{ maxHeight: '45vh', overscrollBehavior: 'contain' }}
              >
                {subtitles.slice().reverse().map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => openCoachFor(sub)}
                    className="group text-left rounded-xl px-3 py-2 transition-colors"
                    style={{
                      background: coachResult?.subtitleId === sub.id ? 'rgba(255,115,0,0.18)' : 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,115,0,0.32)',
                      cursor: 'pointer',
                    }}
                    title={t.coachHelp}
                  >
                    <div className="flex items-start gap-2">
                      <Lightbulb size={11} strokeWidth={1.5} style={{ color: '#FBBF24', flexShrink: 0, marginTop: 4 }} />
                      <p
                        className="text-sm leading-relaxed font-500 flex-1"
                        style={{ color: '#FFFFFF', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                      >
                        {sub.text}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Кнопка «На полигон» — только для суперадмина (отправка фразы в AI Learning Hub) */}
            {user?.role === 'superadmin' && (
            <div className="flex justify-center">
              <button
                className="pointer-events-auto mt-2"
                onClick={async () => {
                  const last = subtitles[subtitles.length - 1];
                  try {
                    await fetch('/api/auth/send-to-playground', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                      body: JSON.stringify({ subtitleText: last?.text || pendingSubtitle || '(live audio)', languageCode: targetLang }),
                    });
                    setPlaygroundToast(true);
                    setTimeout(() => setPlaygroundToast(false), 2500);
                  } catch { /* silent */ }
                }}
                title={t.playgroundTip}
                style={{
                  padding: '4px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                  border: '1px solid rgba(245, 158, 11, 0.30)', background: 'rgba(245, 158, 11, 0.12)',
                  color: '#FBBF24', cursor: 'pointer', transition: 'all 0.15s',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {t.toPlayground}
              </button>
            </div>
            )}
          </div>
        </div>

        {/* Toast: Отправлено на полигон */}
        {playgroundToast && (
          <div
            className="absolute top-20 left-1/2 z-[60]"
            style={{
              transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: 16,
              background: 'rgba(52, 211, 153, 0.14)', border: '1px solid rgba(52, 211, 153, 0.25)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              color: '#34D399', fontSize: 13, fontWeight: 600,
              animation: 'fadeIn 0.3s ease-out', fontFamily: 'Inter, sans-serif',
            }}
          >
            {t.sentToPlayground}
          </div>
        )}

        {/* ═══════════════════════════════════
            AI COACH — приватная янтарная панель (видит только пользователь)
            ═══════════════════════════════════ */}
        {isCreator && coachResult && (
          // v0.8.2: Side panel на десктопе (≥1024px) — sticky правая колонка 380px.
          // На мобильном (<1024px) — оверлей снизу (bottom-sheet-like), как раньше.
          <div
            className="absolute z-30 pointer-events-none
                       left-4 right-4 bottom-[calc(110px+1rem)] flex justify-center
                       lg:left-auto lg:right-3 lg:bottom-auto lg:top-3 lg:w-[380px] lg:max-h-[calc(100vh-140px)] lg:flex lg:justify-end"
          >
            <div
              className="pointer-events-auto rounded-2xl w-full max-w-xl lg:max-w-none lg:h-full lg:overflow-y-auto"
              style={{
                background: 'linear-gradient(180deg, rgba(35,21,4,0.85) 0%, rgba(20,12,2,0.92) 100%)',
                border: '1px solid rgba(245,158,11,0.45)',
                boxShadow: '0 16px 48px rgba(245,158,11,0.18), 0 4px 16px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(24px) saturate(180%)',
                WebkitBackdropFilter: 'blur(24px) saturate(180%)',
                padding: '14px 16px',
              }}
            >
              {/* Заголовок */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Lightbulb size={13} strokeWidth={2} style={{ color: '#FBBF24', flexShrink: 0 }} />
                  <span className="text-[10px] font-700 uppercase tracking-wider truncate" style={{ color: '#FBBF24', letterSpacing: '0.06em' }}>
                    {t.coachTitle}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setCoachResult((prev) => prev ? { ...prev, pinned: !prev.pinned } : prev)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                    style={{
                      background: coachResult.pinned ? 'rgba(245,158,11,0.22)' : 'rgba(255,255,255,0.04)',
                      color: coachResult.pinned ? '#FBBF24' : 'rgba(255,255,255,0.55)',
                    }}
                    title={t.coachPin}
                  >
                    <Pin size={12} strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => { if (coachAbortRef.current) coachAbortRef.current.abort(); setCoachResult(null); }}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                    style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)' }}
                    title={t.coachClose}
                  >
                    <X size={12} strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Реплика собеседника, на которую отвечаем */}
              <div
                className="rounded-xl px-3 py-2 mb-2 text-xs"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}
              >
                «{coachResult.subtitleText}»
              </div>

              {/* Стримящийся ответ ИИ — без markdown-разметки */}
              <div
                className="text-sm font-500 whitespace-pre-wrap mb-3"
                style={{ color: '#FEF3C7', lineHeight: 1.55 }}
              >
                {coachResult.answer ? stripMarkdown(coachResult.answer) : (coachResult.loading ? t.coachThinking : '')}
                {coachResult.loading && (
                  <span className="inline-block ml-1 animate-pulse" style={{ color: '#FBBF24' }}>▍</span>
                )}
              </div>

              {/* Пресеты-чипы */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {coachPresets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => setCoachPromptDraft(preset.prompt)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-600 transition-all"
                    style={{
                      background: coachPromptDraft === preset.prompt ? 'rgba(245,158,11,0.20)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${coachPromptDraft === preset.prompt ? 'rgba(245,158,11,0.45)' : 'rgba(255,255,255,0.08)'}`,
                      color: coachPromptDraft === preset.prompt ? '#FBBF24' : 'rgba(255,255,255,0.7)',
                      cursor: 'pointer',
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Поле произвольного пожелания — на всю ширину, кнопка снизу */}
              <div className="flex flex-col gap-2">
                <textarea
                  value={coachPromptDraft}
                  onChange={(e) => setCoachPromptDraft(e.target.value)}
                  placeholder={t.coachPromptPlaceholder}
                  rows={2}
                  className="w-full resize-none rounded-xl px-3 py-2 text-xs font-500 outline-none"
                  style={{
                    background: 'rgba(0,0,0,0.30)',
                    border: '1px solid rgba(245,158,11,0.22)',
                    color: '#FEF3C7',
                    fontFamily: 'Inter, sans-serif',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const subtitleObj: SubtitleEntry = {
                        id: coachResult.subtitleId,
                        speakerIdentity: '',
                        speakerLanguage: subtitles.find((s) => s.id === coachResult.subtitleId)?.speakerLanguage || '',
                        targetLanguage: targetLang,
                        text: coachResult.subtitleText,
                        timestamp: Date.now(),
                        isFinal: true,
                      };
                      askCoach(subtitleObj, coachPromptDraft);
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const subtitleObj: SubtitleEntry = {
                      id: coachResult.subtitleId,
                      speakerIdentity: '',
                      speakerLanguage: subtitles.find((s) => s.id === coachResult.subtitleId)?.speakerLanguage || '',
                      targetLanguage: targetLang,
                      text: coachResult.subtitleText,
                      timestamp: Date.now(),
                      isFinal: true,
                    };
                    askCoach(subtitleObj, coachPromptDraft);
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs font-700 flex items-center justify-center gap-1.5 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    color: '#1A0F00',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(245,158,11,0.35)',
                  }}
                  disabled={coachResult.loading}
                >
                  <Send size={11} strokeWidth={2.5} />
                  {coachResult.loading ? '…' : t.coachAsk}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════
            БИЛЛИНГ-БАННЕР (low_balance / quota_exhausted)
            ═══════════════════════════════════ */}
        {billingNotice && (
          <div
            className="absolute top-20 left-4 right-4 z-[55] flex justify-center pointer-events-none animate-slide-up"
          >
            <div
              className="pointer-events-auto rounded-2xl max-w-md w-full px-4 py-3"
              style={{
                background: billingNotice.kind === 'quota_exhausted'
                  ? 'linear-gradient(180deg, rgba(40,8,8,0.95) 0%, rgba(28,4,4,0.98) 100%)'
                  : 'linear-gradient(180deg, rgba(40,28,8,0.95) 0%, rgba(28,18,4,0.98) 100%)',
                border: billingNotice.kind === 'quota_exhausted'
                  ? '1px solid rgba(239,68,68,0.45)'
                  : '1px solid rgba(245,158,11,0.45)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
              }}
            >
              <div className="flex items-start gap-3 mb-2">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: billingNotice.kind === 'quota_exhausted' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)',
                    color: billingNotice.kind === 'quota_exhausted' ? '#FCA5A5' : '#FBBF24',
                  }}
                >
                  <AlertTriangle size={16} strokeWidth={1.5} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-700"
                     style={{ color: billingNotice.kind === 'quota_exhausted' ? '#FCA5A5' : '#FBBF24' }}>
                    {billingNotice.kind === 'quota_exhausted'
                      ? 'Минуты перевода закончились'
                      : `Осталось ${billingNotice.remainingMinutes} мин перевода`}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {billingNotice.kind === 'quota_exhausted'
                      ? 'Бот-переводчик приостановлен. Докупите минуты, чтобы продолжить разговор.'
                      : 'Докупите минуты, чтобы разговор не прервался.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBillingNotice(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)' }}
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {[60, 120, 300].map((min) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => handleQuickTopup(min)}
                    disabled={topupBusy}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-700 transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #10B981, #059669)',
                      color: '#FFFFFF',
                      cursor: topupBusy ? 'not-allowed' : 'pointer',
                      opacity: topupBusy ? 0.6 : 1,
                      boxShadow: '0 4px 14px rgba(16,185,129,0.30)',
                      minWidth: 0,
                    }}
                  >
                    {topupBusy ? '…' : `+${min} мин · €${(min * 0.17).toFixed(2)}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════
            НИЖНИЙ SCRIM (160px) — защита элементов
            ═══════════════════════════════════ */}
        <div
          className="absolute bottom-0 left-0 right-0 pointer-events-none"
          style={{
            height: '160px',
            zIndex: 15,
            background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.45) 35%, rgba(0,0,0,0.12) 65%, transparent 100%)',
          }}
        />

        {/* ═══════════════════════════════════
            КОНТРОЛЫ ЗВОНКА — Call Controls Pill
            ═══════════════════════════════════ */}
        <div className="absolute bottom-0 left-0 right-0 z-40 flex justify-center pb-safe" style={{ paddingBottom: '20px' }}>
          <div className="call-controls flex items-center gap-3 px-6 py-3">

            {/* Микрофон */}
            <button
              id="call-btn-mic"
              type="button"
              onClick={() => setMicActive(!micActive)}
              className={`call-btn ${micActive ? 'call-btn-default' : 'call-btn-muted'}`}
              title={micActive ? t.micOn : t.micOff}
            >
              {micActive
                ? <Mic     size={22} strokeWidth={1.5} />
                : <MicOff  size={22} strokeWidth={1.5} />}
            </button>

            {/* Камера */}
            <button
              id="call-btn-camera"
              type="button"
              onClick={() => setCameraActive(!cameraActive)}
              className={`call-btn ${cameraActive ? 'call-btn-default' : 'call-btn-muted'}`}
              title={cameraActive ? t.camOn : t.camOff}
            >
              {cameraActive
                ? <Video    size={22} strokeWidth={1.5} />
                : <VideoOff size={22} strokeWidth={1.5} />}
            </button>

            {/* Демонстрация экрана — primary, видна на всех экранах */}
            <button
              id="call-btn-screenshare"
              type="button"
              onClick={handleToggleScreenShare}
              className={`call-btn ${localScreenShareOn ? 'call-btn-muted' : 'call-btn-default'}`}
              title={localScreenShareOn ? t.screenshareOff : t.screenshareOn}
              style={localScreenShareOn ? { background: 'rgba(59,130,246,0.18)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.4)' } : undefined}
            >
              {localScreenShareOn
                ? <MonitorOff size={22} strokeWidth={1.5} />
                : <Monitor    size={22} strokeWidth={1.5} />}
            </button>

            {/* «Ещё» — все вторичные действия (toggle перевода/субтитров creator-only, PiP/focus) */}
            <button
              id="call-btn-more"
              type="button"
              onClick={() => setMoreSheetOpen(true)}
              className="call-btn call-btn-default"
              title={t.more}
            >
              <MoreHorizontal size={22} strokeWidth={1.5} />
            </button>

            {/* Завершить — справа, отделён, всегда красный */}
            <button
              id="call-btn-hangup"
              type="button"
              onClick={handleHangUp}
              className="call-btn call-btn-hangup"
              title={t.hangUp}
            >
              <PhoneOff size={24} strokeWidth={1.5} />
            </button>

          </div>
        </div>

        {/* ═══════════════════════════════════
            БОТТОМ-ШИТ «ЕЩЁ» — оверфлоу-меню v0.8.2 (mobile-friendly)
            ═══════════════════════════════════ */}
        {moreSheetOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
            onClick={() => setMoreSheetOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md sm:mx-4 sm:mb-0 mb-0 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 animate-slide-up"
              style={{
                background: 'rgba(13, 13, 26, 0.96)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(24px)',
              }}
            >
              {/* Handle на мобильном */}
              <div className="flex justify-center sm:hidden mb-3">
                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
              </div>
              <div className="flex items-center justify-between mb-4">
                {/* Логотип вместо «Действия» — лист тёмный, используем dark-вариант */}
                <VibeVoxLogo height={22} variant="dark" />
                <button onClick={() => setMoreSheetOpen(false)} className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.06)', color: '#fff' }}>
                  <XIcon size={16} />
                </button>
              </div>

              <div className="space-y-2">
                {/* Toggle перевода — только creator */}
                {isCreator && (
                  <button
                    type="button"
                    onClick={() => { updateRoomSettings({ translationEnabled: !roomSettings.translationEnabled }); setMoreSheetOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors"
                    style={{ background: roomSettings.translationEnabled ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.10)', border: `1px solid ${roomSettings.translationEnabled ? 'rgba(16,185,129,0.30)' : 'rgba(148,163,184,0.16)'}` }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: roomSettings.translationEnabled ? '#10b981' : 'rgba(148,163,184,0.22)' }}>
                      <LanguagesIcon size={18} color="#fff" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-600" style={{ color: '#fff' }}>
                        {roomSettings.translationEnabled ? t.raTranslationDisable : t.raTranslationEnable}
                      </p>
                      <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {roomSettings.translationEnabled ? t.raTranslationDisableSub : t.raTranslationEnableSub}
                      </p>
                    </div>
                  </button>
                )}

                {/* Toggle субтитров — только creator при включённом переводе */}
                {isCreator && roomSettings.translationEnabled && (
                  <button
                    type="button"
                    onClick={() => { updateRoomSettings({ subtitlesEnabled: !roomSettings.subtitlesEnabled }); setMoreSheetOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors"
                    style={{ background: roomSettings.subtitlesEnabled ? 'rgba(59,130,246,0.12)' : 'rgba(148,163,184,0.10)', border: `1px solid ${roomSettings.subtitlesEnabled ? 'rgba(59,130,246,0.30)' : 'rgba(148,163,184,0.16)'}` }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: roomSettings.subtitlesEnabled ? '#3b82f6' : 'rgba(148,163,184,0.22)' }}>
                      <Subtitles size={18} color="#fff" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-600" style={{ color: '#fff' }}>
                        {roomSettings.subtitlesEnabled ? t.raSubtitlesHide : t.raSubtitlesShow}
                      </p>
                      <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {t.raSubtitlesSub}
                      </p>
                    </div>
                  </button>
                )}

                {/* Focus mode (PiP) */}
                <button
                  type="button"
                  onClick={() => { setFocusMode(!focusMode); setMoreSheetOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(255,255,255,0.10)' }}>
                    <Maximize2 size={18} color="#fff" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-600" style={{ color: '#fff' }}>
                      {focusMode ? t.normalView : t.expandPeer}
                    </p>
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {focusMode ? t.normalViewSub : t.expandPeerSub}
                    </p>
                  </div>
                </button>

                {/* v0.9.0: Скопировать ссылку — доступно всем */}
                <button
                  type="button"
                  onClick={async () => {
                    if (!roomId) return;
                    const url = `${window.location.origin}/room/${roomId}`;
                    try { await navigator.clipboard.writeText(url); } catch { /* */ }
                    setMoreSheetOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: 'rgba(34,211,238,0.16)' }}>
                    <Copy size={18} color="#22d3ee" strokeWidth={1.5} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-600" style={{ color: '#fff' }}>{t.raCopyLink}</p>
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {t.raCopyLinkSub}
                    </p>
                  </div>
                </button>

                {/* v0.9.0: Удалить комнату — только creator */}
                {isCreator && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!roomId) return;
                      setConfirmDialog({
                        title: t.deleteConfirmTitle,
                        message: t.deleteConfirmMessage,
                        confirmLabel: t.deleteConfirmAction,
                        variant: 'danger',
                        onConfirm: async () => {
                          try {
                            const res = await fetch(`/api/rooms/${roomId}`, {
                              method: 'DELETE',
                              headers: { Authorization: `Bearer ${token}` },
                            });
                            if (!res.ok) {
                              const e = await res.json().catch(() => ({}));
                              showToast(e.error || 'Не удалось удалить комнату', 'error');
                              return;
                            }
                            setMoreSheetOpen(false);
                            cleanupAndExit();
                          } catch (e: any) {
                            showToast(e.message || 'Ошибка сети', 'error');
                          }
                        },
                      });
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-colors"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.24)' }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                         style={{ background: 'rgba(239,68,68,0.20)' }}>
                      <Trash2 size={18} color="#ef4444" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-600" style={{ color: '#ef4444' }}>{t.raDelete}</p>
                      <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                        {t.raDeleteSub}
                      </p>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Screen Share центральная плитка (если кто-то демонстрирует) ── */}
        {(localScreenShareOn || remoteScreenShareIdentity) && (
          <div className="absolute inset-0 z-30 pointer-events-none flex flex-col p-4 sm:p-6"
               style={{ background: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(20px)' }}>
            <div className="flex items-center justify-between mb-2 pointer-events-auto">
              <div className="text-xs font-700 uppercase px-3 py-1 rounded-full inline-flex items-center gap-1.5"
                   style={{ background: 'rgba(59,130,246,0.16)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.32)', letterSpacing: '0.08em' }}>
                <Monitor size={12} strokeWidth={2} />
                {localScreenShareOn ? 'Вы демонстрируете экран' : `Демонстрирует: ${remoteScreenShareIdentity || 'участник'}`}
              </div>
            </div>
            <div className="flex-1 rounded-2xl overflow-hidden flex items-center justify-center pointer-events-auto"
                 style={{
                   background: 'rgba(0,0,0,0.6)',
                   border: '1px solid rgba(59,130,246,0.30)',
                   boxShadow: '0 20px 80px rgba(59,130,246,0.18)',
                 }}>
              <video
                ref={localScreenShareOn ? localScreenShareVideoRef : remoteScreenShareVideoRef}
                autoPlay
                playsInline
                muted={localScreenShareOn}
                className="max-w-full max-h-full"
                style={{ objectFit: 'contain' }}
              />
            </div>
            {/* Горизонтальная полоса миниатюр участников */}
            <div className="mt-3 overflow-x-auto pointer-events-auto" style={{ scrollbarWidth: 'thin' }}>
              <div className="flex gap-2 snap-x snap-mandatory">
                <div className="flex-shrink-0 snap-start rounded-xl overflow-hidden"
                     style={{ width: 140, height: 88, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {hasLocalVideo
                    ? <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                    : <div className="w-full h-full flex items-center justify-center text-[10px]" style={{ color: 'var(--text-muted)' }}>Вы</div>}
                </div>
                <div className="flex-shrink-0 snap-start rounded-xl overflow-hidden"
                     style={{ width: 140, height: 88, background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {hasRemoteVideo
                    ? <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-[10px]" style={{ color: 'var(--text-muted)' }}>{remoteName || '—'}</div>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Status banner для гостей: «Перевод выключен организатором» ── */}
        {!isCreator && joined && !roomSettings.translationEnabled && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-4 py-2 rounded-full text-xs font-600"
               style={{
                 background: 'rgba(148,163,184,0.18)',
                 color: '#cbd5e1',
                 border: '1px solid rgba(148,163,184,0.32)',
                 backdropFilter: 'blur(12px)',
               }}>
            Перевод выключен организатором — только видео
          </div>
        )}
        {!isCreator && joined && roomSettings.translationEnabled && !roomSettings.subtitlesEnabled && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-4 py-2 rounded-full text-xs font-600"
               style={{
                 background: 'rgba(148,163,184,0.18)',
                 color: '#cbd5e1',
                 border: '1px solid rgba(148,163,184,0.32)',
                 backdropFilter: 'blur(12px)',
               }}>
            {tc('postCallInsights.subtitlesHiddenByHost')}
          </div>
        )}

        {/* ── Insights Modal (Enterprise, только creator, после hangup) ── */}
        {insightsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto"
               style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(10px)' }}
               onClick={cleanupAndExit}>
            <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg mx-4 my-4 sm:my-8 rounded-3xl p-5 sm:p-6"
                 style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}>
              <div className="flex items-center gap-3 mb-4">
                <VibeVoxIcon size={40} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-700 truncate" style={{ color: 'var(--text-primary)' }}>{tc('postCallInsights.title')}</h3>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{tc('postCallInsights.subtitle')}</p>
                </div>
                <button type="button" onClick={cleanupAndExit} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-[var(--bg-tertiary)]">
                  <span className="text-lg" style={{ color: 'var(--text-muted)' }}>×</span>
                </button>
              </div>

              {insightsLoading && (
                <div className="py-10 text-center">
                  <Loader2 size={28} className="animate-spin mx-auto mb-3" style={{ color: '#8B5CF6' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{tc('postCallInsights.analyzing')}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{tc('postCallInsights.analyzingHint')}</p>
                </div>
              )}

              {insightsError && (
                <div className="py-6 px-3 rounded-xl mb-3"
                     style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)' }}>
                  <p className="text-sm font-600" style={{ color: '#ef4444' }}>{insightsError}</p>
                </div>
              )}

              {insightsData && (
                <div className="space-y-4">
                  {/* 3 цветные метрики — overflow-hidden, метки и значения с min-w-0 */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: tc('postCallInsights.metricSentiment'), val: insightsData?.sentiment?.score ?? 0, color: insightsData?.sentiment?.label === 'positive' ? '#10b981' : insightsData?.sentiment?.label === 'negative' ? '#ef4444' : '#94a3b8', sub: insightsData?.sentiment?.label },
                      { label: tc('postCallInsights.metricEngagement'), val: insightsData?.engagement?.score ?? 0, color: '#3b82f6', sub: '/100' },
                      { label: tc('postCallInsights.metricLeadScore'), val: insightsData?.leadScore?.score ?? 0, color: insightsData?.leadScore?.stage === 'hot' || insightsData?.leadScore?.stage === 'qualified' ? '#10b981' : insightsData?.leadScore?.stage === 'warm' ? '#f59e0b' : '#94a3b8', sub: insightsData?.leadScore?.stage },
                    ].map((m, i) => (
                      <div key={i} className="rounded-xl p-2.5 min-w-0 overflow-hidden" style={{ background: `${m.color}1a`, border: `1px solid ${m.color}40` }}>
                        <p className="text-[9px] font-700 uppercase tracking-wider mb-1 truncate" style={{ color: 'var(--text-muted)' }} title={m.label}>{m.label}</p>
                        <p className="text-lg font-700 tabular-nums truncate" style={{ color: m.color }}>{m.val}</p>
                        <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }} title={m.sub}>{m.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Tags */}
                  {Array.isArray(insightsData.tags) && insightsData.tags.length > 0 && (
                    <div>
                      <p className="text-[11px] font-700 uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{tc('postCallInsights.topics')}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {insightsData.tags.map((tag: string, i: number) => (
                          <span key={i} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  {insightsData.summary && (
                    <div>
                      <p className="text-[11px] font-700 uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{tc('postCallInsights.summary')}</p>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{insightsData.summary}</p>
                    </div>
                  )}

                  {/* Next steps */}
                  {Array.isArray(insightsData.nextSteps) && insightsData.nextSteps.length > 0 && (
                    <div>
                      <p className="text-[11px] font-700 uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>{tc('postCallInsights.nextSteps')}</p>
                      <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
                        {insightsData.nextSteps.map((step: string, i: number) => (
                          <li key={i} className="flex gap-2"><span style={{ color: '#10b981' }}>→</span> {step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={cleanupAndExit}
                className="mt-5 w-full px-4 py-2.5 rounded-xl text-sm font-700 transition-colors"
                style={{ background: 'var(--btn-primary-bg)', color: 'var(--bg-primary)' }}
              >
                {tc('postCallInsights.close')}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ────────────────────────────────────
  // РЕНДЕР 5: Список комнат
  // ────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">

      {/* Заголовок + поиск + создать */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="section-title text-2xl mb-1">{t.roomsTitle}</h1>
          <p className="section-subtitle">{t.roomsSubtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Поиск по всем комнатам — фильтрует список по имени, тегам, языкам, telegram */}
          <div className="relative">
            <Search
              size={14}
              strokeWidth={1.5}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tc('rooms.searchPlaceholder')}
              className="w-40 sm:w-56 pl-9 pr-8 py-2 rounded-xl text-sm focus:outline-none transition-colors"
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
              }}
              aria-label="Поиск по комнатам"
              id="rooms-search"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center transition-colors hover:bg-[var(--bg-elevated)]"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Очистить поиск"
              >
                <X size={12} strokeWidth={1.5} />
              </button>
            )}
          </div>

          <AuroraButton
            icon={<Plus size={18} strokeWidth={2} />}
            size="sm"
            onClick={handleCreateRoom}
            id="rooms-create"
            className="flex-shrink-0"
          >
            {t.createRoom}
          </AuroraButton>
        </div>
      </div>

      {/* Вкладки: появляются только при подключённом Quest Flow или VibeAdd */}
      {showRoomTabs && (
        <div
          className="flex items-center gap-1 p-1 rounded-2xl overflow-x-auto"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}
          role="tablist"
        >
          {[
            { id: 'video',   label: tc('rooms.tabs.video'),     icon: Video,    color: '#ff7300' },
            { id: 'quest',   label: tc('rooms.tabs.questFlow'), icon: Workflow, color: '#ff7300' },
            { id: 'vibeadd', label: tc('rooms.tabs.vibeAdd'),   icon: Sparkles, color: '#ff7300' },
          ].map(({ id, label, icon: Icon, color }) => {
            const isActive = activeRoomTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveRoomTab(id as 'video' | 'quest' | 'vibeadd')}
                id={`rooms-tab-${id}`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 transition-all whitespace-nowrap"
                style={isActive ? {
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-medium)',
                  color: color,
                } : {
                  background: 'transparent',
                  border: '1px solid transparent',
                  color: 'var(--text-muted)',
                }}
              >
                <Icon size={13} strokeWidth={isActive ? 2 : 1.5} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Список */}
      {filteredRooms.length === 0 ? (
        // Во время первой загрузки не показываем «Нет активных комнат» — иначе
        // empty-state мелькает на долю секунды до того, как комнаты доедут с бэка.
        roomsLoading ? null : (
        <div className="py-16 text-center">
          <Languages size={40} strokeWidth={1} className="mx-auto mb-3" style={{ color: 'var(--text-disabled)' }} />
          <p className="text-sm font-500" style={{ color: 'var(--text-muted)' }}>
            {rooms.length === 0
              ? t.noRooms
              : (searchQuery.trim() ? 'Ничего не найдено' : 'Пусто во вкладке')}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-disabled)' }}>
            {rooms.length === 0
              ? t.noRoomsHint
              : (searchQuery.trim() ? 'Попробуйте другой запрос' : 'В этой категории пока нет комнат')}
          </p>
        </div>
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredRooms.map((room) => {
            const isHighlighted = highlightedRoomIds.has(room.id);
            const isEditing = editingRoomId === room.id;
            return (
              <div
                key={room.id}
                id={`room-card-${room.id}`}
                className="aurora-card p-4 transition-all"
                style={isHighlighted ? {
                  border: '1px solid rgba(16,185,129,0.55)',
                  boxShadow: '0 0 0 3px rgba(16,185,129,0.18), 0 8px 28px rgba(16,185,129,0.20)',
                } : undefined}
              >
                {/* Header — карандашик СРАЗУ рядом с названием */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: room.kind === 'telegram_chat'
                          ? 'rgba(34,211,238,0.10)'
                          : (room.active ? 'rgba(59,130,246,0.10)' : 'rgba(255,255,255,0.03)'),
                        color: room.kind === 'telegram_chat'
                          ? '#22d3ee'
                          : (room.active ? '#60A5FA' : 'var(--text-disabled)'),
                      }}
                    >
                      {room.kind === 'telegram_chat'
                        ? <MessageSquare size={20} strokeWidth={1.5} />
                        : <Languages size={20} strokeWidth={1.5} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitRename(room.id);
                            if (e.key === 'Escape') setEditingRoomId(null);
                          }}
                          onBlur={() => submitRename(room.id)}
                          autoFocus
                          className="text-sm font-600 w-full bg-transparent outline-none border-none focus:outline-none focus:ring-0 focus:border-none p-0"
                          style={{ color: 'var(--text-primary)' }}
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <button type="button"
                                  onClick={() => navigate(room.kind === 'telegram_chat' ? `/room/${room.id}/chat` : `/room/${room.id}`)}
                                  className="text-sm font-600 truncate text-left hover:underline min-w-0"
                                  style={{ color: 'var(--text-primary)' }}>
                            {formatRoomName(room.name, tc, i18n.language || 'en')}
                          </button>
                          <button type="button"
                                  onClick={(e) => { e.stopPropagation(); setEditingRoomId(room.id); setEditingName(formatRoomName(room.name, tc, i18n.language || 'en')); }}
                                  title={tc('rooms.actions.rename')}
                                  className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)] flex-shrink-0"
                                  style={{ color: 'var(--text-muted)' }}>
                            <Pencil size={11} strokeWidth={1.5} />
                          </button>
                        </div>
                      )}
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        <Users size={11} strokeWidth={1.5} className="inline mr-1" style={{ verticalAlign: '-2px' }} />
                        {room.users}
                        {' · '}
                        {room.active ? <span style={{ color: '#10b981' }}>● {tc('rooms.live').toLowerCase()}</span> : <span style={{ color: 'var(--text-disabled)' }}>{tc('rooms.empty').toLowerCase()}</span>}
                      </p>
                    </div>
                  </div>
                  {room.active && (
                    <StatusPill status="live" label="LIVE" pulse className="flex-shrink-0" />
                  )}
                </div>

                {/* ENTERPRISE v0.10.0: теги потребностей под header */}
                {isEnterprise && room.tags && room.tags.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mb-2 -mt-1">
                    {room.tags.slice(0, 5).map((tag) => (
                      <NeedTagBadge key={tag.id} name={tag.name} color={tag.color} confidence={tag.confidence} />
                    ))}
                    {room.tags.length > 5 && (
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        +{room.tags.length - 5}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions row: copy / delete / chat / join */}
                <div className="flex items-center gap-1">
                  <button type="button"
                          onClick={(e) => { e.stopPropagation(); copyRoomLink(room.id); }}
                          title={tc('rooms.actions.copyLink')}
                          className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]"
                          style={{ color: 'var(--text-muted)' }}>
                    <Copy size={13} strokeWidth={1.5} />
                  </button>
                  <button type="button"
                          onClick={(e) => { e.stopPropagation(); setDeletingRoom(room); }}
                          title={tc('roomActions.delete')}
                          className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[rgba(255,115,0,0.10)]"
                          style={{ color: '#ff7300' }}>
                    <Trash2 size={13} strokeWidth={1.5} />
                  </button>

                  {/* ENTERPRISE: кнопка «Чат» → бесшовный Chatwoot (с откатом на внутренний чат) */}
                  {isEnterprise && (
                    <button type="button"
                            onClick={() => openChat(room)}
                            title={tc('chat.openWithClient')}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-700 transition-colors"
                            style={{
                              background: 'rgba(255,115,0,0.12)',
                              color: '#ff7300',
                              border: '1px solid rgba(255,115,0,0.30)',
                            }}>
                      <MessageSquare size={12} strokeWidth={2} />
                      {tc('rooms.actions.chat')}
                    </button>
                  )}

                  {/* «Войти» — для всех video-комнат (включая Enterprise). Для telegram_chat кнопки нет. */}
                  {room.kind !== 'telegram_chat' && (
                    <button type="button"
                            onClick={() => navigate(`/room/${room.id}`)}
                            className={`${isEnterprise ? '' : 'ml-auto'} flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-700 transition-colors`}
                            style={{ background: 'var(--btn-primary-bg)', color: 'var(--bg-primary)' }}>
                      {tc('rooms.actions.open')}
                      <ChevronForward size={13} strokeWidth={2} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast: новый участник / копирование */}
      {roomsToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl text-sm font-600 animate-slide-down"
             style={{
               background: roomsToast.kind === 'join' ? 'rgba(16,185,129,0.18)' : 'rgba(59,130,246,0.18)',
               border: `1px solid ${roomsToast.kind === 'join' ? 'rgba(16,185,129,0.40)' : 'rgba(59,130,246,0.40)'}`,
               color: roomsToast.kind === 'join' ? '#10b981' : '#60A5FA',
               backdropFilter: 'blur(12px)',
             }}>
          {roomsToast.text}
        </div>
      )}

      {/* Delete confirm */}
      {deletingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
             style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
             onClick={() => setDeletingRoom(null)}>
          <div onClick={(e) => e.stopPropagation()}
               className="w-full max-w-sm rounded-3xl p-5 sm:p-6"
               style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                   style={{ background: 'rgba(239,68,68,0.16)' }}>
                <Trash2 size={18} color="#ef4444" />
              </div>
              <div>
                <h3 className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>Удалить комнату?</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{deletingRoom.name}</p>
              </div>
            </div>
            <ul className="text-xs space-y-1 mb-4" style={{ color: 'var(--text-muted)' }}>
              <li>• Ссылка перестанет работать (всех выкинет)</li>
              <li>• Удалятся транскрипты и Enterprise-insights</li>
              <li>• Действие <b style={{ color: '#ef4444' }}>необратимо</b></li>
            </ul>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDeletingRoom(null)}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-600"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                Отмена
              </button>
              <button type="button" onClick={() => submitDelete(deletingRoom.id)}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-700"
                      style={{ background: '#ef4444', color: '#fff' }}>
                Удалить навсегда
              </button>
            </div>
          </div>
        </div>
      )}

      {/* v0.9.1: Modal создания комнаты — задаём имя + предложение использовать пустую */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center overflow-y-auto"
             style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
             onClick={() => !creating && setCreateModalOpen(false)}>
          <div onClick={(e) => e.stopPropagation()}
               className="w-full max-w-md mx-4 my-4 sm:my-8 rounded-3xl p-5 sm:p-6"
               style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #3B82F6, #38BDF8)' }}>
                <Plus size={18} color="#fff" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-700" style={{ color: 'var(--text-primary)' }}>Новая комната</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Назовите встречу, чтобы легко её найти</p>
              </div>
              <button type="button" onClick={() => setCreateModalOpen(false)} disabled={creating}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--bg-tertiary)]">
                <XIcon size={16} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            {/* Suggestion: re-use empty existing rooms */}
            {emptyRooms.length > 0 && (
              <div className="mb-4 p-3 rounded-xl"
                   style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.24)' }}>
                <p className="text-xs font-600 mb-2" style={{ color: '#FBBF24' }}>
                  💡 У вас уже есть {emptyRooms.length === 1 ? 'пустая комната' : 'пустые комнаты'} — используйте её повторно, чтобы не плодить дубликаты:
                </p>
                <div className="space-y-1">
                  {emptyRooms.map((r) => (
                    <button key={r.id} type="button"
                            onClick={() => { setCreateModalOpen(false); navigate(`/room/${r.id}`); }}
                            className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg transition-colors"
                            style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}>
                      → {r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="text-xs font-700 uppercase tracking-wider block mb-1.5"
                   style={{ color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              Название комнаты
            </label>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value.slice(0, 200))}
              onKeyDown={(e) => { if (e.key === 'Enter' && createName.trim()) submitCreateRoom(); }}
              placeholder="Например: Встреча с инвесторами"
              autoFocus
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none focus:border-violet-400"
              style={{
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
              }}
            />
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              Можно переименовать позже карандашиком на карточке.
            </p>

            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setCreateModalOpen(false)} disabled={creating}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm font-600"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                Отмена
              </button>
              <button type="button" onClick={submitCreateRoom} disabled={creating || !createName.trim()}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-700 transition-opacity disabled:opacity-50"
                      style={{ background: 'var(--btn-primary-bg)', color: 'var(--bg-primary)' }}>
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        title={paywallTitle}
        returnUrl={window.location.href}
      />

      {/* In-app confirm-диалог (заменяет браузерный confirm()) */}
      <ConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.title || ''}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel}
        variant={confirmDialog?.variant || 'danger'}
        onConfirm={() => { const cb = confirmDialog?.onConfirm; setConfirmDialog(null); cb?.(); }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
