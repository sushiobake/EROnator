/**
 * 複数作品チェックの実行履歴一覧
 * GET /api/admin/check-batch-runs?limit=20
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)));
    const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');

    let rows: Array<{ id: string; batchSize: number; resultsJson: string; createdAt: string }> = [];
    try {
      if (isPostgres) {
        const r = await prisma.$queryRawUnsafe<
          Array<{ id: string; batchSize: number; resultsJson: string; createdAt: unknown }>
        >(
          `SELECT id, "batchSize", "resultsJson", "createdAt"::text as "createdAt" FROM "CheckBatchRun" ORDER BY "createdAt" DESC LIMIT $1`,
          limit
        );
        rows = r.map((x) => ({ ...x, createdAt: String(x.createdAt ?? '') }));
      } else {
        const r = await prisma.$queryRawUnsafe<
          Array<{ id: string; batchSize: number; resultsJson: string; createdAt: string }>
        >(
          'SELECT id, batchSize, resultsJson, createdAt FROM CheckBatchRun ORDER BY createdAt DESC LIMIT ?',
          limit
        );
        rows = r;
      }
    } catch (_e) {
      return NextResponse.json({
        success: true,
        runs: [],
      });
    }

    const runs = rows.map((r) => ({
      id: r.id,
      batchSize: r.batchSize,
      resultsJson: r.resultsJson,
      createdAt: r.createdAt,
    }));

    return NextResponse.json({ success: true, runs });
  } catch (error) {
    console.error('[check-batch-runs]', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
