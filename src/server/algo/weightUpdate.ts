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
    case 'UNKNOWN': {
      // 微弱NO: workHasFeature ? 0.1 : 0.9（OFFICIALタグ含む全タグ質問で適用）
      const v = workHasFeature ? 0.1 : 0.9;
      return Math.max(low, Math.min(high, v));
    }
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

/** Math.exp のオーバーフロー防止。引数を ±700 にクリップ（exp(709)≒MAX_VALUE） */
const EXP_CLAMP = 700;

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
    const arg = Math.max(-EXP_CLAMP, Math.min(EXP_CLAMP, hasFeature ? beta * answerStrength : -beta * answerStrength));
    const mult = Math.exp(arg);
    
    return {
      workId: w.workId,
      weight: w.weight * mult,
    };
  });
}

/**
 * 有名度（POPULARITY）用: シグモイドでソフト尤度を計算
 * P(YES|work) = sigmoid(k * (popularity - threshold))
 * 回答に応じて尤度を返す（0/1 の代わりに連続値）
 */
function getLikelihoodSoft(
  pYes: number,
  answerChoice: string,
  epsilon: number
): number {
  const p = Math.max(epsilon, Math.min(1 - epsilon, pYes));
  const ep = Math.max(0.01, Math.min(0.2, epsilon));
  switch (answerChoice) {
    case 'YES':
      return Math.max(ep, Math.min(1 - ep, p));
    case 'NO':
      return Math.max(ep, Math.min(1 - ep, 1 - p));
    case 'PROBABLY_YES':
      return Math.max(ep, Math.min(1 - ep, 0.7 * p + 0.3 * (1 - p)));
    case 'PROBABLY_NO':
      return Math.max(ep, Math.min(1 - ep, 0.3 * p + 0.7 * (1 - p)));
    case 'UNKNOWN':
      return Math.max(ep, Math.min(1 - ep, 0.1 * p + 0.9 * (1 - p)));
    case 'DONT_CARE':
    default:
      return 1;
  }
}

/** シグモイド: 1 / (1 + exp(-x)) */
function sigmoid(x: number): number {
  const clamped = Math.max(-EXP_CLAMP, Math.min(EXP_CLAMP, x));
  return 1 / (1 + Math.exp(-clamped));
}

/**
 * 有名度（POPULARITY）特別質問: シグモイドソフト関数で重み更新
 * workPopularity: workId -> popularity 値
 */
export function updateWeightsForPopularitySoft(
  weights: WorkWeight[],
  workPopularity: (workId: string) => number,
  threshold: number,
  answerChoice: string,
  /** シグモイドの傾き。大きいほど閾値付近で急峻 */
  k: number = 0.15,
  epsilon: number = 0.02
): WorkWeight[] {
  return weights.map(w => {
    const pop = workPopularity(w.workId);
    const pYes = sigmoid(k * (pop - threshold));
    const likelihood = getLikelihoodSoft(pYes, answerChoice, epsilon);
    return {
      workId: w.workId,
      weight: w.weight * likelihood,
    };
  });
}

/**
 * REVEAL miss時のペナルティ適用 (Spec §7.2)
 * W(top1) *= revealPenalty
 * 同一シリーズの作品にも軽めのペナルティを適用（双子問題対策）
 */
export function applyRevealPenalty(
  weights: WorkWeight[],
  topWorkId: string,
  penalty: number,
  sameSeriesWorkIds?: string[]
): WorkWeight[] {
  const seriesSet = sameSeriesWorkIds ? new Set(sameSeriesWorkIds) : new Set<string>();
  const SERIES_PENALTY = Math.sqrt(penalty);
  return weights.map(w => {
    if (w.workId === topWorkId) {
      return { workId: w.workId, weight: w.weight * penalty };
    }
    if (seriesSet.has(w.workId)) {
      return { workId: w.workId, weight: w.weight * SERIES_PENALTY };
    }
    return w;
  });
}
