/**
 * 作品頭文字チェック・編集 API
 * GET: 漢字始まりの作品一覧（50音順、1000件/ページ）
 * 対象: コメント取得済み OR ゲーム使用（phase0通過）の作品
 * PATCH: 頭文字を1件更新
 * POST: 一括で確認済みにする
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { getTitleCharType } from '@/server/utils/titleCharType';
import { getPrimaryInitial } from '@/server/utils/titleReadingInitial';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';

/** 50音順（カタカナ）のソート用 */
const GOJUON_ORDER = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンー'.split('');

function getSortIndex(c: string | null): number {
  if (!c || c.length === 0) return 9999;
  const idx = GOJUON_ORDER.indexOf(c);
  return idx >= 0 ? idx : 9999;
}

export async function GET(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    await ensurePrismaConnected();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const includeUnconfirmed = searchParams.get('includeUnconfirmed') === '1';
    const includeConfirmed = searchParams.get('includeConfirmed') === '1';
    const limit = 100;
    const offset = (page - 1) * limit;

    const confirmedConditions: Array<{ titleReadingInitialConfirmed: null | boolean }> = [];
    if (includeUnconfirmed) {
      confirmedConditions.push({ titleReadingInitialConfirmed: null });
      confirmedConditions.push({ titleReadingInitialConfirmed: false });
    }
    if (includeConfirmed) {
      confirmedConditions.push({ titleReadingInitialConfirmed: true });
    }

    if (confirmedConditions.length === 0) {
      return NextResponse.json({
        success: true,
        works: [],
        total: 0,
        page: 1,
        totalPages: 1,
      });
    }

    const allWorks = await prisma.work.findMany({
      where: {
        AND: [
          {
            OR: [
              { commentText: { not: null } },
              { gameRegistered: true },
              { manualTaggingFolder: 'tagged' },
            ],
          },
          ...(confirmedConditions.length > 0 ? [{ OR: confirmedConditions }] : []),
        ],
      },
      select: {
        workId: true,
        title: true,
        titleReadingInitial: true,
        titleReadingInitialConfirmed: true,
      },
    });

    const kanjiWorks = allWorks.filter((w) => getTitleCharType(w.title ?? '') === 'KANJI');
    kanjiWorks.sort((a, b) => {
      const ai = getSortIndex(getPrimaryInitial(a.titleReadingInitial));
      const bi = getSortIndex(getPrimaryInitial(b.titleReadingInitial));
      if (ai !== bi) return ai - bi;
      return (a.title ?? '').localeCompare(b.title ?? '');
    });

    const total = kanjiWorks.length;
    const pageWorks = kanjiWorks.slice(offset, offset + limit);

    const works = pageWorks.map((w) => ({
      workId: w.workId,
      title: w.title ?? '',
      titleReadingInitial: w.titleReadingInitial ?? '',
      titleReadingInitialConfirmed: w.titleReadingInitialConfirmed ?? false,
    }));

    return NextResponse.json({
      success: true,
      works,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error('[title-reading-initial] GET', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    await ensurePrismaConnected();

    const body = await request.json();
    const { workId, titleReadingInitial } = body;

    if (!workId || typeof titleReadingInitial !== 'string') {
      return NextResponse.json({ error: 'workId and titleReadingInitial required' }, { status: 400 });
    }

    const parts = titleReadingInitial
      .trim()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length < 1 || parts.length > 2) {
      return NextResponse.json({ error: 'titleReadingInitial: 1〜2文字まで（カンマ区切り可）' }, { status: 400 });
    }
    if (parts.some((p) => p.length !== 1)) {
      return NextResponse.json({ error: '各文字は1文字であること' }, { status: 400 });
    }
    const toSave = parts.join(',');

    await prisma.work.update({
      where: { workId },
      data: { titleReadingInitial: toSave, updatedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[title-reading-initial] PATCH', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    await ensurePrismaConnected();

    const body = await request.json();
    const { workIds } = body;

    if (!Array.isArray(workIds) || workIds.length === 0) {
      return NextResponse.json({ error: 'workIds array required' }, { status: 400 });
    }

    const result = await prisma.work.updateMany({
      where: { workId: { in: workIds } },
      data: { titleReadingInitialConfirmed: true, updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error('[title-reading-initial] POST', error);
    return NextResponse.json({ error: 'Failed to confirm' }, { status: 500 });
  }
}
