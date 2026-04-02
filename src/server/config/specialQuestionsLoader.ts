/**
 * 特別質問の文言・パラメータを config/specialQuestions.json から読み込む
 * 対応形式: フラット構造 or specialQuestions ラッパー
 * TITLE_SYLLABLE: { ranges: [...] } or 配列直接
 */

import fs from 'fs';
import path from 'path';

export interface SyllableRange {
  id: string;
  label: string;
  questionText: string;
  chars: string[];
}

export interface SyllableBranch {
  label: string;
  questionText: string;
  chars: string[];
}

export interface SpecialQuestionsConfig {
  SERIES?: { questionText?: string };
  TITLE_CHAR_TYPE?: { KANJI?: string; HIRAGANA_OR_KATAKANA?: string };
  POPULARITY?: { questionText?: string; popularityThreshold?: number };
  TITLE_SYLLABLE?:
    | { ranges?: SyllableRange[] }
    | SyllableRange[];
  TITLE_SYLLABLE_2?: {
    branches?: Record<
      string,
      { yesBranch?: SyllableBranch; noBranch?: SyllableBranch }
    >;
  };
  AUTHOR_CHAR_TYPE?: {
    HIRAGANA_OR_KATAKANA?: string;
    KANJI_OR_ALPHA?: string;
  };
  /** タイトル長（なろう系っぽさ）。YES=長めに重み */
  TITLE_LENGTH_STYLE?: {
    questionText?: string;
    yesMinLength?: number;
    noMaxLength?: number;
  };
}

let cache: SpecialQuestionsConfig | null = null;
let cacheTime = 0;
const CACHE_TTL = 5000;

/** 保存後にキャッシュを無効化（API から呼ぶ） */
export function invalidateSpecialQuestionsCache(): void {
  cache = null;
}

/** 生JSONを正規化（specialQuestions ラッパー対応・TITLE_SYLLABLE 配列対応） */
function normalizeConfig(raw: Record<string, unknown>): SpecialQuestionsConfig {
  const base = (raw.specialQuestions as Record<string, unknown>) ?? raw;
  const tsl = base.TITLE_SYLLABLE;
  const ranges: SyllableRange[] = Array.isArray(tsl)
    ? tsl
    : (tsl && typeof tsl === 'object' && Array.isArray((tsl as { ranges?: SyllableRange[] }).ranges))
      ? (tsl as { ranges: SyllableRange[] }).ranges
      : [];
  return {
    SERIES: base.SERIES as SpecialQuestionsConfig['SERIES'],
    TITLE_CHAR_TYPE: base.TITLE_CHAR_TYPE as SpecialQuestionsConfig['TITLE_CHAR_TYPE'],
    POPULARITY: base.POPULARITY as SpecialQuestionsConfig['POPULARITY'],
    TITLE_SYLLABLE: { ranges },
    TITLE_SYLLABLE_2: base.TITLE_SYLLABLE_2 as SpecialQuestionsConfig['TITLE_SYLLABLE_2'],
    AUTHOR_CHAR_TYPE: base.AUTHOR_CHAR_TYPE as SpecialQuestionsConfig['AUTHOR_CHAR_TYPE'],
    TITLE_LENGTH_STYLE: base.TITLE_LENGTH_STYLE as SpecialQuestionsConfig['TITLE_LENGTH_STYLE'],
  };
}

/** サーバー側で使用。特別質問の全設定を返す */
export function loadSpecialQuestionsConfig(): SpecialQuestionsConfig {
  return loadSpecialQuestions();
}

function loadSpecialQuestions(): SpecialQuestionsConfig {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL) {
    return cache;
  }
  try {
    const filePath = path.join(process.cwd(), 'config', 'specialQuestions.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    const raw = JSON.parse(content) as Record<string, unknown>;
    cache = normalizeConfig(raw);
    cacheTime = now;
    return cache ?? {};
  } catch {
    cache = {};
    cacheTime = now;
    return {};
  }
}

/** SERIES の質問文。未設定時はデフォルト */
export function getSeriesQuestionText(): string {
  return loadSpecialQuestions().SERIES?.questionText ?? 'その作品は、シリーズものや総集編？';
}

/** TITLE_CHAR_TYPE の質問文。未設定時はデフォルトを使用 */
export function getTitleCharTypeQuestionText(
  charType: 'KANJI' | 'HIRAGANA_OR_KATAKANA'
): string {
  const text = loadSpecialQuestions().TITLE_CHAR_TYPE?.[charType];
  if (text) return text;
  const defaults: Record<string, string> = {
    KANJI: 'タイトルは【漢字】で始まる？',
    HIRAGANA_OR_KATAKANA: 'タイトルは【ひらがな or カタカナ】で始まる？',
  };
  return defaults[charType] ?? '';
}

/** POPULARITY の質問文と閾値 */
export function getPopularityConfig(): { questionText: string; popularityThreshold: number } {
  const c = loadSpecialQuestions().POPULARITY;
  return {
    questionText: c?.questionText ?? 'その作品は、かなり有名？',
    popularityThreshold: c?.popularityThreshold ?? 40,
  };
}

/** TITLE_SYLLABLE の範囲一覧。未設定時は空配列 */
export function getTitleSyllableRanges(): SyllableRange[] {
  const tsl = loadSpecialQuestions().TITLE_SYLLABLE;
  if (Array.isArray(tsl)) return tsl;
  return tsl?.ranges ?? [];
}

/** TITLE_SYLLABLE_2 の branches。未設定時は空オブジェクト */
export function getTitleSyllable2Branches(): Record<
  string,
  { yesBranch?: SyllableBranch; noBranch?: SyllableBranch }
> {
  return loadSpecialQuestions().TITLE_SYLLABLE_2?.branches ?? {};
}

/** AUTHOR_CHAR_TYPE の質問文。2択（TITLE_CHAR_TYPE同様にランダムで1つ選ぶ）。未設定時はデフォルト */
export function getAuthorCharTypeQuestionText(
  charType: 'HIRAGANA_OR_KATAKANA' | 'KANJI_OR_ALPHA'
): string {
  const text = loadSpecialQuestions().AUTHOR_CHAR_TYPE?.[charType];
  if (text) return text;
  const defaults: Record<string, string> = {
    HIRAGANA_OR_KATAKANA: '作者名は【ひらがな or カタカナ】で始まる？',
    KANJI_OR_ALPHA: '作者名は【漢字 or アルファベット】で始まる？',
  };
  return defaults[charType] ?? '';
}
