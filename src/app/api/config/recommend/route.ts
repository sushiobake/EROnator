/**
 * GET /api/config/recommend: 推薦モード用の文言（公開API）
 * 認証不要。推薦画面でクライアントが取得。
 */

import { NextResponse } from 'next/server';
import { loadMvpConfig } from '@/server/config/loader';
import { DEFAULT_RECOMMEND_COPY } from '@/server/config/schema';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    /** シングルトンは起動時のまま古くなり得るため、推薦文言だけ毎回ファイルから読む */
    const config = loadMvpConfig();
    const recommendCopy = { ...DEFAULT_RECOMMEND_COPY, ...config.recommendCopy };
    return NextResponse.json({ recommendCopy });
  } catch (error) {
    console.error('Error loading recommend config:', error);
    return NextResponse.json({
      recommendCopy: DEFAULT_RECOMMEND_COPY,
    });
  }
}
