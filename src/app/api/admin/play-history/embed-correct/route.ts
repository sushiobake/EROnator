/**
 * /api/admin/play-history/embed-correct: 管理画面から正解 workId を事後埋め込み（NOT_IN_LIST / FAIL_LIST のみ）
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { ensurePrismaConnected } from '@/server/db/client';
import { embedPlayHistoryCorrectWorkByAdmin } from '@/server/playHistory/savePlayHistory';

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensurePrismaConnected();
    const body = await request.json();
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
    const workId = typeof body.workId === 'string' ? body.workId.trim() : '';
    const searchQuery =
      typeof body.searchQuery === 'string' ? body.searchQuery : body.searchQuery == null ? '' : String(body.searchQuery);

    if (!sessionId || !workId) {
      return NextResponse.json(
        { success: false, error: 'sessionId と workId が必要です' },
        { status: 400 }
      );
    }

    const result = await embedPlayHistoryCorrectWorkByAdmin(sessionId, workId, { searchQuery });
    if (!result.ok) {
      const status =
        result.code === 'NOT_FOUND'
          ? 404
          : result.code === 'WORK_NOT_FOUND'
            ? 404
            : result.code === 'ALREADY_SET' || result.code === 'INVALID_OUTCOME'
              ? 409
              : 400;
      return NextResponse.json({ success: false, error: result.error, code: result.code }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[admin/play-history/embed-correct]', e);
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
