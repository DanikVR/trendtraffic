/**
 * XLSX/XLS/CSV-парсер через SheetJS (xlsx).
 *
 * Стратегия: каждая страница → CSV-блок с пометкой "## Sheet: <name>".
 * Это сохраняет структуру таблиц в plain-text формате, который Gemini хорошо
 * понимает в systemInstruction (видит столбцы как разделённые запятыми).
 *
 * Не пытаемся сериализовать формулы — берём вычисленные значения (workbook.SheetNames).
 */

import * as XLSX from 'xlsx';

export async function parseXlsx(buffer: Buffer): Promise<string> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv && csv.trim()) {
      parts.push(`## Sheet: ${sheetName}\n${csv.trim()}`);
    }
  }

  return parts.join('\n\n').trim();
}
