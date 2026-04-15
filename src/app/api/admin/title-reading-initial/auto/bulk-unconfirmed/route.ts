/**
 * 未確認かつ漢字始まりの作品を DB 上すべて走査（workId カーソル）、自動判定して更新。
 * 反映できたもの（low / スキップ以外）は titleReadingInitialConfirmed を true にする（confirmNonRed、既定 true）。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { computeAutoTitleReadingInitials } from '@/server/utils/autoTitleReadingInitial';
import { getTitleCharType } from '@/server/utils/titleCharType';

/** Rows fetched per request (cursor advances by fetch, not by kanji-only). */
const DB_FETCH = 500;
/** Sudachi batch size (align with /auto single POST limit). */
const COMPUTE_CHUNK = 150;

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensurePrismaConnected();
    const body = (await request.json().catch(() => ({}))) as {
      cursor?: unknown;
      confirmNonRed?: unknown;
    };
    const cursor =
      typeof body.cursor === 'string' && body.cursor.length > 0 ? body.cursor : null;
    const confirmNonRed = body.confirmNonRed !== false;

    const rows = await prisma.work.findMany({
      where: {
        gameRegistered: true,
        OR: [
          { titleReadingInitialConfirmed: null },
          { titleReadingInitialConfirmed: false },
        ],
        ...(cursor ? { workId: { gt: cursor } } : {}),
      },
      orderBy: { workId: 'asc' },
      take: DB_FETCH,
      select: { workId: true, title: true },
    });

    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        done: true,
        nextCursor: null,
        fetchedInBatch: 0,
        kanjiExamined: 0,
        updated: 0,
        confirmed: 0,
        skipped: 0,
        lowOnly: 0,
      });
    }

    const lastCursor = rows[rows.length - 1]!.workId;
    const kanjiRows = rows.filter((w) => getTitleCharType(w.title ?? '') === 'KANJI');
    const ids = kanjiRows.map((w) => w.workId);

    let updated = 0;
    let confirmed = 0;
    let skipped = 0;
    let lowOnly = 0;
    const now = new Date();

    for (let i = 0; i < ids.length; i += COMPUTE_CHUNK) {
      const chunk = ids.slice(i, i + COMPUTE_CHUNK);
      const computed = await computeAutoTitleReadingInitials(prisma, chunk);

      for (const row of computed) {
        if (!row.titleReadingInitial) {
          if (row.confidence === 'low') {
            lowOnly += 1;
          } else {
            skipped += 1;
          }
          continue;
        }

        await prisma.work.update({
          where: { workId: row.workId },
          data: {
            titleReadingInitial: row.titleReadingInitial,
            ...(confirmNonRed ? { titleReadingInitialConfirmed: true } : {}),
            updatedAt: now,
          },
        });
        updated += 1;
        if (confirmNonRed) {
          confirmed += 1;
        }
      }
    }

    const done = rows.length < DB_FETCH;

    return NextResponse.json({
      success: true,
      done,
      nextCursor: done ? null : lastCursor,
      fetchedInBatch: rows.length,
      kanjiExamined: ids.length,
      updated,
      confirmed,
      skipped,
      lowOnly,
    });
  } catch (error) {
    console.error('[title-reading-initial/auto/bulk-unconfirmed] POST', error);
    return NextResponse.json({ error: 'Failed bulk auto-fill' }, { status: 500 });
  }
}
