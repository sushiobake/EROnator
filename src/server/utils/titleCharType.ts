/**
 * タイトル先頭文字の文字種判定（Special Question Type 5 用）
 * normalizeTitleForInitial と同様の括弧・記号除去後に、先頭1文字を分類
 */

export type TitleCharType = 'KANJI' | 'KATAKANA' | 'HIRAGANA' | 'OTHER';

/** 括弧パターン（normalizeTitle と同様） */
const BRACKET_PATTERNS = [
  /^【[^】]*】/,
  /^\([^)]*\)/,
  /^\[[^\]]*\]/,
  /^\{[^}]*\}/,
  /^＜[^＞]*＞/,
  /^<[^>]*>/,
  /^「[^」]*」/,
  /^『[^』]*』/,
  /^（[^）]*）/,
  /^［[^］]*］/,
  /^｛[^｝]*｝/,
];

/** 記号パターン */
const SYMBOL_PATTERNS = [
  /^[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/,
  /^[！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～]/,
  /^[★☆◆◇■□・…〜ー—–]/,
];

/**
 * 括弧・先頭記号を除いたあとのタイトル文字列（頭文字プレフィックス用）
 */
export function getNormalizedTitleForInitialReading(title: string): string {
  if (title == null || typeof title !== 'string') return '';
  let normalized = title.normalize('NFKC');
  for (let i = 0; i < 3; i++) {
    let changed = false;
    for (const pattern of BRACKET_PATTERNS) {
      if (pattern.test(normalized)) {
        normalized = normalized.replace(pattern, '');
        changed = true;
        break;
      }
    }
    if (!changed) break;
    normalized = normalized.replace(/^[\s\u3000\t]+/, '');
  }
  for (let i = 0; i < 10; i++) {
    let changed = false;
    for (const pattern of SYMBOL_PATTERNS) {
      if (pattern.test(normalized)) {
        normalized = normalized.replace(pattern, '');
        changed = true;
        break;
      }
    }
    if (!changed) break;
    normalized = normalized.replace(/^[\s\u3000\t]+/, '');
  }
  return normalized.trim();
}

/**
 * Same bracket kinds as BRACKET_PATTERNS (same order): first leading pair yields inner for sub-reading.
 */
const LEADING_BRACKET_INNER_PATTERNS = [
  /^【([^】]*)】/,
  /^\(([^)]*)\)/,
  /^\[([^\]]*)\]/,
  /^\{([^}]*)\}/,
  /^＜([^＞]*)＞/,
  /^<([^>]*)>/,
  /^「([^」]*)」/,
  /^『([^』]*)』/,
  /^（([^）]*)）/,
  /^［([^］]*)］/,
  /^｛([^｝]*)｝/,
];

/**
 * Leading bracket wrapper (【】, 『』, 「」, (), etc.) — inner text for sub titleReadingInitial.
 * Main title still uses getNormalizedTitleForInitialReading (strips these first).
 */
export function extractLeadingBracketInner(rawTitle: string): string | null {
  if (rawTitle == null || typeof rawTitle !== 'string') return null;
  const normalized = rawTitle.normalize('NFKC').trim();
  for (const re of LEADING_BRACKET_INNER_PATTERNS) {
    const m = normalized.match(re);
    if (!m) continue;
    const inner = (m[1] ?? '').trim();
    if (inner.length > 0) return inner;
  }
  return null;
}

/**
 * タイトルから先頭の有効な1文字を取得（括弧・記号除去後）
 */
function getFirstMeaningfulChar(title: string): string {
  const trimmed = getNormalizedTitleForInitialReading(title);
  if (!trimmed.length) return '';
  return trimmed[0] ?? '';
}

/**
 * 文字の文字種を判定
 */
export function getTitleCharType(title: string): TitleCharType {
  const c = getFirstMeaningfulChar(title);
  if (!c) return 'OTHER';
  if (/[\u4e00-\u9faf\u3400-\u4dbf]/.test(c)) return 'KANJI';
  if (/[ァ-ヶー]/.test(c)) return 'KATAKANA';
  if (/[ぁ-んー]/.test(c)) return 'HIRAGANA';
  return 'OTHER';
}

/** 文字種ごとの質問文 */
export const TITLE_CHAR_TYPE_DISPLAY: Record<Exclude<TitleCharType, 'OTHER'>, string> = {
  KANJI: 'その作品のタイトルは、漢字で始まりますか？',
  KATAKANA: 'その作品のタイトルは、カタカナで始まりますか？',
  HIRAGANA: 'その作品のタイトルは、ひらがなで始まりますか？',
};

/** ひらがな1文字をカタカナに変換（濁点・半濁点含む） */
function hiraganaToKatakana(c: string): string {
  const code = c.codePointAt(0) ?? 0;
  // ぁ-ん (U+3041-U+3096): +0x60 → ァ-ン
  if (code >= 0x3041 && code <= 0x3096) {
    return String.fromCodePoint(code + 0x60);
  }
  // ー はそのまま
  if (c === 'ー' || code === 0x30fc) return 'ー';
  return c;
}

/**
 * タイトルから読みの先頭1文字（カタカナ）を取得。
 * ひらがな/カタカナ始まりの場合のみ機械的に算出可能。漢字・英字は null。
 */
export function getTitleReadingInitialFromTitle(title: string): string | null {
  const c = getFirstMeaningfulChar(title);
  if (!c) return null;
  if (/[ァ-ヶー]/.test(c)) return c; // カタカナはそのまま
  if (/[ぁ-んー]/.test(c)) return hiraganaToKatakana(c); // ひらがな→カタカナ
  return null; // 漢字・英字・記号はAIに任せる
}
