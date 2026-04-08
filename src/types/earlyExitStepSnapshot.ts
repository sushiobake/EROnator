/**
 * 早期失敗審査の1手スナップショット（本番 engine とシミュ・管理画面で共有）
 */
export interface EarlyExitStepSnapshot {
  questionCountAfterAnswer: number;
  confidence: number;
  effectiveCandidates: number;
  isReviewPoint: boolean;
  reviewKey: string | null;
  thresholds: {
    minConfidence: number;
    maxEffectiveCandidates: number;
  } | null;
  requiredConditions: number | null;
  matchLowConfidence: boolean;
  /** 実質候補が閾値超（広すぎ＝絞れていない）で②マッチ */
  matchWideCandidates: boolean;
  matchedCount: number;
  wouldEarlyExit: boolean;
}
