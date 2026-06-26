/**
 * ФИЧ-ФЛАГИ VibeVox — КАНОНИЧЕСКИЙ источник (backend).
 * ════════════════════════════════════════════════════════════════════════
 * Зачем: проект используется как «заготовка». Чтобы отключить целую функцию
 * (видеозвонки, SIP, диалекты, партнёрку, демо) — НЕ нужно удалять код по кускам.
 * Достаточно одного флага здесь (+ зеркало в apps/frontend/src/config/features.ts).
 *
 * Как это устроено (важно понимать):
 *   • Гейтинг идёт на уровне МОНТИРОВАНИЯ роутера в server.ts (`if (FEATURES.x)`).
 *   • Это БЕЗОПАСНО: модули импортируют друг у друга СЕРВИСЫ (функции), а не
 *     роутеры. Отключив монтирование, мы убираем HTTP-эндпоинты фичи, но
 *     импортируемые сервисы остаются — ничего у соседей не ломается.
 *   • Frontend читает СВОЁ зеркало (build-time, чтобы код фичи выпиливался из
 *     бандла). GET /api/features отдаёт этот объект для сверки/диагностики.
 *
 * Способы отключить фичу:
 *   1) поставить false ниже (для своей сборки-варианта), ИЛИ
 *   2) env-оверрайд без правки кода: FEATURE_VIDEO=off (off/false/0/no = выкл).
 *      Имя env: FEATURE_<КЛЮЧ_В_ВЕРХНЕМ_РЕГИСТРЕ>.
 *
 * Что НЕ гейтится (ядро — всегда включено): auth, rooms, billing, admin
 * (config/users/promocodes), settings, tenant-settings, notifications, и
 * Enterprise-подсистема (insights/need-tags/tenant-prompt) — она и так закрыта
 * тарифом. Новые флаги добавляй сюда + в зеркало + оберни mount в server.ts.
 */

export interface FeatureFlags {
  /** Видеозвонки-перевод (LiveKit). Роутеры: livekit, translation, coach. Фронт: RoomPage (/, /room/:id), FAB/CTA «создать комнату». */
  video: boolean;
  /** SIP-телефония. Роутер: sip. Фронт: /sip + ссылки в навигации. */
  sip: boolean;
  /** Правила обучения / диалекты (AI Learning Hub). Роутер: admin/dialects. Фронт: /admin/dialects. */
  learnHub: boolean;
  /** Партнёрская программа (рефералки). Роутеры: partners (public+admin). Фронт: /admin/partners. */
  partners: boolean;
  /** Публичная аудио-песочница на лендинге. Роутер: demo. */
  publicDemo: boolean;
}

/** Дефолты — «всё включено». Чтобы отключить функцию в этой сборке: поставь false. */
const DEFAULTS: FeatureFlags = {
  video: true,
  sip: true,
  learnHub: true,
  partners: true,
  publicDemo: true,
};

/** env-оверрайд: FEATURE_<KEY>=off|false|0|no → выключено; пусто → дефолт; иначе → включено. */
function fromEnv(key: keyof FeatureFlags, def: boolean): boolean {
  const v = (process.env[`FEATURE_${key.toUpperCase()}`] || '').trim().toLowerCase();
  if (v === '') return def;
  return !(v === 'off' || v === 'false' || v === '0' || v === 'no');
}

export const FEATURES: FeatureFlags = {
  video: fromEnv('video', DEFAULTS.video),
  sip: fromEnv('sip', DEFAULTS.sip),
  learnHub: fromEnv('learnHub', DEFAULTS.learnHub),
  partners: fromEnv('partners', DEFAULTS.partners),
  publicDemo: fromEnv('publicDemo', DEFAULTS.publicDemo),
};

export function isFeatureEnabled(name: keyof FeatureFlags): boolean {
  return FEATURES[name];
}
