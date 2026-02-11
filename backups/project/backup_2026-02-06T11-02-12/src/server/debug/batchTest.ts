/**
 * バッチテスト機能
 * 複数セッションを自動実行して統計を取得
 */

import { SessionManager } from '@/server/session/manager';
import {
  initializeWeights,
  filterWorksByAiGate,
  selectNextQuestion,
} from '@/server/game/engine';
import { normalizeWeights, calculateConfidence } from '@/server/algo/scoring';
import { processAnswer } from '@/server/game/engine';
import { getMvpConfig } from '@/server/config/loader';
import { prisma } from '@/server/db/client';
import type { AiGateChoice } from '@/server/algo/types';

export interface BatchTestConfig {
  numSessions: number;
  aiGateChoice: AiGateChoice;
  maxQuestions?: number; // デフォルト: config.flow.maxQuestions
  randomAnswers?: boolean; // true: ランダム回答, false: 常にYES
}

export interface BatchTestResult {
  totalSessions: number;
  successSessions: number;
  successRate: number;
  averageQuestions: number;
  averageConfidence: number;
  questionDistribution: Map<number, number>; // 質問数ごとのセッション数
  confidenceDistribution: Array<{ range: string; count: number }>;
  tagEffectiveness: Map<string, { used: number; success: number }>; // タグごとの使用回数と成功回数
}

/**
 * バッチテスト実行
 */
export async function runBatchTest(config: BatchTestConfig): Promise<BatchTestResult> {
  const mvpConfig = getMvpConfig();
  const maxQuestions = config.maxQuestions ?? mvpConfig.flow.maxQuestions;
  
  const results: Array<{
    success: boolean;
    questionCount: number;
    finalConfidence: number;
    usedTags: string[];
  }> = [];

  const tagStats = new Map<string, { used: number; success: number }>();

  // 各セッションを実行
  for (let i = 0; i < config.numSessions; i++) {
    try {
      const result = await runSingleSession(config, maxQuestions, mvpConfig);
      results.push(result);

      // タグ統計を更新
      for (const tagKey of result.usedTags) {
        const stats = tagStats.get(tagKey) || { used: 0, success: 0 };
        stats.used++;
        if (result.success) {
          stats.success++;
        }
        tagStats.set(tagKey, stats);
      }
    } catch (error) {
      console.error(`[BatchTest] Session ${i + 1} failed:`, error);
      // エラー時は失敗として記録
      results.push({
        success: false,
        questionCount: 0,
        finalConfidence: 0,
        usedTags: [],
      });
    }
  }

  // 統計を計算
  const successSessions = results.filter(r => r.success).length;
  const successRate = results.length > 0 ? successSessions / results.length : 0;
  
  const totalQuestions = results.reduce((sum, r) => sum + r.questionCount, 0);
  const averageQuestions = results.length > 0 ? totalQuestions / results.length : 0;

  const totalConfidence = results.reduce((sum, r) => sum + r.finalConfidence, 0);
  const averageConfidence = results.length > 0 ? totalConfidence / results.length : 0;

  // 質問数分布
  const questionDistribution = new Map<number, number>();
  for (const result of results) {
    const count = questionDistribution.get(result.questionCount) || 0;
    questionDistribution.set(result.questionCount, count + 1);
  }

  // 確信度分布（0-0.2, 0.2-0.4, 0.4-0.6, 0.6-0.8, 0.8-1.0）
  const confidenceRanges = [
    { min: 0, max: 0.2, label: '0-20%' },
    { min: 0.2, max: 0.4, label: '20-40%' },
    { min: 0.4, max: 0.6, label: '40-60%' },
    { min: 0.6, max: 0.8, label: '60-80%' },
    { min: 0.8, max: 1.0, label: '80-100%' },
  ];
  const confidenceDistribution = confidenceRanges.map(range => ({
    range: range.label,
    count: results.filter(r => r.finalConfidence >= range.min && r.finalConfidence < range.max).length,
  }));

  return {
    totalSessions: results.length,
    successSessions,
    successRate,
    averageQuestions,
    averageConfidence,
    questionDistribution,
    confidenceDistribution,
    tagEffectiveness: tagStats,
  };
}

