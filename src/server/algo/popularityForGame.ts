/**
 * ゲーム／シミュで使う popularityBase の正規化。
 * DB の null / undefined / 0 は「未設定に近い」扱いで 1 とみなす（先験・有名度まわりのブレ防止）。
 */
export function normalizePopularityBaseForGame(
  value: number | null | undefined
): number {
  if (value == null || value === 0) return 1;
  return value;
}
