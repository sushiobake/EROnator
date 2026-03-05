/**
 * ジョブ予約API
 * POST /api/admin/bulk-job-queue  body: { count: number }
 * DELETE /api/admin/bulk-job-queue  (予約キャンセル)
 * GET /api/admin/bulk-job-queue  (予約状態取得)
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { queueNextJob, getQueuedJob, clearQueue, readBulkProgress } from '@/server/bulk/progressStore';

export async function GET(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const queue = getQueuedJob();
  const running = readBulkProgress();
  return NextResponse.json({ queue, isRunning: !!running && running.status === 'running' });
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const count = Math.max(100, Math.min(5000, Math.floor(Number(body.count) || 100)));

  const result = queueNextJob(count);
  return NextResponse.json(result);
}

export async function DELETE(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  clearQueue();
  return NextResponse.json({ success: true, message: '予約をキャンセルしました' });
}
