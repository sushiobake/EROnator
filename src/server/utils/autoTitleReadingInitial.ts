/**
 * Auto-fill titleReadingInitial for admin batch (no titleReadingInitialConfirmed change).
 * Pipeline:
 * 1) Kana start -> mechanical (high)
 * 2) Sudachi (mode C) on normalized title (after stripping leading 【】 etc.)
 * 3) Optional sub: first 【...】 inner text analyzed separately -> "メイン,サブ"
 * 4) Confidence: worst of main/sub; low -> DB not written by auto route
 */

import type { PrismaClient } from '@prisma/client';
import {
  extractLeadingBracketInner,
  getNormalizedTitleForInitialReading,
  getTitleCharType,
  getTitleReadingInitialFromTitle,
} from '@/server/utils/titleCharType';
import {
  tokenizeSudachiModeC,
  type SudachiToken,
} from '@/server/utils/sudachiTokenizerSingleton';

export type AutoTitleReadingInitialMethod =
  | 'mechanical'
  | 'sudachi'
  | 'unchanged';

export type AutoConfidence = 'high' | 'medium' | 'low' | 'skipped';

export type AutoTitleReadingInitialRow = {
  workId: string;
  titleReadingInitial: string | null;
  method: AutoTitleReadingInitialMethod;
  confidence: AutoConfidence;
  suggestion?: string | null;
};

/** Main title: allow 2+ chars after normalize (was 5; short compounds use Sudachi dict). */
const MIN_NORMALIZED_LENGTH = 2;
const MIN_SUB_INNER_LENGTH = 2;

const KATAKANA_ONE = /^[\u30a1-\u30f6\u30fc]$/;

const KANJI_RE = /^[\u4e00-\u9faf\u3400-\u4dbf]$/;

function isValidStoredInitial(s: string): boolean {
  const parts = s
    .trim()
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length < 1 || parts.length > 2) return false;
  return parts.every((p) => p.length === 1 && KATAKANA_ONE.test(p));
}

const KANA_RE = /^[\u30a1-\u30f6\u30fc\u3041-\u3096]+$/;

function toKatakanaChunk(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp >= 0x3041 && cp <= 0x3096) {
      out += String.fromCodePoint(cp + 0x60);
    } else if (cp >= 0x30a1 && cp <= 0x30f6 || ch === 'ー' || cp === 0x30fc) {
      out += ch === 'ー' || cp === 0x30fc ? 'ー' : String.fromCodePoint(cp);
    } else {
      return null;
    }
  }
  return out.length ? out : null;
}

function firstKatakanaMora(katakana: string): string | null {
  if (!katakana) return null;
  const cp = katakana.codePointAt(0);
  if (cp == null) return null;
  const ch = String.fromCodePoint(cp);
  if (!KATAKANA_ONE.test(ch)) return null;
  return ch;
}

function readingKanaFromToken(t: SudachiToken): string | null {
  const d = (t.dictionary_form ?? '').trim();
  if (d && KANA_RE.test(d)) {
    return toKatakanaChunk(d);
  }
  const r = (t.reading_form ?? '').trim();
  if (r && KANA_RE.test(r)) {
    return toKatakanaChunk(r);
  }
  return null;
}

function isSkippableSurfaceToken(t: SudachiToken): boolean {
  const coarse = t.poses[0] ?? '';
  if (coarse === '空白' || coarse === '補助記号') return true;
  const surf = t.surface ?? '';
  if (!surf.trim()) return true;
  return false;
}

function isVerbToken(t: SudachiToken): boolean {
  return (t.poses[0] ?? '') === '動詞';
}

function needsHumanLowReview(t: SudachiToken): boolean {
  const p = t.poses;
  if ((p[1] ?? '') === '固有名詞') return true;
  if ((p[3] ?? '') === '姓' || (p[3] ?? '') === '名') return true;
  if ((p[0] ?? '') === '名詞') {
    const mid = p[2] ?? '';
    if (mid === '人名' || mid === '地名' || mid === '組織名') return true;
  }
  return false;
}

function isKanjiOnlySurface(t: SudachiToken): boolean {
  const s = t.surface ?? '';
  if (!s) return false;
  return [...s].every((ch) => KANJI_RE.test(ch));
}

function confidenceFromToken(t: SudachiToken, katakanaReading: string): 'high' | 'medium' | 'low' {
  if (needsHumanLowReview(t)) {
    return 'low';
  }
  if (isVerbToken(t)) {
    return 'medium';
  }
  const surfLen = [...(t.surface ?? '')].length;
  const readLen = [...katakanaReading].length;
  const coarse = t.poses[0] ?? '';
  const fine1 = t.poses[1] ?? '';
  if (
    coarse === '名詞' &&
    fine1 === '普通名詞' &&
    isKanjiOnlySurface(t) &&
    surfLen >= 2
  ) {
    return 'medium';
  }
  if (surfLen >= 2 || readLen >= 2) {
    return 'high';
  }
  return 'medium';
}

