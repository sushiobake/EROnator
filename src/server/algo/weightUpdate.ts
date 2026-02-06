import type { WorkWeight } from './types';

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

/** ベイズ更新: 回答 a が観測されたときの尤度 P(a|w,q)。epsilon で 0 を避ける。 */
function getLikelihood(
  workHasFeature: boolean,
  answerChoice: string,
  epsilon: number
): number {
  const ep = Math.max(0, Math.min(0.5, epsilon));
  const high = 1 - ep;
  const low = ep;
  switch (answerChoice) {
    case 'YES':
      return workHasFeature ? high : low;
    case 'NO':
      return workHasFeature ? low : high;
    case 'PROBABLY_YES': {
      const v = workHasFeature ? 0.7 : 0.3;
      return Math.max(low, Math.min(high, v));
    }
    case 'PROBABLY_NO': {
      const v = workHasFeature ? 0.3 : 0.7;
      return Math.max(low, Math.min(high, v));
    }
    case 'UNKNOWN':
    case 'DONT_CARE':
    default:
      return 1;
  }
}

/**
 * ベイズ更新: W(w) *= P(observed|w,q)。正規化は呼び出し側の normalizeWeights に任せる。
 */
export function updateWeightsForTagQuestionBayesian(
  weights: WorkWeight[],
  workHasFeature: (workId: string) => boolean,
  answerChoice: string,
  epsilon: number = 0.02
): WorkWeight[] {
  return weights.map(w => ({
    workId: w.workId,
    weight: w.weight * getLikelihood(workHasFeature(w.workId), answerChoice, epsilon),
  }));
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
  /** 回答強度（正でYES方向・負でNO方向）。コンフィグで1より大きくできる */
  answerStrength: number,
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
