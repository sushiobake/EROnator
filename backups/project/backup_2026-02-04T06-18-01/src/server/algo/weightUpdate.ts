import type { WorkWeight, AnswerStrength } from './types';

/**
 * Weight Update (Spec §5)
 */

/**
 * DERIVEDタグの二値化判定 (Spec §5.1)
 * hasFeature(w) = derivedConfidence >= derivedConfidenceThreshold
 */
export function hasDerivedFeature(
  derivedConfidence: number | null | undefined,
  threshold: number
): boolean {
  if (derivedConfidence === null || derivedConfidence === undefined) {
    return false;
  }
  return derivedConfidence >= threshold;
}

/**
 * Tag-based質問の重み更新 (Spec §5.1)
 * - feature present: mult = exp(+beta * s)
 * - feature absent: mult = exp(-beta * s)
 * - W(w) *= mult
 */
export function updateWeightsForTagQuestion(
  weights: WorkWeight[],
  workHasFeature: (workId: string) => boolean,
  answerStrength: AnswerStrength,
  beta: number
): WorkWeight[] {
  return weights.map(w => {
    const hasFeature = workHasFeature(w.workId);
    const mult = hasFeature
      ? Math.exp(beta * answerStrength)
      : Math.exp(-beta * answerStrength);
    
    return {
      workId: w.workId,
      weight: w.weight * mult,
    };
  });
}

/**
 * REVEAL miss時のペナルティ適用 (Spec §7.2)
 * W(top1) *= revealPenalty
 */
export function applyRevealPenalty(
  weights: WorkWeight[],
  topWorkId: string,
  penalty: number
): WorkWeight[] {
  return weights.map(w => {
    if (w.workId === topWorkId) {
      return {
        workId: w.workId,
        weight: w.weight * penalty,
      };
    }
    return w;
  });
}
