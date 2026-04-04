import type { EarlyExitStepSnapshot } from '@/types/earlyExitStepSnapshot';

const DEFAULT_EARLY_EXIT_REVIEW = {
  enabled: true,
  reviewIndices: [25, 30, 35, 40],
  requiredConditions: 2,
  thresholds: {
    q25: { minConfidence: 0.2, maxEffectiveCandidates: 45, maxConfidenceDelta5: 0.04 },
    q30: { minConfidence: 0.16, maxEffectiveCandidates: 60, maxConfidenceDelta5: 0.035 },
    q35: { minConfidence: 0.13, maxEffectiveCandidates: 80, maxConfidenceDelta5: 0.03 },
    q40: { minConfidence: 0.1, maxEffectiveCandidates: 100, maxConfidenceDelta5: 0.025 },
  },
} as const;

export type EarlyExitQ = 'q25' | 'q30' | 'q35' | 'q40';

export type MergedEarlyExitReview = {
  enabled: boolean;
  reviewIndices: number[];
  requiredConditions: number;
  thresholds: Record<
    EarlyExitQ,
    { minConfidence: number; maxEffectiveCandidates: number; maxConfidenceDelta5: number }
  >;
};

export function mergeEarlyExitReview(raw: unknown): MergedEarlyExitReview {
  const r = raw as {
    enabled?: boolean;
    reviewIndices?: number[];
    requiredConditions?: number;
    thresholds?: Partial<Record<EarlyExitQ, { minConfidence?: number; maxEffectiveCandidates?: number; maxConfidenceDelta5?: number }>>;
  } | null | undefined;
  const t0 = DEFAULT_EARLY_EXIT_REVIEW.thresholds;
  return {
    enabled: r?.enabled !== false,
    reviewIndices:
      Array.isArray(r?.reviewIndices) && r.reviewIndices.length > 0
        ? r.reviewIndices
        : [...DEFAULT_EARLY_EXIT_REVIEW.reviewIndices],
    requiredConditions:
      typeof r?.requiredConditions === 'number' ? r.requiredConditions : DEFAULT_EARLY_EXIT_REVIEW.requiredConditions,
    thresholds: {
      q25: { ...t0.q25, ...r?.thresholds?.q25 },
      q30: { ...t0.q30, ...r?.thresholds?.q30 },
      q35: { ...t0.q35, ...r?.thresholds?.q35 },
      q40: { ...t0.q40, ...r?.thresholds?.q40 },
    },
  };
}

/** 回答後の質問数に対し、「直近で有効な」審査閾値（その回以前で最大の reviewIndex）。未到達区間では null。 */
export function getApplicableEarlyExitThreshold(
  merged: MergedEarlyExitReview,
  questionCountAfterAnswer: number
): { minConfidence: number; maxEffectiveCandidates: number; maxConfidenceDelta5: number; atQ: number } | null {
  if (!merged.enabled) return null;
  const sorted = [...merged.reviewIndices].sort((a, b) => a - b);
  let at: number | null = null;
  for (const r of sorted) {
    if (r <= questionCountAfterAnswer) at = r;
    else break;
  }
  if (at == null) return null;
  const key = `q${at}` as EarlyExitQ;
  const t = merged.thresholds[key];
  if (!t) return null;
  return { ...t, atQ: at };
}

/**
 * シミュ表の行色用: 常に閾値を返す。
 * 未到達でも最初の reviewIndex に対応する q の線で比較し、どの行で基準を満たし始めたか追えるようにする。
 * （到達済みの最大 reviewIndex に対応する q を使い、まだ1つも到達していなければ最初の q）
 */
export function getEarlyExitThresholdForSimRowColor(
  merged: MergedEarlyExitReview,
  questionCountAfterAnswer: number
): { minConfidence: number; maxEffectiveCandidates: number; maxConfidenceDelta5: number; benchmarkQ: number } | null {
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
 * シミュ表用: 行ごとに閾値で常時比較し「安全側」なら真（列を緑表示）。
 * 閾値は getEarlyExitThresholdForSimRowColor（25問未満でも最初の q 線を使用）。
 * ① 確度(回答後) ≥ 下限 ② 候補数 ≤ 上限 ③ 偏り指標が有限かつ閾値より大きい（5問未満は未計算のため緑にしない）
 */
export function computeSimEarlyExitColumnOk(
  step: SimStepLike,
  ex: EarlyExitStepSnapshot | undefined,
  flow: { earlyExitReview?: unknown } | undefined
): { conf: boolean; cand: boolean; delta: boolean } {
  if (step.question.kind === 'REVEAL' || !ex) {
    return { conf: false, cand: false, delta: false };
  }
  const merged = mergeEarlyExitReview(flow?.earlyExitReview);
  const thr = getEarlyExitThresholdForSimRowColor(merged, ex.questionCountAfterAnswer);
  if (!thr) {
    return { conf: false, cand: false, delta: false };
  }

  const confOk = ex.confidence >= thr.minConfidence;
  const candOk = ex.effectiveCandidates <= thr.maxEffectiveCandidates;
  const deltaOk = Number.isFinite(ex.confidenceDelta5) && ex.confidenceDelta5 > thr.maxConfidenceDelta5;

  return {
    conf: confOk,
    cand: candOk,
    delta: deltaOk,
  };
}

export function buildSimEarlyExitColumnOkList(
  steps: SimStepLike[],
  flow: { earlyExitReview?: unknown } | undefined
): Array<{ conf: boolean; cand: boolean; delta: boolean }> {
  return steps.map((step) => computeSimEarlyExitColumnOk(step, step.earlyExit, flow));
}
