/**
 * Coverage gate (Spec §12.2)
 */

export type CoverageMode = 'RATIO' | 'WORKS' | 'AUTO';

/**
 * Coverage計算
 * coverage(tag) = tagWorkCount / totalWorks
 */
export function calculateCoverage(
  tagWorkCount: number,
  totalWorks: number
): number {
  if (totalWorks === 0) {
    return 0;
  }
  return tagWorkCount / totalWorks;
}

/**
 * Coverage gate判定 (Spec §12.2)
 * - 下限: minCoverageRatio以上（タグを持つ作品が少なすぎるタグを除外）
 * - 上限: maxCoverageRatio以下（全員が持っているタグを除外）
 */
export function passesCoverageGate(
  tagWorkCount: number,
  totalWorks: number,
  mode: CoverageMode,
  minCoverageRatio: number | null,
  minCoverageWorks: number | null,
  maxCoverageRatio: number | null = null // 上限（デフォルトはチェックなし）
): boolean {
  const coverage = calculateCoverage(tagWorkCount, totalWorks);
  
  // 上限チェック（全モード共通）
  // maxCoverageRatioが設定されている場合、それを超えるタグは除外
  if (maxCoverageRatio !== null && coverage > maxCoverageRatio) {
    return false;
  }
  
  if (mode === 'RATIO') {
    if (minCoverageRatio === null) {
      return false;
    }
    return coverage >= minCoverageRatio;
  }
  
  if (mode === 'WORKS') {
    if (minCoverageWorks === null) {
      return false;
    }
    return tagWorkCount >= minCoverageWorks;
  }
  
  // AUTO mode (Spec §12.2)
  if (minCoverageRatio === null || minCoverageWorks === null) {
    return false;
  }
  
  // Clamp minCoverageWorks by totalWorks to avoid ratios > 1
  const clampedMinWorks = Math.min(minCoverageWorks, totalWorks);
  const minRatio = Math.max(
    minCoverageRatio,
    clampedMinWorks / Math.max(totalWorks, 1) // Avoid division-by-zero
  );
  
  return coverage >= minRatio;
}
