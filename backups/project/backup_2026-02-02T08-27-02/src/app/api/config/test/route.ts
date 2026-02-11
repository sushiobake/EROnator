/**
 * Config読み込みテスト用API（開発専用）
 * NODE_ENV !== development では 404
 */

import { getMvpConfig } from '@/server/config/loader';
import { NextResponse } from 'next/server';

export async function GET() {
  // 開発環境のみ許可
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  try {
    const config = getMvpConfig();
    return NextResponse.json({
      success: true,
      version: config.version,
      // 最小限の情報のみ返す（Data exposure policy）
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
