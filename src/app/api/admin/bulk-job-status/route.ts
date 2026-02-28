/**
 * バックグラウンド一括処理の進捗取得
 * GET /api/admin/bulk-job-status
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { readBulkProgress } from '@/server/bulk/progressStore';

export async function GET(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const progress = readBulkProgress();
  if (!progress) {
    return NextResponse.json({ status: 'idle', progress: null });
  }
  return NextResponse.json({
    status: progress.status,
    progress,
    phases: progress.phases ?? null,
  });
}
