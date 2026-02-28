/**
 * GET /api/recommend/tags - 推薦用のタグ選択肢を取得
 * POST /api/recommend - タグに基づく推薦結果を取得
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/server/db/client';

const RECOMMEND_TAG_CATEGORIES = ['genre', 'play', 'situation', 'character', 'body'] as const;

export async function GET() {
  try {
    await ensurePrismaConnected();

    const tags = await prisma.tag.findMany({
      where: { tagType: 'DERIVED' },
      select: {
        tagKey: true,
        displayName: true,
        category: true,
      },
      orderBy: { displayName: 'asc' },
    });

    const workTagCounts = await prisma.workTag.groupBy({
      by: ['tagKey'],
      _count: { tagKey: true },
      having: { tagKey: { _count: { gte: 10 } } },
    });
    const countMap = new Map(workTagCounts.map(wt => [wt.tagKey, wt._count.tagKey]));

    const grouped: Record<string, Array<{ tagKey: string; displayName: string; count: number }>> = {};
    for (const cat of RECOMMEND_TAG_CATEGORIES) {
      grouped[cat] = [];
    }
    grouped['other'] = [];

    for (const tag of tags) {
      const count = countMap.get(tag.tagKey);
      if (!count || count < 10) continue;
      const cat = (tag.category && RECOMMEND_TAG_CATEGORIES.includes(tag.category as typeof RECOMMEND_TAG_CATEGORIES[number]))
        ? tag.category
        : 'other';
      grouped[cat].push({
        tagKey: tag.tagKey,
        displayName: tag.displayName,
        count,
      });
    }

    for (const cat of Object.keys(grouped)) {
      grouped[cat].sort((a, b) => b.count - a.count);
      grouped[cat] = grouped[cat].slice(0, 20);
    }

    return NextResponse.json({ success: true, tags: grouped });
  } catch (error) {
    console.error('Error in /api/recommend GET:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensurePrismaConnected();

    const body = await request.json();
    const selectedTagKeys: string[] = body.tagKeys || [];

    if (selectedTagKeys.length === 0) {
      return NextResponse.json({ error: 'タグを1つ以上選択してください' }, { status: 400 });
    }

    const works = await prisma.work.findMany({
      where: {
        gameRegistered: true,
        needsReview: false,
        workTags: {
          some: {
            tagKey: { in: selectedTagKeys },
          },
        },
      },
      select: {
        workId: true,
        title: true,
        authorName: true,
        productUrl: true,
        thumbnailUrl: true,
        reviewAverage: true,
        reviewCount: true,
        popularityBase: true,
        workTags: { select: { tagKey: true } },
      },
    });

    const selectedSet = new Set(selectedTagKeys);
    const scored = works.map(w => {
      const matchedTags = w.workTags.filter(wt => selectedSet.has(wt.tagKey));
      const matchScore = matchedTags.length / selectedTagKeys.length;
      const popularityScore = Math.min(1, (w.popularityBase ?? 0) / 50);
      const reviewScore = w.reviewAverage ? w.reviewAverage / 5 : 0;
      const score = matchScore * 0.6 + popularityScore * 0.25 + reviewScore * 0.15;
      return {
        workId: w.workId,
        title: w.title,
        authorName: w.authorName,
        productUrl: w.productUrl,
        thumbnailUrl: w.thumbnailUrl,
        reviewAverage: w.reviewAverage,
        reviewCount: w.reviewCount,
        matchedTagCount: matchedTags.length,
        totalSelectedTags: selectedTagKeys.length,
        matchRate: Math.round(matchScore * 100),
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const popular = scored.filter(w => (w.matchRate ?? 0) >= 50).slice(0, 10);
    const hidden = scored
      .filter(w => (w.matchRate ?? 0) >= 30 && !popular.some(p => p.workId === w.workId))
      .sort((a, b) => (b.reviewAverage ?? 0) - (a.reviewAverage ?? 0))
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      popular,
      hidden,
      totalMatched: scored.length,
    });
  } catch (error) {
    console.error('Error in /api/recommend POST:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
