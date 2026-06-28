/**
 * ФИЧ-ФЛАГИ VibeVox — frontend (build-time ЗЕРКАЛО backend `config/features.ts`).
 * ════════════════════════════════════════════════════════════════════════
 * Выключение флага здесь убирает РОУТЫ и пункты МЕНЮ фичи (и её код выпадает из
 * бандла при tree-shaking). Гейтинг API — на backend (там канонический источник).
 *
 * ⚠️ ДЕРЖИ В СИНХРОНЕ с apps/backend/src/config/features.ts.
 *    Сверка вживую: GET /api/features отдаёт серверные значения.
 *
 * Чтобы отключить функцию в этой сборке — поставь false. Чтобы добавить новую —
 * добавь ключ здесь и в backend, затем оберни её роут/ссылку в `FEATURES.<ключ>`.
 */
export const FEATURES = {
  /** Видеозвонки-перевод: RoomPage (/, /room/:id), FAB/CTA «создать комнату». TrendTraffic: выкл. */
  video: false,
  /** SIP-телефония: /sip + ссылки в навигации. TrendTraffic: выкл. */
  sip: false,
  /** Правила обучения / диалекты (AI Learning Hub): /admin/dialects. */
  learnHub: true,
  /** Партнёрская программа: /admin/partners. */
  partners: true,
  /** Публичная аудио-песочница на лендинге (бэкенд /api/demo). */
  publicDemo: true,
  /** TrendFlow: визуальный конструктор /flow + пункт меню. */
  flow: true,
  /** TrendTraffic: анализатор трендов /trends + пункт меню. */
  trends: true,
  /** TrendTraffic: галерея скачанных видео /gallery. */
  gallery: true,
  /** TrendTraffic: публикатор в соцсети /publisher. */
  publisher: true,
  /** TrendTraffic: вкладка «Social Media Extension» (рехостинг TikHub-расширения). Только Enterprise. */
  socialMediaExt: true,
} as const;

export type FeatureName = keyof typeof FEATURES;

export function isFeatureEnabled(name: FeatureName): boolean {
  return FEATURES[name];
}

/** Куда вести «/» и логотип, если видеозвонки выключены (TrendTraffic: домашняя = Тренды). */
export const HOME_ROUTE_WHEN_NO_VIDEO = '/trends';
