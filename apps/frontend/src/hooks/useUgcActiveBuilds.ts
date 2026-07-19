/**
 * useUgcActiveBuilds — фоновые сборки UGC текущего тенанта.
 *
 * Поллит GET /api/render/ugc/build/active (лёгкая ручка: чтение из in-memory Map),
 * пока приложение открыто. Нужен для индикаторов ВНЕ студии: спиннер на пункте
 * сайдбара и вкладке UGC + карточка «Создаём видео…» в Галерее — юзер вышел из
 * студии, сборка идёт на сервере, значки крутятся.
 *
 * Поллинг мягкий (по умолчанию 8с) и останавливается в фоне вкладки браузера
 * (document.hidden) — не жжём батарею/сервер зря.
 */
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export interface UgcActiveBuilds {
  count: number;
  jobs: { job: string; status: string; ts?: number; name?: string }[];
}

export function useUgcActiveBuilds(pollMs = 8000): UgcActiveBuilds {
  const token = useAppStore((s) => s.token);
  const [st, setSt] = useState<UgcActiveBuilds>({ count: 0, jobs: [] });
  useEffect(() => {
    if (!token) { setSt({ count: 0, jobs: [] }); return; }
    let dead = false;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch('/api/render/ugc/build/active', { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) return;
        const d = await r.json();
        if (dead) return;
        const count = Number(d?.count) || 0;
        const jobs = Array.isArray(d?.jobs) ? d.jobs : [];
        setSt((prev) => (prev.count === count && count === 0 ? prev : { count, jobs }));
      } catch { /* сеть моргнула — попробуем в следующий тик */ }
    };
    void tick();
    const id = window.setInterval(tick, Math.max(3000, pollMs));
    return () => { dead = true; window.clearInterval(id); };
  }, [token, pollMs]);
  return st;
}
