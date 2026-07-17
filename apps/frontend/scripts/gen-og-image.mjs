#!/usr/bin/env node
/**
 * gen-og-image.mjs — генерация OG-карточки public/og-image.png (1200×630).
 *
 * Карточка для соцшаринга (Telegram/WhatsApp/Facebook/X): чёрный void
 * с индиго-свечением в духе лендинга, фирменный wordmark по центру,
 * слоган EN + домен. На неё ссылаются index.html, SeoMeta и Helmet лендинга.
 *
 * Запуск (из apps/frontend):  node scripts/gen-og-image.mjs
 * Требует dev-зависимость sharp (уже в node_modules).
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const LOGO = path.join(ROOT, 'public', 'vibevox-logo-dark.png');
const OUT = path.join(ROOT, 'public', 'og-image.png');

const W = 1200, H = 630;

const bgSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="glow" cx="50%" cy="42%" r="75%">
      <stop offset="0%" stop-color="#1b1040"/>
      <stop offset="45%" stop-color="#0d0722"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
    <radialGradient id="accent" cx="85%" cy="10%" r="40%">
      <stop offset="0%" stop-color="#8052ff" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#8052ff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect width="${W}" height="${H}" fill="url(#accent)"/>
  ${Array.from({ length: 46 }, (_, i) => {
    // Детерминированные «частицы»-треугольники (как на лендинге) — без Math.random,
    // чтобы карточка была воспроизводимой между запусками.
    const rnd = (s) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
    const x = 40 + rnd(1) * (W - 80), y = 30 + rnd(2) * (H - 60);
    const s = 5 + rnd(3) * 11, a = rnd(4) * 360, o = (0.10 + rnd(5) * 0.30).toFixed(2);
    return `<path d="M ${x.toFixed(1)} ${y.toFixed(1)} l ${s.toFixed(1)} ${(s * 0.58).toFixed(1)} l -${s.toFixed(1)} ${(s * 0.58).toFixed(1)} z" fill="none" stroke="#8052ff" stroke-width="1.1" opacity="${o}" transform="rotate(${a.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }).join('\n  ')}
  <text x="600" y="463" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="37" font-weight="600" fill="#ffffff" opacity="0.92">Find viral trends. Create AI videos on autopilot.</text>
  <text x="600" y="545" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="400" fill="#a48bff" opacity="0.95">trendtraffic.pro</text>
</svg>`;

// В исходном wordmark-е внизу запечена белая подпись «SMART VIDE MARKETING»
// (с опечаткой VIDE), на тёмном фоне она видна. Стираем её поточечно:
// подпись живёт в строках y≥153 при x<490; правее (x≈495–534) — хвост
// лигатуры «ffi», его сохраняем.
const { data: lgRaw, info: lgInfo } = await sharp(LOGO).raw().toBuffer({ resolveWithObject: true });
for (let y = 153; y < lgInfo.height; y++) {
  for (let x = 0; x < Math.min(490, lgInfo.width); x++) {
    lgRaw[(y * lgInfo.width + x) * 4 + 3] = 0;
  }
}
const logoClean = await sharp(lgRaw, { raw: { width: lgInfo.width, height: lgInfo.height, channels: 4 } })
  .png().toBuffer();
const logo = await sharp(logoClean).trim().resize({ width: 780 }).png().toBuffer();
const logoMeta = await sharp(logo).metadata();

await sharp(Buffer.from(bgSvg))
  .png()
  .composite([{ input: logo, left: Math.round((W - logoMeta.width) / 2), top: Math.round(160 + (220 - logoMeta.height) / 2) }])
  .png({ compressionLevel: 9 })
  .toFile(OUT);

const meta = await sharp(OUT).metadata();
const { promises: fsp } = await import('node:fs');
const { size } = await fsp.stat(OUT);
console.log('og-image.png:', `${meta.width}x${meta.height}`, `${Math.round(size / 1024)}KB`);

// Численная проверка: в зоне слогана должны быть светлые пиксели (текст отрендерился).
const raw = await sharp(OUT).extract({ left: 300, top: 430, width: 600, height: 50 }).greyscale().raw().toBuffer();
let bright = 0; for (const v of raw) if (v > 140) bright++;
console.log('bright px in tagline zone:', bright, bright > 500 ? 'OK' : '⚠ ТЕКСТ НЕ ОТРЕНДЕРИЛСЯ');
