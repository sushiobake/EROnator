/**
 * 準有名タグがない作品を一括で未登録（gameRegistered = false）にするAPI
 * DB全体を対象に、100件ずつではなく一括で実行する
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';

async function ensureGameRegisteredColumn(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Work" ADD COLUMN "gameRegistered" INTEGER NOT NULL DEFAULT 0'
    );
    console.warn('[bulk-unregister-no-derived] Added missing column gameRegistered');
  } catch (alterErr: unknown) {
    const msg = String((alterErr as Error)?.message ?? '');
    if (!msg.includes('duplicate column name')) throw alterErr;
  }
}

export async function POST(request: Request) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensureGameRegisteredColumn();

    // 準有名タグが1つもない作品を未登録にする
    const updated = await prisma.$executeRawUnsafe(
      `UPDATE Work SET "gameRegistered" = 0 WHERE workId NOT IN (
        SELECT wt.workId FROM WorkTag wt
        INNER JOIN Tag t ON wt.tagKey = t.tagKey
        WHERE t.tagType = 'DERIVED'
      )`
    );

    const updatedCount = typeof updated === 'number' ? updated : 0;
    console.log(`[bulk-unregister-no-derived] Set gameRegistered=false for ${updatedCount} works`);

    return NextResponse.json({ success: true, updated: updatedCount });
  } catch (error) {
    console.error('Error bulk-unregister-no-derived:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update' },
      { status: 500 }
    );
  }
}
