/**
 * /api/admin/tags/parse: ファイルパースAPI
 * works_A.txt / works_C.txt をパースして作品データを返す
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { parseWorksFile } from '@/server/admin/parseWorksFile';
import { prisma, ensurePrismaConnected } from '@/server/db/client';

export async function POST(request: NextRequest) {
  // アクセス制御
  if (!isAdminAllowed(request)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  try {
    await ensurePrismaConnected();

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mode = formData.get('mode') as string; // 'full' | 'append'

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    // ファイル内容を読み込み
    const content = await file.text();
    
    // パース
    const parsedWorks = parseWorksFile(content);

    if (parsedWorks.length === 0) {
      return NextResponse.json(
        { error: 'No works found in file' },
        { status: 400 }
      );
    }

    // 重複チェック（既存DBと照合）
    const workIds = parsedWorks.map(w => w.workId);
    const existingWorks = await prisma.work.findMany({
      where: {
        workId: { in: workIds },
      },
      select: {
        workId: true,
        title: true,
        authorName: true,
      },
    });

    const existingWorkIds = new Set(existingWorks.map(w => w.workId));

    // 重複情報を付与
    const worksWithStatus = parsedWorks.map(work => ({
      ...work,
      isDuplicate: existingWorkIds.has(work.workId),
      existingTitle: existingWorks.find(w => w.workId === work.workId)?.title || null,
    }));

    return NextResponse.json({
      success: true,
      mode,
      works: worksWithStatus,
      stats: {
        total: parsedWorks.length,
        new: parsedWorks.length - existingWorkIds.size,
        duplicate: existingWorkIds.size,
      },
    });
  } catch (error) {
    console.error('Error parsing works file:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
