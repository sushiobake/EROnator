/**
 * GET /api/config/thinking: 「考え中」表示用の設定を取得（公開API）
 * ゲーム画面で使用。認証不要。
 */

import { NextResponse } from 'next/server';
import { getMvpConfig } from '@/server/config/loader';
import { DEFAULT_THINKING } from '@/server/config/schema';

export async function GET() {
  try {
    const config = getMvpConfig();
    const thinking = config.thinking ?? DEFAULT_THINKING;
    return NextResponse.json(thinking);
  } catch (error) {
    console.error('Error loading thinking config:', error);
    return NextResponse.json(DEFAULT_THINKING);
  }
}
