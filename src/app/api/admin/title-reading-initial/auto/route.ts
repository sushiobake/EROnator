/**
 * 作品頭文字: 表示中ページなど、指定 workId だけ自動推定して titleReadingInitial を上書き
 * （titleReadingInitialConfirmed は変更しない）
 * confidence が low のときは候補のみ返し DB は更新しない。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { computeAutoTitleReadingInitials } from '@/server/utils/autoTitleReadingInitial';

const MAX_WORK_IDS = 150;

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensurePrismaConnected();
    const body = await request.json();
    const { workIds } = body as { workIds?: unknown };

    if (!Array.isArray(workIds) || workIds.length === 0) {
      return NextResponse.json({ error: 'workIds array required' }, { status: 400 });
    }

    const ids = workIds
      .filter((x): x is string => typeof x === 'string' && x.length > 0)
      .slice(0, MAX_WORK_IDS);

    if (ids.length === 0) {
      return NextResponse.json({ error: 'no valid workIds' }, { status: 400 });
    }

    const computed = await computeAutoTitleReadingInitials(prisma, ids);

    const toApply = computed.filter((r) => r.titleReadingInitial != null && r.confidence !== 'low');
    const previousRows =
      toApply.length > 0
        ? await prisma.work.findMany({
            where: { workId: { in: toApply.map((r) => r.workId) } },
            select: { workId: true, titleReadingInitial: true },
          })
        : [];
    const previousById = new Map(previousRows.map((r) => [r.workId, r.titleReadingInitial]));

    let updated = 0;
    const results: Array<{
      workId: string;
      titleReadingInitial: string | null;
      suggestedTitleReadingInitial: string | null;
      method: string;
      applied: boolean;
      confidence: string;
    }> = [];
    const undoEntries: Array<{ workId: string; titleReadingInitial: string | null }> = [];

    const now = new Date();
    for (const row of computed) {
      const suggested =
        row.confidence === 'low' && row.suggestion ? row.suggestion : null;

      if (!row.titleReadingInitial) {
        results.push({
          workId: row.workId,
          titleReadingInitial: null,
          suggestedTitleReadingInitial: suggested,
          method: row.method,
          applied: false,
          confidence: row.confidence,
        });
        continue;
      }

      const previous = previousById.get(row.workId) ?? null;

      await prisma.work.update({
        where: { workId: row.workId },
        data: { titleReadingInitial: row.titleReadingInitial, updatedAt: now },
      });
      updated += 1;
      undoEntries.push({ workId: row.workId, titleReadingInitial: previous });
      results.push({
        workId: row.workId,
        titleReadingInitial: row.titleReadingInitial,
        suggestedTitleReadingInitial: null,
        method: row.method,
        applied: true,
        confidence: row.confidence,
      });
    }

    const notApplied = results.filter((r) => !r.applied);
    return NextResponse.json({
      success: true,
      updated,
      skipped: notApplied.filter((r) => r.confidence !== 'low').length,
      lowCandidates: notApplied.filter((r) => r.confidence === 'low').length,
      results,
      undoEntries,
    });
  } catch (error) {
    console.error('[title-reading-initial/auto] POST', error);
    return NextResponse.json({ error: 'Failed to auto-fill' }, { status: 500 });
  }
}
