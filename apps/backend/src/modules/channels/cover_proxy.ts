/**
 * Прокси обложек/аватаров каналов.
 *
 * TikTok/Instagram отдают подписанные CDN-ссылки (p16-…-sign.tiktokcdn-eu.com и т.п.),
 * которые браузер БЛОКИРУЕТ при прямой загрузке через <img> (ORB / 403 — нужен Referer
 * площадки). Тянем картинку на сервере с правильным Referer и стримим обратно.
 *
 * Публичный (без JWT) — <img> не умеет слать Authorization. Защита: (1) белый список
 * CDN-хостов (нельзя превратить в произвольный SSRF-прокси), (2) только https, (3) только
 * image/*, (4) rate-limit по IP, (5) таймаут. Монтируется ДО /api/channels (auth-роутера).
 */

import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const router = Router();

// Разрешённые CDN-хосты (хвост hostname). Только публичные медиа-CDN площадок.
const ALLOWED = /(?:^|\.)(?:tiktokcdn(?:-eu|-us|-in)?\.com|ibyteimg\.com|byteimg\.com|muscdn\.com|tiktokv\.com|pstatp\.com|cdninstagram\.com|fbcdn\.net|ytimg\.com|ggpht\.com)$/i;

function refererFor(host: string): string {
  if (/tiktok|byteimg|muscdn|pstatp/i.test(host)) return 'https://www.tiktok.com/';
  if (/instagram|fbcdn/i.test(host)) return 'https://www.instagram.com/';
  if (/ytimg|ggpht/i.test(host)) return 'https://www.youtube.com/';
  return 'https://www.google.com/';
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Обложек на канал — до сотен; грузятся пачкой. Лимит высокий, но рубит абуз.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'cover',
});
router.use(limiter);

router.get('/', async (req: Request, res: Response) => {
  const raw = typeof req.query.u === 'string' ? req.query.u : '';
  let u: URL;
  try { u = new URL(raw); } catch { return res.status(400).end(); }
  if (u.protocol !== 'https:' || !ALLOWED.test(u.hostname)) return res.status(403).end();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const upstream = await fetch(u.toString(), {
      headers: { Referer: refererFor(u.hostname), 'User-Agent': UA, Accept: 'image/avif,image/webp,image/*,*/*' },
      signal: controller.signal,
    });
    if (!upstream.ok || !upstream.body) return res.status(upstream.status >= 400 ? 404 : 502).end();
    const ct = upstream.headers.get('content-type') || 'image/jpeg';
    if (!/^image\//i.test(ct)) return res.status(415).end();
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');   // обложки стабильны → кэшируем сутки
    await pipeline(Readable.fromWeb(upstream.body as any), res);
  } catch {
    if (!res.headersSent) res.status(502).end();
  } finally {
    clearTimeout(timer);
  }
});

export default router;
