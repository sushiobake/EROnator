/**
 * /api/start: セッション開始
 * AI_GATE選択後の初期化
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionManager, weightsToStored } from '@/server/session/manager';
import {
  initializeWeights,
  initializeWeightsFromWorks,
  filterWorksByAiGate,
  selectNextQuestion,
} from '@/server/game/engine';
import { normalizeWeights, calculateConfidence, calculateEffectiveCandidates } from '@/server/algo/scoring';
import { getMvpConfig } from '@/server/config/loader';
import {
  DEFAULT_THINKING,
  DEFAULT_GAME_COPY,
  DEFAULT_RECOMMEND_COPY,
  migrateThinking,
  type MvpConfig,
} from '@/server/config/schema';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import type { QuestionResponse, SessionStateResponse } from '@/server/api/types';
import { isDebugAllowed } from '@/server/debug/isDebugAllowed';
import { buildDebugPayload } from '@/server/debug/buildDebugPayload';
import { ApiError, handleApiError } from '@/server/api/errorHandler';
import { getWorkTagMatrix } from '@/server/game/workTagMatrixLoader';
import { randomUUID } from 'crypto';

/** 1回の findMany で取得する Work（重み計算用に popularity を含む） */
type WorkRowFull = { workId: string; isAi: string; popularityBase: number | null; popularityPlayBonus: number | null };
type WorkRowMinimal = { workId: string; isAi: string };

