/**
 * タグ一致に基づく表示用「似てる度」（50〜100、小数1桁）
 * 基準作品のタグと候補作品のタグの重なり度合いで算出
 */

export function computeTagBasedMatchRate(
  baseTagKeys: string[],
  candidateTagKeys: string[]
): number {
  if (baseTagKeys.length === 0) return 50;
  const baseSet = new Set(baseTagKeys);
  let intersection = 0;
  for (const k of candidateTagKeys) {
    if (baseSet.has(k)) intersection++;
  }
  const ratio = intersection / baseTagKeys.length;
  return parseFloat((50 + 50 * ratio).toFixed(1));
}
