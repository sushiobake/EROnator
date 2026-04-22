import { prisma } from '@/server/db/client';
import { isAllowedThumbnailHost } from '@/server/utils/allowedHosts';

export type RecentSuccessItem = {
  workId: string;
  title: string;
  titleCensored: string;
  thumbnailUrl: string | null;
  productUrl: string;
  questionCount: number;
  relativeTime: string;
  isAi: boolean;
  /** 当てた (SUCCESS) / 惜しかった (ALMOST_SUCCESS) の区別。タイトル一覧の吹き出し表示に使う */
  outcome: 'SUCCESS' | 'ALMOST_SUCCESS';
};

export type GetRecentSuccessesResult = {
  items: RecentSuccessItem[];
};

function clampLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 10;
  return Math.min(30, Math.max(1, Math.floor(limit ?? 10)));
}

function appendAffiliateId(url: string): string {
  const affiliateId = process.env.NEXT_PUBLIC_AFFILIATE_ID ?? '';
  if (!affiliateId) return url;
  if (url.includes('af_id=')) return url;
  return `${url}${url.includes('?') ? '&' : '?'}af_id=${affiliateId}`;
}

function partialCensor(text: string): string {
  return [...text]
    .map((char, index) => {
      if (/[0-9]/.test(char)) return char;
      return index % 2 === 1 ? '*' : char;
    })
    .join('');
}

function toRelativeTimeJa(from: Date, now: Date = new Date()): string {
  const diffMs = Math.max(0, now.getTime() - from.getTime());
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;

  if (diffMs >= week) return '1週間以上前';
  if (diffMs >= 2 * day) return `${Math.floor(diffMs / day)}日前`;
  if (diffMs >= day) return '昨日';
  if (diffMs >= hour) return `${Math.floor(diffMs / hour)}時間前`;
  if (diffMs >= minute) return `${Math.max(1, Math.floor(diffMs / minute))}分前`;
  return 'たった今';
}

export async function getRecentSuccesses(input?: { limit?: number }): Promise<GetRecentSuccessesResult> {
  const limit = clampLimit(input?.limit);
  const fetchTake = Math.min(limit * 4, 80);

  try {
    const histories = await prisma.playHistory.findMany({
      where: {
        // SUCCESS = 当てた / ALMOST_SUCCESS = 惜しかった。キャラ立ちのため少数混ぜる
        outcome: { in: ['SUCCESS', 'ALMOST_SUCCESS'] },
        resultWorkId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: fetchTake,
      select: {
        resultWorkId: true,
        questionCount: true,
        createdAt: true,
        outcome: true,
      },
    });

    const workIds = [...new Set(histories.map((h) => h.resultWorkId).filter((id): id is string => Boolean(id)))];
    if (workIds.length === 0) {
      return { items: [] };
    }

    const works = await prisma.work.findMany({
      where: {
        workId: { in: workIds },
        gameRegistered: true,
        needsReview: false,
      },
      select: {
        workId: true,
        title: true,
        thumbnailUrl: true,
        productUrl: true,
        affiliateUrl: true,
        isAi: true,
      },
    });

    const workById = new Map(works.map((work) => [work.workId, work] as const));
    const usedWorkIds = new Set<string>();
    const items: RecentSuccessItem[] = [];

    for (const history of histories) {
      const workId = history.resultWorkId;
      if (!workId || usedWorkIds.has(workId)) continue;

      const work = workById.get(workId);
      if (!work) continue;

      usedWorkIds.add(workId);
      items.push({
        workId,
        title: work.title,
        titleCensored: partialCensor(work.title),
        thumbnailUrl: isAllowedThumbnailHost(work.thumbnailUrl) ? work.thumbnailUrl : null,
        productUrl: appendAffiliateId(work.affiliateUrl || work.productUrl),
        questionCount: history.questionCount,
        relativeTime: toRelativeTimeJa(history.createdAt),
        isAi: work.isAi === 'AI',
        outcome: history.outcome === 'ALMOST_SUCCESS' ? 'ALMOST_SUCCESS' : 'SUCCESS',
      });

      if (items.length >= limit) break;
    }

    return { items };
  } catch (error) {
    console.error('[recent-successes] failed to fetch:', error);
    return { items: [] };
  }
}
