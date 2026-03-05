/**
 * /api/reveal: REVEAL回答（Yes/No）
 * Yes → SUCCESS
 * No → ペナルティ適用＋missCount加算＋QUIZへ戻る
 * 判定ロジックは engine.handleRevealResponse に集約
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/server/session/manager';
import {
  normalizeWeights,
  calculateConfidence,
} from '@/server/algo/scoring';
import { handleRevealResponse } from '@/server/game/engine';
import { getMvpConfig } from '@/server/config/loader';
import type { MvpConfig } from '@/server/config/schema';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import type { QuestionResponse, SessionStateResponse } from '@/server/api/types';
import { toWorkResponse } from '@/server/api/dto';
import { isDebugAllowed } from '@/server/debug/isDebugAllowed';
import { buildDebugPayload, type BeforeState } from '@/server/debug/buildDebugPayload';
import { buildRevealAnalysis } from '@/server/debug/buildRevealAnalysis';
import { ApiError, handleApiError } from '@/server/api/errorHandler';
import { computeTagBasedMatchRate } from '@/server/utils/tagMatchRate';
import { createPlayHistory } from '@/server/playHistory/savePlayHistory';
import { getWorkTagsFromMatrix } from '@/server/game/workTagMatrixLoader';

export async function POST(request: NextRequest) {
  try {
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

    const session = await SessionManager.getSession(sessionId);
    if (!session) {
      throw new ApiError(
        404,
        'セッションが見つかりませんでした。最初からやり直してください。',
        'Session not found'
      );
    }

    const config: MvpConfig = getMvpConfig();

    const weights = Object.entries(session.weights).map(([workId, weight]) => ({
      workId,
      weight,
    }));
    const probabilities = normalizeWeights(weights);

    const result = await handleRevealResponse(
      session,
      answer,
      weights,
      probabilities,
      config
    );

    // SUCCESS: DB更新・recommended構築・PlayHistory・レスポンス
    if (result.state === 'SUCCESS' && result.topWorkId) {
      const topWorkId = result.topWorkId;
      const topWork = await prisma.work.findUnique({
        where: { workId: topWorkId },
        include: { workTags: { select: { tagKey: true } } },
      });

      if (topWork) {
        if (process.env.DISABLE_POPULARITY_PLAY_BONUS !== '1') {
          prisma.work
            .update({
              where: { workId: topWorkId },
              data: {
                popularityPlayBonus: topWork.popularityPlayBonus + config.popularity.playBonusOnSuccess,
              },
            })
            .catch((e) => console.error('[reveal] popularityPlayBonus update failed:', e));
        }

        const allowed = isDebugAllowed(request);
        const debug = allowed && session
          ? await buildDebugPayload(session, probabilities, calculateConfidence(probabilities), undefined, undefined)
          : undefined;

        const revealAnalysis = allowed && session
          ? await buildRevealAnalysis(session, topWorkId, probabilities)
          : undefined;

        const sorted = [...probabilities].sort((a, b) => {
          if (a.probability !== b.probability) return b.probability - a.probability;
          return a.workId.localeCompare(b.workId);
        });
        const correctAuthor = topWork.authorName ?? '';
        const correctTagKeys = (topWork.workTags ?? []).map(wt => wt.tagKey);
        const candidateProbs = sorted.slice(1).filter(p => p.workId !== topWorkId);
        // おすすめは最大5件のため、上位50件に制限してDB負荷を削減
        const topCandidateProbs = candidateProbs.slice(0, 50);
        const topCandidateIds = topCandidateProbs.map(p => p.workId);
        const candidateRows = topCandidateIds.length > 0
          ? await prisma.work.findMany({
              where: { workId: { in: topCandidateIds } },
            })
          : [];
        const workMap = new Map(candidateRows.map(w => [w.workId, w]));
        const seenAuthors = new Set<string>();
        const recommended: Array<{ work: ReturnType<typeof toWorkResponse>; matchRate: number }> = [];
        const recTagKeysFromMatrix = getWorkTagsFromMatrix(topCandidateIds);
        const workTagKeysMap = new Map<string, string[]>();
        for (const e of recTagKeysFromMatrix) {
          if (!workTagKeysMap.has(e.workId)) workTagKeysMap.set(e.workId, []);
          workTagKeysMap.get(e.workId)!.push(e.tagKey);
        }
        for (const p of topCandidateProbs) {
          if (recommended.length >= 5) break;
          const w = workMap.get(p.workId);
          if (!w || w.authorName === correctAuthor || seenAuthors.has(w.authorName)) continue;
          seenAuthors.add(w.authorName);
          const recTagKeys = workTagKeysMap.get(p.workId) ?? [];
          const matchRate = computeTagBasedMatchRate(correctTagKeys, recTagKeys);
          recommended.push({ work: toWorkResponse(w), matchRate });
        }
        const recommendedWorks = recommended.map(({ work, matchRate }) => ({ ...work, matchRate }));

        try {
          await createPlayHistory(session, 'SUCCESS', topWorkId);
        } catch (e) {
          console.error('[PlayHistory] create SUCCESS failed:', e);
        }

        return NextResponse.json({
          state: 'SUCCESS',
          workId: topWorkId,
          recommendedWorks,
          ...(debug ? { debug } : {}),
          ...(revealAnalysis ? { revealAnalysis } : {}),
        });
      }
    }

    // FAIL_LIST / QUIZ: セッション更新を適用
    if (result.sessionUpdates) {
      await SessionManager.updateSession(sessionId, result.sessionUpdates, session);
    }

    // FAIL_LIST
    if (result.state === 'FAIL_LIST') {
      const updatedSession = await SessionManager.getSession(sessionId);
      if (updatedSession) {
        try {
          await createPlayHistory(updatedSession, 'FAIL_LIST');
        } catch (e) {
          console.error('[PlayHistory] create FAIL_LIST failed:', e);
        }
      }
      return NextResponse.json({ state: 'FAIL_LIST' });
    }

    // QUIZ
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
      const updatedSession = await SessionManager.getSession(sessionId);
      const confidence = result.confidence ?? (updatedSession ? calculateConfidence(normalizeWeights(Object.entries(updatedSession.weights).map(([workId, weight]) => ({ workId, weight })))) : 0);
      const sessionState: SessionStateResponse = {
        questionCount: updatedSession?.questionCount ?? session.questionCount + 1,
        confidence,
      };

      const allowed = isDebugAllowed(request);
      let debug;
      if (allowed && updatedSession && result.sessionUpdates) {
        const beforeWeights = weights;
        const beforeProbabilities = probabilities;
        const beforeConfidence = calculateConfidence(beforeProbabilities);
        const beforeState: BeforeState = {
          session,
          weights: beforeWeights,
          probabilities: beforeProbabilities,
          confidence: beforeConfidence,
        };
        const penalizedWeights = Object.entries(result.sessionUpdates.weights).map(([workId, weight]) => ({ workId, weight }));
        const penalizedProbs = normalizeWeights(penalizedWeights);
        debug = await buildDebugPayload(
          updatedSession,
          penalizedProbs,
          confidence,
          beforeState,
          { answerValue: 'NO', touchedTagKeys: [] }
        );
      }

      return NextResponse.json({
        state: 'QUIZ',
        question: questionResponse,
        sessionState,
        ...(debug ? { debug } : {}),
      });
    }

    throw new ApiError(500, '予期しない状態が発生しました', 'Unexpected state');
  } catch (error) {
    console.error('Error in /api/reveal:', error);
    return handleApiError(error);
  }
}
