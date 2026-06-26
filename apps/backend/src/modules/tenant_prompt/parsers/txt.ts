/**
 * TXT-парсер: просто декодирует UTF-8 буфер в строку.
 *
 * Используется для .txt и any text/* файлов. Если файл бинарный — вернётся
 * испорченная строка с replacement chars, но это не валит сервер.
 */

export async function parseTxt(buffer: Buffer): Promise<string> {
  return buffer.toString('utf-8');
}
