/**
 * /api/start: セッション開始
 * AI_GATE選択後の初期化
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/server/session/manager';
import {
  initializeWeights,
  filterWorksByAiGate,
  selectNextQuestion,
} from '@/server/game/engine';
import { normalizeWeights, calculateConfidence } from '@/server/algo/scoring';
import { getMvpConfig } from '@/server/config/loader';
import type { MvpConfig } from '@/server/config/schema';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import type { QuestionResponse, SessionStateResponse } from '@/server/api/types';
import { isDebugAllowed } from '@/server/debug/isDebugAllowed';
import { buildDebugPayload } from '@/server/debug/buildDebugPayload';

export async function POST(request: NextRequest) {
  try {
    // Prisma Clientの接続を確実にする（Vercel serverless functions用）
    await ensurePrismaConnected();
    
    // デバッグ: 環境変数の確認
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
    if (process.env.DATABASE_URL) {
      const urlParts = process.env.DATABASE_URL.split('@');
      if (urlParts.length > 1) {
        const hostPart = urlParts[1].split(':')[0];
        console.log('DATABASE_URL host:', hostPart);
      }
    }
    
    const body = await request.json();
    const { aiGateChoice } = body;

    if (!aiGateChoice || !['YES', 'NO', 'DONT_CARE'].includes(aiGateChoice)) {
      const errorPayload = { error: 'Invalid aiGateChoice' };
      return new NextResponse(JSON.stringify(errorPayload), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    // セッション作成
    const sessionId = await SessionManager.createSession();
    await SessionManager.setAiGateChoice(sessionId, aiGateChoice);

    // 全Work取得（AI_GATEフィルタ前）
    // productUrlは必須（Prisma schemaでnullableではない）
    const allWorks = await prisma.work.findMany();

    // AI_GATEフィルタ適用
    const allowedWorkIds = filterWorksByAiGate(
      allWorks.map(w => ({ workId: w.workId, isAi: w.isAi })),
      aiGateChoice
    );

    // 初期重み計算
    const config: MvpConfig = getMvpConfig();
    const weights = await initializeWeights(allowedWorkIds, config.algo.alpha);

    // セッションに重みを保存
    await SessionManager.updateWeights(sessionId, weights);

    // 初期重みのスナップショットを保存（修正機能用、qIndex=0）
    await SessionManager.saveWeightsSnapshot(sessionId, 0, weights);

    // 正規化
    const probabilities = normalizeWeights(weights);

    // 最初の質問を選択
    const firstQuestion = await selectNextQuestion(
      weights,
      probabilities,
      0, // questionCount = 0
      [], // questionHistory = []
      config
    );

    if (!firstQuestion) {
      const errorPayload = { error: 'No question available' };
      return new NextResponse(JSON.stringify(errorPayload), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    // 質問履歴に追加
    await SessionManager.addQuestionHistory(sessionId, {
      qIndex: 1,
      kind: firstQuestion.kind,
      tagKey: firstQuestion.tagKey,
      hardConfirmType: firstQuestion.hardConfirmType,
      hardConfirmValue: firstQuestion.hardConfirmValue,
    });

    // 返却（最小限の情報のみ）
    const questionResponse: QuestionResponse = {
      kind: firstQuestion.kind,
      displayText: firstQuestion.displayText,
      tagKey: firstQuestion.tagKey,
      hardConfirmType: firstQuestion.hardConfirmType,
      hardConfirmValue: firstQuestion.hardConfirmValue,
    };

    // Confidence計算（デバッグ用）
    const confidence = calculateConfidence(probabilities);

    const sessionState: SessionStateResponse = {
      questionCount: 0,
      confidence, // 初期状態でも計算
    };

    // デバッグペイロード構築（3重ロック成立時のみ）
    // /api/start は初期状態なので before は不要
    const allowed = isDebugAllowed(request);
    const session = await SessionManager.getSession(sessionId);
    const debug = allowed && session
      ? await buildDebugPayload(session, probabilities, confidence, undefined, undefined)
      : undefined;

    const payload = {
      sessionId,
      state: 'QUIZ',
      question: questionResponse,
      sessionState,
      ...(debug ? { debug } : {}),
      // 内部状態は返さない（Data exposure policy）
    };

    return new NextResponse(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (error) {
    console.error('Error in /api/start:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error details:', { errorMessage, errorStack });
    
    const errorPayload = {
      error: errorMessage,
      // 開発環境でのみスタックトレースを含める
      ...(process.env.NODE_ENV !== 'production' && errorStack ? { stack: errorStack } : {}),
    };
    return new NextResponse(JSON.stringify(errorPayload), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }
}
