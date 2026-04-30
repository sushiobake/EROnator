import type { PrismaClient } from '@prisma/client';
import { getTagEntriesForWork } from '../matrixLoader';
import { extractSampleImageUrls } from '../sourcePayloadImages';
import type { QuizDisplayTag, QuizPoolSummary, QuizTier, QuizWork } from '../types';
import { readExclusion } from './exclusionStore';
import { bucketByPopularity, fillTierCounts } from './tierBuckets';

interface CandidateRow {
  workId: string;
  title: string;
  authorName: string;
  thumbnailUrl: string | null;
  sourcePayload: string | null;
  popularityBase: number;
  /** "AI" | "HAND" | "UNKNOWN" — Work.isAi の生値 */
  isAi: string;
}

/** 'hand' = isAi==="HAND" の手書き作品のみ。'any' = 全作品 */
export type QuizTagSourceFilter = 'hand' | 'any';

export interface QuizPoolBuildResult {
  works: QuizWork[];
  /** プール選外で除外/入替候補になる作品（人気順、最大200件） */
  extras: QuizWork[];
  summary: QuizPoolSummary;
  /** 手動除外されている workId */
  excluded: string[];
  /** 現在使用している isAi フィルタ */
  tagSourceFilter: QuizTagSourceFilter;
}

interface CacheEntry {
  tagSourceFilter: QuizTagSourceFilter;
  excludedHash: string;
  data: QuizPoolBuildResult;
}

let cachedPool: CacheEntry | null = null;

function excludedHash(excluded: Set<string>): string {
  return [...excluded].sort().join(',');
}

function inferTagType(tagKey: string, tagMetaType?: string): 'DERIVED' | 'OFFICIAL' | 'STRUCTURAL' {
  if (tagMetaType === 'DERIVED' || tagMetaType === 'OFFICIAL' || tagMetaType === 'STRUCTURAL') {
    return tagMetaType;
  }
  if (tagKey.startsWith('tag_')) return 'DERIVED';
  if (tagKey.startsWith('off_')) return 'OFFICIAL';
  return 'STRUCTURAL';
}

function toTag(
  tagKey: string,
  tagMeta: { displayName: string; tagType: string } | undefined,
  confidence: number | null,
): QuizDisplayTag {
  const inferredType = inferTagType(tagKey, tagMeta?.tagType);
  const isDerivedByConfidence = confidence != null;
  const isDerived = isDerivedByConfidence || inferredType === 'DERIVED';
  return {
    tagKey,
    displayName: tagMeta?.displayName ?? tagKey,
    isDerived,
    confidence: isDerived ? confidence : null,
  };
}

