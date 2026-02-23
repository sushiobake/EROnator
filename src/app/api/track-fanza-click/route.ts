/**
 * /api/track-fanza-click: FANZAで見るリンクのクリックを記録
 * 成功・失敗画面のおすすめからFANZAへ遷移したときに呼ばれる
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensurePrismaConnected } from '@/server/db/client';
import { updatePlayHistoryClickedFanza } from '@/server/playHistory/savePlayHistory';

export async function POST(request: NextRequest) {
  try {
    await ensurePrismaConnected();

    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : null;

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'sessionId required' }, { status: 400 });
    }

    await updatePlayHistoryClickedFanza(sessionId);
    return NextResponse.json({ success: true });
  } catch (e) {
    // レコードが存在しない等は静かに失敗（404など返さず success: false）
    console.error('[track-fanza-click]', e);
    return NextResponse.json({ success: false }, { status: 200 });
  }
}
