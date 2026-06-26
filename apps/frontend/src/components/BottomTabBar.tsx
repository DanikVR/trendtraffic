/**
 * BottomTabBar — мобильный шелл VibeVox.
 *
 * Нижней полосы нет. Содержит:
 *  - Плавающую FAB в левом-нижнем углу с композитной иконкой «перевод+телефон»,
 *    которая «светится» (анимация box-shadow). По клику — сразу триггер создания
 *    комнаты перевода через ?create=true (с pre-check баланса в RoomPage).
 *  - MoreSheet (выдвижной снизу sheet), открывается из гамбургера в шапке MainLayout.
 *    Состояние общее через useAppStore.moreSheetOpen.
 *
 * Desktop (lg+): весь компонент скрыт — навигация через slim left sidebar в MainLayout.
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Languages,
  Phone,
  Settings,
  X,
  Zap,
  ShieldAlert,
  Download,
  Workflow,
  TrendingUp,
  Image,
  Send,
} from 'lucide-react';
import { AvatarCircle } from './AvatarCircle';
import { StatusPill } from './StatusPill';
import { MinutesDisplay } from './MinutesDisplay';
import { VibeVoxIcon } from './VibeVoxIcon';
import { ChevronForward } from './Chevron';
import { usePWAInstall } from './PWAInstallPrompt';
import { useAppStore } from '../store/useAppStore';
import { useIsEnterprise } from '../hooks/useIsEnterprise';
import { FEATURES } from '../config/features';

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────
export function BottomTabBar() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const location = useLocation();
  const { user, translationBalance, moreSheetOpen, setMoreSheetOpen } = useAppStore();
  const { showInstallDialog, isAvailable: pwaInstallAvailable } = usePWAInstall();

  // Локализованные пункты More-sheet — i18n заново резолвится при смене языка.
  const moreItems = [
    ...(FEATURES.sip ? [{ path: '/sip', icon: <Phone size={20} strokeWidth={1.5} />, label: t('moreSheet.sip.label'), sublabel: t('moreSheet.sip.sub'), accent: 'var(--text-secondary)' }] : []),
    ...(FEATURES.flow ? [{ path: '/flow', icon: <Workflow size={20} strokeWidth={1.5} />, label: 'TrendFlow', sublabel: t('moreSheet.flow.sub', 'Сценарии бота для каналов'), accent: '#7c5cff' }] : []),
    ...(FEATURES.trends ? [{ path: '/trends', icon: <TrendingUp size={20} strokeWidth={1.5} />, label: t('nav.trends', 'Тренды'), sublabel: t('moreSheet.trends.sub', 'Сканирование TikTok-трендов'), accent: '#f59e0b' }] : []),
    ...(FEATURES.gallery ? [{ path: '/gallery', icon: <Image size={20} strokeWidth={1.5} />, label: t('nav.gallery', 'Галерея'), sublabel: t('moreSheet.gallery.sub', 'Скачанные видео'), accent: '#10b981' }] : []),
    ...(FEATURES.publisher ? [{ path: '/publisher', icon: <Send size={20} strokeWidth={1.5} />, label: t('nav.publisher', 'Публикатор'), sublabel: t('moreSheet.publisher.sub', 'Публикация в соцсети'), accent: '#7c5cff' }] : []),
    { path: '/settings', icon: <Settings size={20} strokeWidth={1.5} />, label: t('moreSheet.settings.label'), sublabel: t('moreSheet.settings.sub'), accent: 'var(--text-muted)' },
  ];

  // ENTERPRISE: видимость пункта «Настройки Enterprise» в More-sheet.
  // Каноничный хук — true для tier === 'enterprise' и для superadmin.
  const isEnterprise = useIsEnterprise();

  // FAB не показываем на странице чата — она имеет свою кнопку «Отправить»,
  // и плавающая FAB перекрывает её.
  const isOnChatPage = /^\/room\/[^/]+\/chat\/?$/.test(location.pathname);

  return (
    <>
      {/* ── Плавающая FAB справа-снизу, чуть приподнятая (на всех размерах) ── */}
      {/* Иконки и glow — оранжевые (#ff7300) в обеих темах. Фон theme-adaptive,
          чтобы контраст работал и на светлом, и на тёмном. */}
      {FEATURES.video && !isOnChatPage && (
      <motion.button
        type="button"
        id="floating-action-glyph"
        onClick={() => navigate('/?create=true')}
        className="fixed bottom-6 right-6 z-30 flex items-center gap-1 px-3.5 py-3 rounded-2xl transition-transform active:scale-95 no-select touch-target"
        style={{ background: 'var(--btn-primary-bg)', color: '#ff7300' }}
        animate={{
          boxShadow: [
            '0 0 16px rgba(255,115,0,0.45), 0 4px 12px rgba(0,0,0,0.30)',
            '0 0 28px rgba(255,115,0,0.80), 0 4px 12px rgba(0,0,0,0.30)',
            '0 0 16px rgba(255,115,0,0.45), 0 4px 12px rgba(0,0,0,0.30)',
          ],
        }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        aria-label={t('moreSheet.createRoomAria')}
      >
        <Languages size={16} strokeWidth={1.75} />
        <Phone size={16} strokeWidth={1.75} />
      </motion.button>
      )}

      {/* ── More Sheet ── */}
      <AnimatePresence>
        {moreSheetOpen && (
          <>
            {/* Overlay */}
            <motion.div
              key="more-overlay"
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.65)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMoreSheetOpen(false)}
            />

            {/* Sheet */}
            <motion.div
              key="more-sheet"
              className="fixed bottom-0 left-0 right-0 z-50 bottom-sheet pb-safe"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            >
              {/* Handle */}
              <div className="pt-3 pb-1 flex justify-center">
                <div className="bottom-sheet-handle" />
              </div>

              {/* User profile row — кликабельная, ведёт в /settings */}
              <button
                type="button"
                onClick={() => { setMoreSheetOpen(false); navigate('/settings'); }}
                className="w-full mx-4 mt-3 mb-4 p-4 rounded-2xl flex items-center gap-3 text-left transition-colors hover:bg-[var(--bg-elevated)]"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', width: 'calc(100% - 2rem)' }}
                aria-label={t('moreSheet.settings.label')}
              >
                <AvatarCircle name={user?.name || user?.email} size="md" status="online" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600 truncate" style={{ color: 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif' }}>
                    {user?.name || t('moreSheet.userFallback')}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {user?.email}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <StatusPill status="online" />
                  <div className="flex items-center gap-1">
                    <Zap size={11} strokeWidth={2} style={{ color: 'var(--accent)' }} />
                    <span className="text-xs font-600" style={{ color: 'var(--accent-light)' }}>
                      <MinutesDisplay count={Math.floor(translationBalance / 60)} />
                    </span>
                  </div>
                </div>
              </button>

              {/* Menu items */}
              <div className="mx-4 mb-6 flex flex-col gap-2">
                {moreItems.map((item) => {
                  const isHex = item.accent.startsWith('#');
                  const bgStyle = isHex ? `${item.accent}18` : 'var(--bg-elevated)';
                  const fgStyle = item.accent;
                  return (
                    <button
                      key={item.path}
                      onClick={() => { setMoreSheetOpen(false); navigate(item.path); }}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-colors"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}
                    >
                      <div
                        className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ background: bgStyle, color: fgStyle }}
                      >
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
                          {item.label}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {item.sublabel}
                        </p>
                      </div>
                      <ChevronForward size={18} strokeWidth={1.5} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    </button>
                  );
                })}

                {/* ENTERPRISE v0.10.4: пункт «Настройки Enterprise» в More-sheet */}
                {isEnterprise && (
                  <button
                    onClick={() => { setMoreSheetOpen(false); navigate('/settings/enterprise'); }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-colors"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(139,92,246,0.12)', color: '#8B5CF6' }}
                    >
                      <Settings size={20} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
                        {t('moreSheet.enterprise.label')}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t('moreSheet.enterprise.sub')}
                      </p>
                    </div>
                    <ChevronForward size={18} strokeWidth={1.5} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </button>
                )}

                {user?.role === 'superadmin' && (
                  <button
                    onClick={() => { setMoreSheetOpen(false); navigate('/admin/config'); }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-colors"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--accent)' }}
                    >
                      <ShieldAlert size={20} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-600" style={{ color: 'var(--text-primary)' }}>
                        {t('moreSheet.admin.label')}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t('moreSheet.admin.sub')}
                      </p>
                    </div>
                    <ChevronForward size={18} strokeWidth={1.5} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  </button>
                )}

                {/* Logout — оранжевый */}
                <button
                  onClick={() => { setMoreSheetOpen(false); useAppStore.getState().logout(); }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl text-left mt-1"
                  style={{ background: 'rgba(255,115,0,0.06)', border: '1px solid rgba(255,115,0,0.18)', color: '#ff7300' }}
                >
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(255,115,0,0.14)' }}
                  >
                    <X size={18} strokeWidth={1.5} />
                  </div>
                  <span className="text-sm font-600">{t('moreSheet.logout')}</span>
                </button>

                {/* PWA Install — принудительная установка. Кнопка показывается
                    после Logout, кроме случая когда приложение уже запущено как
                    установленная PWA (standalone) или внутри Telegram WebView.
                    Использует фирменный VibeVoxIcon — даёт юзеру понять что
                    именно «VibeVox» окажется у него на главном экране. */}
                {pwaInstallAvailable && (
                  <button
                    type="button"
                    onClick={() => { setMoreSheetOpen(false); showInstallDialog(); }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl text-left mt-3"
                    style={{
                      background: 'rgba(255,115,0,0.06)',
                      border: '1px solid rgba(255,115,0,0.22)',
                    }}
                    aria-label={t('pwaInstall.buttonAria')}
                  >
                    <VibeVoxIcon size={40} bordered />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-600" style={{ color: '#ff7300' }}>
                        {t('pwaInstall.buttonLabel')}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {t('pwaInstall.buttonSubtitle')}
                      </p>
                    </div>
                    <Download size={18} strokeWidth={1.75} style={{ color: '#ff7300', flexShrink: 0 }} />
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
