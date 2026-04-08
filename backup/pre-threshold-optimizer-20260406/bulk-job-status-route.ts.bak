/**
 * バックグラウンド一括処理の進捗取得
 * GET /api/admin/bulk-job-status
 * 実行中 / 完了結果 / 予約キュー / キャンセル状態 を一括返却
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { readBulkProgress, readLastCompleted, getQueuedJob, getCancelState, getSimProgress } from '@/server/bulk/progressStore';

export async function GET(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const progress = readBulkProgress();
  const lastCompleted = readLastCompleted();
  const queue = getQueuedJob();
  const cancelState = getCancelState();
  const simProgress = getSimProgress();

  const base = {
    lastCompleted,
    queue,
    cancelState,
    simProgress: simProgress ?? null,
  };

  if (progress) {
    return NextResponse.json({
      status: progress.status,
      progress,
      phases: progress.phases ?? null,
      ...base,
    });
  }

  return NextResponse.json({
    status: 'idle',
    progress: null,
    phases: null,
    ...base,
  });
}
