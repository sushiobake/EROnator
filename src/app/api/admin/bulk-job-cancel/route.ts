/**
 * 一括処理の安全な停止
 * POST /api/admin/bulk-job-cancel
 * 次のチェックポイントで処理を停止します（データ破損なし）
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { requestBulkCancel } from '@/server/bulk/progressStore';

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  requestBulkCancel();
  return NextResponse.json({ success: true, message: '停止要求を送信しました。次の区切りで安全に停止します。' });
}
