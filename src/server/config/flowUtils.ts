/**
 * フロー関連の動的ロジック（P1改善）
 * - REVEAL閾値の質問数による動的調整
 * - maxQuestions の confidence による動的延長
 */

/** ベースの revealThreshold（config から取得） */
type BaseThreshold = number;

/**
 * 質問数に応じた REVEAL 閾値を返す。
 * Q1-15: 0.7, Q16-20: 0.6, Q21-25: 0.5, Q26-30: 0.4
 */
export function getRevealThresholdForQuestion(
  questionCount: number,
  baseThreshold: BaseThreshold
): number {
  const q = questionCount + 1; // 1-based（次の質問が何問目か）
  if (q <= 15) return Math.max(baseThreshold, 0.7);
  if (q <= 20) return 0.6;
  if (q <= 25) return 0.5;
  return 0.4;
}

/** 動的延長時の最大質問数（confidence >= 0.3 のとき） */
const EXTENDED_MAX_QUESTIONS = 35;

/** confidence がこの値以上なら maxQuestions を 35 まで延長 */
const EXTEND_THRESHOLD = 0.3;

/**
 * 有効な最大質問数を返す。
 * confidence >= 0.3 のとき 35 問まで延長、それ以外は config.flow.maxQuestions。
 */
export function getEffectiveMaxQuestions(
  baseMaxQuestions: number,
  confidence: number
): number {
  return confidence >= EXTEND_THRESHOLD ? EXTENDED_MAX_QUESTIONS : baseMaxQuestions;
}
