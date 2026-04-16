/**
 * フロー関連の動的ロジック（P1改善）
 * - REVEAL閾値の質問数による動的調整
 * - maxQuestions の confidence による動的延長
 * - IG 計算用の上位 N 作品（topNForIG / フェーズ）
 */

import type { MvpConfig } from '@/server/config/schema';

/** ベースの revealThreshold（config から取得） */
type BaseThreshold = number;

/**
 * 質問数に応じた REVEAL 閾値を返す。
 * Q1-15: 0.7, Q16-20: 0.65, Q21-25: 0.6, Q26-30: 0.55
 */
export function getRevealThresholdForQuestion(
  questionCount: number,
  baseThreshold: BaseThreshold
): number {
  const q = questionCount + 1; // 1-based（次の質問が何問目か）
  if (q <= 15) return Math.max(baseThreshold, 0.7);
  if (q <= 20) return 0.65;
  if (q <= 25) return 0.6;
  return 0.55;
}

/** 動的延長の上限（わからない回復・Q30 recovery のキャップ） */
const MAX_QUESTIONS_CAP = 40;

export interface GetEffectiveMaxQuestionsOptions {
  questionHistory?: Array<{ answer?: string }>;
  effectiveCandidates?: number;
  questionCount?: number;
}

/**
 * 有効な最大質問数を返す。
 * - わからない1回につき +1 問
 * - Q30 到達時かつ effectiveCandidates < 50 なら +5 問
 * - 最大 40 問
 */
export function getEffectiveMaxQuestions(
  baseMaxQuestions: number,
  _confidence: number,
  options?: GetEffectiveMaxQuestionsOptions
): number {
  const { questionHistory = [], effectiveCandidates = Infinity, questionCount = 0 } = options ?? {};
  const unknownCount = questionHistory.filter(q => q.answer === 'UNKNOWN').length;
  const recoveryBonus = (questionCount >= 30 && effectiveCandidates < 50) ? 5 : 0;
  const total = baseMaxQuestions + unknownCount + recoveryBonus;
  return Math.min(MAX_QUESTIONS_CAP, total);
}

const DEFAULT_TOP_N_FOR_IG = 300;

/**
 * EXPLORE_TAG の IG 計算に使う上位作品数を返す。
 * - topNForIG: 0 または未指定時は既定 300。0 は「全件」とはしない（後方互換のため）。
 * - topNForIGPhases: untilQuestionIndex（1-based・次に出す質問番号）以前ならその topN を使用。
 * - 常に totalWorks を上限にクランプ。
 */
export function resolveTopNForIG(
  config: MvpConfig,
  nextQuestionIndex1Based: number,
  totalWorks: number
): number {
  const phases = config.algo.topNForIGPhases;
  if (phases && phases.length > 0) {
    const sorted = [...phases].sort((a, b) => a.untilQuestionIndex - b.untilQuestionIndex);
    for (const p of sorted) {
      if (nextQuestionIndex1Based <= p.untilQuestionIndex) {
        const n = p.topN <= 0 ? totalWorks : p.topN;
        return Math.min(n, totalWorks);
      }
    }
  }
  const raw = config.algo.topNForIG;
  let base: number;
  if (raw == null) {
    base = DEFAULT_TOP_N_FOR_IG;
  } else if (raw <= 0) {
    base = totalWorks;
  } else {
    base = raw;
  }
  return Math.min(base, totalWorks);
}
