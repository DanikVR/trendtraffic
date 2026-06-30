/**
 * VibeVoxLogo — фирменный логотип VibeVox (wordmark «VIBEVOX» + иконка телефон/перевод).
 *
 * Файлы:
 *   /vibevox-logo-light.png — для светлой темы (тёмный текст)
 *   /vibevox-logo-dark.png  — для тёмной темы (светлый текст)
 *
 * Логика выбора: реагируем на класс `dark` на <html> + слушаем MutationObserver,
 * чтобы переключение темы во время сеанса меняло картинку без перезагрузки.
 */

import React, { useEffect, useState } from 'react';

interface VibeVoxLogoProps {
  /** Высота логотипа в пикселях. Ширина пропорциональна (логотип широкий: ~3.5:1). */
  height?: number;
  className?: string;
  /** ARIA-label. По умолчанию «VibeVox». */
  alt?: string;
  /** Принудительный вариант: 'light' (тёмный текст для белого фона)
   *  или 'dark' (светлый текст для тёмного фона). По умолчанию — по теме app. */
  variant?: 'light' | 'dark';
}

function readIsDark(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

export function VibeVoxLogo({ height = 32, className, alt = 'VibeVox', variant }: VibeVoxLogoProps) {
  const [isDark, setIsDark] = useState<boolean>(readIsDark);

  useEffect(() => {
    if (variant) return; // принудительный вариант — не слушаем theme
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains('dark'));
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    update();
    return () => observer.disconnect();
  }, [variant]);

  const effectiveDark = variant ? variant === 'dark' : isDark;
  const src = effectiveDark ? '/vibevox-logo-dark.png' : '/vibevox-logo-light.png';

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      // Исходник 700×200 (3.5:1). Жёстко фиксируем пропорции: даже если родитель
      // ограничит ширину, aspect-ratio + object-fit:contain не дадут «сплющить» логотип.
      style={{
        height,
        width: 'auto',
        aspectRatio: '700 / 200',
        objectFit: 'contain',
        maxWidth: '100%',
        display: 'block',
        userSelect: 'none',
      }}
      draggable={false}
    />
  );
}

export default VibeVoxLogo;
