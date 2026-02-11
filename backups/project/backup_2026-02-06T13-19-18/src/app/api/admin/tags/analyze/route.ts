/**
 * /api/admin/tags/analyze: AI分析API
 * 選択した作品のコメントからタグを抽出
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { getAiPromptConfig } from '@/config/aiPrompt';
import { analyzeWithCloudflareAi, analyzeWithHuggingFace } from '@/server/ai/cloudflareAi';

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
 * AI分析を実行
 * Cloudflare Workers AIまたはHugging Face APIを使用
 */
async function analyzeWork(work: { workId: string; title: string; commentText: string }): Promise<{
  derivedTags: Array<{ displayName: string; confidence: number; category: string | null }>;
  characterTags: string[];
}> {
  console.log(`[analyze] Starting analysis for work: ${work.workId}`);
  console.log(`[analyze] Title: ${work.title}`);
  console.log(`[analyze] Comment text length: ${work.commentText.length} chars`);
  
  // プロンプト設定を取得
  const promptConfig = getAiPromptConfig();
  
  // AIサービスを選択（環境変数で制御）
  const aiProvider = process.env.ERONATOR_AI_PROVIDER || 'huggingface'; // 'cloudflare' | 'huggingface'
  console.log(`[analyze] Using AI provider: ${aiProvider}`);
  
  try {
    let result;
    if (aiProvider === 'cloudflare') {
      console.log(`[analyze] Calling Cloudflare AI...`);
      result = await analyzeWithCloudflareAi(work.commentText, promptConfig.systemPrompt);
    } else if (aiProvider === 'huggingface') {
      console.log(`[analyze] Calling Hugging Face API...`);
      result = await analyzeWithHuggingFace(work.commentText, promptConfig.systemPrompt);
    } else {
      console.warn(`[analyze] Unknown AI provider: ${aiProvider}, using Hugging Face as fallback`);
      result = await analyzeWithHuggingFace(work.commentText, promptConfig.systemPrompt);
    }
    
    console.log(`[analyze] Analysis completed for ${work.workId}:`, {
      derivedTagsCount: result.derivedTags.length,
      characterTagsCount: result.characterTags.length,
    });
    
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
  console.log('[analyze] POST /api/admin/tags/analyze called');
  
  // アクセス制御
  if (!isAdminAllowed(request)) {
    console.log('[analyze] Access denied (not admin)');
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }

  try {
    const body: AnalyzeRequest = await request.json();
    const { works } = body;

    console.log(`[analyze] Received request for ${works?.length || 0} works`);

    if (!works || !Array.isArray(works) || works.length === 0) {
      console.log('[analyze] Invalid request: works array is empty or missing');
      return NextResponse.json(
        { error: 'works array is required' },
        { status: 400 }
      );
    }

    // バッチ処理（5作品ずつ）
    const BATCH_SIZE = 5;
    const results: AnalyzeResponse['results'] = [];

    console.log(`[analyze] Processing ${works.length} works in batches of ${BATCH_SIZE}`);

    for (let i = 0; i < works.length; i += BATCH_SIZE) {
      const batch = works.slice(i, i + BATCH_SIZE);
      console.log(`[analyze] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(works.length / BATCH_SIZE)} (${batch.length} works)`);
      
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
        console.log('[analyze] Waiting 1 second before next batch...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`[analyze] Analysis completed. Total results: ${results.length}`);
    console.log(`[analyze] Results summary:`, {
      total: results.length,
      withDerivedTags: results.filter(r => r.derivedTags.length > 0).length,
      withCharacterTags: results.filter(r => r.characterTags.length > 0).length,
    });

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
