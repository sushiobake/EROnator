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
import { processAnswer, handleAnswerResponse, setSimWorkDataMap, type SimWorkData } from '@/server/game/engine';
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

    const body = await request.json();
    const { sessionId, choice, questionShownAt } = body;

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
    if (!session) {
      throw new ApiError(
        404,
        'セッションが見つかりませんでした。最初からやり直してください。',
        'Session not found'
      );
    }

    const config: MvpConfig = getMvpConfig();

    // SPECIAL_QUESTION 用: セッション内の作品情報を1回で取得しキャッシュ（processAnswer 内の findMany を排除）
    const workIds = Object.keys(session.weights);
    if (workIds.length > 0) {
      const rows = await prisma.work.findMany({
        where: { workId: { in: workIds } },
        select: {
          workId: true,
          title: true,
          authorName: true,
          popularityBase: true,
          popularityPlayBonus: true,
          titleReadingInitial: true,
        },
      });
      const map = new Map<string, SimWorkData>();
      for (const w of rows) {
        map.set(w.workId, {
          workId: w.workId,
          title: w.title,
          authorName: w.authorName,
          popularityBase: w.popularityBase,
          popularityPlayBonus: w.popularityPlayBonus,
          titleReadingInitial: w.titleReadingInitial,
        });
      }
      setSimWorkDataMap(map);
    }

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

    // 重みのスナップショットは handleAnswerResponse の sessionUpdates に含め、1回の updateSession で保存する
    // （saveWeightsSnapshot を別呼び出しすると楽観的ロックで version がずれ、2回目の updateSession が SESSION_CONFLICT になる）

    // 回答処理（まとめ質問のときは strength ±0.6 と summaryDisplayNames を使用）
    const questionData = {
      kind: currentQuestion.kind,
      displayText: currentQuestion.displayText ?? '',
      tagKey: currentQuestion.tagKey,
      hardConfirmType: currentQuestion.hardConfirmType,
      hardConfirmValue: currentQuestion.hardConfirmValue,
      isSummaryQuestion: currentQuestion.isSummaryQuestion,
      summaryDisplayNames: currentQuestion.summaryDisplayNames,
      specialQuestionType: currentQuestion.specialQuestionType,
      seriesTagKeys: currentQuestion.seriesTagKeys,
      titleCharType: (currentQuestion as { titleCharType?: 'KANJI' | 'HIRAGANA_OR_KATAKANA' }).titleCharType,
      popularityThreshold: (currentQuestion as { popularityThreshold?: number }).popularityThreshold,
      syllableChars: (currentQuestion as { syllableChars?: string[] }).syllableChars,
      authorCharType: (currentQuestion as { authorCharType?: 'HIRAGANA_OR_KATAKANA' | 'KANJI_OR_ALPHA' }).authorCharType,
    };

    const t3 = Date.now();
    const updatedWeights = await processAnswer(
      weights,
      questionData,
      choice,
      config
    );

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
    const durationSeconds =
      typeof questionShownAt === 'string' && questionShownAt
        ? Math.max(0, Math.round((Date.now() - new Date(questionShownAt).getTime()) / 1000))
        : undefined;
    const historyWithAnswer = session.questionHistory.length > 0 && choice != null
      ? session.questionHistory.map((entry, i) =>
          i === session.questionHistory.length - 1
            ? { ...entry, answer: choice as string, ...(durationSeconds != null && { durationSeconds }) }
            : entry
        )
      : session.questionHistory;
    
    // 重みのスナップショット（修正機能用）。QUIZ 返却時は次の質問追加とまとめて1回で更新する
    // O(n)で構築（reduce+spreadはO(n^2)で2800件で約2秒かかっていた）
    const snapshotWeights: Record<string, number> = {};
    for (const w of weights) {
      snapshotWeights[w.workId] = w.weight;
    }
    const currentWeightsHistory = session.weightsHistory || [];
    const newWeightsHistory = [...currentWeightsHistory, {
      qIndex: currentQuestion.qIndex,
      weights: snapshotWeights,
    }];

    // 回答後の応答を決定（engine に集約）
    const result = await handleAnswerResponse(
      session,
      currentQuestion,
      updatedWeights,
      probabilities,
      confidence,
      historyWithAnswer,
      weightsMap,
      newQuestionCount,
      newWeightsHistory,
      config
    );

    // セッション更新（全パターン共通）
    await SessionManager.updateSession(sessionId, result.sessionUpdates, session);

    // REVEAL: 作品を取得して返却
    if (result.state === 'REVEAL' && result.revealWorkId) {
      const topWork = await prisma.work.findUnique({
        where: { workId: result.revealWorkId },
        select: {
          workId: true,
          title: true,
          authorName: true,
          isAi: true,
          productUrl: true,
          thumbnailUrl: true,
          reviewAverage: true,
          reviewCount: true,
        },
      });
      if (topWork) {
        let debug;
        if (allowed && session && beforeState) {
          const touchedTagKeys: string[] = [];
          if (currentQuestion.tagKey) touchedTagKeys.push(currentQuestion.tagKey);
          debug = await buildDebugPayload(
            { ...session, questionCount: session.questionCount + 1, weights: weightsMap },
            probabilities,
            confidence,
            beforeState,
            { questionId: currentQuestion.tagKey || undefined, answerValue: choice, touchedTagKeys }
          );
        }
        return NextResponse.json({
          state: 'REVEAL',
          work: toWorkResponse(topWork),
          ...(result.forcedReveal ? { forcedReveal: true } : {}),
          ...(debug ? { debug } : {}),
        });
      }
    }

    // FAIL_LIST: PlayHistory 作成して返却
    if (result.state === 'FAIL_LIST') {
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

    // QUIZ: 次の質問を返却
    if (result.state === 'QUIZ' && result.nextQuestion) {
      const nextQuestion = result.nextQuestion;
      const questionResponse: QuestionResponse = {
        kind: nextQuestion.kind,
        displayText: nextQuestion.displayText,
        tagKey: nextQuestion.tagKey,
        hardConfirmType: nextQuestion.hardConfirmType,
        hardConfirmValue: nextQuestion.hardConfirmValue,
        exploreTagKind: (nextQuestion as { exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' }).exploreTagKind,
        specialQuestionType: (nextQuestion as { specialQuestionType?: 'SERIES' | 'TITLE_CHAR_TYPE' | 'POPULARITY' | 'TITLE_SYLLABLE' }).specialQuestionType,
      };
      const sessionState: SessionStateResponse = {
        questionCount: session.questionCount + 1,
        confidence: result.confidence ?? confidence,
      };
      let debug;
      if (allowed && session && beforeState) {
        const touchedTagKeys: string[] = [];
        if (currentQuestion.tagKey) touchedTagKeys.push(currentQuestion.tagKey);
        debug = await buildDebugPayload(
          { ...session, questionCount: session.questionCount + 1, weights: weightsMap },
          probabilities,
          confidence,
          beforeState,
          { questionId: currentQuestion.tagKey || undefined, answerValue: choice, touchedTagKeys }
        );
      }
      return NextResponse.json({
        state: 'QUIZ',
        question: questionResponse,
        sessionState,
        effectiveCandidates,
        ...(debug ? { debug } : {}),
      });
    }

    // フォールバック（REVEAL で work が見つからなかった等）
    try {
      await createPlayHistory(
        { ...session, questionCount: newQuestionCount, questionHistory: historyWithAnswer },
        'FAIL_LIST'
      );
    } catch (e) {
      console.error('[PlayHistory] create FAIL_LIST failed:', e);
    }
    return NextResponse.json({ state: 'FAIL_LIST' });
  } catch (error) {
    console.error('Error in /api/answer:', error);
    return handleApiError(error);
  } finally {
    setSimWorkDataMap(null);
  }
}
