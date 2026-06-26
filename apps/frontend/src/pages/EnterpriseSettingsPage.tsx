/**
 * EnterpriseSettingsPage — контейнер 4 секций Enterprise-настроек.
 *
 * URL: /settings/enterprise (виден только Enterprise / superadmin).
 *
 * Архитектура подготовлена под добавление Section5+ без структурных изменений:
 * новый таб = добавить элемент в SECTIONS массив + лениво-импортированный компонент.
 */

import React, { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, BrainCircuit, Workflow, Boxes, Loader2, Lock, Plug } from 'lucide-react';
import { useIsEnterprise } from '../hooks/useIsEnterprise';
import { AuroraCard } from '../components/AuroraCard';

// Lazy-load каждой секции — стартовая страница лёгкая, тяжёлые формы грузятся по требованию.
const Section1Gemini = lazy(() => import('./enterprise/Section1Gemini'));
const Section2Prompt = lazy(() => import('./enterprise/Section2Prompt'));
const Section3QuestFlow = lazy(() => import('./enterprise/Section3QuestFlow'));
const Section4Chatwoot = lazy(() => import('./enterprise/Section4Chatwoot'));
const Section5Mcp = lazy(() => import('./enterprise/Section5Mcp'));

interface BuiltSection {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  component: React.LazyExoticComponent<React.ComponentType<any>>;
}

export function EnterpriseSettingsPage() {
  const { t } = useTranslation('common');
  const isEnterprise = useIsEnterprise();

  const SECTIONS: BuiltSection[] = [
    {
      key: 'gemini',
      label: t('enterprise.tabs.api', 'API'),
      icon: <Sparkles size={16} />,
      color: '#8B5CF6',
      component: Section1Gemini,
    },
    {
      key: 'prompt',
      label: t('enterprise.tabs.prompts'),
      icon: <BrainCircuit size={16} />,
      color: '#8B5CF6',
      component: Section2Prompt,
    },
    {
      key: 'questflow',
      label: t('enterprise.tabs.ai', 'AI'),
      icon: <Workflow size={16} />,
      color: '#22d3ee',
      component: Section3QuestFlow,
    },
    {
      key: 'chatwoot',
      label: t('enterprise.tabs.chatwoot'),
      icon: <Boxes size={16} />,
      color: '#10b981',
      component: Section4Chatwoot,
    },
    {
      key: 'mcp',
      label: t('enterprise.tabs.mcp'),
      icon: <Plug size={16} />,
      color: '#f59e0b',
      component: Section5Mcp,
    },
  ];

  const [active, setActive] = useState<string>(SECTIONS[0].key);

  if (!isEnterprise) {
    // Не Enterprise — показываем заглушку с upsell. Альтернатива — redirect.
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <AuroraCard className="p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-4"
               style={{ background: 'rgba(139,92,246,0.10)', color: '#8B5CF6' }}>
            <Lock size={24} />
          </div>
          <h2 className="text-lg font-700 mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('enterprise.page.upsellTitle')}
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('enterprise.page.upsellBody')}
          </p>
          <a href="/billing" className="inline-block mt-4 px-4 py-2 rounded-xl text-sm font-700"
             style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', color: '#fff' }}>
            {t('enterprise.page.upsellCta')}
          </a>
        </AuroraCard>
      </div>
    );
  }

  const ActiveComponent = SECTIONS.find((s) => s.key === active)?.component;

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-700" style={{ color: 'var(--text-primary)' }}>
          {t('enterprise.page.title')}
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('enterprise.page.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b" style={{ borderColor: 'var(--border-medium)' }}>
        {SECTIONS.map((s) => {
          const isActive = active === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-700 whitespace-nowrap transition-all border-b-2"
              style={{
                borderColor: isActive ? s.color : 'transparent',
                color: isActive ? s.color : 'var(--text-muted)',
                background: isActive ? `${s.color}10` : 'transparent',
              }}
            >
              <span style={{ color: isActive ? s.color : 'var(--text-muted)' }}>{s.icon}</span>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Active section */}
      <div>
        <Suspense fallback={
          <div className="py-12 text-center">
            <Loader2 size={24} className="animate-spin inline-block" style={{ color: 'var(--text-muted)' }} />
          </div>
        }>
          {ActiveComponent && <ActiveComponent />}
        </Suspense>
      </div>
    </div>
  );
}

export default EnterpriseSettingsPage;
