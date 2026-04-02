import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { getMvpConfig } from '@/server/config/loader';

export async function GET(request: NextRequest) {
  try {
    await ensurePrismaConnected();
    const { searchParams } = new URL(request.url);
    const rawQ = (searchParams.get('q') ?? '').trim();
    const config = getMvpConfig();
    const defaultLimit = config.failHub?.searchLimitDefault ?? 10;
    const maxLimit = config.failHub?.searchLimitMax ?? 20;
    const parsedLimit = Number(searchParams.get('limit') ?? defaultLimit);
    const limit = Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(maxLimit, Math.floor(parsedLimit)))
      : defaultLimit;

    if (!rawQ) {
      return NextResponse.json({ works: [] });
    }

    const works = await prisma.work.findMany({
      where: {
        title: { contains: rawQ },
      },
      select: {
        workId: true,
        title: true,
        authorName: true,
        thumbnailUrl: true,
        gameRegistered: true,
      },
      orderBy: [
        { gameRegistered: 'desc' },
        { updatedAt: 'desc' },
      ],
      take: limit,
    });

    return NextResponse.json({
      works: works.map((w) => ({
        workId: w.workId,
        title: w.title,
        authorName: w.authorName,
        thumbnailUrl: w.thumbnailUrl,
        source: w.gameRegistered ? 'active' : 'reserve',
      })),
    });
  } catch (error) {
    console.error('Error in /api/works/search GET:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

