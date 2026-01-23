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

export async function POST(request: NextRequest) {
  try {
    // Prisma Clientの接続を確実にする（Vercel serverless functions用）
    await ensurePrismaConnected();
    
    const body = await request.json();
    const { sessionId, choice } = body;

    if (!sessionId || !choice) {
      return NextResponse.json(
        { error: 'sessionId and choice are required' },
        { status: 400 }
      );
    }

    // セッション取得
    const session = await SessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const config: MvpConfig = getMvpConfig();

    // 現在の質問を履歴から取得（最後の質問）
    const currentQuestion = session.questionHistory[session.questionHistory.length - 1];
    if (!currentQuestion) {
      return NextResponse.json(
        { error: 'No current question' },
        { status: 400 }
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
    await SessionManager.saveWeightsSnapshot(
      sessionId,
      currentQuestion.qIndex,
      weights
    );

    // 回答処理
    const questionData = {
      kind: currentQuestion.kind,
      displayText: '', // 使用しない
      tagKey: currentQuestion.tagKey,
      hardConfirmType: currentQuestion.hardConfirmType,
      hardConfirmValue: currentQuestion.hardConfirmValue,
    };

    const updatedWeights = await processAnswer(
      weights,
      questionData,
      choice,
      config
    );

    // 正規化
    const probabilities = normalizeWeights(updatedWeights);
    const confidence = calculateConfidence(probabilities);
    const effectiveCandidates = calculateEffectiveCandidates(probabilities);

    // 重みを更新
    await SessionManager.updateWeights(sessionId, updatedWeights);

    // 質問カウントをインクリメント
    await SessionManager.incrementQuestionCount(sessionId);

    // REVEAL判定
    if (confidence >= config.confirm.revealThreshold) {
      // top1を取得（REVEAL再出防止チェック）
      const sorted = [...probabilities].sort((a, b) => {
        if (a.probability !== b.probability) {
          return b.probability - a.probability;
        }
        return a.workId.localeCompare(b.workId);
      });
      const topWorkId = sorted[0]?.workId;

      if (topWorkId && !session.revealRejectedWorkIds.includes(topWorkId)) {
        // REVEAL可能
        const topWork = await prisma.work.findUnique({
          where: { workId: topWorkId },
        });

        if (topWork) {
          const workResponse = toWorkResponse(topWork);

          // デバッグペイロード構築（3重ロック成立時のみ）
          const updatedSession = await SessionManager.getSession(sessionId);
          let debug;
          if (allowed && updatedSession && beforeState) {
            const touchedTagKeys: string[] = [];
            if (currentQuestion.tagKey) {
              touchedTagKeys.push(currentQuestion.tagKey);
            }
            debug = await buildDebugPayload(
              updatedSession,
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
            // 内部確率・重みは返さない（Data exposure policy）
          });
        }
      }
    }

    // FAIL_LIST判定
    if (
      session.questionCount + 1 >= (config.flow.maxQuestions as number) ||
      session.revealMissCount >= (config.flow.maxRevealMisses as number)
    ) {
      // FAIL_LISTに遷移（/api/failListで処理）
      return NextResponse.json({
        state: 'FAIL_LIST',
        // 候補は/failListで返す（ここでは返さない）
      });
    }

    // 次の質問を選択
    const nextQuestion = await selectNextQuestion(
      updatedWeights,
      probabilities,
      session.questionCount + 1,
      session.questionHistory,
      config
    );

    if (!nextQuestion) {
      // 質問が無い → FAIL_LIST
      return NextResponse.json({
        state: 'FAIL_LIST',
      });
    }

    // 質問履歴に追加
    await SessionManager.addQuestionHistory(sessionId, {
      qIndex: session.questionCount + 1,
      kind: nextQuestion.kind,
      tagKey: nextQuestion.tagKey,
      hardConfirmType: nextQuestion.hardConfirmType,
      hardConfirmValue: nextQuestion.hardConfirmValue,
    });

    // 返却（最小限の情報のみ）
    const questionResponse: QuestionResponse = {
      kind: nextQuestion.kind,
      displayText: nextQuestion.displayText,
      tagKey: nextQuestion.tagKey, // 最小限（質問プール全体は返さない）
      hardConfirmType: nextQuestion.hardConfirmType,
      hardConfirmValue: nextQuestion.hardConfirmValue,
    };

    const sessionState: SessionStateResponse = {
      questionCount: session.questionCount + 1,
      confidence, // P(top1)のみ（詳細内訳は返さない）
    };

    // デバッグペイロード構築（3重ロック成立時のみ）
    const updatedSession = await SessionManager.getSession(sessionId);
    let debug;
    if (allowed && updatedSession && beforeState) {
      const touchedTagKeys: string[] = [];
      if (currentQuestion.tagKey) {
        touchedTagKeys.push(currentQuestion.tagKey);
      }
      debug = await buildDebugPayload(
        updatedSession,
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
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
