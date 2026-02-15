/**
 * 人力タグ付け: 各フォルダの作品数（1作品＝1フォルダ）
 * GET /api/admin/manual-tagging/works/counts
 * SQLite のときは better-sqlite3 で dev.db を直接読んで確実に反映。それ以外は Prisma raw SQL。
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { isSqlite, getCountsFromSqlite } from '@/server/db/sqlite-direct';

const FOLDERS = ['tagged', 'needs_human_check', 'pending', 'untagged', 'legacy_ai', 'needs_review'] as const;

export async function GET() {
  try {
    if (isSqlite()) {
      const counts = getCountsFromSqlite();
      return NextResponse.json({ success: true, counts });
    }

    const countValues = await Promise.all(
      FOLDERS.map(async (folder) => {
        const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
          'SELECT COUNT(*) as count FROM Work WHERE commentText IS NOT NULL AND manualTaggingFolder = $1',
          folder
        );
        return rows[0]?.count ?? 0;
      })
    );
    const result: Record<string, number> = {};
    FOLDERS.forEach((f, i) => {
      result[f] = countValues[i];
    });
    return NextResponse.json({ success: true, counts: result });
  } catch (error) {
    console.error('[manual-tagging/works/counts]', error);
    return NextResponse.json({ error: 'Failed to fetch counts' }, { status: 500 });
  }
}