export async function POST(request: NextRequest) {
  try {
    await ensurePrismaConnected();

    const body = await request.json();
    const { aiGateChoice } = body;

    const clientVisitorId =
      typeof body.visitorId === 'string' && body.visitorId.length > 0
        ? body.visitorId.slice(0, 128)
        : null;
    /** 未送信時はサーバーで付与（本番で localStorage 不可でも履歴に ID を残す） */
    const visitorId = clientVisitorId ?? randomUUID();

    if (!aiGateChoice || !['YES', 'NO', 'DONT_CARE'].includes(aiGateChoice)) {
      throw new ApiError(
        400,
        '無効なAIゲート選択です',
        'Invalid aiGateChoice'
      );
    }

    // 全Work取得（1回で workId, isAi, popularityBase, popularityPlayBonus を取得）
    let allWorks: WorkRowFull[] | WorkRowMinimal[] = await prisma.work.findMany({
      where: { gameRegistered: true, needsReview: false } as Record<string, unknown>,
      select: {
        workId: true,
        isAi: true,
        popularityBase: true,
        popularityPlayBonus: true,
      },
    });

    if (allWorks.length === 0) {
      const dbUrl = process.env.DATABASE_URL ?? '';
      const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');
      if (isPostgres) {
        throw new ApiError(
          503,
          'ゲームに登録された作品がありません。管理者が作品を登録してください。',
          'No works with gameRegistered=true on Postgres'
        );
      }
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqlite3 = require('better-sqlite3');
        const path = require('path');
        const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const db = sqlite3(dbPath, { readonly: true });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const directWorks = db.prepare('SELECT workId, isAi FROM Work WHERE gameRegistered = 1 AND (needsReview = 0 OR needsReview IS NULL)').all() as WorkRowMinimal[];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        db.close();
        allWorks = directWorks;
      } catch (directError) {
        console.error('[start] Error in direct SQLite fallback:', directError);
        throw new ApiError(
          500,
          '作品データの読み込みに失敗しました',
          'Failed to load works from database'
        );
      }
    }

    let allowedWorkIds: string[] = filterWorksByAiGate(
      allWorks.map((w) => ({ workId: w.workId, isAi: w.isAi })),
      aiGateChoice
    );

    const matrix = getWorkTagMatrix();
    if (matrix?.workTagMap) {
      const inMatrix = new Set(Object.keys(matrix.workTagMap));
      const before = allowedWorkIds.length;
      allowedWorkIds = allowedWorkIds.filter((id) => inMatrix.has(id));
      if (allowedWorkIds.length < before) {
        console.warn(`[start] ${before - allowedWorkIds.length} 件を matrix に存在しないため除外しました`);
      }
      if (allowedWorkIds.length === 0) {
        throw new ApiError(
          503,
          'ゲームに登録された作品がありません。workTagMatrix.json を確認してください。',
          'No works in matrix after filter'
        );
      }
    }

    const config: MvpConfig = getMvpConfig();
    const hasPrior =
      allWorks.length > 0 &&
      'popularityBase' in allWorks[0]! &&
      (allWorks[0] as WorkRowFull).popularityBase !== undefined;
    const weights = hasPrior
      ? initializeWeightsFromWorks(
          (allWorks as WorkRowFull[]).filter((w) => allowedWorkIds.includes(w.workId)),
          config.algo.alpha
        )
      : await initializeWeights(allowedWorkIds, config.algo.alpha);

    const probabilities = normalizeWeights(weights);

    const firstQuestion = await selectNextQuestion(
      weights,
      probabilities,
      0,
      [],
      config
    );

    if (!firstQuestion) {
      const errorPayload = { error: 'No question available' };
      return new NextResponse(JSON.stringify(errorPayload), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    const sessionId = randomUUID();
    const weightsMap: Record<string, number> = {};
    for (const w of weights) {
      weightsMap[w.workId] = w.weight;
    }
    const firstQuestionEntry = {
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
      specialQuestionType: (firstQuestion as { specialQuestionType?: 'SERIES' | 'TITLE_CHAR_TYPE' | 'POPULARITY' | 'TITLE_SYLLABLE' }).specialQuestionType,
      seriesTagKeys: (firstQuestion as { seriesTagKeys?: string[] }).seriesTagKeys,
      titleCharType: (firstQuestion as { titleCharType?: 'KANJI' | 'HIRAGANA_OR_KATAKANA' }).titleCharType,
    };

    await prisma.session.create({
      data: {
        sessionId,
        aiGateChoice,
        questionCount: 0,
        revealMissCount: 0,
        revealRejectedWorkIds: JSON.stringify([]),
        weights: JSON.stringify(weightsToStored(weightsMap)),
        weightsHistory: '[]',
        questionHistory: JSON.stringify([firstQuestionEntry]),
        visitorId,
      },
    });
    await prisma.sessionWeightsSnapshot.create({
      data: {
        sessionId,
        qIndex: 0,
        weightsJson: JSON.stringify(weightsToStored(weightsMap)),
      },
    });

    // 返却（最小限の情報のみ）
    const questionResponse: QuestionResponse = {
      kind: firstQuestion.kind,
      displayText: firstQuestion.displayText,
      tagKey: firstQuestion.tagKey,
      hardConfirmType: firstQuestion.hardConfirmType,
      hardConfirmValue: firstQuestion.hardConfirmValue,
      exploreTagKind: (firstQuestion as { exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' }).exploreTagKind,
      specialQuestionType: (firstQuestion as { specialQuestionType?: 'SERIES' | 'TITLE_CHAR_TYPE' | 'POPULARITY' | 'TITLE_SYLLABLE' }).specialQuestionType,
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

    const effectiveCandidates = calculateEffectiveCandidates(probabilities);
    const recommendCopy = { ...DEFAULT_RECOMMEND_COPY, ...config.recommendCopy };
    const gameCopyOut = {
      ...DEFAULT_GAME_COPY,
      ...(config.gameCopy ?? {}),
      recommendResultsHeading:
        recommendCopy.recommendResultsHeading ?? DEFAULT_RECOMMEND_COPY.recommendResultsHeading,
    };
    const payload = {
      sessionId,
      visitorId,
      state: 'QUIZ',
      question: questionResponse,
      sessionState,
      effectiveCandidates,
      gameCopy: gameCopyOut,
      thinking: migrateThinking(config.thinking ?? DEFAULT_THINKING),
      ...(debug ? { debug } : {}),
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
