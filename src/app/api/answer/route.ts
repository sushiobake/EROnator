/**
 * /api/answer: QUIZ/Confirm回答受付
 * Data exposure policy: (sessionId, choice) のみ受け、サーバ側で currentQuestion を保持
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/server/session/manager';
import {
  normalizeWeights,
  calculateConfidence,
  calculateEffectiveCandidates,
} from '@/server/algo/scoring';
import { processAnswer, selectNextQuestion } from '@/server/game/engine';
import { applyRevealPenalty } from '@/server/algo/weightUpdate';
import { getMvpConfig } from '@/server/config/loader';
import type { MvpConfig } from '@/server/config/schema';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import type { WorkResponse, QuestionResponse, SessionStateResponse } from '@/server/api/types';
import { toWorkResponse } from '@/server/api/dto';
import { isDebugAllowed } from '@/server/debug/isDebugAllowed';
import { buildDebugPayload, type BeforeState } from '@/server/debug/buildDebugPayload';
import { ApiError, handleApiError } from '@/server/api/errorHandler';
import { createPlayHistory } from '@/server/playHistory/savePlayHistory';

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  try {
    // Prisma Clientの接続を確実にする（Vercel serverless functions用）
    await ensurePrismaConnected();
    console.log(`[perf] /api/answer ensurePrismaConnected: ${Date.now() - t0}ms`);

    const body = await request.json();
    const { sessionId, choice } = body;

    if (!sessionId || !choice) {
      throw new ApiError(
        400,
        'セッションIDと回答が必要です',
        'sessionId and choice are required'
      );
    }

    // セッション取得
    const t1 = Date.now();
    const session = await SessionManager.getSession(sessionId);
    console.log(`[perf] /api/answer getSession: ${Date.now() - t1}ms`);
    if (!session) {
      throw new ApiError(
        404,
        'セッションが見つかりませんでした。最初からやり直してください。',
        'Session not found'
      );
    }

    const config: MvpConfig = getMvpConfig();

    // 現在の質問を履歴から取得（最後の質問）
    const currentQuestion = session.questionHistory[session.questionHistory.length - 1];
    if (!currentQuestion) {
      throw new ApiError(
        400,
        '現在の質問が見つかりませんでした',
        'No current question'
      );
    }

    // 重みを取得
    const weights = Object.entries(session.weights).map(([workId, weight]) => ({
      workId,
      weight,
    }));

    // Before状態を取得（デバッグ用）
    const allowed = isDebugAllowed(request);
    let beforeState: BeforeState | undefined;
    if (allowed) {
      const beforeProbabilities = normalizeWeights(weights);
      const beforeConfidence = calculateConfidence(beforeProbabilities);
      beforeState = {
        session,
        weights,
        probabilities: beforeProbabilities,
        confidence: beforeConfidence,
      };
    }

    // 回答処理前に重みのスナップショットを保存（修正機能用）
    const t2 = Date.now();
    await SessionManager.saveWeightsSnapshot(
      sessionId,
      currentQuestion.qIndex,
      weights
    );
    console.log(`[perf] /api/answer saveWeightsSnapshot: ${Date.now() - t2}ms`);

    // 回答処理（まとめ質問のときは strength ±0.6 と summaryDisplayNames を使用）
    const questionData = {
      kind: currentQuestion.kind,
      displayText: '', // 使用しない
      tagKey: currentQuestion.tagKey,
      hardConfirmType: currentQuestion.hardConfirmType,
      hardConfirmValue: currentQuestion.hardConfirmValue,
      isSummaryQuestion: currentQuestion.isSummaryQuestion,
      summaryDisplayNames: currentQuestion.summaryDisplayNames,
    };

    const t3 = Date.now();
    const updatedWeights = await processAnswer(
      weights,
      questionData,
      choice,
      config
    );
    console.log(`[perf] /api/answer processAnswer: ${Date.now() - t3}ms`);

    const t3b = Date.now();
    // 正規化
    const probabilities = normalizeWeights(updatedWeights);
    const confidence = calculateConfidence(probabilities);
    const effectiveCandidates = calculateEffectiveCandidates(probabilities);

    // パフォーマンス最適化: 重み更新、質問カウント更新、スナップショット保存を1回のクエリにまとめる
    const weightsMap: Record<string, number> = {};
    for (const w of updatedWeights) {
      weightsMap[w.workId] = w.weight;
    }
    const newQuestionCount = session.questionCount + 1;
    
    // 直近の質問に回答を付与（表示・リプレイ用に choice をそのまま保存。YES/NO/PROBABLY_YES 等）
    const historyWithAnswer = session.questionHistory.length > 0 && choice != null
      ? session.questionHistory.map((entry, i) =>
          i === session.questionHistory.length - 1 ? { ...entry, answer: choice as string } : entry
        )
      : session.questionHistory;
    
    // 重みのスナップショット（修正機能用）。QUIZ 返却時は次の質問追加とまとめて1回で更新する
    const currentWeightsHistory = session.weightsHistory || [];
    const newWeightsHistory = [...currentWeightsHistory, {
      qIndex: currentQuestion.qIndex,
      weights: weights.reduce((acc, w) => ({ ...acc, [w.workId]: w.weight }), {}),
    }];

    console.log(`[perf] /api/answer prepare(post-normalize): ${Date.now() - t3b}ms`);

    // REVEAL判定（一度外した作品は候補から外し、確度順で未出の先頭をREVEAL）
    const tReveal = Date.now();
    if (confidence >= config.confirm.revealThreshold) {
      const sorted = [...probabilities].sort((a, b) => {
        if (a.probability !== b.probability) {
          return b.probability - a.probability;
        }
        return a.workId.localeCompare(b.workId);
      });
      const rejectedSet = new Set(session.revealRejectedWorkIds ?? []);
      const revealWorkId = sorted.find(p => !rejectedSet.has(p.workId))?.workId ?? null;

      if (revealWorkId) {
        const topWork = await prisma.work.findUnique({
          where: { workId: revealWorkId },
          select: {
            workId: true,
            title: true,
            authorName: true,
            isAi: true,
            productUrl: true,
            thumbnailUrl: true,
          },
        });

        if (topWork) {
          const workResponse = toWorkResponse(topWork);
          await SessionManager.updateSession(sessionId, {
            weights: weightsMap,
            questionCount: newQuestionCount,
            weightsHistory: newWeightsHistory,
            questionHistory: historyWithAnswer,
          }, session);

          // デバッグペイロード構築（3重ロック成立時のみ）
          let debug;
          if (allowed && session && beforeState) {
            const touchedTagKeys: string[] = [];
            if (currentQuestion.tagKey) {
              touchedTagKeys.push(currentQuestion.tagKey);
            }
            const updatedSessionForDebug = {
              ...session,
              questionCount: session.questionCount + 1,
              weights: updatedWeights.reduce((acc, w) => ({ ...acc, [w.workId]: w.weight }), {}),
            };
            debug = await buildDebugPayload(
              updatedSessionForDebug,
              probabilities,
              confidence,
              beforeState,
              {
                questionId: currentQuestion.tagKey || undefined,
                answerValue: choice,
                touchedTagKeys,
              }
            );
          }

          return NextResponse.json({
            state: 'REVEAL',
            work: workResponse,
            ...(debug ? { debug } : {}),
          });
        }
      }
    }

    // REVEAL失敗回数上限のみ FAIL_LIST（maxQuestions は強制 REVEAL にする）
    if (session.revealMissCount >= (config.flow.maxRevealMisses as number)) {
      await SessionManager.updateSession(sessionId, {
        weights: weightsMap,
        questionCount: newQuestionCount,
        weightsHistory: newWeightsHistory,
        questionHistory: historyWithAnswer,
      }, session);
      try {
        await createPlayHistory(
          { ...session, questionCount: newQuestionCount, questionHistory: historyWithAnswer },
          'FAIL_LIST'
        );
      } catch (e) {
        console.error('[PlayHistory] create FAIL_LIST failed:', e);
      }
      return NextResponse.json({
        state: 'FAIL_LIST',
      });
    }

    // maxQuestions 到達時は確度に関係なく強制 REVEAL（既出は候補から外す）
    if (session.questionCount + 1 >= (config.flow.maxQuestions as number)) {
      const sorted = [...probabilities].sort((a, b) => {
        if (a.probability !== b.probability) return b.probability - a.probability;
        return a.workId.localeCompare(b.workId);
      });
      const rejectedSet = new Set(session.revealRejectedWorkIds ?? []);
      const forceRevealId = sorted.find(p => !rejectedSet.has(p.workId))?.workId ?? sorted[0]?.workId;
      if (forceRevealId) {
        const topWork = await prisma.work.findUnique({
          where: { workId: forceRevealId },
          select: {
            workId: true,
            title: true,
            authorName: true,
            isAi: true,
            productUrl: true,
            thumbnailUrl: true,
          },
        });
        if (topWork) {
          await SessionManager.updateSession(sessionId, {
            weights: weightsMap,
            questionCount: newQuestionCount,
            weightsHistory: newWeightsHistory,
            questionHistory: historyWithAnswer,
          }, session);
          return NextResponse.json({
            state: 'REVEAL',
            work: toWorkResponse(topWork),
            forcedReveal: true, // maxQuestions 到達のため強制
          });
        }
      }
    }
    console.log(`[perf] /api/answer revealChecks: ${Date.now() - tReveal}ms`);

    // 次の質問を選択（回答付き履歴を渡して連続NO判定に使う）
    const t4 = Date.now();
    const nextQuestion = await selectNextQuestion(
      updatedWeights,
      probabilities,
      session.questionCount + 1,
      historyWithAnswer,
      config
    );
    console.log(`[perf] /api/answer selectNextQuestion: ${Date.now() - t4}ms`);

    if (!nextQuestion) {
      // 質問が無い → 強制 REVEAL または FAIL_LIST（いずれも1回だけセッション更新）
      await SessionManager.updateSession(sessionId, {
        weights: weightsMap,
        questionCount: newQuestionCount,
        weightsHistory: newWeightsHistory,
        questionHistory: historyWithAnswer,
      }, session);
      const sorted = [...probabilities].sort((a, b) => {
        if (a.probability !== b.probability) return b.probability - a.probability;
        return a.workId.localeCompare(b.workId);
      });
      const rejectedSet = new Set(session.revealRejectedWorkIds ?? []);
      const forceRevealId = sorted.find(p => !rejectedSet.has(p.workId))?.workId ?? sorted[0]?.workId;
      if (forceRevealId) {
        const topWork = await prisma.work.findUnique({
          where: { workId: forceRevealId },
          select: {
            workId: true,
            title: true,
            authorName: true,
            isAi: true,
            productUrl: true,
            thumbnailUrl: true,
          },
        });
        if (topWork) {
          return NextResponse.json({
            state: 'REVEAL',
            work: toWorkResponse(topWork),
            forcedReveal: true, // 次の質問が null のため強制
          });
        }
      }
      try {
        await createPlayHistory(
          { ...session, questionCount: newQuestionCount, questionHistory: historyWithAnswer },
          'FAIL_LIST'
        );
      } catch (e) {
        console.error('[PlayHistory] create FAIL_LIST failed:', e);
      }
      return NextResponse.json({ state: 'FAIL_LIST' });
    }

    // 次の質問の qIndex は「今答えた質問 + 1」（1問目=1, 2問目=2）。newQuestionCount は「回答数」なので 2問目でも 1 になり誤って qIndex が被る
    const nextQIndex = currentQuestion.qIndex + 1;
    const newHistory = [...historyWithAnswer, {
      qIndex: nextQIndex,
      kind: nextQuestion.kind,
      tagKey: nextQuestion.tagKey,
      hardConfirmType: nextQuestion.hardConfirmType,
      hardConfirmValue: nextQuestion.hardConfirmValue,
      displayText: nextQuestion.displayText,
      isSummaryQuestion: nextQuestion.isSummaryQuestion,
      summaryQuestionId: nextQuestion.summaryQuestionId,
      summaryDisplayNames: nextQuestion.summaryDisplayNames,
      exploreTagKind: (nextQuestion as { exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' }).exploreTagKind,
    }];
    const weightsHistoryWithNext = [...newWeightsHistory, {
      qIndex: nextQIndex,
      weights: weightsMap,
    }];
    const t5 = Date.now();
    await SessionManager.updateSession(sessionId, {
      weights: weightsMap,
      questionCount: newQuestionCount,
      questionHistory: newHistory,
      weightsHistory: weightsHistoryWithNext,
    }, {
      ...session,
      questionCount: newQuestionCount,
      weights: weightsMap,
      weightsHistory: weightsHistoryWithNext,
    });
    console.log(`[perf] /api/answer updateSession: ${Date.now() - t5}ms`);
    console.log(`[perf] /api/answer TOTAL: ${Date.now() - t0}ms`);

    // 返却（最小限の情報のみ）
    const questionResponse: QuestionResponse = {
      kind: nextQuestion.kind,
      displayText: nextQuestion.displayText,
      tagKey: nextQuestion.tagKey, // 最小限（質問プール全体は返さない）
      hardConfirmType: nextQuestion.hardConfirmType,
      hardConfirmValue: nextQuestion.hardConfirmValue,
      exploreTagKind: (nextQuestion as { exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' }).exploreTagKind,
    };

    const sessionState: SessionStateResponse = {
      questionCount: session.questionCount + 1,
      confidence, // P(top1)のみ（詳細内訳は返さない）
    };

    // デバッグペイロード構築（3重ロック成立時のみ）
    // パフォーマンス最適化: セッション再取得を削除（既に取得済みのsessionを使用）
    let debug;
    if (allowed && session && beforeState) {
      const touchedTagKeys: string[] = [];
      if (currentQuestion.tagKey) {
        touchedTagKeys.push(currentQuestion.tagKey);
      }
      // セッション状態を更新（デバッグ用）
      const updatedSessionForDebug = {
        ...session,
        questionCount: session.questionCount + 1,
        weights: updatedWeights.reduce((acc, w) => ({ ...acc, [w.workId]: w.weight }), {}),
      };
      debug = await buildDebugPayload(
        updatedSessionForDebug,
        probabilities,
        confidence,
        beforeState,
        {
          questionId: currentQuestion.tagKey || undefined,
          answerValue: choice,
          touchedTagKeys,
        }
      );
    }

    return NextResponse.json({
      state: 'QUIZ',
      question: questionResponse,
      sessionState,
      ...(debug ? { debug } : {}),
      // 内部確率・重み・候補全量は返さない（Data exposure policy）
    });
  } catch (error) {
    console.error('Error in /api/answer:', error);
    return handleApiError(error);
  }
}