/** Lower ordinal = stricter (human review). */
function confidenceRank(c: AutoConfidence): number {
  if (c === 'low') return 0;
  if (c === 'medium') return 1;
  if (c === 'high') return 2;
  return 3;
}

function mergeConfidence(a: AutoConfidence, b: AutoConfidence): AutoConfidence {
  return confidenceRank(a) <= confidenceRank(b) ? a : b;
}

async function analyzeSudachiHeadOnNorm(
  norm: string,
  minLen: number
): Promise<{ initial: string | null; confidence: AutoConfidence }> {
  if (norm.length < minLen) {
    return { initial: null, confidence: 'skipped' };
  }
  let tokens: SudachiToken[];
  try {
    tokens = await tokenizeSudachiModeC(norm);
  } catch {
    return { initial: null, confidence: 'skipped' };
  }

  for (const t of tokens) {
    if (isSkippableSurfaceToken(t)) continue;
    const kana = readingKanaFromToken(t);
    if (!kana) continue;
    const initial = firstKatakanaMora(kana);
    if (!initial || !isValidStoredInitial(initial)) {
      continue;
    }
    const conf = confidenceFromToken(t, kana);
    return { initial, confidence: conf };
  }
  return { initial: null, confidence: 'skipped' };
}

/**
 * Compute titleReadingInitial for workIds (no DB writes).
 */
export async function computeAutoTitleReadingInitials(
  prisma: PrismaClient,
  workIds: string[]
): Promise<AutoTitleReadingInitialRow[]> {
  const uniqueIds = [...new Set(workIds)].filter(Boolean);
  if (uniqueIds.length === 0) return [];

  const works = await prisma.work.findMany({
    where: { workId: { in: uniqueIds } },
    select: { workId: true, title: true },
  });

  const byId = new Map(works.map((w) => [w.workId, w]));

  const out: AutoTitleReadingInitialRow[] = [];
  for (const workId of uniqueIds) {
    const w = byId.get(workId);
    if (!w) {
      out.push({
        workId,
        titleReadingInitial: null,
        method: 'unchanged',
        confidence: 'skipped',
      });
      continue;
    }
    const title = w.title ?? '';
    if (getTitleCharType(title) !== 'KANJI') {
      out.push({
        workId,
        titleReadingInitial: null,
        method: 'unchanged',
        confidence: 'skipped',
      });
      continue;
    }

    const mechanical = getTitleReadingInitialFromTitle(title);
    if (mechanical) {
      out.push({
        workId,
        titleReadingInitial: mechanical,
        method: 'mechanical',
        confidence: 'high',
      });
      continue;
    }

    const norm = getNormalizedTitleForInitialReading(title);
    if (norm.length < MIN_NORMALIZED_LENGTH) {
      out.push({
        workId,
        titleReadingInitial: null,
        method: 'unchanged',
        confidence: 'skipped',
      });
      continue;
    }

    const main = await analyzeSudachiHeadOnNorm(norm, MIN_NORMALIZED_LENGTH);
    if (!main.initial) {
      out.push({
        workId,
        titleReadingInitial: null,
        method: 'unchanged',
        confidence: 'skipped',
      });
      continue;
    }

    let mergedInitial = main.initial;
    let mergedConf: AutoConfidence = main.confidence;

    const innerRaw = extractLeadingBracketInner(title);
    if (innerRaw) {
      const innerNorm = getNormalizedTitleForInitialReading(innerRaw);
      if (innerNorm.length >= MIN_SUB_INNER_LENGTH) {
        const sub = await analyzeSudachiHeadOnNorm(innerNorm, MIN_SUB_INNER_LENGTH);
        if (sub.initial && isValidStoredInitial(`${mergedInitial},${sub.initial}`)) {
          mergedInitial = `${mergedInitial},${sub.initial}`;
          mergedConf = mergeConfidence(mergedConf, sub.confidence);
        }
      }
    }

    if (mergedConf === 'low') {
      out.push({
        workId,
        titleReadingInitial: null,
        method: 'sudachi',
        confidence: 'low',
        suggestion: mergedInitial,
      });
      continue;
    }

    out.push({
      workId,
      titleReadingInitial: mergedInitial,
      method: 'sudachi',
      confidence: mergedConf,
    });
  }

  return out;
}
