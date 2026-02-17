/**
 * /api/admin/batchTest: バッチテスト実行
 * デバッグモード時のみ利用可能
 */

import { NextRequest, NextResponse } from 'next/server';
import { isDebugAllowed } from '@/server/debug/isDebugAllowed';
import { runBatchTest, type BatchTestConfig } from '@/server/debug/batchTest';
import { ensurePrismaConnected } from '@/server/db/client';
import { ApiError, handleApiError } from '@/server/api/errorHandler';

export async function POST(request: NextRequest) {
  try {
    // デバッグモードチェック
    if (!isDebugAllowed(request)) {
      throw new ApiError(
        403,
        'この機能はデバッグモードでのみ利用できます',
        'Debug mode required'
      );
    }

    await ensurePrismaConnected();

    const body = await request.json();
    const config: BatchTestConfig = {
      numSessions: body.numSessions ?? 10,
      aiGateChoice: body.aiGateChoice ?? 'DONT_CARE',
      maxQuestions: body.maxQuestions,
      randomAnswers: body.randomAnswers ?? false,
    };

    // バリデーション
    if (config.numSessions < 1 || config.numSessions > 100) {
      throw new ApiError(
        400,
        'セッション数は1〜100の範囲で指定してください',
        'numSessions must be between 1 and 100'
      );
    }

    if (!['YES', 'NO', 'DONT_CARE'].includes(config.aiGateChoice)) {
      throw new ApiError(
        400,
        '無効なAIゲート選択です',
        'Invalid aiGateChoice'
      );
    }

    // バッチテスト実行
    const result = await runBatchTest(config);

    // 結果を返す（Mapをオブジェクトに変換）
    return NextResponse.json({
      ...result,
      questionDistribution: Object.fromEntries(result.questionDistribution),
      tagEffectiveness: Object.fromEntries(
        Array.from(result.tagEffectiveness.entries()).map(([tagKey, stats]) => [
          tagKey,
          stats,
        ])
      ),
    });
  } catch (error) {
    console.error('Error in /api/admin/batchTest:', error);
    return handleApiError(error);
  }
}
