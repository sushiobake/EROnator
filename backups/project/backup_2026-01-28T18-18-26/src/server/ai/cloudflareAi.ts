/**
 * Cloudflare Workers AI統合
 * 
 * 注意: Cloudflare Workers AIはCloudflare Workers環境でのみ動作します。
 * Next.jsアプリから直接使用するには、Cloudflare Workersを作成してREST APIとして公開する必要があります。
 * 
 * 代替案:
 * 1. Cloudflare Workersを作成してAIエンドポイントを公開
 * 2. Hugging Face Inference APIを使用（無料枠あり）
 * 3. OpenAI APIを使用（有料だが確実）
 */

import { filterDerivedTags, selectTopTags } from './derivedTagFilter';

export interface AiAnalysisResult {
  derivedTags: Array<{
    displayName: string;
    confidence: number;
    category: string | null;
  }>;
  characterTags: string[];
}

/**
 * Cloudflare Workers AI経由で分析を実行
 * 
 * @param commentText 作品コメント
 * @param systemPrompt システムプロンプト
 * @returns 分析結果
 */
export async function analyzeWithCloudflareAi(
  commentText: string,
  systemPrompt: string
): Promise<AiAnalysisResult> {
  // Cloudflare Workers AIのエンドポイントURL
  // 環境変数から取得（例: https://your-worker.your-subdomain.workers.dev/analyze）
  const cloudflareWorkerUrl = process.env.CLOUDFLARE_WORKER_AI_URL;
  
  if (!cloudflareWorkerUrl) {
    throw new Error('CLOUDFLARE_WORKER_AI_URL is not set. Please create a Cloudflare Worker and set the URL.');
  }

  try {
    const response = await fetch(cloudflareWorkerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CLOUDFLARE_AI_TOKEN || ''}`,
      },
      body: JSON.stringify({
        commentText,
        systemPrompt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cloudflare AI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // レスポンスをパース
    return {
      derivedTags: data.derivedTags || [],
      characterTags: data.characterTags || [],
    };
  } catch (error) {
    console.error('Error calling Cloudflare Workers AI:', error);
    throw error;
  }
}

/**
 * Hugging Face Inference API経由で分析を実行（OpenAI互換エンドポイント）
 * Step 1: 公式どおりの入口で疎通確認
 * 
 * @param commentText 作品コメント
 * @param systemPrompt システムプロンプト
 * @returns 分析結果
 */
async function analyzeWithHuggingFaceOpenAICompatible(
  commentText: string,
  systemPrompt: string,
  modelName: string = 'HuggingFaceTB/SmolLM3-3B:hf-inference'
): Promise<AiAnalysisResult> {
  const apiToken = process.env.HUGGINGFACE_API_TOKEN;

  if (!apiToken) {
    throw new Error('HUGGINGFACE_API_TOKEN is not set. Please set it in .env.local');
  }

  // OpenAI互換エンドポイント
  const apiUrl = 'https://router.huggingface.co/v1/chat/completions';

  // プロンプトを構築
  const prompt = `${systemPrompt}\n\n作品コメント:\n${commentText}\n\nJSON形式で出力してください:`;

  console.log('[AI Debug] Using OpenAI-compatible endpoint:', apiUrl);
  console.log('[AI Debug] Model name:', modelName);
  console.log('[AI Debug] Comment text length:', commentText.length);
  console.log('[AI Debug] Prompt length:', prompt.length);

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `作品コメント:\n${commentText}\n\nJSON形式で出力してください:`,
          },
        ],
        max_tokens: 2000, // JSON出力には十分。推論プロセスが出ても対応可能
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AI Debug] Hugging Face API error response:', {
        endpoint: apiUrl,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorText,
      });

      // 401/403エラーは権限/トークン/アカウントの問題
      if (response.status === 401 || response.status === 403) {
        throw new Error(
          `権限/トークン/アカウントの問題の可能性があります。\n` +
          `ステータス: ${response.status} ${response.statusText}\n` +
          `エラー: ${errorText}`
        );
      }

      throw new Error(`Hugging Face API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // 成功した場合はこのエンドポイントを使用
    console.log('[AI Debug] Successfully connected to OpenAI-compatible endpoint');

    const data = await response.json();
    console.log('[AI Debug] Hugging Face API response:', JSON.stringify(data, null, 2));

    // OpenAI互換形式のレスポンスからテキストを抽出
    const text = data.choices?.[0]?.message?.content || '';
    
    if (!text) {
      throw new Error('AIからの応答が空です');
    }

    // デバッグログ: AIの応答テキストを出力
    console.log('[AI Debug] Hugging Face API response text:', text.substring(0, 500));

    // 推論プロセス（<think>、<reasoning>など）を除去してJSONを抽出
    let cleanedText = text;
    
    // 方法1: <think>...</think>タグを除去（閉じタグがある場合）
    cleanedText = cleanedText.replace(/<think>[\s\S]*?<\/think>/gi, '');
    // <reasoning>タグを除去
    cleanedText = cleanedText.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');
    // <redacted_reasoning>タグを除去
    cleanedText = cleanedText.replace(/<think>[\s\S]*?<\/redacted_reasoning>/gi, '');
    
    // 前後の空白を除去
    cleanedText = cleanedText.trim();
    
    // 方法2: JSONの開始位置（最初の{）を探して、それ以降を取得
    // これにより、<think>タグが閉じられていない場合でもJSONを抽出できる
    const jsonStartIndex = cleanedText.indexOf('{');
    if (jsonStartIndex !== -1 && jsonStartIndex > 0) {
      cleanedText = cleanedText.substring(jsonStartIndex);
    }
    
    // デバッグログ: クリーンアップ後のテキストを出力
    console.log('[AI Debug] Cleaned text (first 500 chars):', cleanedText.substring(0, 500));

    // JSONを抽出（複数のパターンに対応）
    let jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // プロンプト部分を除去して再試行
      const promptRemoved = cleanedText.replace(/^.*?\{/, '{');
      jsonMatch = promptRemoved.match(/\{[\s\S]*\}/);
    }

    if (!jsonMatch) {
      console.error('[AI Debug] Failed to extract JSON.');
      console.error('[AI Debug] Original text (first 1000 chars):', text.substring(0, 1000));
      console.error('[AI Debug] Cleaned text (first 1000 chars):', cleanedText.substring(0, 1000));
      throw new Error('AIからの応答からJSONを抽出できませんでした');
    }

    // デバッグログ: 抽出したJSONを出力
    console.log('[AI Debug] Extracted JSON:', jsonMatch[0].substring(0, 500));

    // JSONをパース（不完全なJSONの修復を試みる）
    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.warn('[AI Debug] JSON parse failed, attempting to repair truncated JSON...');
      
      // 不完全なJSONを修復する試み
      // finish_reason: "length" の場合、JSONが途中で切れている可能性が高い
      let repairedJson = jsonMatch[0];
      
      // derivedTagsの配列が途中で切れている場合の修復
      // パターン: "category": "属性 で切れている → "category": "属性"} で閉じる
      if (repairedJson.includes('"derivedTags"')) {
        // 最後の完全なオブジェクトの位置を探す
        const lastCompleteObject = repairedJson.lastIndexOf('}');
        if (lastCompleteObject !== -1) {
          // 最後の完全なオブジェクトまでを取得
          const truncated = repairedJson.substring(0, lastCompleteObject + 1);
          
          // derivedTagsの配列を閉じる
          if (!truncated.includes('"characterTags"')) {
            repairedJson = truncated + '], "characterTags": []}';
          } else {
            repairedJson = truncated + ']}';
          }
          
          console.log('[AI Debug] Repaired JSON:', repairedJson.substring(0, 500));
          
          try {
            parsed = JSON.parse(repairedJson);
            console.log('[AI Debug] JSON repair successful');
          } catch (repairError) {
            console.error('[AI Debug] JSON repair failed:', repairError);
            throw parseError; // 元のエラーを投げる
          }
        } else {
          throw parseError;
        }
      } else {
        throw parseError;
      }
    }

    // デバッグログ: パース結果を出力
    console.log('[AI Debug] Parsed JSON:', JSON.stringify(parsed, null, 2));

    // バリデーション: AIの出力を整形
    const rawDerivedTags = Array.isArray(parsed.derivedTags)
      ? parsed.derivedTags
          .filter((tag: any) => tag && tag.displayName && typeof tag.confidence === 'number')
          .map((tag: any) => ({
            displayName: String(tag.displayName).trim(),
            confidence: Math.max(0, Math.min(1, tag.confidence)), // 0-1の範囲に制限
            category: tag.category ? String(tag.category) : null,
          }))
      : [];

    // 後処理フィルタを適用
    const filterResult = filterDerivedTags(rawDerivedTags, 5);
    
    // デバッグログ: フィルタ結果
    if (filterResult.rejected.length > 0) {
      console.log('[AI Debug] Filtered out tags:', 
        filterResult.rejected.map(r => `${r.tag.displayName} (${r.reason})`).join(', ')
      );
    }

    // 厳選: 上位5件を選択（confidence 50%以上）
    // ※DBには5件保存、ゲーム使用時は上位2件のみ使用
    const derivedTags = selectTopTags(filterResult.passed, 5);

    const characterTags = Array.isArray(parsed.characterTags)
      ? parsed.characterTags
          .filter((name: any) => name && typeof name === 'string')
          .slice(0, 1) // 最大1件
          .map((name: any) => String(name))
      : [];

    // デバッグログ: 最終結果を出力
    console.log('[AI Debug] Final result:', {
      rawCount: rawDerivedTags.length,
      afterFilterCount: filterResult.passed.length,
      selectedCount: derivedTags.length,
      derivedTags: derivedTags.map(t => `${t.displayName} (${t.confidence.toFixed(2)})`),
      characterTags,
    });

    return {
      derivedTags,
      characterTags,
    };
  } catch (error) {
    console.error('[AI Debug] Error with OpenAI-compatible endpoint:', error);
    throw error;
  }
}

