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
import { handleRevealResponse, setSimWorkDataMap, type SimWorkData } from '@/server/game/engine';
import { getMvpConfig } from '@/server/config/loader';
import type { MvpConfig } from '@/server/config/schema';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import type { QuestionResponse, SessionStateResponse } from '@/server/api/types';
import { toWorkResponse } from '@/server/api/dto';
import { isDebugAllowed } from '@/server/debug/isDebugAllowed';
import { buildDebugPayload, type BeforeState } from '@/server/debug/buildDebugPayload';
import { buildRevealAnalysis } from '@/server/debug/buildRevealAnalysis';
import { ApiError, handleApiError } from '@/server/api/errorHandler';
import { SESSION_NOT_FOUND_CODE } from '@/constants/apiCodes';
import { computeTagBasedMatchRate } from '@/server/utils/tagMatchRate';
import { createPlayHistory } from '@/server/playHistory/savePlayHistory';
import { buildFailListContextSnapshot } from '@/server/playHistory/buildFailListContext';
import type { QuestionHistoryEntry } from '@/server/session/manager';
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
        'Session not found',
        SESSION_NOT_FOUND_CODE
      );
    }

    const config: MvpConfig = getMvpConfig();

    const weights = Object.entries(session.weights).map(([workId, weight]) => ({
      workId,
      weight,
    }));
    const probabilities = normalizeWeights(weights);

    // REVEAL→NO→QUIZ のとき selectNextQuestion 内で selectSpecialQuestion が呼ばれる。
    // setSimWorkDataMap がないと getSimWorkDataMap() が null のまま 3 回 findMany で 20 秒かかる。
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

    let result;
    try {
      result = await handleRevealResponse(
        session,
        answer,
        weights,
        probabilities,
        config
      );
    } finally {
      setSimWorkDataMap(null);
    }

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
          const h = session.questionHistory ?? [];
          const maxQ = h.length > 0 ? Math.max(...h.map((x) => x.qIndex ?? 0)) : 0;
          const revealEntry = {
            qIndex: maxQ + 1,
            kind: 'REVEAL',
            displayText: `断定: この作品は「${topWork.title}」ですか？`,
            answer: 'YES',
            revealResult: 'SUCCESS',
            revealWorkId: topWorkId,
            revealWorkTitle: topWork.title,
          } as unknown as QuestionHistoryEntry;
          const sessionForHistory: typeof session = {
            ...session,
            questionHistory: [...h, revealEntry],
          };
          await createPlayHistory(sessionForHistory, 'SUCCESS', topWorkId);
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

    // FAIL_LIST / QUIZ: セッション更新を適用。QUIZ のときはスナップショットを 1 行だけ INSERT。
    if (result.sessionUpdates) {
      // REVEAL→NO 時: 断定ミス行を questionHistory に追加（管理画面での分析用）
      if (answer === 'NO') {
        const rejectedSetForReveal = new Set(session.revealRejectedWorkIds ?? []);
        const sortedForReveal = [...probabilities].sort((a, b) => b.probability - a.probability);
        const revealedWorkId = sortedForReveal.find((p) => !rejectedSetForReveal.has(p.workId))?.workId ?? null;
        if (revealedWorkId) {
          const revealedWork = await prisma.work.findUnique({
            where: { workId: revealedWorkId },
            select: { title: true },
          });
          const existingHist = session.questionHistory;
          const maxExistingQ = existingHist.length > 0
            ? Math.max(...existingHist.map((e) => e.qIndex ?? 0))
            : 0;
          const revealMissEntry: QuestionHistoryEntry = {
            qIndex: maxExistingQ + 1,
            kind: 'REVEAL',
            displayText: `断定: この作品は「${revealedWork?.title ?? revealedWorkId}」ですか？`,
            answer: 'NO',
            revealResult: 'MISS',
            revealWorkId: revealedWorkId,
            revealWorkTitle: revealedWork?.title ?? undefined,
          };
          if (result.state === 'QUIZ' && result.sessionUpdates.questionHistory) {
            const hist = result.sessionUpdates.questionHistory;
            const lastEntry = hist[hist.length - 1];
            result.sessionUpdates.questionHistory = [
              ...hist.slice(0, -1),
              revealMissEntry,
              { ...lastEntry, qIndex: maxExistingQ + 2 },
            ];
            if (result.sessionUpdates.questionCount != null) {
              result.sessionUpdates.questionCount = maxExistingQ + 2;
            }
          } else if (result.state === 'FAIL_LIST') {
            result.sessionUpdates.questionHistory = [...session.questionHistory, revealMissEntry];
          }
        }
      }
      await SessionManager.updateSession(sessionId, result.sessionUpdates, session);
      if (result.state === 'QUIZ' && result.sessionUpdates.questionCount != null && result.sessionUpdates.weights) {
        const snapshotArray = Object.entries(result.sessionUpdates.weights).map(([workId, weight]) => ({ workId, weight }));
        await SessionManager.saveWeightsSnapshot(sessionId, result.sessionUpdates.questionCount, snapshotArray);
      }
    }

    // FAIL_LIST
    if (result.state === 'FAIL_LIST') {
      const updatedSession = await SessionManager.getSession(sessionId);
      if (updatedSession) {
        try {
          let snap = null;
          try {
            snap = await buildFailListContextSnapshot(updatedSession, config);
          } catch (err) {
            console.warn('[PlayHistory] failList snapshot:', err);
          }
          await createPlayHistory(updatedSession, 'FAIL_LIST', undefined, snap);
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
        newTagVariantId: (nextQuestion as { newTagVariantId?: string }).newTagVariantId,
        hardConfirmType: nextQuestion.hardConfirmType,
        hardConfirmValue: nextQuestion.hardConfirmValue,
        exploreTagKind: (nextQuestion as { exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' }).exploreTagKind,
        specialQuestionType: (nextQuestion as { specialQuestionType?: QuestionResponse['specialQuestionType'] }).specialQuestionType,
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
