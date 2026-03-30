/**
 * POST /api/recommend/play-history — 推薦モード完了時にクライアントから履歴を1件保存
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensurePrismaConnected } from '@/server/db/client';
import { createRecommendPlayHistory } from '@/server/recommendPlayHistory/saveRecommendPlayHistory';

export async function POST(request: NextRequest) {
  try {
    await ensurePrismaConnected();
    const body = await request.json().catch(() => ({}));

    const recommendSessionId =
      typeof body.recommendSessionId === 'string' && body.recommendSessionId.length > 0
        ? body.recommendSessionId.slice(0, 128)
        : null;

    if (!recommendSessionId) {
      return NextResponse.json({ success: false, error: 'recommendSessionId required' }, { status: 400 });
    }

    const detailRaw = body.detail;
    let detailJson: string;
    if (typeof detailRaw === 'string') {
      detailJson = detailRaw;
    } else if (detailRaw != null && typeof detailRaw === 'object') {
      detailJson = JSON.stringify(detailRaw);
    } else {
      return NextResponse.json({ success: false, error: 'detail required' }, { status: 400 });
    }

    const sessionStartedIso =
      typeof body.sessionStartedAt === 'string' ? body.sessionStartedAt : null;
    const sessionStartedAt = sessionStartedIso ? new Date(sessionStartedIso) : null;
    if (sessionStartedAt && Number.isNaN(sessionStartedAt.getTime())) {
      return NextResponse.json({ success: false, error: 'invalid sessionStartedAt' }, { status: 400 });
    }

    const topWorkId =
      typeof body.topWorkId === 'string' && body.topWorkId.length > 0 ? body.topWorkId.slice(0, 128) : null;
    const topWorkTitle =
      typeof body.topWorkTitle === 'string' ? body.topWorkTitle.slice(0, 512) : null;

    const visitorId =
      typeof body.visitorId === 'string' && body.visitorId.length > 0
        ? body.visitorId.slice(0, 128)
        : null;

    await createRecommendPlayHistory({
      recommendSessionId,
      sessionStartedAt,
      detailJson,
      topWorkId,
      topWorkTitle,
      visitorId,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg.includes('Unique constraint') || msg.includes('unique constraint')) {
      return NextResponse.json({ success: false, error: 'duplicate' }, { status: 409 });
    }
    console.error('[recommend/play-history]', e);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
