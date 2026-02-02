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
 */
export function passesCoverageGate(
  tagWorkCount: number,
  totalWorks: number,
  mode: CoverageMode,
  minCoverageRatio: number | null,
  minCoverageWorks: number | null
): boolean {
  if (mode === 'RATIO') {
    if (minCoverageRatio === null) {
      return false;
    }
    const coverage = calculateCoverage(tagWorkCount, totalWorks);
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
  
  const coverage = calculateCoverage(tagWorkCount, totalWorks);
  return coverage >= minRatio;
}
