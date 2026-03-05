/**
 * 一括処理の安全な停止 + 予約キューのクリア
 * POST /api/admin/bulk-job-cancel
 * POST /api/admin/bulk-job-cancel?clearQueue=1  (予約もキャンセル)
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { requestBulkCancel, readBulkProgress, clearQueue, getCancelState } from '@/server/bulk/progressStore';

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const clearQueueParam = request.nextUrl.searchParams.get('clearQueue') === '1';
  if (clearQueueParam) {
    clearQueue();
  }

  const progress = readBulkProgress();
  if (!progress || progress.status !== 'running') {
    return NextResponse.json({
      success: true,
      message: '実行中のジョブがありません。',
      cancelState: getCancelState(),
    });
  }

  requestBulkCancel();
  return NextResponse.json({
    success: true,
    message: '停止要求を送信しました。次の区切りで安全に停止します。',
    cancelState: 'requesting',
  });
}
