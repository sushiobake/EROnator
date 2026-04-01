/**
 * POST /api/play-history/abandon — 途中離脱時のみ（本番のみ有効）
 * クライアントは sendBeacon 等で sessionId のみ送信。内容はサーバーが Session から読み取る。
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensurePrismaConnected } from '@/server/db/client';
import { recordAbandonedPlayHistory } from '@/server/playHistory/savePlayHistory';

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ success: false, error: 'disabled_outside_production' }, { status: 403 });
  }

  try {
    await ensurePrismaConnected();
    const body = (await request.json().catch(() => ({}))) as { sessionId?: unknown };
    const sessionId =
      typeof body.sessionId === 'string' && body.sessionId.length > 0 ? body.sessionId.slice(0, 128) : null;
    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId required' }, { status: 400 });
    }

    const result = await recordAbandonedPlayHistory(sessionId);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    console.error('[play-history/abandon]', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
