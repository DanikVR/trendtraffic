/**
 * PublisherPage — публикатор (TrendTraffic).
 *
 * Заглушка под следующий этап: публикация готовых видео в соцсети
 * (профили бренда, контент-план/календарь, отложенный постинг). Пока — описание
 * предстоящего функционала, чтобы пункт меню жил и был понятен.
 */

import React from 'react';
import { Send, Calendar, Share2, Clock, CheckCircle2 } from 'lucide-react';
import { AuroraCard } from '../components/AuroraCard';

const STEPS = [
  { icon: <Share2 size={16} />, title: 'Профили соцсетей', body: 'Подключение профилей бренда (TikTok, Instagram, YouTube, Facebook, X и др.).' },
  { icon: <Calendar size={16} />, title: 'Контент-план', body: 'Календарь-сетка: перетаскивание роликов на дату и время публикации.' },
  { icon: <Clock size={16} />, title: 'Отложенный постинг', body: 'Авто-публикация по расписанию + «лучшее время для поста».' },
  { icon: <CheckCircle2 size={16} />, title: 'Статусы и аналитика', body: 'Отслеживание статусов публикаций и охватов в реальном времени.' },
];

export default function PublisherPage() {
  return (
    <div className="max-w-[1760px] mx-auto py-2 sm:py-3 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
             style={{ background: 'linear-gradient(135deg, #7c5cff, #6366F1)' }}>
          <Send size={20} color="#fff" />
        </div>
        <div>
          <h1 className="text-2xl font-700" style={{ color: 'var(--text-primary)' }}>Публикатор</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Публикация готовых видео в соцсети.</p>
        </div>
      </div>

      <AuroraCard className="p-5">
        <div className="inline-flex items-center gap-2 text-xs font-700 px-2.5 py-1 rounded-full mb-3"
             style={{ background: 'rgba(124,92,255,0.12)', color: '#7c5cff' }}>
          <Clock size={12} /> Следующий этап
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Здесь появится публикация роликов из <b>Галереи</b> в соцсети: подключение профилей, контент-план
          в виде календаря и отложенный постинг. Базовый тариф покрывает до <b>10 профилей</b> бренда;
          Enterprise-тенанты смогут подключить собственные интеграции.
        </p>
      </AuroraCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STEPS.map((s, i) => (
          <AuroraCard key={i} className="p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'var(--bg-tertiary)', color: '#7c5cff' }}>{s.icon}</div>
            <div>
              <div className="text-sm font-700" style={{ color: 'var(--text-primary)' }}>{s.title}</div>
              <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>{s.body}</p>
            </div>
          </AuroraCard>
        ))}
      </div>
    </div>
  );
}
