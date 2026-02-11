/**
 * /api/admin/play-history: サービスプレイ履歴一覧（管理用）
 * 本番履歴の確認・DB・タグ修正の参照用
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';

export interface PlayHistoryListResponse {
  success: boolean;
  items?: Array<{
    id: string;
    sessionId: string;
    outcome: string;
    questionCount: number;
    questionHistory: unknown;
    aiGateChoice: string | null;
    resultWorkId: string | null;
    resultWorkTitle: string | null;
    submittedTitleText: string | null;
    createdAt: string;
  }>;
  total?: number;
  error?: string;
}

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
    const outcome = searchParams.get('outcome') ?? undefined; // SUCCESS | FAIL_LIST | ALMOST_SUCCESS | NOT_IN_LIST

    const where = outcome ? { outcome } : {};

    const [items, total] = await Promise.all([
      prisma.playHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.playHistory.count({ where }),
    ]);

    const workIds = [...new Set(items.map((r) => r.resultWorkId).filter(Boolean) as string[])];
    const workTitles =
      workIds.length > 0
        ? await prisma.work.findMany({
            where: { workId: { in: workIds } },
            select: { workId: true, title: true },
          })
        : [];
    const titleByWorkId = Object.fromEntries(workTitles.map((w) => [w.workId, w.title]));

    return NextResponse.json({
      success: true,
      items: items.map((row) => ({
        id: row.id,
        sessionId: row.sessionId,
        outcome: row.outcome,
        questionCount: row.questionCount,
        questionHistory: (() => {
          try {
            return JSON.parse(row.questionHistory ?? '[]');
          } catch {
            return [];
          }
        })(),
        aiGateChoice: row.aiGateChoice,
        resultWorkId: row.resultWorkId,
        resultWorkTitle: row.resultWorkId ? (titleByWorkId[row.resultWorkId] ?? null) : null,
        submittedTitleText: row.submittedTitleText,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
    });
  } catch (e) {
    console.error('[admin/play-history]', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
