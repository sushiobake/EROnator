/**
 * デバッグペイロード構築
 * 既存の内部計算結果・DB取得結果をそのまま覗く（新規計算禁止）
 */

import type { WorkProbability, WorkWeight } from '@/server/algo/types';
import { normalizeWeights, calculateConfidence } from '@/server/algo/scoring';
import { prisma } from '@/server/db/client';
import type { SessionState } from '@/server/session/manager';

export interface DebugPayload {
  step: number;
  session: {
    sessionId: string;
    questionCount: number;
    confidence: number;
    candidateCount: number;
    top1Score: number;
    top2Score: number;
  };
  before?: {
    questionCount: number;
    confidence: number;
    candidateCount: number;
    top1Score: number;
    top2Score: number;
    weightsTop: Array<{
      workId: string;
      weight: number;
    }>;
  };
  after: {
    questionCount: number;
    confidence: number;
    candidateCount: number;
    top1Score: number;
    top2Score: number;
    weightsTop: Array<{
      workId: string;
      weight: number;
    }>;
  };
  delta?: {
    confidenceDelta: number;
    candidateCountDelta: number;
    topGapDelta: number;
    weightDeltasTop: Array<{
      workId: string;
      workTitle: string; // 作品名を追加
      before: number;
      after: number;
      delta: number;
    }>;
  };
  lastAnswerMeta?: {
    questionId?: string;
    answerValue: string;
    touchedTagKeys: string[];
    touchedTagNames?: string[]; // タグ名を追加
  };
  topCandidates: Array<{
    workId: string;
    title: string;
    authorName: string;
    isAi: string;
    score: number;
    popularityBase: number;
    popularityPlayBonus: number;
    tags: string[];
  }>;
  rationaleRaw: Record<string, unknown>;
}

export interface BeforeState {
  session: SessionState;
  weights: WorkWeight[];
  probabilities: WorkProbability[];
  confidence: number;
}

