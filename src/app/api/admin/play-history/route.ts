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
    /** resultWorkId が指す作品の gameRegistered（検索リザーブ判別用） */
    resultWorkGameRegistered: boolean | null;
    submittedTitleText: string | null;
    sessionStartedAt: string | null;
    clickedFanza: boolean;
    /** FAIL_LIST 時の候補スナップショット（JSON オブジェクト） */
    failListContext: unknown | null;
    visitorId: string | null;
    /** referrer / landing / utm の JSON 文字列（なければ null） */
    trafficAttributionJson: string | null;
    hasRecommendPlay: boolean;
    /** 同じ visitorId で観測されているプレイの総数（本人含む）。未観測なら null */
    visitorPlayCount: number | null;
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
    const outcome = searchParams.get('outcome') ?? undefined; // SUCCESS | FAIL_LIST | ALMOST_SUCCESS | NOT_IN_LIST | ABANDONED
    // createdAtFrom: ISO8601 / "YYYY-MM-DDTHH:mm" 形式の文字列。指定以降の履歴のみ返す
    const createdAtFromRaw = searchParams.get('createdAtFrom');
    const createdAtFrom = (() => {
      if (!createdAtFromRaw) return null;
      const d = new Date(createdAtFromRaw);
      return Number.isFinite(d.getTime()) ? d : null;
    })();

    const where: Record<string, unknown> = {};
    if (outcome) where.outcome = outcome;
    if (createdAtFrom) where.createdAt = { gte: createdAtFrom };

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
    const workRows =
      workIds.length > 0
        ? await prisma.work.findMany({
            where: { workId: { in: workIds } },
            select: { workId: true, title: true, gameRegistered: true },
          })
        : [];
    const titleByWorkId = Object.fromEntries(workRows.map((w) => [w.workId, w.title]));
    const gameRegByWorkId = Object.fromEntries(
      workRows.map((w) => [w.workId, w.gameRegistered ?? null] as const)
    );

    const visitorIds = [...new Set(items.map((r) => r.visitorId).filter(Boolean) as string[])];
    const recPlays = visitorIds.length > 0
      ? await prisma.recommendPlayHistory.findMany({
          where: { visitorId: { in: visitorIds } },
          select: { visitorId: true },
        })
      : [];
    const recVisitorIds = new Set(recPlays.map((r) => r.visitorId).filter(Boolean) as string[]);

    // visitorId ごとの総プレイ数（表示行だけでなく DB 全体で何回プレイしているか）
    const visitorCountRows = visitorIds.length > 0
      ? await prisma.playHistory.groupBy({
          by: ['visitorId'],
          where: { visitorId: { in: visitorIds } },
          _count: { _all: true },
        })
      : [];
    const visitorPlayCountMap = new Map<string, number>();
    for (const r of visitorCountRows) {
      if (r.visitorId) visitorPlayCountMap.set(r.visitorId, r._count._all);
    }

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
        resultWorkGameRegistered:
          row.resultWorkId != null ? (gameRegByWorkId[row.resultWorkId] ?? null) : null,
        submittedTitleText: row.submittedTitleText,
        sessionStartedAt: row.sessionStartedAt?.toISOString() ?? null,
        clickedFanza: row.clickedFanza ?? false,
        failListContext: (() => {
          const raw = row.failListContextJson;
          if (raw == null || raw === '') return null;
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        })(),
        visitorId: row.visitorId ?? null,
        trafficAttributionJson: row.trafficAttributionJson ?? null,
        hasRecommendPlay: row.visitorId ? recVisitorIds.has(row.visitorId) : false,
        visitorPlayCount: row.visitorId ? (visitorPlayCountMap.get(row.visitorId) ?? 1) : null,
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
