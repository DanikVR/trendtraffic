/**
 * Admission control для видеоперевода (Gemini Live).
 *
 * ЗАЧЕМ: каждый переводимый участник = одна Gemini Live WebSocket-сессия. Их число
 * на процесс/проект ограничено (лимит concurrent sessions у Gemini + CPU одного Node).
 * Без ограничителя «залп» из N человек создаёт N сессий, упирается в потолок Gemini
 * (лишние сессии молча падают) и душит event-loop. Этот модуль вводит ГЛОБАЛЬНЫЙ
 * лимит одновременных слотов перевода и даёт ВИДИМЫЙ отказ (503) на входе в комнату.
 *
 * МОДЕЛЬ: «слот» резервируется в момент выдачи LiveKit-токена (ещё ДО подключения и
 * старта bridge — иначе залп проскочит, т.к. сессии создаются с задержкой). Ключ слота —
 * `${room}::${identity}`, поэтому повторная выдача токена тому же участнику идемпотентна.
 *
 * ОСВОБОЖДЕНИЕ слота (точное, без утечек):
 *   1. bridge.onParticipantDisconnected → release(room, identity)
 *   2. translation/stop (hangup, удаление комнаты, выкл. перевода) → releaseRoom(room)
 *   3. TTL-страховка (SLOT_TTL_MS) — на случай пропущенных событий (краш/реконнект)
 *   4. reconcile с LiveKit раз в RECONCILE_INTERVAL_MS — слоты «мёртвых» комнат снимаются
 *
 * ОДНОПРОЦЕССНОСТЬ: реестр живёт в памяти процесса. Это корректно при текущем single-instance
 * деплое. При переходе на несколько инстансов backend — вынести в общий стор (Redis) или
 * считать нагрузку через LiveKit (он глобален). См. docs/SCALING_GEMINI_LIVE.md.
 */

import { getMaxConcurrentSessions } from '../../config/systemConfig.js';
import { listActiveRoomNames } from '../livekit/service.js';

interface Slot {
  room: string;
  identity: string;
  acquiredAt: number;
}

/** Реестр активных слотов: `${room}::${identity}` → Slot. */
const slots = new Map<string, Slot>();

/** Слот живёт не дольше этого (страховка от утечки, если release не пришёл). */
const SLOT_TTL_MS = 3 * 60 * 60 * 1000; // 3 часа — заведомо дольше реального звонка

/** Период reconcile с LiveKit (самоисцеление от утечек). */
const RECONCILE_INTERVAL_MS = 2 * 60 * 1000; // 2 минуты

/** Свежие слоты (моложе этого) reconcile НЕ трогает — участник мог ещё не подключиться. */
const RECONCILE_GRACE_MS = 45 * 1000;

/** Нужны ли псевдослучайные метки времени? Нет — берём Date.now() напрямую (рантайм, не workflow). */
function now(): number {
  return Date.now();
}

function key(room: string, identity: string): string {
  return `${room}::${identity}`;
}

/** Удаляет протухшие по TTL слоты. Вызывается перед любым подсчётом. */
function purgeExpired(): void {
  const t = now();
  for (const [k, s] of slots) {
    if (t - s.acquiredAt > SLOT_TTL_MS) slots.delete(k);
  }
}

/** Текущее число занятых слотов (≈ активных участников перевода). */
export function activeCount(): number {
  purgeExpired();
  return slots.size;
}

/** Текущий лимит (из конфигурации суперадмина). */
export function getLimit(): number {
  return getMaxConcurrentSessions();
}

export interface AcquireResult {
  ok: boolean;
  current: number;
  limit: number;
  /** true, если слот для этой пары уже был занят (повторный токен — не считаем дважды). */
  existing?: boolean;
}

/**
 * Пытается зарезервировать слот под участника. Идемпотентно по (room, identity):
 * повторный вызов для уже занятого слота всегда успешен и НЕ увеличивает счётчик.
 */
export function tryAcquire(room: string, identity: string): AcquireResult {
  purgeExpired();
  const limit = getLimit();
  const k = key(room, identity);

  if (slots.has(k)) {
    // Обновляем метку, чтобы TTL не снял активного участника.
    slots.get(k)!.acquiredAt = now();
    return { ok: true, current: slots.size, limit, existing: true };
  }

  if (slots.size >= limit) {
    return { ok: false, current: slots.size, limit };
  }

  slots.set(k, { room, identity, acquiredAt: now() });
  return { ok: true, current: slots.size, limit };
}

/** Освобождает слот конкретного участника. */
export function release(room: string, identity: string): void {
  slots.delete(key(room, identity));
}

/** Освобождает все слоты комнаты (hangup/stop/delete). */
export function releaseRoom(room: string): void {
  const prefix = `${room}::`;
  for (const k of slots.keys()) {
    if (k.startsWith(prefix)) slots.delete(k);
  }
}

/** Снимок для мониторинга (/api/translation/status). */
export function snapshot(): { current: number; limit: number; rooms: number } {
  purgeExpired();
  const rooms = new Set<string>();
  for (const s of slots.values()) rooms.add(s.room);
  return { current: slots.size, limit: getLimit(), rooms: rooms.size };
}

/**
 * Reconcile с LiveKit: освобождает слоты комнат, которых уже нет среди живых.
 * Защищает от утечек, если release-события были пропущены. Свежие слоты (grace) не трогает.
 */
export async function reconcileWithLiveKit(): Promise<void> {
  const liveRooms = await listActiveRoomNames();
  if (!liveRooms) return; // LiveKit недоступен — пропускаем, ничего не ломаем
  const t = now();
  for (const [k, s] of slots) {
    if (t - s.acquiredAt < RECONCILE_GRACE_MS) continue; // только что выдан токен — ждём подключения
    if (!liveRooms.has(s.room)) slots.delete(k);
  }
}

let reconcileTimer: NodeJS.Timeout | null = null;

/** Запускает периодический reconcile. Идемпотентно (повторный вызов — no-op). */
export function startReconcileLoop(): void {
  if (reconcileTimer) return;
  reconcileTimer = setInterval(() => {
    reconcileWithLiveKit().catch((err) =>
      console.warn('[admission.reconcile] error:', err?.message || err)
    );
  }, RECONCILE_INTERVAL_MS);
  // Не держим процесс живым только ради этого таймера.
  if (typeof reconcileTimer.unref === 'function') reconcileTimer.unref();
  console.log('[admission] reconcile loop запущен (каждые', RECONCILE_INTERVAL_MS / 1000, 'сек)');
}
