/**
 * Phase 5: 廃止済み
 * 質問テンプレートは Tag.questionText（DB）に移行。
 * 互換のため GET は空オブジェクトを返す。POST は 410 Gone。
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    success: true,
    templates: {},
  });
}

export async function POST() {
  return NextResponse.json(
    { error: 'Deprecated: 質問テンプレートはDB（Tag.questionText）に移行しました。管理画面のタグ編集から更新してください。' },
    { status: 410 }
  );
}
