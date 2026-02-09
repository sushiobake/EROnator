/**
 * GET /api/failList/selected?sessionId=xxx&workId=yyy
 * 失敗時に候補から1作品を選んだときの「惜しかった」画面用データ
 * 選んだ作品 + おすすめ5件（確度順・同一作者1本まで）を返す。似てる度は選んだ作品とのタグ一致で算出。
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/server/session/manager';
import { normalizeWeights } from '@/server/algo/scoring';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { toWorkResponse } from '@/server/api/dto';
import { computeTagBasedMatchRate } from '@/server/utils/tagMatchRate';
import { updatePlayHistoryAlmostSuccess } from '@/server/playHistory/savePlayHistory';

export async function GET(request: NextRequest) {
  try {
    await ensurePrismaConnected();

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const workId = searchParams.get('workId');

    if (!sessionId || !workId) {
      return NextResponse.json(
        { error: 'sessionId and workId are required' },
        { status: 400 }
      );
    }

    const session = await SessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const weights = Object.entries(session.weights).map(([wId, weight]) => ({
      workId: wId,
      weight,
    }));
    const probabilities = normalizeWeights(weights);
    const sorted = [...probabilities].sort((a, b) => {
      if (a.probability !== b.probability) return b.probability - a.probability;
      return a.workId.localeCompare(b.workId);
    });

    const rejectedIds = new Set<string>(
      (typeof session.revealRejectedWorkIds === 'string'
        ? JSON.parse(session.revealRejectedWorkIds || '[]')
        : session.revealRejectedWorkIds ?? []) as string[]
    );
    const filtered = sorted.filter(p => !rejectedIds.has(p.workId));

    const selectedWork = await prisma.work.findUnique({
      where: { workId },
      include: { workTags: { select: { tagKey: true } } },
    });
    if (!selectedWork) {
      return NextResponse.json(
        { error: 'Selected work not found' },
        { status: 404 }
      );
    }

    const selectedAuthor = selectedWork.authorName ?? '';
    const selectedTagKeys = (selectedWork.workTags ?? []).map(wt => wt.tagKey);

    const candidateProbs = filtered.filter(p => p.workId !== workId);
    const candidateIds = candidateProbs.map(p => p.workId).slice(0, 30);
    const candidateRows =
      candidateIds.length > 0
        ? await prisma.work.findMany({
            where: { workId: { in: candidateIds } },
            include: { workTags: { select: { tagKey: true } } },
          })
        : [];
    const workMap = new Map(candidateRows.map(w => [w.workId, w]));
    const seenAuthors = new Set<string>();
    const recommended: Array<{ work: ReturnType<typeof toWorkResponse>; matchRate: number }> = [];
    for (const p of candidateProbs) {
      if (recommended.length >= 5) break;
      const w = workMap.get(p.workId);
      if (!w || w.authorName === selectedAuthor || seenAuthors.has(w.authorName)) continue;
      seenAuthors.add(w.authorName);
      const recTagKeys = (w.workTags ?? []).map(wt => wt.tagKey);
      const matchRate = computeTagBasedMatchRate(selectedTagKeys, recTagKeys);
      recommended.push({
        work: toWorkResponse(w),
        matchRate,
      });
    }

    // プレイ履歴を ALMOST_SUCCESS に更新（候補から選択）
    try {
      await updatePlayHistoryAlmostSuccess(sessionId, workId);
    } catch (e) {
      console.error('[PlayHistory] update ALMOST_SUCCESS failed:', e);
    }

    return NextResponse.json({
      work: toWorkResponse(selectedWork),
      recommendedWorks: recommended.map(({ work, matchRate }) => ({ ...work, matchRate })),
    });
  } catch (error) {
    console.error('Error in /api/failList/selected GET:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
