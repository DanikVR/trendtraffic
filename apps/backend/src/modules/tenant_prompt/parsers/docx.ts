/**
 * DOCX-парсер через mammoth.
 *
 * mammoth.extractRawText() выдаёт plain text без форматирования — это именно то,
 * что нужно для подмешивания в Gemini systemInstruction (форматирование съест токены).
 *
 * Для .doc (старый формат) НЕ работает — Mammoth поддерживает только OOXML.
 */

import mammoth from 'mammoth';

export async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return (result?.value || '').trim();
}
