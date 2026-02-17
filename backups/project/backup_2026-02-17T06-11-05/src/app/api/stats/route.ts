/**
 * 公開用統計API（トップ画面の作品数表示など）
 * 認証不要
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

export async function GET() {
  try {
    let gameRegisteredCount = 0;
    try {
      gameRegisteredCount = await prisma.work.count({
        where: { gameRegistered: true, needsReview: false },
      });
    } catch {
      // gameRegistered 列が無いDBでは 0
    }

    return NextResponse.json({
      gameRegisteredCount,
    });
  } catch (error) {
    console.error('[api/stats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
