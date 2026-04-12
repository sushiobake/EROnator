import type { EarlyExitStepSnapshot } from '@/types/earlyExitStepSnapshot';

const DEFAULT_EARLY_EXIT_REVIEW = {
  enabled: true,
  reviewIndices: [25, 30, 35, 40],
  requiredConditions: 2,
  thresholds: {
    q25: { minConfidence: 0.08, maxEffectiveCandidates: 80 },
    q30: { minConfidence: 0.1, maxEffectiveCandidates: 50 },
    q35: { minConfidence: 0.12, maxEffectiveCandidates: 30 },
    q40: { minConfidence: 0.1, maxEffectiveCandidates: 40 },
  },
} as const;

export type EarlyExitQ = 'q25' | 'q30' | 'q35' | 'q40';

export type MergedEarlyExitReview = {
  enabled: boolean;
  reviewIndices: number[];
  requiredConditions: number;
  thresholds: Record<EarlyExitQ, { minConfidence: number; maxEffectiveCandidates: number }>;
};

export function mergeEarlyExitReview(raw: unknown): MergedEarlyExitReview {
  const r = raw as {
    enabled?: boolean;
    reviewIndices?: number[];
    requiredConditions?: number;
    thresholds?: Partial<
      Record<EarlyExitQ, { minConfidence?: number; maxEffectiveCandidates?: number; maxConfidenceDelta5?: number }>
    >;
  } | null | undefined;
  const t0 = DEFAULT_EARLY_EXIT_REVIEW.thresholds;
  const pick = (q: EarlyExitQ) => {
    const o = r?.thresholds?.[q];
    return {
      minConfidence: typeof o?.minConfidence === 'number' ? o.minConfidence : t0[q].minConfidence,
      maxEffectiveCandidates:
        typeof o?.maxEffectiveCandidates === 'number' ? o.maxEffectiveCandidates : t0[q].maxEffectiveCandidates,
    };
  };
  return {
    enabled: r?.enabled !== false,
    reviewIndices:
      Array.isArray(r?.reviewIndices) && r.reviewIndices.length > 0
        ? r.reviewIndices
        : [...DEFAULT_EARLY_EXIT_REVIEW.reviewIndices],
    requiredConditions:
      typeof r?.requiredConditions === 'number' ? r.requiredConditions : DEFAULT_EARLY_EXIT_REVIEW.requiredConditions,
    thresholds: {
      q25: pick('q25'),
      q30: pick('q30'),
      q35: pick('q35'),
      q40: pick('q40'),
    },
  };
}

/**
 * シミュ表の行色用: 常に閾値を返す。
 * 未到達でも最初の reviewIndex に対応する q の線で比較し、どの行で基準を満たし始めたか追えるようにする。
 */
export function getEarlyExitThresholdForSimRowColor(
  merged: MergedEarlyExitReview,
  questionCountAfterAnswer: number
): { minConfidence: number; maxEffectiveCandidates: number; benchmarkQ: number } | null {
  if (!merged.enabled) return null;
  const sorted = [...merged.reviewIndices].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  let benchmark = sorted[0];
  for (const r of sorted) {
    if (r <= questionCountAfterAnswer) benchmark = r;
  }
  const key = `q${benchmark}` as EarlyExitQ;
  const t = merged.thresholds[key];
  if (!t) return null;
  return { ...t, benchmarkQ: benchmark };
}

type SimStepLike = {
  question: { kind: string };
  confidenceBefore: number;
  confidenceAfter: number;
  earlyExit?: EarlyExitStepSnapshot;
};

/**
 * シミュ表用: 行ごとに閾値で常時比較し「早期失敗の条件に該当しない側」なら真（列を緑）。
 * ① 確度(回答後) ≥ minConfidence ② 実質候補 > maxEffectiveCandidates（狭すぎ閾値より大きい）
 */
export function computeSimEarlyExitColumnOk(
  step: SimStepLike,
  ex: EarlyExitStepSnapshot | undefined,
  flow: { earlyExitReview?: unknown } | undefined
): { conf: boolean; cand: boolean } {
  if (step.question.kind === 'REVEAL' || !ex) {
    return { conf: false, cand: false };
  }
  const merged = mergeEarlyExitReview(flow?.earlyExitReview);
  const thr = getEarlyExitThresholdForSimRowColor(merged, ex.questionCountAfterAnswer);
  if (!thr) {
    return { conf: false, cand: false };
  }

  const confOk = ex.confidence >= thr.minConfidence;
  const candOk = ex.effectiveCandidates > thr.maxEffectiveCandidates;

  return {
    conf: confOk,
    cand: candOk,
  };
}

export function buildSimEarlyExitColumnOkList(
  steps: SimStepLike[],
  flow: { earlyExitReview?: unknown } | undefined
): Array<{ conf: boolean; cand: boolean }> {
  return steps.map((step) => computeSimEarlyExitColumnOk(step, step.earlyExit, flow));
}
