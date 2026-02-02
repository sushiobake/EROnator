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
  /** 旧形式: matched/suggested 混在。新形式のときは未使用 */
  derivedTags: Array<{
    displayName: string;
    confidence: number;
    category: string | null;
    source?: 'matched' | 'suggested';
    rank?: string;
  }>;
  /** 新形式: 追加Sタグ（OFFICIALのうち作品にまだ付いていないもの） */
  additionalSTags?: string[];
  /** 新形式: Aランクタグ */
  aTags?: string[];
  /** 新形式: Bランクタグ */
  bTags?: string[];
  /** 新形式: Cランクタグ */
  cTags?: string[];
  characterTags: string[];
  needsReview?: boolean;
  usage?: Record<string, unknown>;
  /** 紐付け検証失敗時（workId/runId/commentHash 不一致）。このときはタグを保存しない */
  validationFailed?: boolean;
}

/** Worker に送る最小ペイロード（リストはWorker内に埋め込み。タイトル・コメント・現状Sのみ送る） */
export interface CloudflarePayload {
  title?: string;
  commentText: string;
  currentSTags: string[];
  /** 紐付け検証用（reanalyze で送ると Worker がそのまま返す。不一致なら結果を破棄） */
  workId?: string;
  runId?: string;
  commentHash?: string;
}

/** Worker で useAppPrompt 時にフィルタ・rank再配置に使うリスト（省略時はWorker埋め込みリスト） */
export interface CloudflareFilterLists {
  s: string[];
  a: string[];
  b: string[];
  c: string[];
}

/**
 * Cloudflare Workers AI経由で分析を実行
 * ・payload を渡すと「タイトル・コメント・現状S・S/A/B/C一覧」だけ送り、Worker内の固定指示で分析（推奨）
 * ・commentText + systemPrompt を渡すと従来どおり長文プロンプトを送る
 * ・options.filterLists を渡すと Worker 側でそのリストでフィルタ・rank再配置する
 * ・options.currentSTags を渡すと Worker が additionalSTags に既存Sを含めない（既存Sをまた選ばない）
 */
