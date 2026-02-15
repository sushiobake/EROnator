/**
 * 人力タグ付け: 作品一覧取得（フォルダのみで判定）
 * GET ?filter=tagged|needs_human_check|pending|untagged|legacy_ai|needs_review&limit=50&offset=0
 * SQLite のときは better-sqlite3 で dev.db を直接読んで確実に反映。それ以外は Prisma raw SQL。
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { isSqlite, getWorksFromSqlite } from '@/server/db/sqlite-direct';

const FOLDERS = ['tagged', 'needs_human_check', 'pending', 'untagged', 'legacy_ai', 'needs_review'] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'tagged';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!FOLDERS.includes(filter as (typeof FOLDERS)[number])) {
      return NextResponse.json({ error: 'Invalid filter' }, { status: 400 });
    }

    if (isSqlite()) {
      const { total, works } = getWorksFromSqlite(filter as (typeof FOLDERS)[number], limit, offset);
      return NextResponse.json({ success: true, works, total });
    }

    const totalRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      'SELECT COUNT(*) as count FROM Work WHERE commentText IS NOT NULL AND manualTaggingFolder = $1',
      filter
    );
    const total = totalRows[0]?.count ?? 0;

    let works: Array<{ workId: string; title: string; authorName: string; taggedAt?: string | null }>;

    if (filter === 'pending') {
      const rows = await prisma.$queryRawUnsafe<Array<{ workId: string; title: string; authorName: string }>>(
        `SELECT workId, title, authorName FROM Work
         WHERE commentText IS NOT NULL AND manualTaggingFolder = 'pending'
         ORDER BY checkQueueAt DESC NULLS LAST, updatedAt DESC
         LIMIT $1 OFFSET $2`,
        limit,
        offset
      );
      works = rows;
    } else if (filter === 'tagged') {
      const rows = await prisma.$queryRawUnsafe<
        Array<{ workId: string; title: string; authorName: string; taggedAt: string | null }>
      >(
        `SELECT workId, title, authorName, "taggedAt" FROM "Work"
         WHERE commentText IS NOT NULL AND "manualTaggingFolder" = 'tagged'
         ORDER BY COALESCE("taggedAt", "updatedAt") DESC
         LIMIT $1 OFFSET $2`,
        limit,
        offset
      );
      works = rows;
    } else {
      const rows = await prisma.$queryRawUnsafe<Array<{ workId: string; title: string; authorName: string }>>(
        'SELECT workId, title, authorName FROM Work WHERE commentText IS NOT NULL AND manualTaggingFolder = $1 ORDER BY updatedAt DESC LIMIT $2 OFFSET $3',
        filter,
        limit,
        offset
      );
      works = rows;
    }

    return NextResponse.json({
      success: true,
      works: works.map((w) => ({
        workId: w.workId,
        title: w.title,
        authorName: w.authorName,
        ...(w.taggedAt !== undefined && { taggedAt: w.taggedAt }),
      })),
      total,
    });
  } catch (error) {
    console.error('[manual-tagging/works]', error);
    return NextResponse.json({ error: 'Failed to fetch works' }, { status: 500 });
  }
}