/**
 * Hugging Face Inference API経由で分析を実行
 * 
 * 注意: 無料モデルは初回リクエスト時に起動時間（10-30秒）がかかる場合があります。
 * 
 * @param commentText 作品コメント
 * @param systemPrompt システムプロンプト
 * @returns 分析結果
 */
export async function analyzeWithHuggingFace(
  commentText: string,
  systemPrompt: string
): Promise<AiAnalysisResult> {
  // Hugging Face Inference APIを使用
  // router.huggingface.coが推奨エンドポイント
  const apiToken = process.env.HUGGINGFACE_API_TOKEN;

  if (!apiToken) {
    throw new Error('HUGGINGFACE_API_TOKEN is not set. Please set it in .env.local');
  }

  // Step 1: router.huggingface.co（推奨エンドポイント）を試す
  // 複数のモデルを順番に試す
  const modelsToTry = [
    process.env.HUGGINGFACE_MODEL_NAME || 'elyza/ELYZA-japanese-Llama-2-7b-instruct',
    'HuggingFaceTB/SmolLM3-3B',
    'meta-llama/Llama-3.2-3B-Instruct',
  ];

  for (const modelName of modelsToTry) {
    try {
      console.log(`[AI Debug] Trying model: ${modelName} on router.huggingface.co...`);
      // router.huggingface.co用の形式: モデル名に`:hf-inference`を追加
      const modelNameWithSuffix = modelName.includes(':') ? modelName : `${modelName}:hf-inference`;
      return await analyzeWithHuggingFaceOpenAICompatible(
        commentText,
        systemPrompt,
        modelNameWithSuffix
      );
    } catch (error) {
      console.warn(`[AI Debug] Model ${modelName} failed:`, error instanceof Error ? error.message : String(error));
      // 次のモデルを試す
      continue;
    }
  }

  // すべてのモデルが失敗した場合
  throw new Error(
    `すべてのHugging Faceモデルが失敗しました。\n` +
    `試したモデル: ${modelsToTry.join(', ')}\n` +
    `HUGGINGFACE_API_TOKENが正しく設定されているか確認してください。\n` +
    `エンドポイント: https://router.huggingface.co/v1/chat/completions`
  );
}