export async function analyzeWithCloudflareAi(
  commentTextOrPayload: string | CloudflarePayload,
  systemPromptOrUndefined?: string,
  options?: { filterLists?: CloudflareFilterLists; currentSTags?: string[] }
): Promise<AiAnalysisResult> {
  const cloudflareWorkerUrl = process.env.CLOUDFLARE_WORKER_AI_URL;
  if (!cloudflareWorkerUrl) {
    throw new Error('CLOUDFLARE_WORKER_AI_URL is not set. Please create a Cloudflare Worker and set the URL.');
  }

  const isPayload = typeof commentTextOrPayload === 'object' && commentTextOrPayload !== null && 'currentSTags' in (commentTextOrPayload as CloudflarePayload) && Array.isArray((commentTextOrPayload as CloudflarePayload).currentSTags);
  const body = isPayload
    ? (commentTextOrPayload as CloudflarePayload)
    : {
        commentText: commentTextOrPayload as string,
        systemPrompt: systemPromptOrUndefined ?? '',
        ...(options?.filterLists && { filterLists: options.filterLists }),
        ...(options?.currentSTags && { currentSTags: options.currentSTags }),
      };

  const debug = process.env.DEBUG_CLOUDFLARE_AI === '1';

  try {
    if (debug) {
      if (isPayload) {
        const p = body as CloudflarePayload;
        const fullLen = (p.commentText ?? '').length;
        const previewLen = Math.min(300, fullLen);
        console.log('[Cloudflare AI Debug] Request (minimal payload):', {
          title: p.title?.substring(0, 60),
          commentLength: fullLen,
          commentPreviewFirst300: (p.commentText ?? '').substring(0, previewLen) + (fullLen > 300 ? '...' : ''),
          note: '作品コメントは全文をWorkerに送信しています。上記はログ用の先頭300字です。',
          currentSTagsCount: p.currentSTags?.length ?? 0,
        });
      } else {
        console.log('[Cloudflare AI Debug] Request (legacy): commentLength=', (body as { commentText?: string }).commentText?.length ?? 0, 'promptLength=', (body as { systemPrompt?: string }).systemPrompt?.length ?? 0);
      }
    }

    const response = await fetch(cloudflareWorkerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CLOUDFLARE_AI_TOKEN || ''}`,
        'Cache-Control': 'no-store',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[Cloudflare AI] Non-OK response:', response.status, response.statusText, text.substring(0, 500));
      // 5024 (JSON Mode couldn't be met) 等でバッチが止まらないよう、throw せず needsReview の空結果を返す
      let data: Record<string, unknown> = {};
      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        // ignore
      }
      const fallback: AiAnalysisResult = {
        derivedTags: [],
        additionalSTags: [],
        aTags: [],
        bTags: [],
        cTags: [],
        characterTags: [],
        needsReview: true,
      };
      if (Array.isArray(data.additionalSTags)) fallback.additionalSTags = data.additionalSTags.filter((x): x is string => typeof x === 'string');
      if (Array.isArray(data.aTags)) fallback.aTags = data.aTags.filter((x): x is string => typeof x === 'string');
      if (Array.isArray(data.bTags)) fallback.bTags = data.bTags.filter((x): x is string => typeof x === 'string');
      if (Array.isArray(data.cTags)) fallback.cTags = data.cTags.filter((x): x is string => typeof x === 'string');
      if (data.needsReview === true) fallback.needsReview = true;
      return fallback;
    }

    const data = await response.json();

    // 紐付け検証: 送った workId/runId/commentHash がそのまま返っているか（Worker がエコーする）
    const sentWorkId = isPayload ? (body as CloudflarePayload).workId : undefined;
    const sentRunId = isPayload ? (body as CloudflarePayload).runId : undefined;
    const sentCommentHash = isPayload ? (body as CloudflarePayload).commentHash : undefined;
    const hasBinding = sentWorkId != null && sentRunId != null && sentCommentHash != null;
    const echoedWorkId = data.workId;
    const echoedRunId = data.runId;
    const echoedCommentHash = data.commentHash;
    const bindingMismatch = hasBinding && (
      echoedWorkId !== sentWorkId || echoedRunId !== sentRunId || echoedCommentHash !== sentCommentHash
    );
    if (bindingMismatch) {
      console.warn('[Cloudflare AI] Binding mismatch - discarding result. Sent workId=%s runId=%s commentHash=%s vs echoed workId=%s runId=%s commentHash=%s',
        sentWorkId, sentRunId, sentCommentHash, echoedWorkId, echoedRunId, echoedCommentHash);
    }

    if (debug) {
      // デバッグ: Worker側で追加したdebugAiRawフィールドを出力
      if ('debugAiRaw' in data) {
        console.log('[Cloudflare AI Debug] Raw AI Response from Worker:', (data as { debugAiRaw?: unknown }).debugAiRaw);
      }
      
      console.log('[Cloudflare AI Debug] Response:', JSON.stringify({
        matchedTags: (data as { matchedTags?: unknown }).matchedTags,
        suggestedTags: (data as { suggestedTags?: unknown }).suggestedTags,
        derivedTags: (data as { derivedTags?: unknown }).derivedTags,
        additionalSTags: (data as { additionalSTags?: unknown }).additionalSTags,
        aTags: (data as { aTags?: unknown }).aTags,
        bTags: (data as { bTags?: unknown }).bTags,
        cTags: (data as { cTags?: unknown }).cTags,
        characterTags: (data as { characterTags?: unknown }).characterTags,
        needsReview: (data as { needsReview?: unknown }).needsReview,
      }, null, 2));
    }

    const toStrArr = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map(s => s.trim()).filter(Boolean) : [];

    const additionalSTags = toStrArr(data.additionalSTags);
    const aTags = toStrArr(data.aTags);
    const bTags = toStrArr(data.bTags);
    const cTags = toStrArr(data.cTags);
    const hasNewFormat =
      'additionalSTags' in data || 'aTags' in data || 'bTags' in data || 'cTags' in data;

    let derivedTags: AiAnalysisResult['derivedTags'] = [];
    // タグ取得では confidence は無視。1 固定（型・DB 互換用のみ）
    const tagConfidence = 1;
    if (data.derivedTags && Array.isArray(data.derivedTags)) {
      derivedTags = data.derivedTags.map((t: { displayName: string; confidence?: number; category?: string | null; source?: string; rank?: string }) => ({
        displayName: t.displayName,
        confidence: typeof t.confidence === 'number' ? t.confidence : tagConfidence,
        category: t.category ?? null,
        source: t.source === 'matched' || t.source === 'suggested' ? t.source : undefined,
        rank: t.rank ?? undefined,
      }));
    } else if (!hasNewFormat && Array.isArray(data.matchedTags)) {
      derivedTags = (data.matchedTags as Array<{ displayName: string; confidence?: number; category?: string | null; rank?: string }>).map((t) => ({
        displayName: t.displayName,
        confidence: typeof t.confidence === 'number' ? t.confidence : tagConfidence,
        category: t.category ?? null,
        source: 'matched' as const,
        rank: t.rank ?? undefined,
      }));
      if (Array.isArray(data.suggestedTags)) {
        derivedTags = derivedTags.concat(
          (data.suggestedTags as Array<{ displayName: string; confidence?: number; category?: string | null }>).map((t) => ({
            displayName: t.displayName,
            confidence: typeof t.confidence === 'number' ? t.confidence : tagConfidence,
            category: t.category ?? null,
            source: 'suggested' as const,
            rank: undefined as string | undefined,
          }))
        );
      }
    }

    const result: AiAnalysisResult = {
      derivedTags: bindingMismatch ? [] : derivedTags,
      characterTags: bindingMismatch ? [] : (data.characterTags || []),
    };
    if (hasNewFormat && !bindingMismatch) {
      result.additionalSTags = additionalSTags;
      result.aTags = aTags;
      result.bTags = bTags;
      result.cTags = cTags;
    }
    if (data.needsReview === true || bindingMismatch) result.needsReview = true;
    if (bindingMismatch) result.validationFailed = true;
    if (data.usage && typeof data.usage === 'object') {
      result.usage = data.usage as Record<string, unknown>;
    }
    return result;
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

    const toStrArr = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x: unknown): x is string => typeof x === 'string').map(s => s.trim()).filter(Boolean) : [];
    const hasNewFormat =
      'additionalSTags' in parsed || 'aTags' in parsed || 'bTags' in parsed || 'cTags' in parsed;

    if (hasNewFormat) {
      const characterTags = parsed.characterName && typeof parsed.characterName === 'string'
        ? [parsed.characterName]
        : Array.isArray(parsed.characterTags)
          ? parsed.characterTags.filter((n: unknown) => typeof n === 'string').slice(0, 1).map((n: unknown) => String(n))
          : [];
      return {
        derivedTags: [],
        additionalSTags: toStrArr(parsed.additionalSTags),
        aTags: toStrArr(parsed.aTags),
        bTags: toStrArr(parsed.bTags),
        cTags: toStrArr(parsed.cTags),
        characterTags,
        ...(parsed.needsReview === true && { needsReview: true }),
      };
    }

    // 旧形式: matchedTags（rank付き）+ suggestedTags + characterName + needsReview
    const matchedTags = Array.isArray(parsed.matchedTags)
      ? parsed.matchedTags
          .filter((tag: any) => tag && tag.displayName)
          .map((tag: any) => ({
            displayName: String(tag.displayName).trim(),
            confidence: typeof tag.confidence === 'number' ? Math.max(0, Math.min(1, tag.confidence)) : 0.9,
            category: tag.category ? String(tag.category) : null,
            source: 'matched' as const,
            rank: tag.rank === 'A' || tag.rank === 'B' || tag.rank === 'C' ? tag.rank : undefined,
          }))
      : [];

    const suggestedTags = Array.isArray(parsed.suggestedTags)
      ? parsed.suggestedTags
          .filter((tag: any) => tag && tag.displayName)
          .map((tag: any) => ({
            displayName: String(tag.displayName).trim(),
            confidence: typeof tag.confidence === 'number' ? Math.max(0, Math.min(1, tag.confidence)) : 0.85,
            category: tag.category ? String(tag.category) : null,
            source: 'suggested' as const,
            rank: undefined as string | undefined,
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

    const needsReview = parsed.needsReview === true;

    console.log('[Groq] Final result:', {
      rawCount: rawDerivedTags.length,
      afterFilterCount: filterResult.passed.length,
      selectedCount: derivedTags.length,
      derivedTags: derivedTags.map(t => `${t.displayName} (${t.confidence.toFixed(2)}, ${t.source}${t.rank ? `, rank:${t.rank}` : ''})`),
      characterTags,
      needsReview,
    });

    return {
      derivedTags,
      characterTags,
      ...(needsReview && { needsReview: true }),
    };
  } catch (error) {
    console.error('[Groq] Error:', error);
    throw error;
  }
}

/**
 * 環境変数に従ってプロバイダを選択して分析を実行
 * 優先: ERONATOR_AI_PROVIDER 指定 > auto 時は Cloudflare > Groq > HuggingFace
 * （Cloudflare で進める場合は CLOUDFLARE_WORKER_AI_URL を設定）
 */
export async function analyzeWithConfiguredProvider(
  commentText: string,
  systemPrompt: string
): Promise<AiAnalysisResult> {
  const provider = (process.env.ERONATOR_AI_PROVIDER || 'auto').toLowerCase();
  if (provider === 'cloudflare' || (provider === 'auto' && process.env.CLOUDFLARE_WORKER_AI_URL)) {
    return await analyzeWithCloudflareAi(commentText, systemPrompt);
  }
  if (provider === 'groq' || (provider === 'auto' && process.env.GROQ_API_KEY)) {
    return await analyzeWithGroq(commentText, systemPrompt);
  }
  if (provider === 'huggingface' || (provider === 'auto' && process.env.HUGGINGFACE_API_TOKEN)) {
    return await analyzeWithHuggingFace(commentText, systemPrompt);
  }
  throw new Error(
    'No AI provider configured. Set ERONATOR_AI_PROVIDER=cloudflare and CLOUDFLARE_WORKER_AI_URL, or GROQ_API_KEY, or HUGGINGFACE_API_TOKEN'
  );
}
