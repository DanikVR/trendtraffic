/**
 * TrendTraffic — файлы-артефакты анализа тренда («Медиафайлы → Аналитика»).
 *
 * «Добавить в галерею» из «Тренды → Аналитика» складывает в Галерею ПАКЕТ отдельных
 * файлов: видео (качает ingest/analyze-save) + читаемый разбор (.md из TrendDNA) +
 * субтитры (.srt из дословной расшифровки речи Gemini-видеоанализа, язык оригинала).
 *
 * Файлы лежат в uploads/analysis (статика /uploads смонтирована в server.ts), ассеты —
 * kind='reference', mediaType='file', folder='analyzed' — та же папка «Из анализа»,
 * что у видео; вкладка «Медиафайлы» показывает её подфильтром «Аналитика».
 *
 * Best-effort: сбой записи файла/ассета логируется и не роняет основной сценарий
 * (видео к этому моменту уже скачано, ДНК сохранена).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { createAsset, ANALYZED_FOLDER, TEXT_FOLDER, type MediaAsset } from '../media/assets.js';
import type { TrendDNA, TranscriptSegment, SceneBeat } from './dna.js';

const __dirname_local = path.dirname(fileURLToPath(import.meta.url));
// src/modules/trends → apps/uploads/analysis (та же база, что у /uploads static).
const OUTPUT_DIR = path.resolve(__dirname_local, '../../../../uploads/analysis');
try { fs.mkdirSync(OUTPUT_DIR, { recursive: true }); } catch { /* best-effort */ }

// ── Субтитры (.srt) ──────────────────────────────────────────────────────────

/** Секунды → таймкод SRT `ЧЧ:ММ:СС,мс`. */
function srtTime(sec: number): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor(ms / 60_000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
}

/** SRT из дословной расшифровки речи (video_insight.transcript). */
export function buildSrt(segments: TranscriptSegment[]): string {
  return segments
    .map((s, i) => {
      const start = Math.max(0, s.start);
      const end = s.end > start ? s.end : start + 2.5;
      return `${i + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${s.text.trim()}\n`;
    })
    .join('\n');
}

// ── Читаемый разбор (.md) ────────────────────────────────────────────────────

