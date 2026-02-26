/**
 * 人力タグ付け: 各フォルダの作品数（1作品＝1フォルダ）
 * GET /api/admin/manual-tagging/works/counts
 * Prisma のみ使用（sqlite-direct 廃止で二重アクセスを解消）
 */

import { NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/server/db/client';

const FOLDERS = ['tagged', 'needs_human_check', 'has_issues', 'pending', 'untagged', 'legacy_ai', 'needs_review'] as const;

export async function GET() {
  try {
    await ensurePrismaConnected();

    const rows = await prisma.work.groupBy({
      by: ['manualTaggingFolder'],
      where: {
        commentText: { not: null },
        manualTaggingFolder: { not: null },
      },
      _count: { id: true },
    });

    const result: Record<string, number> = Object.fromEntries(FOLDERS.map((f) => [f, 0]));
    for (const r of rows) {
      if (r.manualTaggingFolder && FOLDERS.includes(r.manualTaggingFolder as (typeof FOLDERS)[number])) {
        result[r.manualTaggingFolder] = r._count.id;
      }
    }
    return NextResponse.json({ success: true, counts: result });
  } catch (error) {
    console.error('[manual-tagging/works/counts]', error);
    return NextResponse.json({ error: 'Failed to fetch counts' }, { status: 500 });
  }
}
