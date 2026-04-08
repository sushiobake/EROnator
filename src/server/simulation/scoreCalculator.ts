/**
 * 閾値最適化: メトリクス集計・総合スコア（DESIGN-threshold-optimizer-v1.md §7）
 */
import type { SimulationResult, SimulationStep } from '@/server/simulation/simulationRunner';
import type {
  ParamSet,
  ParamSetLevelResult,
  ScoreCard,
} from '@/types/thresholdOptimizer';

export type TaggedSimResult = SimulationResult & {
  ambiguityLevel: number;
  trialIndex: number;
};

const AMBIGUITY_WEIGHTS: Record<number, number> = {
  1: 0.2,
  3: 0.4,
  5: 0.4,
};

function weightForAmbiguity(level: number): number {
  return AMBIGUITY_WEIGHTS[level] ?? 1 / 3;
}

function normalize(val: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (val - min) / (max - min)));
}

export function calcHardBurstRate(steps: SimulationStep[]): number {
  const kinds = steps.map((s) => s.question.kind);
  if (kinds.length <= 4) return 0;
  let burstSteps = 0;
  for (let i = 4; i < kinds.length; i++) {
    const window = kinds.slice(i - 4, i + 1);
    const hardCount = window.filter((k) => k === 'HARD_CONFIRM').length;
    if (hardCount >= 3) burstSteps++;
  }
  return burstSteps / (kinds.length - 4);
}

function calcHardBurstRateForSlice(steps: SimulationStep[]): number {
  return calcHardBurstRate(steps);
}

export function calcRhythmScore(steps: SimulationStep[]): number {
  if (steps.length < 6) return 0.5;

  const quizSteps = steps.filter((s) => s.question.kind !== 'REVEAL');
  if (quizSteps.length === 0) return 0.5;

  const third = Math.ceil(quizSteps.length / 3);
  const early = quizSteps.slice(0, third);
  const mid = quizSteps.slice(third, third * 2);
  const late = quizSteps.slice(third * 2);

  const earlyExploreRatio =
    early.filter((s) => s.question.kind === 'EXPLORE_TAG').length / Math.max(1, early.length);

  const midSoftRatio =
    mid.filter((s) => s.question.kind === 'SOFT_CONFIRM').length / Math.max(1, mid.length);

  const lateHardBurst = calcHardBurstRateForSlice(late);

  const revealIdx = steps.findIndex((s) => s.question.kind === 'REVEAL');
  const preReveal = revealIdx > 0 ? steps[revealIdx - 1] : null;
  const preRevealBonus =
    preReveal &&
    (preReveal.question.kind === 'HARD_CONFIRM' || preReveal.question.kind === 'SOFT_CONFIRM')
      ? 1.0
      : 0.0;

  return Math.min(
    1,
    Math.max(
      0,
      0.3 * midSoftRatio +
        0.3 * (1 - lateHardBurst) +
        0.2 * earlyExploreRatio +
        0.2 * preRevealBonus
    )
  );
}

function aggregateStepsMetrics(results: TaggedSimResult[]): {
  softTotal: number;
  hardTotal: number;
  hardBurstSum: number;
  rhythmSum: number;
  rhythmCount: number;
} {
  let softTotal = 0;
  let hardTotal = 0;
  let hardBurstSum = 0;
  let rhythmSum = 0;
  let rhythmCount = 0;

  for (const r of results) {
    const steps = (r.steps ?? []) as SimulationStep[];
    for (const s of steps) {
      if (s.question.kind === 'SOFT_CONFIRM') softTotal++;
      if (s.question.kind === 'HARD_CONFIRM') hardTotal++;
    }
    if (steps.length > 0) {
      hardBurstSum += calcHardBurstRate(steps);
      rhythmSum += calcRhythmScore(steps);
      rhythmCount++;
    }
  }

  return { softTotal, hardTotal, hardBurstSum, rhythmSum, rhythmCount };
}

