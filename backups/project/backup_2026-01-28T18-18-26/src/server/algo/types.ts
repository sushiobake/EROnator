/**
 * アルゴリズム用の型定義
 */

export type WorkId = string;
export type TagKey = string;

export interface WorkWeight {
  workId: WorkId;
  weight: number;
}

export interface WorkProbability {
  workId: WorkId;
  probability: number;
}

export type AnswerStrength = -1.0 | -0.6 | 0 | 0.6 | 1.0;

/**
 * 6択回答のマッピング（Spec §3.2）
 */
export const ANSWER_STRENGTH_MAP: Record<string, AnswerStrength> = {
  YES: 1.0,
  PROBABLY_YES: 0.6,
  UNKNOWN: 0,
  PROBABLY_NO: -0.6,
  NO: -1.0,
  DONT_CARE: 0,
} as const;

/**
 * AI_GATE選択
 */
export type AiGateChoice = 'YES' | 'NO' | 'DONT_CARE';

/**
 * 質問種別
 */
export type QuestionKind = 'EXPLORE_TAG' | 'SOFT_CONFIRM' | 'HARD_CONFIRM';

/**
 * HardConfirm種別
 */
export type HardConfirmType = 'TITLE_INITIAL' | 'AUTHOR';
