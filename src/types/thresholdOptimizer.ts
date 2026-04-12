/**
 * 閾値最適化シミュレーション（DESIGN-threshold-optimizer-v1.md）
 */

/** スイープ対象のパラメータ1セット */
export interface ParamSet {
  id: string;
  label: string;
  confidenceConfirmBandLower: number;
  confidenceConfirmBandUpper: number;
  hardConfidenceMin: number;
  hardConfirmInjectionRatio: number;
  reviewIndices: number[];
  earlyExitThresholds: {
    [key: string]: {
      minConfidence: number;
      maxEffectiveCandidates: number;
    };
  };
  /** 省略時はベース config の flow.maxQuestions */
  maxQuestions?: number;
  /** 省略時はベース config の confirm.softConfidenceMin */
  softConfidenceMin?: number;
  /**
   * true のとき topNForIG / topNForIGPhases のみ適用し、Confirm・早期失敗はディスクの mvpConfig のまま。
   * 閾値最適化の ParamSet とは別系統のスイープ用。
   */
  applyTopNOnly?: boolean;
  /** EXPLORE_TAG の IG に使う上位 N 作品（algo.topNForIG） */
  topNForIG?: number;
  /** 質問番号フェーズ別 topN（algo.topNForIGPhases） */
  topNForIGPhases?: Array<{ untilQuestionIndex: number; topN: number }>;
}

/** Sweep 全体のリクエスト */
export interface SweepRequest {
  phase: 1 | 2;
  sampleSize: number;
  ambiguityLevels: number[];
  aiGateChoice: string;
  trialsPerWork: number;
  parallelCount: number;
  paramSetIds?: string[] | null;
  expandedSampleSize?: number;
  /** Phase 1 完了後に Phase 2 を自動実行 */
  autoPhase2?: boolean;
  autoPhase2SampleSize?: number;
  /** Phase 1 終了時に上位 N 件を Phase 2 に渡す（既定 5） */
  autoPhase2TopN?: number;
  /** 1ボタンで Phase1→2→3（100→200→500）まで実行 */
  fullAutoPipeline?: boolean;
  /** true のとき早期失敗v2用グリッド（Confirm=ps_034 固定・閾値のみ9通り） */
  useV2ParamSets?: boolean;
  /** true のとき V3 包括グリッド（45通り＋Phase2/3で解決） */
  useV3ParamSets?: boolean;
  /** true のとき topNForIG 専用スイープ（有名度3帯×曖昧さ1中心）。他の useV* は無視 */
  useTopNForIGSweep?: boolean;
  /** topN スイープ時: 各帯（有名30+ / 中間10〜30未満 / 無名10未満）から何作品サンプルするか。既定 200 */
  topNForIGSamplePerTier?: number;
  phase1SampleSize?: number;
  phase2SampleSize?: number;
  phase3SampleSize?: number;
}

export interface ParamSetLevelResult {
  paramSetId: string;
  ambiguityLevel: number;
  totalTrials: number;
  successCount: number;
  successRate: number;
  avgQuestionsOnSuccess: number;
  avgQuestionsAll: number;
  softConfirmTotal: number;
  hardConfirmTotal: number;
  softHardRatio: number;
  hardBurstRate: number;
  earlyExitCount: number;
  earlyExitFalsePositiveCount: number;
  missedEarlyExitCount: number;
  rhythmScore: number;
  endedByBreakdown: Record<string, number>;
}

export interface ScoreCard {
  paramSetId: string;
  paramSet: ParamSet;
  levelResults: ParamSetLevelResult[];
  weightedSuccessRate: number;
  weightedAvgQuestions: number;
  weightedSoftHardRatio: number;
  weightedHardBurstRate: number;
  weightedFalsePositiveRate: number;
  weightedMissedEarlyExitRate: number;
  weightedRhythmScore: number;
  totalScore: number;
  rank: number;
}

export interface SweepResult {
  sweepId: string;
  phase: 1 | 2;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  sampleSize: number;
  ambiguityLevels: number[];
  trialsPerWork: number;
  totalSimulations: number;
  paramSetCount: number;
  scoreCards: ScoreCard[];
  baselineScoreCard: ScoreCard;
  recommendedForPhase2?: string[];
}

export interface SweepProgress {
  sweepId: string;
  phase: 1 | 2;
  pipelineStep?: 'phase1' | 'phase2' | 'phase3' | 'done';
  status: 'running' | 'completed' | 'error';
  paramSetsDone: number;
  paramSetsTotal: number;
  simulationsDone: number;
  simulationsTotal: number;
  currentParamSetId: string | null;
  elapsedSeconds: number;
  estimatedRemainingSeconds: number | null;
  errorMessage?: string;
  resultPath?: string;
}

/** fullAutoPipeline 時の合成結果 */
export interface PipelineResult {
  pipelineId: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  phase1: SweepResult;
  phase2?: SweepResult;
  /** Phase2 上位1件を 500 本で再検証した結果（スキップ時は undefined） */
  phase3?: SweepResult;
  winnerParamSetId: string | null;
  winnerScore: number | null;
}
