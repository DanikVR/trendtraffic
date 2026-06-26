/**
 * Диспетчер парсеров файлов knowledge base / прикреплений Quest Flow.
 *
 * Принимает Buffer + MIME type + filename, выбирает подходящий парсер,
 * возвращает plain text. Если формат неизвестен — fallback на TXT.
 *
 * Поддерживаем: TXT, DOCX, XLSX, XLS, CSV.
 * Для .doc (старый бинарный Word) и .pdf — пока не поддерживаем; вернём ошибку.
 */

import { parseTxt } from './txt.js';
import { parseDocx } from './docx.js';
import { parseXlsx } from './xlsx.js';

export interface ParseResult {
  text: string;
  /** Расшифрованный тип источника для логов/диагностики */
  format: 'txt' | 'docx' | 'xlsx' | 'csv' | 'unknown';
}

export class UnsupportedFileFormatError extends Error {
  constructor(mime: string, filename: string) {
    super(`Формат файла не поддерживается: ${filename} (${mime || 'без MIME'}). Допустимы: .txt, .docx, .xlsx, .csv.`);
    this.name = 'UnsupportedFileFormatError';
  }
}

function pickFormat(mime: string, filename: string): ParseResult['format'] {
  const lc = filename.toLowerCase();
  const m = (mime || '').toLowerCase();

  if (lc.endsWith('.docx') || m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return 'docx';
  }
  if (lc.endsWith('.xlsx') || m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return 'xlsx';
  }
  if (lc.endsWith('.xls') || m === 'application/vnd.ms-excel') {
    return 'xlsx'; // SheetJS читает старый xls тоже
  }
  if (lc.endsWith('.csv') || m === 'text/csv') {
    return 'csv';
  }
  if (lc.endsWith('.txt') || m.startsWith('text/')) {
    return 'txt';
  }
  return 'unknown';
}

export async function parseFile(
  buffer: Buffer,
  mime: string,
  filename: string
): Promise<ParseResult> {
  const format = pickFormat(mime, filename);

  switch (format) {
    case 'docx':
      return { text: await parseDocx(buffer), format };
    case 'xlsx':
      return { text: await parseXlsx(buffer), format };
    case 'csv':
    case 'txt':
      return { text: await parseTxt(buffer), format };
    case 'unknown':
    default:
      throw new UnsupportedFileFormatError(mime, filename);
  }
}
