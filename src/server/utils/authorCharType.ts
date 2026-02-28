/**
 * 作者名先頭文字の文字種判定（Special Question AUTHOR_CHAR_TYPE 用）
 * ひらがな/カタカナ vs 漢字/アルファベット の2択
 */

export type AuthorCharType = 'HIRAGANA' | 'KATAKANA' | 'KANJI' | 'ALPHA' | 'OTHER';

/** 先頭の有効文字を取得（空白・記号スキップ） */
function getFirstMeaningfulChar(name: string): string {
  if (name == null || typeof name !== 'string') return '';
  const trimmed = name.trim();
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i] ?? '';
    if (/[\s\u3000\t]/.test(c)) continue;
    if (/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(c)) continue;
    return c;
  }
  return '';
}

/**
 * 作者名の先頭文字の文字種を判定
 */
export function getAuthorCharType(authorName: string): AuthorCharType {
  const c = getFirstMeaningfulChar(authorName);
  if (!c) return 'OTHER';
  if (/[ぁ-んー]/.test(c)) return 'HIRAGANA';
  if (/[ァ-ヶー]/.test(c)) return 'KATAKANA';
  if (/[\u4e00-\u9faf\u3400-\u4dbf]/.test(c)) return 'KANJI';
  if (/[a-zA-Z]/.test(c)) return 'ALPHA';
  return 'OTHER';
}
