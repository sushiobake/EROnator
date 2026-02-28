/**
 * /api/admin/tags/analyze: AI分析API
 * 選択した作品のコメントからタグを抽出
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { getAiPromptConfig } from '@/config/aiPrompt';
import { analyzeWithOpenAi } from '@/server/ai/cloudflareAi';

export interface AnalyzeRequest {
  works: Array<{
    workId: string;
    title: string;
    commentText: string;
  }>;
}

export interface AnalyzeResponse {
  success: boolean;
  results?: Array<{
    workId: string;
    derivedTags: Array<{
      displayName: string;
      confidence: number;
      category: string | null;
    }>;
    characterTags: string[];
  }>;
  error?: string;
}

/**
 * AI分析を実行（GPT のみ）
 */
async function analyzeWork(work: { workId: string; title: string; commentText: string }): Promise<{
  derivedTags: Array<{ displayName: string; confidence: number; category: string | null }>;
  characterTags: string[];
}> {
  const promptConfig = getAiPromptConfig();
  try {
    const result = await analyzeWithOpenAi(work.commentText, promptConfig.systemPrompt);
    return result;
  } catch (error) {
    console.error(`[analyze] Error analyzing work ${work.workId}:`, error);
    console.error(`[analyze] Error details:`, error instanceof Error ? error.stack : String(error));
    // エラー時は空の結果を返す（処理を続行）
    return {
      derivedTags: [],
      characterTags: [],
    };
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  try {
    const body: AnalyzeRequest = await request.json();
    const { works } = body;

    if (!works || !Array.isArray(works) || works.length === 0) {
      return NextResponse.json(
        { error: 'works array is required' },
        { status: 400 }
      );
    }

    // バッチ処理（5作品ずつ）
    const BATCH_SIZE = 5;
    const results: AnalyzeResponse['results'] = [];

    for (let i = 0; i < works.length; i += BATCH_SIZE) {
      const batch = works.slice(i, i + BATCH_SIZE);
      // バッチごとに分析実行
      const batchResults = await Promise.all(
        batch.map(work => analyzeWork(work))
      );

      // 結果をマージ
      for (let j = 0; j < batch.length; j++) {
        results.push({
          workId: batch[j].workId,
          ...batchResults[j],
        });
      }

      // レート制限対応（1秒待機）
      if (i + BATCH_SIZE < works.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('[analyze] Error analyzing works:', error);
    console.error('[analyze] Error stack:', error instanceof Error ? error.stack : String(error));
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
