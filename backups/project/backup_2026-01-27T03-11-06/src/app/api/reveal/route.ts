/**
 * /api/reveal: REVEAL回答（Yes/No）
 * Yes → SUCCESS
 * No → ペナルティ適用＋missCount加算＋QUIZへ戻る
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/server/session/manager';
import {
  normalizeWeights,
  calculateConfidence,
} from '@/server/algo/scoring';
import { applyRevealPenalty } from '@/server/algo/weightUpdate';
import { selectNextQuestion } from '@/server/game/engine';
import { getMvpConfig } from '@/server/config/loader';
import type { MvpConfig } from '@/server/config/schema';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import type { QuestionResponse, SessionStateResponse } from '@/server/api/types';
import { isDebugAllowed } from '@/server/debug/isDebugAllowed';
import { buildDebugPayload, type BeforeState } from '@/server/debug/buildDebugPayload';
import { buildRevealAnalysis } from '@/server/debug/buildRevealAnalysis';
import { ApiError, handleApiError } from '@/server/api/errorHandler';

export async function POST(request: NextRequest) {
  try {
    // Prisma Clientの接続を確実にする（Vercel serverless functions用）
    await ensurePrismaConnected();
    
    const body = await request.json();
    const { sessionId, answer } = body; // "YES" or "NO"

    if (!sessionId || !answer) {
      throw new ApiError(
        400,
        'セッションIDと回答が必要です',
        'sessionId and answer are required'
      );
    }

    if (answer !== 'YES' && answer !== 'NO') {
      throw new ApiError(
        400,
        '回答は「はい」または「いいえ」である必要があります',
        'answer must be YES or NO'
      );
    }

    // セッション取得
    const session = await SessionManager.getSession(sessionId);
    if (!session) {
      throw new ApiError(
        404,
        'セッションが見つかりませんでした。最初からやり直してください。',
        'Session not found'
      );
    }

    const config: MvpConfig = getMvpConfig();

    // 重みを取得
    const weights = Object.entries(session.weights).map(([workId, weight]) => ({
      workId,
      weight,
    }));

    // 正規化してtop1を取得
    const probabilities = normalizeWeights(weights);
    const sorted = [...probabilities].sort((a, b) => {
      if (a.probability !== b.probability) {
        return b.probability - a.probability;
      }
      return a.workId.localeCompare(b.workId);
    });
    const topWorkId = sorted[0]?.workId;

    if (!topWorkId) {
      throw new ApiError(
        400,
        '候補作品が見つかりませんでした',
        'No top work found'
      );
    }

    if (answer === 'YES') {
      // SUCCESS
      const topWork = await prisma.work.findUnique({
        where: { workId: topWorkId },
      });

      if (topWork) {
        // popularityPlayBonus更新（SUCCESS時のみ、環境変数で無効化可能）
        if (process.env.DISABLE_POPULARITY_PLAY_BONUS !== '1') {
          await prisma.work.update({
            where: { workId: topWorkId },
            data: {
              popularityPlayBonus: topWork.popularityPlayBonus + config.popularity.playBonusOnSuccess,
            },
          });
        }

        // デバッグペイロード構築（3重ロック成立時のみ）
        // SUCCESS時は before/after の差分は不要（初期状態からの表示のみ）
        const allowed = isDebugAllowed(request);
        const debug = allowed && session
          ? await buildDebugPayload(session, probabilities, calculateConfidence(probabilities), undefined, undefined)
          : undefined;

        // REVEAL分析構築（確度・タグ整合度）
        const revealAnalysis = allowed && session
          ? await buildRevealAnalysis(session, topWorkId, probabilities)
          : undefined;

        return NextResponse.json({
          state: 'SUCCESS',
          workId: topWorkId,
          ...(debug ? { debug } : {}),
          ...(revealAnalysis ? { revealAnalysis } : {}),
          // 内部確率・重みは返さない（Data exposure policy）
        });
      }
    } else {
      // NO: ペナルティ適用
      const penalizedWeights = applyRevealPenalty(
        weights,
        topWorkId,
        config.algo.revealPenalty
      );

      // 重みを更新
      await SessionManager.updateWeights(sessionId, penalizedWeights);

      // REVEAL拒否WorkIdを追加（再REVEAL防止）
      await SessionManager.addRejectedWorkId(sessionId, topWorkId);

      // missCountをインクリメント
      await SessionManager.incrementRevealMissCount(sessionId);

      const updatedSession = await SessionManager.getSession(sessionId);
      if (!updatedSession) {
        throw new ApiError(
          500,
          'セッションの更新に失敗しました。もう一度お試しください。',
          'Session update failed'
        );
      }

      // FAIL_LIST判定
      if (updatedSession.revealMissCount >= (config.flow.maxRevealMisses as number)) {
        return NextResponse.json({
          state: 'FAIL_LIST',
        });
      }

      // QUIZに戻る（次の質問を選択）
      const updatedProbabilities = normalizeWeights(penalizedWeights);
      const nextQuestion = await selectNextQuestion(
        penalizedWeights,
        updatedProbabilities,
        updatedSession.questionCount,
        updatedSession.questionHistory,
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
        qIndex: updatedSession.questionCount + 1,
        kind: nextQuestion.kind,
        tagKey: nextQuestion.tagKey,
        hardConfirmType: nextQuestion.hardConfirmType,
        hardConfirmValue: nextQuestion.hardConfirmValue,
      });

      const questionResponse: QuestionResponse = {
        kind: nextQuestion.kind,
        displayText: nextQuestion.displayText,
        tagKey: nextQuestion.tagKey,
        hardConfirmType: nextQuestion.hardConfirmType,
        hardConfirmValue: nextQuestion.hardConfirmValue,
      };

      const confidence = calculateConfidence(updatedProbabilities);
      const sessionState: SessionStateResponse = {
        questionCount: updatedSession.questionCount,
        confidence,
      };

      // デバッグペイロード構築（3重ロック成立時のみ）
      // REVEAL No の場合は before/after を取得
      const allowed = isDebugAllowed(request);
      let debug;
      if (allowed && updatedSession) {
        // Before状態を取得（ペナルティ適用前）
        const beforeWeights = weights;
        const beforeProbabilities = probabilities;
        const beforeConfidence = calculateConfidence(beforeProbabilities);
        const beforeState = {
          session,
          weights: beforeWeights,
          probabilities: beforeProbabilities,
          confidence: beforeConfidence,
        };
        debug = await buildDebugPayload(
          updatedSession,
          updatedProbabilities,
          confidence,
          beforeState,
          {
            answerValue: 'NO',
            touchedTagKeys: [], // REVEAL No はタグに影響しない
          }
        );
      }

      return NextResponse.json({
        state: 'QUIZ',
        question: questionResponse,
        sessionState,
        ...(debug ? { debug } : {}),
        // 内部確率・重みは返さない（Data exposure policy）
      });
    }

    throw new ApiError(
      500,
      '予期しない状態が発生しました',
      'Unexpected state'
    );
  } catch (error) {
    console.error('Error in /api/reveal:', error);
    return handleApiError(error);
  }
}
