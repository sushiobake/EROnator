/**
 * /api/back: 前の質問に戻る（修正機能）
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/server/session/manager';
import { getMvpConfig } from '@/server/config/loader';
import type { MvpConfig } from '@/server/config/schema';
import type { QuestionResponse, SessionStateResponse } from '@/server/api/types';
import { toQuestionResponse as convertToQuestionResponse } from '@/server/api/dto';
import { normalizeWeights, calculateConfidence } from '@/server/algo/scoring';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
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

    // 質問履歴が空または1問目のみの場合は戻れない
    if (session.questionHistory.length <= 1) {
      return NextResponse.json(
        { error: 'Cannot go back: no previous question' },
        { status: 400 }
      );
    }

    // 現在の質問番号（最後の質問）
    const currentQIndex = session.questionHistory[session.questionHistory.length - 1]?.qIndex;
    if (!currentQIndex || currentQIndex <= 1) {
      return NextResponse.json(
        { error: 'Cannot go back: already at first question' },
        { status: 400 }
      );
    }

    // 前の質問番号
    const previousQIndex = currentQIndex - 1;

    // ロールバック実行
    const result = await SessionManager.rollbackToQuestion(sessionId, previousQIndex);
    if (!result.success || !result.question) {
      return NextResponse.json(
        { error: 'Failed to rollback' },
        { status: 500 }
      );
    }

    // 更新後のセッションを取得
    const updatedSession = await SessionManager.getSession(sessionId);
    if (!updatedSession) {
      return NextResponse.json(
        { error: 'Session update failed' },
        { status: 500 }
      );
    }

    // 重みを取得
    const weights = Object.entries(updatedSession.weights).map(([workId, weight]) => ({
      workId,
      weight,
    }));

    // 正規化
    const probabilities = normalizeWeights(weights);
    const confidence = calculateConfidence(probabilities);

    // 前の質問をQuestionResponse形式に変換
    const questionResponse = await convertToQuestionResponse(result.question);

    // SessionStateResponse
    const sessionStateResponse: SessionStateResponse = {
      questionCount: updatedSession.questionCount,
      confidence,
    };

    return NextResponse.json({
      state: 'QUIZ',
      question: questionResponse,
      sessionState: sessionStateResponse,
    });
  } catch (error) {
    console.error('Error in /api/back:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
