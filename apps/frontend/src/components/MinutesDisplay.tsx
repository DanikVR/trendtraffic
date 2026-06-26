/**
 * MinutesDisplay — рендер числа минут с локализованной единицей.
 *
 * Использует Intl.NumberFormat({ style: 'unit', unit: 'minute' }) — данные
 * берутся из встроенного в браузер CLDR и КОРРЕКТНЫ для всех 108 языков
 * без обращения к Google Translate. Сравните: «мин» → ja/ko Google → «мини»/
 * «最小» (мусор), а Intl → «分»/«분» (правильно).
 *
 * formatToParts() разбивает результат на integer/literal/unit, что позволяет
 * стилизовать число и единицу по-разному (большое число + маленькая единица),
 * сохраняя порядок слов локали (важно для RTL).
 *
 * Примеры (count = 16666):
 *   en:    "16,666 min"
 *   ru:    "16 666 мин."
 *   ja:    "16,666分"
 *   ko:    "16,666분"
 *   ar:    "١٦٬٦٦٦ د"   (с цифровым форматированием локали)
 *   he:    "16,666 דק׳"
 *   zh:    "16,666分钟"
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  /** Количество минут (целое). */
  count: number;
  /** Стиль для числовой части (integer + literal). */
  numberStyle?: React.CSSProperties;
  numberClassName?: string;
  /** Стиль для единицы (unit-part). */
  unitStyle?: React.CSSProperties;
  unitClassName?: string;
  /** unitDisplay: 'short' = «мин» / «min», 'long' = «минут» / «minutes», 'narrow' = «м» / «m». */
  unitDisplay?: 'short' | 'long' | 'narrow';
}

export function MinutesDisplay({
  count,
  numberStyle, numberClassName,
  unitStyle, unitClassName,
  unitDisplay = 'short',
}: Props) {
  const { i18n } = useTranslation();
  const parts = useMemo(() => {
    try {
      const fmt = new Intl.NumberFormat(i18n.language || 'en', {
        style: 'unit',
        unit: 'minute',
        unitDisplay,
        maximumFractionDigits: 0,
      });
      return fmt.formatToParts(count);
    } catch {
      // Браузер слишком старый / язык не распознан — fallback на «N min».
      return [
        { type: 'integer', value: String(count) },
        { type: 'literal', value: ' ' },
        { type: 'unit',    value: 'min' },
      ] as Intl.NumberFormatPart[];
    }
  }, [i18n.language, count, unitDisplay]);

  return (
    <>
      {parts.map((p, idx) => {
        const isUnit = p.type === 'unit';
        return (
          <span
            key={idx}
            style={isUnit ? unitStyle : numberStyle}
            className={isUnit ? unitClassName : numberClassName}
          >
            {p.value}
          </span>
        );
      })}
    </>
  );
}