function clock(t: number): string {
  const s = Math.max(0, Math.round(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
const li = (arr?: string[]) => (arr || []).filter(Boolean).map((x) => `- ${x}`).join('\n');
/** Секция «Заголовок + текст/список» — пустые пропускаются. */
function sec(title: string, body?: string): string {
  return body && body.trim() ? `### ${title}\n\n${body.trim()}\n` : '';
}

/** TrendDNA → человекочитаемый Markdown (зеркало панели анализа: Viral Breakdown + Content Analysis). */
export function dnaToMarkdown(dna: TrendDNA, sourceUrl?: string): string {
  const m = dna.meta || {};
  const stats = [
    m.views != null && `просмотры ${m.views}`,
    m.likes != null && `лайки ${m.likes}`,
    m.comments != null && `комментарии ${m.comments}`,
    m.shares != null && `репосты ${m.shares}`,
    m.engagementRate != null && `ER ${m.engagementRate}%`,
  ].filter(Boolean).join(' · ');
  const head = [
    sourceUrl && `- Источник: ${sourceUrl}`,
    m.platform && `- Платформа: ${m.platform}${m.author ? ` · автор: ${m.author}` : ''}`,
    m.durationSec != null && `- Длительность: ${clock(m.durationSec)}`,
    stats && `- Метрики: ${stats}`,
    m.music && `- Музыка: ${m.music}`,
    m.hashtags?.length && `- Хэштеги: ${m.hashtags.join(' ')}`,
  ].filter(Boolean).join('\n');

  const beats = (dna.sceneBeats || [])
    .map((b: SceneBeat) => `- \`${clock(b.t)}\` ${b.desc}${b.intensity ? ` _(${b.intensity})_` : ''}`)
    .join('\n');
  const v = dna.visual;
  const visualExtra = [
    v?.framesAnalyzed ? '- Покадровый видеоанализ: да (сцены — по реальным кадрам)' : '',
    v?.cutsCount != null ? `- Монтажных склеек: ${v.cutsCount}` : '',
    v?.textOverlays?.length ? `- Надписи в кадре: ${v.textOverlays.join(' | ')}` : '',
  ].filter(Boolean).join('\n');

  // Каждый блок заканчивается '\n' → при join('\n') между блоками остаётся пустая
  // строка (валидный Markdown: заголовки/списки/hr не слипаются). Пустые секции — вон.
  const md = [
    `# Анализ тренда — ${m.author || dna.hookType || 'видео'}\n`,
    head ? `${head}\n` : '',
    '## Viral Breakdown\n',
    sec('Hook type', dna.hookType),
    sec('Why it works', dna.whyItWorks),
    sec('Target audience', dna.targetAudience),
    sec('Viral factors', li(dna.viralFactors)),
    sec('Copy-ready script draft', dna.copyReadyScript && `> ${dna.copyReadyScript.replace(/\n/g, '\n> ')}`),
    sec('How to adapt', li(dna.howToAdapt)),
    '## Video Content Analysis\n',
    sec('Summary', dna.summary),
    sec('Scene beats', beats),
    sec('Hook analysis', dna.hookAnalysis),
    sec('Visual style', dna.visualStyle),
    sec('Audio & dialogue', dna.audioDialogue),
    sec('Why it resonates', li(dna.whyResonates)),
    sec('How to replicate', li(dna.howToReplicate)),
    sec('Визуальные детали', visualExtra),
    sec('Ключевые слова', (dna.keywords || []).join(', ')),
    '---\n',
    `_Модель: ${dna.model} · ${dna.generatedAt}_`,
  ].filter((s) => s !== '').join('\n') + '\n';
  return md;
}

// ── Сохранение пакета ────────────────────────────────────────────────────────

export interface AnalysisArtifacts { doc: MediaAsset | null; subtitles: MediaAsset | null }

/** Записать текст в uploads/analysis и зарегистрировать ассетом папки «Из анализа». */
async function saveTextAsset(
  tenantId: string,
  args: { text: string; ext: 'md' | 'srt' | 'txt'; originalName: string; mime: string; folder?: string },
): Promise<MediaAsset | null> {
  const name = `tt-${randomUUID()}.${args.ext}`;
  const filePath = path.join(OUTPUT_DIR, name);
  fs.writeFileSync(filePath, args.text, 'utf8');
  const asset = await createAsset(tenantId, {
    kind: 'reference', mediaType: 'file',
    originalName: args.originalName,
    fileUrl: `/uploads/analysis/${name}`, filePath, mime: args.mime,
    size: Buffer.byteLength(args.text, 'utf8'),
    folder: args.folder || ANALYZED_FOLDER,
  });
  if (!asset) { try { fs.unlinkSync(filePath); } catch { /* noop */ } }
  return asset;
}

/** Прочитать сохранённый текстовый ассет по его fileUrl (`/uploads/analysis/<файл>`).
 *  Путь к папке живёт здесь же, где запись — иначе он разъезжается между модулями. */
export function readTextAssetFile(fileUrl: string): string | null {
  const name = path.basename(String(fileUrl || ''));
  if (!name) return null;
  const filePath = path.join(OUTPUT_DIR, name);
  try { return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null; }
  catch { return null; }
}

/**
 * Текст в раздел Галереи «Текст» (папка TEXT_FOLDER): транскрибация речи ролика и её
 * переводы. Отдельная папка — чтобы тексты не мешались в «Медиафайлах» и их было видно
 * пикеру озвучки. Бросает при сбое записи (вызов идёт по кнопке — юзеру нужен ответ).
 */
export async function saveTranscriptAsset(
  tenantId: string,
  args: { text: string; name: string },
): Promise<MediaAsset | null> {
  return saveTextAsset(tenantId, {
    text: args.text, ext: 'txt', mime: 'text/plain; charset=utf-8',
    originalName: args.name.endsWith('.txt') ? args.name : `${args.name}.txt`,
    folder: TEXT_FOLDER,
  });
}

/**
 * Пакет файлов анализа для «Медиафайлы → Аналитика»: разбор .md всегда,
 * субтитры .srt — если Gemini расслышал речь. Не бросает.
 */
export async function saveAnalysisArtifacts(
  tenantId: string,
  args: { platform: string; videoId: string; dna: TrendDNA; sourceUrl?: string },
): Promise<AnalysisArtifacts> {
  const out: AnalysisArtifacts = { doc: null, subtitles: null };
  const base = `${args.platform}-${args.videoId}`;
  try {
    out.doc = await saveTextAsset(tenantId, {
      text: dnaToMarkdown(args.dna, args.sourceUrl), ext: 'md',
      originalName: `Анализ — ${base}.md`, mime: 'text/markdown',
    });
  } catch (e) {
    console.warn('[trends] файл разбора не сохранился:', (e as Error).message);
  }
  const segments = args.dna.visual?.transcript || [];
  if (segments.length) {
    try {
      out.subtitles = await saveTextAsset(tenantId, {
        text: buildSrt(segments), ext: 'srt',
        originalName: `Субтитры — ${base}.srt`, mime: 'application/x-subrip',
      });
    } catch (e) {
      console.warn('[trends] субтитры не сохранились:', (e as Error).message);
    }
  }
  return out;
}
