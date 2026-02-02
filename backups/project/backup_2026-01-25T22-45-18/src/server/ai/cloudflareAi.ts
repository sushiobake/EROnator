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
        max_tokens: 500,
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

    // JSONを抽出（複数のパターンに対応）
    let jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // プロンプト部分を除去して再試行
      const promptRemoved = text.replace(/^.*?\{/, '{');
      jsonMatch = promptRemoved.match(/\{[\s\S]*\}/);
    }

    if (!jsonMatch) {
      console.error('[AI Debug] Failed to extract JSON. Full response text:', text);
      throw new Error('AIからの応答からJSONを抽出できませんでした');
    }

    // デバッグログ: 抽出したJSONを出力
    console.log('[AI Debug] Extracted JSON:', jsonMatch[0].substring(0, 500));

    const parsed = JSON.parse(jsonMatch[0]);

    // デバッグログ: パース結果を出力
    console.log('[AI Debug] Parsed JSON:', JSON.stringify(parsed, null, 2));

    // バリデーション
    const derivedTags = Array.isArray(parsed.derivedTags)
      ? parsed.derivedTags
          .filter((tag: any) => tag && tag.displayName && typeof tag.confidence === 'number')
          .slice(0, 5) // 最大5件
          .map((tag: any) => ({
            displayName: String(tag.displayName),
            confidence: Math.max(0, Math.min(1, tag.confidence)), // 0-1の範囲に制限
            category: tag.category || null,
          }))
      : [];

    const characterTags = Array.isArray(parsed.characterTags)
      ? parsed.characterTags
          .filter((name: any) => name && typeof name === 'string')
          .slice(0, 1) // 最大1件
          .map((name: any) => String(name))
      : [];

    // デバッグログ: 最終結果を出力
    console.log('[AI Debug] Final result:', {
      derivedTagsCount: derivedTags.length,
      characterTagsCount: characterTags.length,
      derivedTags: derivedTags.map(t => t.displayName),
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
  // 日本語対応モデルを推奨（例: elyza/ELYZA-japanese-Llama-2-7b-instruct）
  // 環境変数で明示的に指定する場合は、HUGGINGFACE_API_URLを設定してください
  const apiToken = process.env.HUGGINGFACE_API_TOKEN;

  if (!apiToken) {
    throw new Error('HUGGINGFACE_API_TOKEN is not set. Please set it in .env.local');
  }

  // Step 1: まずOpenAI互換エンドポイントで検証用モデルを試す
  // 成功すればエンドポイントと権限はOK、失敗すれば権限/トークン/アカウントの問題
  try {
    console.log('[AI Debug] Step 1: Trying OpenAI-compatible endpoint with verification model...');
    return await analyzeWithHuggingFaceOpenAICompatible(
      commentText,
      systemPrompt,
      'HuggingFaceTB/SmolLM3-3B:hf-inference' // 検証用モデル
    );
  } catch (error) {
    console.warn('[AI Debug] OpenAI-compatible endpoint failed, trying legacy format...', error);
    // OpenAI互換エンドポイントが失敗した場合、従来の形式を試す
  }

  // モデル名を環境変数から取得、またはデフォルト値を使用
  const modelName = process.env.HUGGINGFACE_MODEL_NAME || 'elyza/ELYZA-japanese-Llama-2-7b-instruct';
  
  // 複数のエンドポイント形式を試す（フォールバック）
  // 注意: api-inference.huggingface.coは410 Gone（非推奨）のため、他の形式を優先
  // Hugging Face Inference APIの正しいエンドポイント形式を試行
  const endpointFormats = [
    // 形式1: api-inference.huggingface.co (非推奨だが、まだ動作する可能性がある)
    `https://api-inference.huggingface.co/models/${modelName}`,
    // 形式2: huggingface.co/api/models (公式API形式)
    `https://huggingface.co/api/models/${modelName}`,
    // 形式3: inference.huggingface.co (別の形式)
    `https://inference.huggingface.co/models/${modelName}`,
  ];

  // 環境変数で明示的に指定されている場合は、それを優先
  const customUrl = process.env.HUGGINGFACE_API_URL;
  const urlsToTry = customUrl ? [customUrl] : endpointFormats;

  // プロンプトを構築（日本語モデル用に調整）
  const prompt = `${systemPrompt}\n\n作品コメント:\n${commentText}\n\nJSON形式で出力してください:`;

  console.log('[AI Debug] Model name:', modelName);
  console.log('[AI Debug] Prompt length:', prompt.length);
  console.log('[AI Debug] Trying endpoints:', urlsToTry);

  let lastError: Error | null = null;

  // 各エンドポイント形式を順番に試す
  for (const apiUrl of urlsToTry) {
    try {
      console.log('[AI Debug] Trying endpoint:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.7,
            return_full_text: false,
          },
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
        
        // モデルが起動中の場合は待機
        if (response.status === 503) {
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.estimated_time) {
              throw new Error(`モデルが起動中です。約${Math.ceil(errorData.estimated_time)}秒後に再試行してください。`);
            }
          } catch (e) {
            // パースエラーは無視
          }
        }

        // 410エラー（非推奨）や404エラー（エンドポイント形式が間違っている）の場合は次の形式を試す
        if (response.status === 410 || response.status === 404) {
          lastError = new Error(`Endpoint ${apiUrl} returned ${response.status}: ${errorText}`);
          console.warn(`[AI Debug] Endpoint failed, trying next...`);
          continue; // 次のエンドポイント形式を試す
        }
        
        // その他のエラーは即座にスロー
        throw new Error(`Hugging Face API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // 成功した場合はこのエンドポイントを使用
      console.log('[AI Debug] Successfully connected to:', apiUrl);

      const data = await response.json();
      
      // レスポンスからテキストを抽出
      let text = '';
      if (Array.isArray(data)) {
        text = data[0]?.generated_text || '';
      } else if (typeof data === 'string') {
        text = data;
      } else {
        text = data.generated_text || data[0]?.generated_text || '';
      }
      
      // デバッグログ: AIの応答テキストを出力
      console.log('[AI Debug] Hugging Face API response text:', text.substring(0, 500)); // 最初の500文字のみ
      
      // JSONを抽出（複数のパターンに対応）
      let jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // プロンプト部分を除去して再試行
        const promptRemoved = text.replace(/^.*?\{/, '{');
        jsonMatch = promptRemoved.match(/\{[\s\S]*\}/);
      }
      
      if (!jsonMatch) {
        console.error('[AI Debug] Failed to extract JSON. Full response text:', text);
        throw new Error('AIからの応答からJSONを抽出できませんでした');
      }
      
      // デバッグログ: 抽出したJSONを出力
      console.log('[AI Debug] Extracted JSON:', jsonMatch[0].substring(0, 500));

      const parsed = JSON.parse(jsonMatch[0]);
      
      // デバッグログ: パース結果を出力
      console.log('[AI Debug] Parsed JSON:', JSON.stringify(parsed, null, 2));
      
      // バリデーション
      const derivedTags = Array.isArray(parsed.derivedTags) 
        ? parsed.derivedTags
            .filter((tag: any) => tag && tag.displayName && typeof tag.confidence === 'number')
            .slice(0, 5) // 最大5件
            .map((tag: any) => ({
              displayName: String(tag.displayName),
              confidence: Math.max(0, Math.min(1, tag.confidence)), // 0-1の範囲に制限
              category: tag.category || null,
            }))
        : [];
      
      const characterTags = Array.isArray(parsed.characterTags)
        ? parsed.characterTags
            .filter((name: any) => name && typeof name === 'string')
            .slice(0, 1) // 最大1件
            .map((name: any) => String(name))
        : [];
      
      // デバッグログ: 最終結果を出力
      console.log('[AI Debug] Final result:', {
        derivedTagsCount: derivedTags.length,
        characterTagsCount: characterTags.length,
        derivedTags: derivedTags.map(t => t.displayName),
        characterTags,
      });
      
      return {
        derivedTags,
        characterTags,
      };
    } catch (error) {
      console.error(`[AI Debug] Error with endpoint ${apiUrl}:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      // 次のエンドポイント形式を試す
      continue;
    }
  }

  // すべてのエンドポイント形式が失敗した場合
  console.error('[AI Debug] All endpoints failed. Last error:', lastError);
  throw new Error(
    `すべてのHugging Face APIエンドポイント形式が失敗しました。最後のエラー: ${lastError?.message || 'Unknown error'}\n` +
    `試したエンドポイント: ${urlsToTry.join(', ')}\n` +
    `モデル名: ${modelName}\n` +
    `トークンが設定されているか確認してください。`
  );
}
