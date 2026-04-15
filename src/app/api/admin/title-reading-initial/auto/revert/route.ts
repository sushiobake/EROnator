/**
 * Restore titleReadingInitial after a prior /auto run (same admin auth).
 * Client sends entries: [{ workId, titleReadingInitial }] with previous values.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';

const MAX_ENTRIES = 150;

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensurePrismaConnected();
    const body = await request.json();
    const { entries } = body as {
      entries?: Array<{ workId?: string; titleReadingInitial?: string | null }>;
    };

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: 'entries array required' }, { status: 400 });
    }

    const slice = entries.slice(0, MAX_ENTRIES);
    const now = new Date();
    let restored = 0;

    for (const e of slice) {
      if (!e.workId || typeof e.workId !== 'string') continue;
      const v = e.titleReadingInitial;
      if (v != null && typeof v !== 'string') continue;

      await prisma.work.update({
        where: { workId: e.workId },
        data: {
          titleReadingInitial: v === null || v === '' ? null : v,
          updatedAt: now,
        },
      });
      restored += 1;
    }

    return NextResponse.json({ success: true, restored });
  } catch (error) {
    console.error('[title-reading-initial/auto/revert] POST', error);
    return NextResponse.json({ error: 'Failed to revert' }, { status: 500 });
  }
}
