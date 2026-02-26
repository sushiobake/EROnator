/**
 * 人力タグ付け: 作品一覧取得（フォルダのみで判定）
 * GET ?filter=tagged|needs_human_check|pending|untagged|legacy_ai|needs_review&limit=50&offset=0
 * Prisma のみ使用（sqlite-direct 廃止で二重アクセスを解消）
 */

import { NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/server/db/client';

const FOLDERS = ['tagged', 'needs_human_check', 'has_issues', 'pending', 'untagged', 'legacy_ai', 'needs_review'] as const;

const baseWhere = {
  commentText: { not: null },
};

export async function GET(request: Request) {
  try {
    await ensurePrismaConnected();
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'tagged';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!FOLDERS.includes(filter as (typeof FOLDERS)[number])) {
      return NextResponse.json({ error: 'Invalid filter' }, { status: 400 });
    }

    const where = { ...baseWhere, manualTaggingFolder: filter };

    const [total, rows] = await Promise.all([
      prisma.work.count({ where }),
      prisma.work.findMany({
        where,
        select: { workId: true, title: true, authorName: true, taggedAt: true },
        orderBy:
          filter === 'pending'
            ? [{ checkQueueAt: 'desc' }, { updatedAt: 'desc' }]
            : filter === 'tagged'
              ? [{ taggedAt: 'desc' }, { updatedAt: 'desc' }]
              : [{ updatedAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
    ]);

    const works = rows.map((w) => ({
      workId: w.workId,
      title: w.title,
      authorName: w.authorName,
      ...(w.taggedAt != null && { taggedAt: w.taggedAt }),
    }));

    return NextResponse.json({ success: true, works, total });
  } catch (error) {
    console.error('[manual-tagging/works]', error);
    return NextResponse.json({ error: 'Failed to fetch works' }, { status: 500 });
  }
}
