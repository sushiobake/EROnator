/**
 * GET /api/config/game-ui: ゲーム画面用の文言・考え中設定（公開API）
 * 認証不要。トップ／AI_GATE でクライアントが取得。
 */

import { NextResponse } from 'next/server';
import { getMvpConfig } from '@/server/config/loader';
import { DEFAULT_GAME_COPY, DEFAULT_THINKING, migrateThinking } from '@/server/config/schema';

export async function GET() {
  try {
    const config = getMvpConfig();
    const gameCopy = { ...DEFAULT_GAME_COPY, ...config.gameCopy };
    const thinking = migrateThinking(config.thinking ?? DEFAULT_THINKING);
    return NextResponse.json({ gameCopy, thinking });
  } catch (error) {
    console.error('Error loading game-ui config:', error);
    return NextResponse.json({
      gameCopy: DEFAULT_GAME_COPY,
      thinking: migrateThinking(DEFAULT_THINKING),
    });
  }
}