export async function buildDebugPayload(
  afterSession: SessionState,
  afterProbabilities: WorkProbability[],
  afterConfidence: number,
  beforeState?: BeforeState,
  lastAnswerMeta?: {
    questionId?: string;
    answerValue: string;
    touchedTagKeys: string[];
  }
): Promise<DebugPayload> {
  // 確率をソート（P desc → workId asc、決定論的）
  const sorted = [...afterProbabilities].sort((a, b) => {
    if (a.probability !== b.probability) {
      return b.probability - a.probability;
    }
    return a.workId.localeCompare(b.workId);
  });

  // Top10を取得
  const top10 = sorted.slice(0, 10);
  const top10WorkIds = top10.map(p => p.workId);

  // Work情報を取得（既存のDB取得を再利用）
  const works = await prisma.work.findMany({
    where: {
      workId: { in: top10WorkIds },
    },
    include: {
      workTags: {
        include: {
          tag: true,
        },
      },
    },
  });

  // WorkMapを作成
  const workMap = new Map(works.map(w => [w.workId, w]));

  // TopCandidatesを構築
  const topCandidates = top10
    .map(p => {
      const work = workMap.get(p.workId);
      if (!work) return null;

      return {
        workId: work.workId,
        title: work.title,
        authorName: work.authorName,
        isAi: work.isAi,
        score: p.probability,
        popularityBase: work.popularityBase,
        popularityPlayBonus: work.popularityPlayBonus,
        tags: work.workTags.map(wt => wt.tag.displayName),
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

  // After状態を構築
  const afterTop1Score = sorted[0]?.probability ?? 0;
  const afterTop2Score = sorted[1]?.probability ?? 0;
  const afterWeights = Object.entries(afterSession.weights).map(([workId, weight]) => ({
    workId,
    weight,
  }));
  const afterWeightsSorted = [...afterWeights].sort((a, b) => {
    if (a.weight !== b.weight) {
      return b.weight - a.weight;
    }
    return a.workId.localeCompare(b.workId);
  });
  const afterWeightsTop = afterWeightsSorted.slice(0, 20).map(w => ({
    workId: w.workId,
    weight: w.weight,
  }));

  const after = {
    questionCount: afterSession.questionCount,
    confidence: afterConfidence,
    candidateCount: afterProbabilities.length,
    top1Score: afterTop1Score,
    top2Score: afterTop2Score,
    weightsTop: afterWeightsTop,
  };

  // Before状態とDeltaを構築（beforeStateが提供された場合のみ）
  let before: DebugPayload['before'] | undefined;
  let delta: DebugPayload['delta'] | undefined;

  if (beforeState) {
    const beforeSorted = [...beforeState.probabilities].sort((a, b) => {
      if (a.probability !== b.probability) {
        return b.probability - a.probability;
      }
      return a.workId.localeCompare(b.workId);
    });
    const beforeTop1Score = beforeSorted[0]?.probability ?? 0;
    const beforeTop2Score = beforeSorted[1]?.probability ?? 0;
    const beforeWeightsSorted = [...beforeState.weights].sort((a, b) => {
      if (a.weight !== b.weight) {
        return b.weight - a.weight;
      }
      return a.workId.localeCompare(b.workId);
    });
    const beforeWeightsTop = beforeWeightsSorted.slice(0, 20).map(w => ({
      workId: w.workId,
      weight: w.weight,
    }));

    before = {
      questionCount: beforeState.session.questionCount,
      confidence: beforeState.confidence,
      candidateCount: beforeState.probabilities.length,
      top1Score: beforeTop1Score,
      top2Score: beforeTop2Score,
      weightsTop: beforeWeightsTop,
    };

    // Weight deltas計算
    const weightMapBefore = new Map(beforeState.weights.map(w => [w.workId, w.weight]));
    const weightMapAfter = new Map(afterWeights.map(w => [w.workId, w.weight]));
    const allWorkIds = new Set([...weightMapBefore.keys(), ...weightMapAfter.keys()]);
    
    const weightDeltas = Array.from(allWorkIds)
      .map(workId => ({
        workId,
        before: weightMapBefore.get(workId) ?? 0,
        after: weightMapAfter.get(workId) ?? 0,
        delta: (weightMapAfter.get(workId) ?? 0) - (weightMapBefore.get(workId) ?? 0),
      }))
      .filter(w => Math.abs(w.delta) > 1e-10); // ゼロでない差分のみ

    // abs(delta)の大きい順でソート
    weightDeltas.sort((a, b) => {
      const absDeltaA = Math.abs(a.delta);
      const absDeltaB = Math.abs(b.delta);
      if (absDeltaA !== absDeltaB) {
        return absDeltaB - absDeltaA;
      }
      return a.workId.localeCompare(b.workId);
    });

    // 作品名を取得（上位20件のみ）
    const topWorkIds = weightDeltas.slice(0, 20).map(w => w.workId);
    const workTitles = await prisma.work.findMany({
      where: {
        workId: { in: topWorkIds },
      },
      select: {
        workId: true,
        title: true,
      },
    });
    const workTitleMap = new Map(workTitles.map(w => [w.workId, w.title]));

    delta = {
      confidenceDelta: afterConfidence - beforeState.confidence,
      candidateCountDelta: afterProbabilities.length - beforeState.probabilities.length,
      topGapDelta: (afterTop1Score - afterTop2Score) - (beforeTop1Score - beforeTop2Score),
      weightDeltasTop: weightDeltas.slice(0, 20).map(w => ({
        workId: w.workId,
        workTitle: workTitleMap.get(w.workId) ?? w.workId, // 作品名、取得できない場合はworkId
        before: w.before,
        after: w.after,
        delta: w.delta,
      })),
    };
  }

  // タグ名を取得（lastAnswerMetaがある場合）
  let enrichedLastAnswerMeta = lastAnswerMeta;
  if (lastAnswerMeta && lastAnswerMeta.touchedTagKeys.length > 0) {
    const tags = await prisma.tag.findMany({
      where: {
        tagKey: { in: lastAnswerMeta.touchedTagKeys },
      },
      select: {
        tagKey: true,
        displayName: true,
      },
    });
    const tagNameMap = new Map(tags.map(t => [t.tagKey, t.displayName]));
    enrichedLastAnswerMeta = {
      ...lastAnswerMeta,
      touchedTagNames: lastAnswerMeta.touchedTagKeys.map(tagKey => 
        tagNameMap.get(tagKey) ?? tagKey // タグ名、取得できない場合はtagKey
      ),
    };
  }

  return {
    step: afterSession.questionCount,
    session: {
      sessionId: afterSession.sessionId,
      questionCount: afterSession.questionCount,
      confidence: afterConfidence,
      candidateCount: afterProbabilities.length,
      top1Score: afterTop1Score,
      top2Score: afterTop2Score,
    },
    before,
    after,
    delta,
    lastAnswerMeta: enrichedLastAnswerMeta,
    topCandidates,
    rationaleRaw: {}, // 既存の質問選択で使った生の指標が取れるならそれ（現状は空）
  };
}
