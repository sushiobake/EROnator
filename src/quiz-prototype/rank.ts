/**
 * 正解数から爵位（日本語）を返す
 */

export function calcRank(correct: number): string {
  if (correct === 10) return '王';
  if (correct === 9) return '公爵';
  if (correct >= 7) return '侯爵';
  if (correct >= 5) return '伯爵';
  if (correct >= 3) return '男爵';
  if (correct >= 1) return '騎士見習い';
  return '民';
}
