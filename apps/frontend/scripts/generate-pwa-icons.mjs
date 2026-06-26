#!/usr/bin/env node
/**
 * generate-pwa-icons.mjs
 *
 * Из master-файла Content/pwa-master-1024.png генерирует полный набор
 * PWA-иконок в apps/frontend/public/icons/:
 *
 *   icon-192.png             — any-purpose, Android home screen (минимум для установки)
 *   icon-512.png             — any-purpose, Android splash / Chrome Desktop
 *   icon-maskable-192.png    — maskable, Android adaptive (логотип в центре 70%, фон #0A0A0A)
 *   icon-maskable-512.png    — maskable, тот же принцип, больший размер
 *   apple-touch-icon-180.png — iOS home screen (Safari читает напрямую, не из манифеста)
 *   favicon-32.png           — вкладка браузера
 *   favicon-16.png           — вкладка браузера (legacy)
 *
 * Maskable safe zone: Android может вырезать иконку кругом, скруглённым квадратом
 * или каплей — логотип должен помещаться в центральный круг диаметром 80% от стороны.
 * Делаем с запасом — масштабируем master до 70% и центруем на фоне #0A0A0A
 * (совпадает с theme-color/background-color в манифесте).
 *
 * Запуск:
 *   node scripts/generate-pwa-icons.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const MONOREPO_ROOT = path.resolve(FRONTEND_ROOT, '..', '..');
const MASTER = path.join(MONOREPO_ROOT, 'Content', 'pwa-master-1024.png');
const OUT_DIR = path.join(FRONTEND_ROOT, 'public', 'icons');

const BACKGROUND = '#0A0A0A';
const MASKABLE_INNER_RATIO = 0.70; // логотип занимает 70% — даёт ~15% padding со всех сторон

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function genAny(size, outName) {
  const out = path.join(OUT_DIR, outName);
  await sharp(MASTER)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ✓ ${outName} (${size}×${size})`);
}

async function genMaskable(size, outName) {
  const inner = Math.round(size * MASKABLE_INNER_RATIO);
  const pad = Math.round((size - inner) / 2);
  const out = path.join(OUT_DIR, outName);

  // Уменьшенный логотип
  const logo = await sharp(MASTER)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // Накладываем на фон BACKGROUND
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BACKGROUND,
    },
  })
    .composite([{ input: logo, top: pad, left: pad }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ✓ ${outName} (${size}×${size}, maskable, inner=${inner})`);
}

async function main() {
  // Проверяем мастер
  try {
    await fs.access(MASTER);
  } catch {
    console.error(`ERROR: master file not found at ${MASTER}`);
    console.error('Положи мастер-иконку 1024×1024 PNG по этому пути и запусти снова.');
    process.exit(1);
  }

  await ensureDir(OUT_DIR);
  console.log(`Master: ${path.relative(MONOREPO_ROOT, MASTER)}`);
  console.log(`Output: ${path.relative(MONOREPO_ROOT, OUT_DIR)}\n`);

  // Any-purpose иконки (с прозрачным фоном)
  await genAny(192, 'icon-192.png');
  await genAny(512, 'icon-512.png');

  // Maskable (с фоном #0A0A0A)
  await genMaskable(192, 'icon-maskable-192.png');
  await genMaskable(512, 'icon-maskable-512.png');

  // Apple touch icon (iOS) — на тёмном фоне, без скруглений (iOS сам скруглит)
  // iOS не уважает alpha, поэтому делаем непрозрачный фон.
  {
    const size = 180;
    const inner = Math.round(size * 0.85);
    const pad = Math.round((size - inner) / 2);
    const out = path.join(OUT_DIR, 'apple-touch-icon-180.png');
    const logo = await sharp(MASTER)
      .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    await sharp({
      create: { width: size, height: size, channels: 4, background: BACKGROUND },
    })
      .composite([{ input: logo, top: pad, left: pad }])
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log(`  ✓ apple-touch-icon-180.png (180×180, opaque bg)`);
  }

  // Favicons (вкладка браузера) — прозрачный фон, чтобы вписаться в любую тему вкладки
  await genAny(32, 'favicon-32.png');
  await genAny(16, 'favicon-16.png');

  console.log('\nAll PWA icons generated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
