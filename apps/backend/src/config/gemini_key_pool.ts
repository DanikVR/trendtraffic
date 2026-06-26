/**
 * Round-robin пул Gemini API ключей (п.4 плана масштабирования).
 *
 * ЗАЧЕМ: лимит concurrent Gemini Live сессий считается per GCP-проект. Один ключ из одного
 * проекта = один потолок. Чтобы поднять общий потолок для глобального/freemium трафика,
 * раскидываем сессии по нескольким ключам ИЗ РАЗНЫХ ПРОЕКТОВ (ключи из одного проекта
 * делят лимит и ротация не поможет — см. docs/SCALING_GEMINI_LIVE.md).
 *
 * Ротация — по новой Gemini-сессии/мосту (на уровне bridge.connect). Состояние индекса
 * живёт в памяти процесса (single-instance); при multi-instance каждый инстанс ротирует
 * независимо — это допустимо, распределение остаётся равномерным в среднем.
 */

import { getGeminiApiKeyPool } from './systemConfig.js';

let rrIndex = 0;

/**
 * Возвращает следующий ключ из пула по round-robin, либо null если пул пуст.
 * Если в пуле один ключ — всегда возвращает его (вырожденный случай, как раньше).
 */
export function pickGeminiKey(): string | null {
  const pool = getGeminiApiKeyPool();
  if (pool.length === 0) return null;
  const key = pool[rrIndex % pool.length];
  rrIndex = (rrIndex + 1) % pool.length;
  return key;
}

/** Размер пула (число уникальных ключей). Для логов/мониторинга. */
export function geminiPoolSize(): number {
  return getGeminiApiKeyPool().length;
}