/**
 * 単一セッションを実行
 */
async function runSingleSession(
  config: BatchTestConfig,
  maxQuestions: number,
  mvpConfig: ReturnType<typeof getMvpConfig>
): Promise<{
  success: boolean;
  questionCount: number;
  finalConfidence: number;
  usedTags: string[];
}> {
  // セッション作成
  const sessionId = await SessionManager.createSession();
  await SessionManager.setAiGateChoice(sessionId, config.aiGateChoice);

  // 全Work取得
  const allWorks = await prisma.work.findMany({
    select: {
      workId: true,
      isAi: true,
    },
  });

  // AI_GATEフィルタ適用
  const allowedWorkIds = filterWorksByAiGate(
    allWorks.map(w => ({ workId: w.workId, isAi: w.isAi })),
    config.aiGateChoice
  );

  // 初期重み計算
  const weights = await initializeWeights(allowedWorkIds, mvpConfig.algo.alpha);
  await SessionManager.updateWeights(sessionId, weights);

  const usedTags: string[] = [];
  let currentWeights = weights;
  let questionCount = 0;
  let finalConfidence = 0;

  // 質問ループ
  while (questionCount < maxQuestions) {
    const probabilities = normalizeWeights(currentWeights);
    const confidence = calculateConfidence(probabilities);

    // REVEAL判定
    if (confidence >= mvpConfig.confirm.revealThreshold) {
      finalConfidence = confidence;
      // 成功として記録（実際のREVEAL回答は省略）
      return {
        success: true,
        questionCount,
        finalConfidence,
        usedTags: [...usedTags],
      };
    }

    // 次の質問を選択
    const session = await SessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const nextQuestion = await selectNextQuestion(
      currentWeights,
      probabilities,
      questionCount,
      session.questionHistory,
      mvpConfig
    );

    if (!nextQuestion) {
      // 質問が無い → 失敗
      finalConfidence = confidence;
      return {
        success: false,
        questionCount,
        finalConfidence,
        usedTags: [...usedTags],
      };
    }

    // 質問履歴に追加
    await SessionManager.addQuestionHistory(sessionId, {
      qIndex: questionCount + 1,
      kind: nextQuestion.kind,
      tagKey: nextQuestion.tagKey,
      hardConfirmType: nextQuestion.hardConfirmType,
      hardConfirmValue: nextQuestion.hardConfirmValue,
    });

    // タグを記録
    if (nextQuestion.tagKey) {
      usedTags.push(nextQuestion.tagKey);
    }

    // 回答を生成（ランダム or 常にYES）
    const choice = config.randomAnswers
      ? getRandomChoice()
      : 'YES';

    // 回答処理
    const questionData = {
      kind: nextQuestion.kind,
      displayText: '',
      tagKey: nextQuestion.tagKey,
      hardConfirmType: nextQuestion.hardConfirmType,
      hardConfirmValue: nextQuestion.hardConfirmValue,
    };

    currentWeights = await processAnswer(
      currentWeights,
      questionData,
      choice,
      mvpConfig
    );

    await SessionManager.updateWeights(sessionId, currentWeights);
    questionCount++;
  }

  // 最大質問数に達した
  const probabilities = normalizeWeights(currentWeights);
  finalConfidence = calculateConfidence(probabilities);
  
  return {
    success: false,
    questionCount,
    finalConfidence,
    usedTags: [...usedTags],
  };
}

/**
 * ランダムな回答を生成
 */
function getRandomChoice(): string {
  const choices = ['YES', 'PROBABLY_YES', 'UNKNOWN', 'PROBABLY_NO', 'NO', 'DONT_CARE'];
  return choices[Math.floor(Math.random() * choices.length)];
}
