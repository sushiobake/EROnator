/**
 * /api/cron/cleanup: 古いセッションの定期削除
 * Vercel Cron から呼び出し。updatedAt が 7 日以上前の Session を削除する。
 * 認証: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/server/db/client';

const RETENTION_DAYS = 7;

function verifyCronAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return false;

  const token = auth.slice(7).trim();
  return token === secret;
}

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Invalid or missing CRON_SECRET' },
      { status: 401 }
    );
  }

  try {
    await ensurePrismaConnected();

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const result = await prisma.session.deleteMany({
      where: {
        updatedAt: { lt: cutoff },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        deletedCount: result.count,
        cutoff: cutoff.toISOString(),
      },
      { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error) {
    console.error('[cron/cleanup] Error:', error);
    return NextResponse.json(
      {
        error: 'Cleanup failed',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}
