/**
 * 早期失敗審査の1手スナップショット（本番 engine とシミュ・管理画面で共有）
 */
export interface EarlyExitStepSnapshot {
  questionCountAfterAnswer: number;
  confidence: number;
  effectiveCandidates: number;
  confidenceDelta5: number;
  isReviewPoint: boolean;
  reviewKey: string | null;
  thresholds: {
    minConfidence: number;
    maxEffectiveCandidates: number;
    maxConfidenceDelta5: number;
  } | null;
  requiredConditions: number | null;
  matchLowConfidence: boolean;
  matchWideCandidates: boolean;
  matchFlatDelta5: boolean;
  matchedCount: number;
  wouldEarlyExit: boolean;
}
