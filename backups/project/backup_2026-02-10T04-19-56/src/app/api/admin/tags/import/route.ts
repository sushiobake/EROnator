/**
 * /api/admin/tags/import: DBインポートAPI
 * 編集済みの分析結果をDBに直接保存する
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { importWorksToDb, type ImportWorkData } from '@/server/admin/importToDb';
import { ensurePrismaConnected } from '@/server/db/client';

export interface ImportRequest {
  works: Array<{
    workId: string;
    cid: string | null;
    title: string;
    circleName: string;
    productUrl: string;
    thumbnailUrl: string | null;
    reviewAverage: number | null;
    reviewCount: number | null;
    isAi: 'AI' | 'HAND' | 'UNKNOWN';
    scrapedAt: string;
    officialTags: string[];
    derivedTags: Array<{
      displayName: string;
      confidence: number;
      category: string | null;
    }>;
    characterTags: string[];
    metaText?: string;
    commentText?: string;
  }>;
}

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

    const body: ImportRequest = await request.json();
    const { works } = body;

    if (!works || !Array.isArray(works) || works.length === 0) {
      return NextResponse.json(
        { error: 'works array is required' },
        { status: 400 }
      );
    }

    // DBにインポート
    const result = await importWorksToDb(works);

    return NextResponse.json({
      success: result.success,
      stats: result.stats,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Error importing works:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
