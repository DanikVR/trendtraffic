import React, { useRef, useState, useEffect } from 'react';

export interface LanguageItem {
  code: string;
  name: string;
  flagCode: string;
}

export const LANGUAGES: LanguageItem[] = [
  { code: 'ru', name: 'Русский', flagCode: 'ru' },
  { code: 'en', name: 'English', flagCode: 'us' },
  { code: 'es', name: 'Español', flagCode: 'es' },
  { code: 'de', name: 'Deutsch', flagCode: 'de' },
  { code: 'fr', name: 'Français', flagCode: 'fr' },
  { code: 'it', name: 'Italiano', flagCode: 'it' },
  { code: 'zh', name: '中文', flagCode: 'cn' },
  { code: 'tr', name: 'Türkçe', flagCode: 'tr' },
  { code: 'ar', name: 'العربية', flagCode: 'sa' },
  { code: 'he', name: 'עברית', flagCode: 'il' },
  { code: 'uz', name: 'Oʻzbekcha', flagCode: 'uz' },
  { code: 'pt', name: 'Português', flagCode: 'pt' },
  { code: 'ja', name: '日本語', flagCode: 'jp' },
  { code: 'ko', name: '한국어', flagCode: 'kr' },
  { code: 'pl', name: 'Polski', flagCode: 'pl' },
  { code: 'nl', name: 'Nederlands', flagCode: 'nl' },
  { code: 'uk', name: 'Українська', flagCode: 'ua' },
  { code: 'vi', name: 'Tiếng Việt', flagCode: 'vn' },
  { code: 'th', name: 'ภาษาไทย', flagCode: 'th' },
  { code: 'hi', name: 'हिन्दी', flagCode: 'in' },
  { code: 'id', name: 'Bahasa Indonesia', flagCode: 'id' },
  { code: 'ro', name: 'Română', flagCode: 'ro' },
  { code: 'mr', name: 'मराठी', flagCode: 'in' },
  { code: 'bn', name: 'বাংলা', flagCode: 'bd' },
  { code: 'ta', name: 'தமிழ்', flagCode: 'in' },
  { code: 'te', name: 'తెలుగు', flagCode: 'in' },
  { code: 'cs', name: 'Čeština', flagCode: 'cz' },
  { code: 'da', name: 'Dansk', flagCode: 'dk' },
  { code: 'fi', name: 'Suomi', flagCode: 'fi' },
  { code: 'el', name: 'Ελληνικά', flagCode: 'gr' },
  { code: 'hu', name: 'Magyar', flagCode: 'hu' },
  { code: 'no', name: 'Norsk', flagCode: 'no' },
  { code: 'sv', name: 'Svenska', flagCode: 'se' },
  { code: 'bg', name: 'Български', flagCode: 'bg' },
  { code: 'hr', name: 'Hrvatski', flagCode: 'hr' },
  { code: 'sk', name: 'Slovenčina', flagCode: 'sk' },
  { code: 'sl', name: 'Slovenščina', flagCode: 'si' },
  { code: 'et', name: 'Eesti', flagCode: 'ee' },
  { code: 'lv', name: 'Latviešu', flagCode: 'lv' },
  { code: 'lt', name: 'Lietuvių', flagCode: 'lt' },
  { code: 'sr', name: 'Српски', flagCode: 'rs' },
  { code: 'kk', name: 'Қазақша', flagCode: 'kz' },
  { code: 'az', name: 'Azərbaycanca', flagCode: 'az' },
  { code: 'ka', name: 'ქართული', flagCode: 'ge' },
  { code: 'hy', name: 'Հայերեն', flagCode: 'am' },
  { code: 'fa', name: 'فارسی', flagCode: 'ir' },
  { code: 'ur', name: 'اردو', flagCode: 'pk' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', flagCode: 'in' },
  { code: 'gu', name: 'ગુજરાતી', flagCode: 'in' },
  { code: 'ml', name: 'മലയാളം', flagCode: 'in' },
  { code: 'kn', name: 'ಕನ್ನಡ', flagCode: 'in' },
  { code: 'am', name: 'አмаርኛ', flagCode: 'et' },
  { code: 'sq', name: 'Shqip', flagCode: 'al' },
  { code: 'eu', name: 'Euskara', flagCode: 'es' },
  { code: 'be', name: 'Беларуская', flagCode: 'by' },
  { code: 'bs', name: 'Bosanski', flagCode: 'ba' },
  { code: 'ca', name: 'Català', flagCode: 'es' },
  { code: 'eo', name: 'Esperanto', flagCode: 'un' },
  { code: 'gl', name: 'Galego', flagCode: 'es' },
  { code: 'is', name: 'Íslenska', flagCode: 'is' },
  { code: 'ga', name: 'Gaeilge', flagCode: 'ie' },
  { code: 'mk', name: 'Македонски', flagCode: 'mk' },
  { code: 'ms', name: 'Bahasa Melayu', flagCode: 'my' },
  { code: 'mt', name: 'Malti', flagCode: 'mt' },
  { code: 'sw', name: 'Kiswahili', flagCode: 'tz' },
  { code: 'cy', name: 'Cymraeg', flagCode: 'gb' },
  { code: 'af', name: 'Afrikaans', flagCode: 'za' },
  { code: 'mn', name: 'Монгол', flagCode: 'mn' },
  { code: 'ne', name: 'नेपाली', flagCode: 'np' },
  { code: 'si', name: 'සිංහල', flagCode: 'lk' },
  { code: 'km', name: 'ភាសាខ្មែរ', flagCode: 'kh' },
  { code: 'lo', name: 'ພາສາລາວ', flagCode: 'la' },
  { code: 'my', name: 'မြန်မာဘာသာ', flagCode: 'mm' },
  { code: 'fil', name: 'Filipino', flagCode: 'ph' },
  { code: 'haw', name: 'Ōlelo Hawaiʻi', flagCode: 'us' },
  { code: 'mg', name: 'Malagasy', flagCode: 'mg' },
  { code: 'so', name: 'Af-Soomaali', flagCode: 'so' },
  { code: 'yo', name: 'Yorùbá', flagCode: 'ng' },
  { code: 'zu', name: 'isiZulu', flagCode: 'za' },
  { code: 'tl', name: 'Tagalog', flagCode: 'ph' }
];

interface LanguageWheel3DProps {
  value: string;
  onChange: (code: string) => void;
}

export function LanguageWheel3D({ value, onChange }: LanguageWheel3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Находим начальный индекс
  const initialIndex = LANGUAGES.findIndex(lang => lang.code === value);
  const [scrollOffset, setScrollOffset] = useState<number>(initialIndex !== -1 ? initialIndex : 0);
  const [isDragging, setIsDragging] = useState(false);
  
  const startYRef = useRef<number>(0);
  const startOffsetRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const isFirstRender = useRef(true);

  const ITEM_HEIGHT = 44; // условная высота шага скролла в пикселях

  // Синхронизация при внешнем изменении value
  useEffect(() => {
    const idx = LANGUAGES.findIndex(lang => lang.code === value);
    if (idx !== -1 && !isDragging) {
      if (isFirstRender.current) {
        setScrollOffset(idx);
        isFirstRender.current = false;
      } else {
        snapTo(idx);
      }
    }
  }, [value]);

  const handleStart = (clientY: number) => {
    setIsDragging(true);
    startYRef.current = clientY;
    startOffsetRef.current = scrollOffset;
    velocityRef.current = 0;
    lastYRef.current = clientY;
    lastTimeRef.current = performance.now();

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  const handleMove = (clientY: number) => {
    if (!isDragging) return;
    
    const deltaY = clientY - startYRef.current;
    // Конвертируем дельту Y в сдвиг по индексам
    const indexDelta = -deltaY / ITEM_HEIGHT;
    let newOffset = startOffsetRef.current + indexDelta;

    // Ограничиваем скролл с эффектом натяжения на краях (rubber banding)
    if (newOffset < 0) {
      newOffset = newOffset * 0.4;
    } else if (newOffset > LANGUAGES.length - 1) {
      const maxIdx = LANGUAGES.length - 1;
      newOffset = maxIdx + (newOffset - maxIdx) * 0.4;
    }

    // Вычисляем мгновенную скорость
    const now = performance.now();
    const dt = now - lastTimeRef.current;
    if (dt > 0) {
      const dy = clientY - lastYRef.current;
      velocityRef.current = -dy / ITEM_HEIGHT / (dt / 1000); // индексов в секунду
    }

    lastYRef.current = clientY;
    lastTimeRef.current = now;
    setScrollOffset(newOffset);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // Физика затухания инерции (Deceleration)
    let currentVelocity = velocityRef.current;
    let currentOffset = scrollOffset;

    const decay = 0.95; // Коэффициент трения
    
    const animateDecay = () => {
      if (Math.abs(currentVelocity) > 0.1) {
        currentVelocity *= decay;
        currentOffset += currentVelocity * 0.016; // 60 FPS
        
        // Границы
        if (currentOffset < 0) {
          currentOffset = 0;
          currentVelocity = 0;
        } else if (currentOffset > LANGUAGES.length - 1) {
          currentOffset = LANGUAGES.length - 1;
          currentVelocity = 0;
        }

        setScrollOffset(currentOffset);
        animationFrameRef.current = requestAnimationFrame(animateDecay);
      } else {
        // Доводка до ближайшего целого элемента (Snap)
        const targetIndex = Math.round(currentOffset);
        snapTo(targetIndex);
      }
    };

    if (Math.abs(currentVelocity) > 0.5) {
      animationFrameRef.current = requestAnimationFrame(animateDecay);
    } else {
      snapTo(Math.round(currentOffset));
    }
  };

  const snapTo = (targetIndex: number) => {
    const finalIndex = Math.max(0, Math.min(LANGUAGES.length - 1, targetIndex));
    
    let start = scrollOffset;
    const duration = 200; // мс
    const startTime = performance.now();

    const animateSnap = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      
      // Изинг-функция (easeOutCubic)
      const ease = 1 - Math.pow(1 - progress, 3);
      const val = start + (finalIndex - start) * ease;
      
      setScrollOffset(val);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animateSnap);
      } else {
        setScrollOffset(finalIndex);
        onChange(LANGUAGES[finalIndex].code);
        animationFrameRef.current = null;
      }
    };

    animationFrameRef.current = requestAnimationFrame(animateSnap);
  };

  // Прокрутка колесиком
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    
    const direction = e.deltaY > 0 ? 1 : -1;
    const targetIndex = Math.max(0, Math.min(LANGUAGES.length - 1, Math.round(scrollOffset) + direction));
    snapTo(targetIndex);
  };

  // Сенсорные события для мобильных
  const onTouchStart = (e: React.TouchEvent) => {
    handleStart(e.touches[0].clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientY);
  };

  const onTouchEnd = () => {
    handleEnd();
  };

  // События мыши для ПК
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientY);
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      handleMove(moveEvent.clientY);
    };

    const onMouseUp = () => {
      handleEnd();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div 
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative w-full h-[220px] flex items-center justify-center overflow-hidden select-none cursor-grab active:cursor-grabbing"
      style={{ perspective: '1000px' }}
    >
      {/* Стеклянные рамки фокуса в центре барабана */}
      <div className="absolute w-[90%] h-[46px] border-y border-emerald-500/25 bg-emerald-500/[0.02] rounded-lg pointer-events-none z-10" />

      {/* 3D Барабан */}
      <div 
        className="relative w-full h-full flex items-center justify-center"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {LANGUAGES.map((lang, i) => {
          // Отсекаем элементы вне видимой зоны (+- 4.2 шага) для устранения циклического наложения по 360-градусному цилиндру
          if (Math.abs(i - scrollOffset) > 4.2) return null;

          const stepAngle = 25; // Увеличили угол для большего вертикального разделения
          const radius = 145;  // Увеличили радиус цилиндра для четкого распределения по Y и Z
          
          const angle = (i - scrollOffset) * stepAngle;
          const radians = (angle * Math.PI) / 180;
          
          const yOffset = radius * Math.sin(radians);
          const zOffset = radius * Math.cos(radians);
          
          const isFocused = Math.abs(i - scrollOffset) < 0.5;
          // Более выраженный спад масштаба для неактивных элементов
          const scale = isFocused ? 1.1 : Math.max(0.7, 1 - Math.abs(i - scrollOffset) * 0.15);
          // Уменьшили opacity неактивных элементов (0.25 вместо 0.5) для чистоты интерфейса
          const opacity = isFocused ? 1.0 : Math.max(0, Math.cos(radians)) * 0.22;

          return (
            <div
              key={lang.code}
              className={`absolute flex items-center justify-center gap-3 px-4 py-2 transition-colors duration-150 ${
                isFocused 
                  ? 'text-white font-bold text-base md:text-lg' 
                  : 'text-white/30 font-medium text-sm'
              }`}
              style={{
                height: `${ITEM_HEIGHT}px`,
                transform: `translateY(${yOffset}px) translateZ(${zOffset}px) rotateX(${-angle}deg) scale(${scale})`,
                opacity: isFocused ? 1.0 : opacity,
                transformStyle: 'preserve-3d',
                backfaceVisibility: 'hidden',
                willChange: 'transform, opacity',
                // ВАЖНО: Убрали transform из transition для мгновенного и точного позиционирования без отставания координат
                transition: isDragging ? 'none' : 'opacity 0.15s ease-out'
              }}
            >
              <span className={`w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border overflow-hidden shadow-inner transition-colors duration-150 shrink-0 ${
                isFocused ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-white/5'
              }`}>
                <img
                  src={`https://flagcdn.com/w160/${lang.flagCode}.png`}
                  alt={lang.name}
                  className="w-full h-full object-cover"
                  style={{ imageRendering: '-webkit-optimize-contrast' }}
                  loading="lazy"
                />
              </span>
              <span>
                {lang.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
