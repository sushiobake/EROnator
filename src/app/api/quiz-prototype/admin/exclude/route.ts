/**
 * F@NZA王クイズ プロトタイプ 管理API: 作品除外 / 復帰
 * POST body: { workId: string, action: 'exclude' | 'include' }
 */
import { NextResponse } from 'next/server';
import {
  addExclusion,
  removeExclusion,
  readExclusion,
} from '@/quiz-prototype/pool/exclusionStore';
import { clearQuizPoolCache } from '@/quiz-prototype/pool/selectWorks';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { workId?: unknown; action?: unknown };
    const workId = typeof body.workId === 'string' ? body.workId.trim() : '';
    const action = body.action === 'exclude' || body.action === 'include' ? body.action : null;
    if (!workId || !action) {
      return NextResponse.json(
        { error: 'BadRequest', message: 'workId と action (exclude|include) が必要です' },
        { status: 400 },
      );
    }

    const set = action === 'exclude' ? await addExclusion(workId) : await removeExclusion(workId);
    clearQuizPoolCache();

    return NextResponse.json({ excluded: [...set].sort(), action, workId });
  } catch (e) {
    console.error('[quiz-prototype/admin/exclude]', e);
    return NextResponse.json(
      { error: 'Internal error', message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function GET() {
  const set = await readExclusion();
  return NextResponse.json({ excluded: [...set].sort() });
}
