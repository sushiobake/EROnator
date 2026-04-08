/**
 * バッチシミュ・閾値最適化で共有する SharedBatchContext 構築（DB 1 回取得）
 */
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { getWorkTagMatrix } from '@/server/game/workTagMatrixLoader';
import { ensureTagCacheLoaded, getAllCachedTags } from '@/server/game/tagCacheLoader';
import type { SimWorkData } from '@/server/game/engine';
import type { SharedBatchContext } from '@/server/simulation/simulationRunner';

export async function buildSharedBatchContextForSimulation(): Promise<{
  sharedContext: SharedBatchContext;
  workTagMatrixData: ReturnType<typeof getWorkTagMatrix>;
  tagCacheData: ReturnType<typeof getAllCachedTags>;
  simWorkDataEntries: [string, SimWorkData][];
}> {
  await ensurePrismaConnected();

  getWorkTagMatrix();
  await ensureTagCacheLoaded();

  const allWorks = await prisma.work.findMany({
    where: { gameRegistered: true, needsReview: false },
    select: {
      workId: true,
      isAi: true,
      popularityBase: true,
      popularityPlayBonus: true,
      title: true,
      authorName: true,
      titleReadingInitial: true,
      reviewCount: true,
      reviewAverage: true,
      commentText: true,
    },
  });

  const workTitleMap = new Map<string, string>(allWorks.map((w) => [w.workId, w.title ?? '(不明)']));
  const workDetailMap = new Map(allWorks.map((w) => [w.workId, w]));

  const matrix = getWorkTagMatrix();
  const workTagMap = new Map<
    string,
    Array<{ tagKey: string; displayName: string; tagType: string; derivedConfidence: number | null }>
  >();
  if (matrix?.workTagMap) {
    const { getTagsByTagKeys: getTags, isTagCacheReady: cacheReady } = await import('@/server/game/tagCacheLoader');
    for (const [wId, entries] of Object.entries(matrix.workTagMap)) {
      if (cacheReady()) {
        const tagKeys = entries.map((e) => e.tagKey);
        const tags = getTags(tagKeys);
        const tagMap = new Map(tags.map((t) => [t.tagKey, t]));
        workTagMap.set(
          wId,
          entries.map((e) => {
            const t = tagMap.get(e.tagKey);
            return {
              tagKey: e.tagKey,
              displayName: t?.displayName ?? e.tagKey,
              tagType: t?.tagType ?? 'DERIVED',
              derivedConfidence: e.derivedConfidence,
            };
          })
        );
      }
    }
  }

  const sharedContext: SharedBatchContext = { allWorks, workTitleMap, workDetailMap, workTagMap };

  const simWorkDataEntries: [string, SimWorkData][] = allWorks.map((w) => [
    w.workId,
    {
      workId: w.workId,
      title: w.title,
      authorName: w.authorName,
      popularityBase: w.popularityBase,
      popularityPlayBonus: w.popularityPlayBonus,
      titleReadingInitial: w.titleReadingInitial,
    },
  ]);

  return {
    sharedContext,
    workTagMatrixData: matrix,
    tagCacheData: getAllCachedTags(),
    simWorkDataEntries,
  };
}
