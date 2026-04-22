import { NextRequest, NextResponse } from 'next/server';
import { getRecentSuccesses } from '@/server/playHistory/getRecentSuccesses';

function parseLimit(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseLimit(searchParams.get('limit'));
    const result = await getRecentSuccesses({ limit });

    return NextResponse.json(
      { items: result.items },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (error) {
    console.error('[api/recent-successes] unexpected error:', error);
    return NextResponse.json(
      { items: [] },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  }
}