export function buildParamSetLevelResult(args: {
  paramSetId: string;
  ambiguityLevel: number;
  results: TaggedSimResult[];
  baselineStats: Map<string, { successCount: number; totalTrials: number }>;
}): ParamSetLevelResult {
  const { paramSetId, ambiguityLevel, results, baselineStats } = args;
  const totalTrials = results.length;
  const successCount = results.filter((r) => r.success).length;
  const successRate = totalTrials > 0 ? successCount / totalTrials : 0;

  const successes = results.filter((r) => r.success);
  const avgQuestionsOnSuccess =
    successes.length > 0
      ? successes.reduce((s, r) => s + r.questionCount, 0) / successes.length
      : Infinity;

  const avgQuestionsAll =
    totalTrials > 0 ? results.reduce((s, r) => s + r.questionCount, 0) / totalTrials : 0;

  const { softTotal, hardTotal, hardBurstSum, rhythmSum, rhythmCount } =
    aggregateStepsMetrics(results);

  const softDen = Math.max(1, softTotal + hardTotal);
  const softHardRatio = softTotal / softDen;
  const hardBurstRate = results.length > 0 ? hardBurstSum / results.length : 0;
  const rhythmScore = rhythmCount > 0 ? rhythmSum / rhythmCount : 0.5;

  let earlyExitCount = 0;
  let earlyExitFalsePositiveCount = 0;
  let missedEarlyExitCount = 0;

  const endedByBreakdown: Record<string, number> = {};

  for (const r of results) {
    endedByBreakdown[r.outcome] = (endedByBreakdown[r.outcome] ?? 0) + 1;

    const endedEarly =
      r.outcome === 'FAIL_LIST' && r.diagnostic?.endedBy === 'EARLY_FAIL_REVIEW';
    if (endedEarly) {
      earlyExitCount++;
      const key = `${r.targetWorkId}_${ambiguityLevel}`;
      const base = baselineStats.get(key);
      if (base && base.totalTrials > 0) {
        const br = base.successCount / base.totalTrials;
        if (br >= 0.5) earlyExitFalsePositiveCount++;
      }
    }

    if (
      !endedEarly &&
      (r.outcome === 'FAIL_LIST' || r.outcome === 'MAX_QUESTIONS')
    ) {
      missedEarlyExitCount++;
    }
  }

  return {
    paramSetId,
    ambiguityLevel,
    totalTrials,
    successCount,
    successRate,
    avgQuestionsOnSuccess: Number.isFinite(avgQuestionsOnSuccess) ? avgQuestionsOnSuccess : 40,
    avgQuestionsAll,
    softConfirmTotal: softTotal,
    hardConfirmTotal: hardTotal,
    softHardRatio,
    hardBurstRate,
    earlyExitCount,
    earlyExitFalsePositiveCount,
    missedEarlyExitCount,
    rhythmScore,
    endedByBreakdown,
  };
}

export function buildScoreCard(args: {
  paramSet: ParamSet;
  levelResults: ParamSetLevelResult[];
}): ScoreCard {
  const { paramSet, levelResults } = args;
  let wSuccess = 0;
  let wAvgQ = 0;
  let wSoftHard = 0;
  let wHardBurst = 0;
  let wFp = 0;
  let wMiss = 0;
  let wRhythm = 0;
  let wSum = 0;

  for (const lr of levelResults) {
    const w = weightForAmbiguity(lr.ambiguityLevel);
    wSum += w;
    wSuccess += lr.successRate * w;
    wAvgQ += lr.avgQuestionsAll * w;
    wSoftHard += lr.softHardRatio * w;
    wHardBurst += lr.hardBurstRate * w;
    const fpRate = lr.totalTrials > 0 ? lr.earlyExitFalsePositiveCount / lr.totalTrials : 0;
    const missRate = lr.totalTrials > 0 ? lr.missedEarlyExitCount / lr.totalTrials : 0;
    wFp += fpRate * w;
    wMiss += missRate * w;
    wRhythm += lr.rhythmScore * w;
  }

  if (wSum <= 0) wSum = 1;

  const weightedSuccessRate = wSuccess / wSum;
  const weightedAvgQuestions = wAvgQ / wSum;
  const weightedSoftHardRatio = wSoftHard / wSum;
  const weightedHardBurstRate = wHardBurst / wSum;
  const weightedFalsePositiveRate = wFp / wSum;
  const weightedMissedEarlyExitRate = wMiss / wSum;
  const weightedRhythmScore = wRhythm / wSum;

  const totalScore =
    0.3 * weightedSuccessRate +
    0.15 * (1 - normalize(weightedAvgQuestions, 10, 40)) +
    0.1 * weightedSoftHardRatio +
    0.1 * (1 - weightedHardBurstRate) +
    0.15 * (1 - weightedFalsePositiveRate) +
    0.1 * (1 - weightedMissedEarlyExitRate) +
    0.1 * weightedRhythmScore;

  return {
    paramSetId: paramSet.id,
    paramSet,
    levelResults,
    weightedSuccessRate,
    weightedAvgQuestions,
    weightedSoftHardRatio,
    weightedHardBurstRate,
    weightedFalsePositiveRate,
    weightedMissedEarlyExitRate,
    weightedRhythmScore,
    totalScore,
    rank: 0,
  };
}

export function rankScoreCards(cards: ScoreCard[]): ScoreCard[] {
  const sorted = [...cards].sort((a, b) => b.totalScore - a.totalScore);
  return sorted.map((c, i) => ({ ...c, rank: i + 1 }));
}