function randomPick<T>(src: T[], count: number): T[] {
  if (src.length <= count) return [...src];
  const arr = [...src];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

function assignTier(works: QuizWork[]): QuizWork[] {
  const sortedDesc = [...works].sort((a, b) => b.popularityBase - a.popularityBase);
  const bucketed = bucketByPopularity(sortedDesc);
  const baseBuckets = bucketed.famous.map((w) => ({ ...w, tier: 'famous' as const }));
  const baseBucketsMid = bucketed.mid.map((w) => ({ ...w, tier: 'mid' as const }));
  const baseBucketsMinor = bucketed.minor.map((w) => ({ ...w, tier: 'minor' as const }));
  const filled = fillTierCounts(
    { famous: baseBuckets, mid: baseBucketsMid, minor: baseBucketsMinor },
    sortedDesc.map((w) => ({ ...w, tier: 'mid' as QuizTier })),
  );

  const famous = filled.famous.slice(0, 40).map((w) => ({ ...w, tier: 'famous' as const }));
  const mid = filled.mid.slice(0, 40).map((w) => ({ ...w, tier: 'mid' as const }));
  const minor = filled.minor.slice(0, 20).map((w) => ({ ...w, tier: 'minor' as const }));

  return [...famous, ...mid, ...minor];
}

export async function buildQuizPool(
  prisma: PrismaClient,
  options?: { tagSourceFilter?: QuizTagSourceFilter },
): Promise<QuizPoolBuildResult> {
  const tagSourceFilter: QuizTagSourceFilter = options?.tagSourceFilter ?? 'hand';

  const rows = await prisma.work.findMany({
    where: { gameRegistered: true },
    select: {
      workId: true,
      title: true,
      authorName: true,
      thumbnailUrl: true,
      sourcePayload: true,
      popularityBase: true,
      isAi: true,
    },
  });

  const matrixCandidate = rows
    .map((r) => ({ r, matrix: getTagEntriesForWork(r.workId) }))
    .filter((x) => x.matrix.length > 0);

  const allTagKeys = new Set<string>();
  for (const c of matrixCandidate) {
    for (const m of c.matrix) allTagKeys.add(m.tagKey);
  }

  const tagRows = await prisma.tag.findMany({
    where: { tagKey: { in: [...allTagKeys] } },
    select: { tagKey: true, displayName: true, tagType: true },
  });
  const tagMeta = new Map(tagRows.map((t) => [t.tagKey, { displayName: t.displayName, tagType: t.tagType }]));

  const candidates: QuizWork[] = [];
  for (const item of matrixCandidate) {
    const row = item.r as CandidateRow;

    // 手書き作品のみフィルタ（isAi === "HAND" のみ採用。AI作品・UNKNOWN は除外）
    if (tagSourceFilter === 'hand' && row.isAi !== 'HAND') continue;

    const sample = extractSampleImageUrls(row.sourcePayload);
    if (!sample || sample.length < 6) continue;

    const tags = item.matrix.map((m) => toTag(m.tagKey, tagMeta.get(m.tagKey), m.derivedConfidence));
    const derivedTags = tags.filter((t) => t.isDerived);
    const officialTags = tags.filter((t) => !t.isDerived && inferTagType(t.tagKey, tagMeta.get(t.tagKey)?.tagType) === 'OFFICIAL');
    const structuralTags = tags.filter((t) => inferTagType(t.tagKey, tagMeta.get(t.tagKey)?.tagType) === 'STRUCTURAL');

    if (derivedTags.length < 2) continue;

    candidates.push({
      workId: row.workId,
      title: row.title,
      authorName: row.authorName,
      thumbnailUrl: row.thumbnailUrl,
      popularityBase: row.popularityBase ?? 0,
      sampleImages: sample.slice(0, 8),
      tagKeys: tags.map((t) => t.tagKey),
      derivedTags,
      officialTags,
      structuralTags,
      tier: 'mid',
      tagSource: row.isAi ?? null,
    });
  }

  // 除外リストを先に適用してから tier 割り当て
  const excluded = await readExclusion();
  const filtered = candidates.filter((c) => !excluded.has(c.workId));

  const selected = assignTier(filtered);
  const selectedSet = new Set(selected.map((w) => w.workId));

  // extras は「プールに入っていない候補」を人気順で最大200件
  const extras = filtered
    .filter((c) => !selectedSet.has(c.workId))
    .sort((a, b) => b.popularityBase - a.popularityBase)
    .slice(0, 200);

  const summary: QuizPoolSummary = {
    totalCandidates: candidates.length,
    totalSelected: selected.length,
    famousCount: selected.filter((w) => w.tier === 'famous').length,
    midCount: selected.filter((w) => w.tier === 'mid').length,
    minorCount: selected.filter((w) => w.tier === 'minor').length,
  };

  return {
    works: selected,
    extras,
    summary,
    excluded: [...excluded].sort(),
    tagSourceFilter,
  };
}

export async function getQuizPool(
  prisma: PrismaClient,
  options?: { refresh?: boolean; tagSourceFilter?: QuizTagSourceFilter },
): Promise<QuizPoolBuildResult> {
  const tagSourceFilter: QuizTagSourceFilter = options?.tagSourceFilter ?? 'hand';
  const excluded = await readExclusion();
  const hash = excludedHash(excluded);

  if (
    !options?.refresh &&
    cachedPool &&
    cachedPool.tagSourceFilter === tagSourceFilter &&
    cachedPool.excludedHash === hash
  ) {
    return cachedPool.data;
  }

  const data = await buildQuizPool(prisma, { tagSourceFilter });
  cachedPool = { tagSourceFilter, excludedHash: hash, data };
  return data;
}

export function clearQuizPoolCache(): void {
  cachedPool = null;
}

export function pickByTier(works: QuizWork[], tier: QuizTier, count: number): QuizWork[] {
  return randomPick(
    works.filter((w) => w.tier === tier),
    count,
  );
}
