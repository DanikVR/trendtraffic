/**
 * MediaLightbox + MediaDownloadButton — просмотр и скачивание медиа из чата.
 *
 * MediaLightbox — полноэкранный просмотр изображения: кнопка «Закрыть» (✕),
 * клик по фону, Esc. Плюс иконка скачивания.
 *
 * MediaDownloadButton — компактная иконка-кнопка «Скачать» (без текста),
 * ставится рядом с любым медиа (изображение / видео / аудио).
 *
 * Скачивание: fetch → blob (надёжно на мобильных/PWA, где атрибут download у <a>
 * часто игнорируется). Имя файла берётся ЧИСТЫМ из URL (id-имя на диске, ASCII) —
 * НЕ из metadata.original_name, которое приходит с бэка в битой кодировке.
 */

import React, { useEffect, useState } from 'react';
import { X, Download, Loader2 } from 'lucide-react';

/** Чистое имя файла из URL: '/uploads/enterprise-chat/123-456.png?x=1' → '123-456.png'. */
function filenameFromUrl(url: string): string {
  try {
    const path = url.split('?')[0].split('#')[0];
    const base = path.split('/').pop();
    return base && base.length ? decodeURIComponent(base) : 'vibevox-media';
  } catch {
    return 'vibevox-media';
  }
}

/** Сохраняет медиа на устройство. fetch→blob, при ошибке — открыть в новой вкладке. */
export async function downloadMedia(url: string): Promise<void> {
  const name = filenameFromUrl(url);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 2000);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

interface MediaDownloadButtonProps {
  url: string;
  /** overlay — тёмная иконка поверх медиа (для картинок/видео); иначе приглушённая (для строки аудио). */
  overlay?: boolean;
  className?: string;
}

/** Иконка-кнопка «Скачать» (без текста). */
export function MediaDownloadButton({ url, overlay = false, className = '' }: MediaDownloadButtonProps) {
  const [busy, setBusy] = useState(false);
  const handle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      await downloadMedia(url);
    } finally {
      setBusy(false);
    }
  };
  const size = overlay ? 15 : 13;
  return (
    <button
      type="button"
      onClick={handle}
      disabled={busy}
      title="Скачать"
      aria-label="Скачать"
      className={`flex items-center justify-center flex-shrink-0 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-50 ${overlay ? 'w-7 h-7' : 'w-6 h-6'} ${className}`}
      style={
        overlay
          ? { background: 'rgba(0,0,0,0.55)', color: '#fff', backdropFilter: 'blur(4px)' }
          : { color: 'var(--text-muted)' }
      }
    >
      {busy ? <Loader2 size={size} className="animate-spin" /> : <Download size={size} />}
    </button>
  );
}

interface MediaLightboxProps {
  open: boolean;
  url: string;
  onClose: () => void;
}

export function MediaLightbox({ open, url, onClose }: MediaLightboxProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      {/* Действия: скачать + закрыть (только иконки) */}
      <div className="absolute top-3 right-3 flex items-center gap-2 z-10" onClick={(e) => e.stopPropagation()}>
        <MediaDownloadButton url={url} overlay className="!w-10 !h-10 !rounded-xl" />
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-opacity hover:opacity-90"
          style={{ background: 'rgba(255,255,255,0.16)', color: '#fff', backdropFilter: 'blur(8px)' }}
          title="Закрыть"
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>
      </div>

      {/* Изображение (клик по нему не закрывает оверлей) */}
      <div className="max-w-full max-h-full flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <img src={url} alt="" className="max-w-full max-h-[88vh] rounded-lg object-contain" />
      </div>
    </div>
  );
}

export default MediaLightbox;
