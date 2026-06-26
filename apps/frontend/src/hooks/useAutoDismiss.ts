/**
 * useAutoDismiss — состояние, которое само сбрасывается в `resetValue` через `ms`.
 *
 * Зачем: по коду россыпью встречается анти-паттерн
 *   setSuccess(msg);
 *   setTimeout(() => setSuccess(null), 4000);   // таймер не сохраняется и не чистится
 * При размонтировании компонента таймер срабатывает уже после unmount (в React 18
 * безвреден, но это «грязь»), а при повторном set'е старые таймеры наслаиваются.
 *
 * Этот хук хранит таймер в ref и:
 *  - чистит предыдущий таймер при каждом новом значении (не-reset);
 *  - чистит таймер при размонтировании;
 *  - сбрасывает значение к `resetValue` через `ms` мс.
 *
 * Использование:
 *   const [success, setSuccess] = useAutoDismiss<string | null>(null, 4000);
 *   ...
 *   setSuccess('Готово');   // через 4с само станет null, без ручного setTimeout
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export function useAutoDismiss<T>(
  resetValue: T,
  ms = 4000,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(resetValue);
  const timerRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const set = useCallback((next: T) => {
    clear();
    setValue(next);
    // Авто-сброс ставим только если значение «активно» (не равно resetValue).
    if (next !== resetValue) {
      timerRef.current = window.setTimeout(() => {
        setValue(resetValue);
        timerRef.current = null;
      }, ms);
    }
  }, [clear, ms, resetValue]);

  // Чистим таймер при размонтировании.
  useEffect(() => clear, [clear]);

  return [value, set];
}
