/**
 * 人力タグ付け: 各タブの作品数を取得
 * GET /api/admin/manual-tagging/works/counts
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

function buildWhere(filter: string): Parameters<typeof prisma.work.count>[0]['where'] {
  const baseWhere = { commentText: { not: null } };

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

export async function GET() {
  try {
    const filters = ['checked', 'pending', 'untagged', 'legacy_ai', 'needs_review'] as const;
    const counts = await Promise.all(
      filters.map((f) => prisma.work.count({ where: buildWhere(f) }))
    );
    const result: Record<string, number> = {};
    filters.forEach((f, i) => {
      result[f] = counts[i];
    });
    return NextResponse.json({ success: true, counts: result });
  } catch (error) {
    console.error('[manual-tagging/works/counts]', error);
    return NextResponse.json({ error: 'Failed to fetch counts' }, { status: 500 });
  }
}
