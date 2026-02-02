/**
 * 人力タグ付け: 作品一覧取得
 * GET ?filter=checked|pending|untagged|legacy_ai&limit=50&offset=0
 * - checked: チェック済み（人間チェック済み or 旧 tagSource=human）
 * - pending: チェック待ち（AI分析済み・未チェック）
 * - untagged: 未タグ（準有名タグなし）
 * - legacy_ai: 旧AIタグ（従来AIでタグあり・未チェック）
 * - needs_review: 要注意⚠️（隔離・ゲームに使用しない）
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

function buildWhere(filter: string): Parameters<typeof prisma.work.findMany>[0]['where'] {
  const baseWhere: Parameters<typeof prisma.work.findMany>[0]['where'] = { commentText: { not: null } };

  // 要注意⚠️＝隔離。needsReview=true の作品はこのタブにのみ表示し、他タブには出さない
  if (filter === 'needs_review') {
    return { ...baseWhere, needsReview: true };
  }

  const notFlagged = { ...baseWhere, needsReview: false };

  if (filter === 'checked') {
    return { ...notFlagged, OR: [{ humanChecked: true }, { tagSource: 'human' }] };
  }
  if (filter === 'pending') {
    return {
      ...notFlagged,
      aiAnalyzed: true,
      humanChecked: false,
      NOT: { tagSource: 'human' },
    };
  }
  if (filter === 'untagged') {
    // 人間チェック済みはチェック済みタブにのみ表示（未タグには出さない）
    return {
      ...notFlagged,
      humanChecked: false,
      NOT: { workTags: { some: { tag: { tagType: 'DERIVED' } } } },
    };
  }
  if (filter === 'legacy_ai') {
    return {
      ...notFlagged,
      workTags: { some: { tag: { tagType: 'DERIVED' } } },
      aiAnalyzed: false,
      humanChecked: false,
    };
  }
  return notFlagged;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'checked';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const where = buildWhere(filter);

    const [works, total] = await Promise.all([
      prisma.work.findMany({
        where,
        select: {
          workId: true,
          title: true,
          authorName: true,
          needsReview: true,
          tagSource: true,
          aiAnalyzed: true,
          humanChecked: true,
          workTags: {
            select: {
              tag: { select: { tagType: true } },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.work.count({ where }),
    ]);

    const list = works.map((w) => {
      const hasDerived = w.workTags.some((wt) => wt.tag.tagType === 'DERIVED');
      const source =
        w.tagSource === 'human' ? 'human' : w.tagSource === 'ai' ? 'ai' : hasDerived ? 'ai' : 'untagged';
      return {
        workId: w.workId,
        title: w.title,
        authorName: w.authorName,
        needsReview: w.needsReview,
        tagSource: source,
        aiAnalyzed: (w as { aiAnalyzed?: boolean }).aiAnalyzed ?? false,
        humanChecked: (w as { humanChecked?: boolean }).humanChecked ?? false,
      };
    });

    return NextResponse.json({ success: true, works: list, total });
  } catch (error) {
    console.error('[manual-tagging/works]', error);
    return NextResponse.json({ error: 'Failed to fetch works' }, { status: 500 });
  }
}
