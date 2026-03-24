/**
 * GET /api/admin/recommend-play-history — 推薦プレイ履歴一覧（管理用）
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';

export async function GET(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensurePrismaConnected();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') ?? '50', 10)));
    const offset = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.recommendPlayHistory.findMany({
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.recommendPlayHistory.count(),
    ]);

    return NextResponse.json({
      success: true,
      items: items.map((row) => ({
        id: row.id,
        recommendSessionId: row.recommendSessionId,
        sessionStartedAt: row.sessionStartedAt?.toISOString() ?? null,
        clickedFanza: row.clickedFanza ?? false,
        detailJson: (() => {
          try {
            return JSON.parse(row.detailJson ?? '{}');
          } catch {
            return {};
          }
        })(),
        topWorkId: row.topWorkId,
        topWorkTitle: row.topWorkTitle,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
    });
  } catch (e) {
    console.error('[admin/recommend-play-history]', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
