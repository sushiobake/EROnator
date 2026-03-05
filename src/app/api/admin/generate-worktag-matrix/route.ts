/**
 * /api/admin/generate-worktag-matrix: WorkTag 行列を再生成
 *
 * gameRegistered=true, needsReview=false の作品と WorkTag を取得し、
 * data/workTagMatrix.json に出力する。
 * シミュレーション実行前に呼び出すことで行列を最新化できる。
 *
 * 注意: Vercel 等のサーバーレス環境ではファイル書き込みができない場合がある。
 * ローカル開発時のみ有効とするか、環境に応じたエラーハンドリングを検討すること。
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { setWorkTagMatrixDirect } from '@/server/game/workTagMatrixLoader';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const works = await prisma.work.findMany({
      where: { gameRegistered: true, needsReview: false },
      select: { workId: true },
    });

    const workIds = works.map((w) => w.workId);
    if (workIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ゲーム登録済み作品が 0 件です。' },
        { status: 400 }
      );
    }

    const workTags = await prisma.workTag.findMany({
      where: { workId: { in: workIds } },
      select: { workId: true, tagKey: true, derivedConfidence: true },
    });

    const workTagMap: Record<string, Array<{ tagKey: string; derivedConfidence: number | null }>> = {};
    for (const w of workIds) {
      workTagMap[w] = [];
    }
    for (const r of workTags) {
      workTagMap[r.workId].push({
        tagKey: r.tagKey,
        derivedConfidence: r.derivedConfidence ?? null,
      });
    }

    const output = {
      version: 1,
      generatedAt: new Date().toISOString(),
      workCount: workIds.length,
      totalWorkTags: workTags.length,
      workTagMap,
    };

    const outPath = path.join(process.cwd(), 'data', 'workTagMatrix.json');
    const dataDir = path.dirname(outPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(outPath, JSON.stringify(output, null, 0), 'utf-8');

    // メモリキャッシュをクリアし、次回 getWorkTagMatrix でファイルから再読み込みさせる
    setWorkTagMatrixDirect(null);

    return NextResponse.json({
      success: true,
      workCount: workIds.length,
      totalWorkTags: workTags.length,
      message: `行列を再生成しました (${workIds.length} works, ${workTags.length} workTags)`,
    });
  } catch (error) {
    console.error('Error generating worktag matrix:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: msg,
        hint: 'Vercel 等のサーバーレス環境ではファイル書き込みができません。ローカルで npm run generate:worktag-matrix を実行してください。',
      },
      { status: 500 }
    );
  }
}