/**
 * Groq API経由で分析を実行（超高速・無料枠大）
 * 
 * @param commentText 作品コメント
 * @param systemPrompt システムプロンプト
 * @returns 分析結果
 */
export async function analyzeWithGroq(
  commentText: string,
  systemPrompt: string
): Promise<AiAnalysisResult> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set. Please set it in .env.local');
  }

  // Groqで使用するモデル（Llama 3.3が日本語対応で高品質）
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

  console.log(`[Groq] Using model: ${model}`);
  console.log(`[Groq] Comment length: ${commentText.length}`);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `【作品コメント】\n${commentText}` },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Groq] API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
      });
      throw new Error(`Groq API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Groq API returned empty content');
    }

    console.log('[Groq] Raw response:', content.substring(0, 500));

    // JSONをパース
    let parsed: any;
    try {
      // JSON部分を抽出
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('[Groq] JSON parse error:', parseError);
      console.error('[Groq] Raw content:', content);
      throw new Error(`Failed to parse JSON from Groq response: ${parseError}`);
    }

    // 新形式: matchedTags + suggestedTags + characterName
    const matchedTags = Array.isArray(parsed.matchedTags)
      ? parsed.matchedTags
          .filter((tag: any) => tag && tag.displayName && typeof tag.confidence === 'number')
          .map((tag: any) => ({
            displayName: String(tag.displayName).trim(),
            confidence: Math.max(0, Math.min(1, tag.confidence)),
            category: tag.category ? String(tag.category) : null,
            source: 'matched' as const,
          }))
      : [];

    const suggestedTags = Array.isArray(parsed.suggestedTags)
      ? parsed.suggestedTags
          .filter((tag: any) => tag && tag.displayName && typeof tag.confidence === 'number')
          .map((tag: any) => ({
            displayName: String(tag.displayName).trim(),
            confidence: Math.max(0, Math.min(1, tag.confidence)),
            category: tag.category ? String(tag.category) : null,
            source: 'suggested' as const,
          }))
      : [];

    // 旧形式との互換性（derivedTagsがある場合）
    const legacyTags = Array.isArray(parsed.derivedTags)
      ? parsed.derivedTags
          .filter((tag: any) => tag && tag.displayName && typeof tag.confidence === 'number')
          .map((tag: any) => ({
            displayName: String(tag.displayName).trim(),
            confidence: Math.max(0, Math.min(1, tag.confidence)),
            category: tag.category ? String(tag.category) : null,
            source: (tag.source || 'suggested') as 'matched' | 'suggested',
          }))
      : [];

    // 全タグを結合（新形式優先、旧形式はフォールバック）
    const rawDerivedTags = matchedTags.length > 0 || suggestedTags.length > 0
      ? [...matchedTags, ...suggestedTags]
      : legacyTags;

    console.log('[Groq] Parsed tags:', {
      matched: matchedTags.length,
      suggested: suggestedTags.length,
      legacy: legacyTags.length,
    });

    // 後処理フィルタを適用
    const filterResult = filterDerivedTags(rawDerivedTags, 5);
    
    if (filterResult.rejected.length > 0) {
      console.log('[Groq] Filtered out tags:', 
        filterResult.rejected.map(r => `${r.tag.displayName} (${r.reason})`).join(', ')
      );
    }

    // 厳選: 上位5件を選択
    const derivedTags = selectTopTags(filterResult.passed, 5);

    // キャラクター名（新形式: characterName, 旧形式: characterTags）
    let characterTags: string[] = [];
    if (parsed.characterName && typeof parsed.characterName === 'string') {
      characterTags = [parsed.characterName];
    } else if (Array.isArray(parsed.characterTags)) {
      characterTags = parsed.characterTags
        .filter((name: any) => name && typeof name === 'string')
        .slice(0, 1)
        .map((name: any) => String(name));
    }

    console.log('[Groq] Final result:', {
      rawCount: rawDerivedTags.length,
      afterFilterCount: filterResult.passed.length,
      selectedCount: derivedTags.length,
      derivedTags: derivedTags.map(t => `${t.displayName} (${t.confidence.toFixed(2)}, ${t.source})`),
      characterTags,
    });

    return {
      derivedTags,
      characterTags,
    };
  } catch (error) {
    console.error('[Groq] Error:', error);
    throw error;
  }
}
