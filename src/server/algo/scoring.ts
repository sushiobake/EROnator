import type { WorkWeight, WorkProbability } from './types';

/**
 * Scoring / Probability Model (Spec §4)
 */

/**
 * basePrior計算 (Spec §4.1)
 * basePrior(w) = exp(alpha * popularityTotal(w))
 */
export function calculateBasePrior(
  popularityBase: number,
  popularityPlayBonus: number,
  alpha: number
): number {
  const popularityTotal = popularityBase + popularityPlayBonus;
  return Math.exp(alpha * popularityTotal);
}

/**
 * 重みを正規化して確率に変換 (Spec §4.1)
 * P(w) = W(w) / sum(W)
 */
export function normalizeWeights(weights: WorkWeight[]): WorkProbability[] {
  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
  
  if (totalWeight === 0) {
    // ゼロ除算回避: 均等分布
    return weights.map(w => ({
      workId: w.workId,
      probability: 1 / weights.length,
    }));
  }
  
  return weights.map(w => ({
    workId: w.workId,
    probability: w.weight / totalWeight,
  }));
}

/**
 * Confidence計算 (Spec §4.2)
 * confidence = P(top1)
 */
export function calculateConfidence(probabilities: WorkProbability[]): number {
  if (probabilities.length === 0) {
    return 0;
  }
  
  // P desc順にソート（同点時はworkId ascで決定論的）
  const sorted = [...probabilities].sort((a, b) => {
    if (a.probability !== b.probability) {
      return b.probability - a.probability;
    }
    return a.workId.localeCompare(b.workId);
  });
  
  return sorted[0].probability;
}

/**
 * Effective candidates計算 (Spec §4.3)
 * effectiveCandidates = 1 / sum(P(w)^2)
 */
export function calculateEffectiveCandidates(
  probabilities: WorkProbability[]
): number {
  if (probabilities.length === 0) {
    return 0;
  }
  
  const sumSquared = probabilities.reduce(
    (sum, p) => sum + p.probability * p.probability,
    0
  );
  
  if (sumSquared === 0) {
    return 0;
  }
  
  return 1 / sumSquared;
}

/**
 * Effective confirm threshold計算 (Spec §4.3, Config flow.effectiveConfirmThresholdFormula)
 * Formula A: min(max, max(min, round(totalWorks / divisor)))
 */
export function calculateEffectiveConfirmThreshold(
  totalWorks: number,
  min: number,
  max: number,
  divisor: number
): number {
  return Math.min(max, Math.max(min, Math.round(totalWorks / divisor)));
}
