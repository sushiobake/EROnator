/**
 * 配信者モード用: 部分的伏字ユーティリティ
 * - 奇数位置を〇に置換（数字はスキップ）
 * - エロワードリストはコンフィグ化前にハードコード
 */

/** 奇数位置（1,3,5…）を〇に。数字はそのまま */
export function partialCensor(text: string, skipNumbers = true): string {
  return [...text]
    .map((char, i) => {
      if (skipNumbers && /[0-9]/.test(char)) return char;
      return i % 2 === 1 ? '〇' : char;
    })
    .join('');
}

/** エロワード（エロ質問タグの displayName 相当）。コンフィグ化予定 */
export const DEFAULT_EROTIC_WORDS = [
  'おっぱい', 'おっぱ', '巨乳', '貧乳', '爆乳', '中出し', '口内射精', 'フェラ', 'パイズリ',
  'アナル', 'あなる', '潮吹き', '絶頂', 'オナニー', '手コキ', '足コキ', '母乳', 'ふたなり',
  '触手', '調教', '緊縛', '陵辱', '痴漢', '露出', '寝取られ', '催眠',
  'ランジェリー', '水着', 'メイド', 'ナース', 'バニー',
];

/** 長い順にソート（「口内射精」を「射精」より先にマッチ） */
function sortByLengthDesc(words: string[]): string[] {
  return [...words].sort((a, b) => b.length - a.length);
}

/**
 * テキスト内のエロワードを検出して部分置換した文字列を返す。
 * マッチした単語は partialCensor で置換。
 */
export function streamerCensorWords(text: string, eroticWords = DEFAULT_EROTIC_WORDS): string {
  const sorted = sortByLengthDesc(eroticWords);
  let result = text;
  for (const word of sorted) {
    if (!word) continue;
    const censored = partialCensor(word);
    result = result.split(word).join(censored);
  }
  return result;
}
