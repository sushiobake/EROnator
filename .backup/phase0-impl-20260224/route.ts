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
import { ApiError, handleApiError } from '@/server/api/errorHandler';

export async function POST(request: NextRequest) {
  try {
    // Prisma Clientの接続を確実にする（Vercel serverless functions用）
    await ensurePrismaConnected();
    
    const body = await request.json();
    const { aiGateChoice } = body;

    if (!aiGateChoice || !['YES', 'NO', 'DONT_CARE'].includes(aiGateChoice)) {
      throw new ApiError(
        400,
        '無効なAIゲート選択です',
        'Invalid aiGateChoice'
      );
    }

    // セッション作成
    const sessionId = await SessionManager.createSession();
    await SessionManager.setAiGateChoice(sessionId, aiGateChoice);

    // 全Work取得（ゲーム登録済みのみ・AI_GATEフィルタ前）
    type WorkRow = { workId: string; isAi: string };
    // gameRegistered は schema に追加済み。prisma generate 後に型が付く
    let allWorks: WorkRow[] = await prisma.work.findMany({
      where: { gameRegistered: true, needsReview: false } as Record<string, unknown>,
      select: {
        workId: true,
        isAi: true,
      },
    });

    // Prismaで0件の場合
    if (allWorks.length === 0) {
      const dbUrl = process.env.DATABASE_URL ?? '';
      const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');
      // デプロイ先（Postgres）ではSQLiteフォールバックは使わない（ファイルが存在しないため）
      if (isPostgres) {
        throw new ApiError(
          503,
          'ゲームに登録された作品がありません。管理者が作品を登録してください。',
          'No works with gameRegistered=true on Postgres'
        );
      }
      // ローカル（SQLite）のみ: 直接SQLiteで取得（フォールバック）
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqlite3 = require('better-sqlite3');
        const path = require('path');
        const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
        console.log(`[start] Prisma returned 0 works, using direct SQLite query as fallback...`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const db = sqlite3(dbPath, { readonly: true });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const directWorks = db.prepare('SELECT workId, isAi FROM Work WHERE gameRegistered = 1 AND (needsReview = 0 OR needsReview IS NULL)').all() as WorkRow[];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        db.close();
        allWorks = directWorks;
        console.log(`[start] Direct SQLite query found ${allWorks.length} works`);
      } catch (directError) {
        console.error('[start] Error in direct SQLite fallback:', directError);
        throw new ApiError(
          500,
          '作品データの読み込みに失敗しました',
          'Failed to load works from database'
        );
      }
    }

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

    // 質問履歴に追加（displayText を保存して修正するで戻ったときに同じ文言を出す）
    await SessionManager.addQuestionHistory(sessionId, {
      qIndex: 1,
      kind: firstQuestion.kind,
      tagKey: firstQuestion.tagKey,
      hardConfirmType: firstQuestion.hardConfirmType,
      hardConfirmValue: firstQuestion.hardConfirmValue,
      displayText: firstQuestion.displayText,
      isSummaryQuestion: firstQuestion.isSummaryQuestion,
      summaryQuestionId: firstQuestion.summaryQuestionId,
      summaryDisplayNames: firstQuestion.summaryDisplayNames,
      exploreTagKind: (firstQuestion as { exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' }).exploreTagKind,
    });

    // 返却（最小限の情報のみ）
    const questionResponse: QuestionResponse = {
      kind: firstQuestion.kind,
      displayText: firstQuestion.displayText,
      tagKey: firstQuestion.tagKey,
      hardConfirmType: firstQuestion.hardConfirmType,
      hardConfirmValue: firstQuestion.hardConfirmValue,
      exploreTagKind: (firstQuestion as { exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' }).exploreTagKind,
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
    const response = handleApiError(error);
    // Content-Typeヘッダーを確実に設定
    response.headers.set('Content-Type', 'application/json; charset=utf-8');
    return response;
  }
}
