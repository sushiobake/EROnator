/**
 * 作品DBの件数API（シミュレーション用）
 * - 全作品数
 * - ゲームに有効な作品数（gameRegistered = true）
 * gameRegistered 列が無いDBでは有効数は 0 として返す
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';

export async function GET(request: Request) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const totalWorks = await prisma.work.count();

    let gameRegisteredCount = 0;
    try {
      gameRegisteredCount = await prisma.work.count({
        where: { gameRegistered: true, needsReview: false },
      });
    } catch {
      // gameRegistered 列が無いDBでは 0
    }

    return NextResponse.json({
      success: true,
      totalWorks,
      gameRegisteredCount,
    });
  } catch (error) {
    console.error('Error fetching works stats:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
