/**
 * タグチェック用 AI API クライアント（OpenAI/GPT のみ）
 * Phase0/1/2 共通。OPENAI_CHECK_MODEL で上書き可。未設定時は gpt-5-nano。
 *
 * グローバル API セマフォ: Phase0 と Phase1+2 で同じ API 呼び出しプールを共有し、
 * 全体の同時実行数を抑えてレート制限を回避。OPENAI_CHECK_GLOBAL_CONCURRENCY で調整可（デフォルト 4）。
 *
 * 429 リトライ: レート制限時のみ指数バックオフでリトライ（課金されないため安全）。
 * タイムアウト/abort はリトライしない（二重課金リスクのため）。
 */

import pLimit from 'p-limit';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/** Phase0/Phase1+2 全体で共有する同時実行数制限（レート制限回避） */
const GLOBAL_API_LIMIT = pLimit(
  parseInt(process.env.OPENAI_CHECK_GLOBAL_CONCURRENCY || '10', 10)
);

/** 429 リトライ最大回数（OPENAI_CHECK_429_MAX_RETRIES で上書き可、デフォルト 3） */
const MAX_429_RETRIES = parseInt(process.env.OPENAI_CHECK_429_MAX_RETRIES || '3', 10);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function doCallCheckApi(userContent: string, logPrefix: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');
  const model = process.env.OPENAI_CHECK_MODEL || 'gpt-5-nano';
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: userContent }],
    max_completion_tokens: 10000,
  };

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= MAX_429_RETRIES; attempt++) {
    const timeoutMs = Number(process.env.OPENAI_CHECK_TIMEOUT_MS) || 480000; // 8分
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const msg = err instanceof Error ? err.message : String(err);
      // タイムアウト/abort はリトライしない（二重課金リスク）
      if (msg.includes('aborted') || msg.includes('timeout') || msg.includes('Timeout')) {
        console.error(`[${logPrefix}] AI API fetch failed (no retry):`, msg);
        throw err;
      }
      console.error(`[${logPrefix}] AI API fetch failed:`, msg);
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.ok) {
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('OpenAI returned empty content');
      }
      return content;
    }

    const errText = await response.text();
    const detail = (() => {
      try {
        const errJson = JSON.parse(errText) as { error?: { message?: string; code?: string } };
        return errJson.error?.message || errJson.error?.code || errText.slice(0, 300);
      } catch {
        return errText.slice(0, 300);
      }
    })();

    lastError = new Error(`OpenAI API error: ${response.status} - ${detail}`);

    if (response.status === 429 && attempt < MAX_429_RETRIES) {
      const waitSec = Math.pow(2, attempt + 1);
      console.warn(`[${logPrefix}] 429 rate limit, retry ${attempt + 1}/${MAX_429_RETRIES} after ${waitSec}s`);
      await sleep(waitSec * 1000);
      continue;
    }

    console.error(`[${logPrefix}] OpenAI API error:`, response.status, errText);
    throw lastError;
  }

  throw lastError ?? new Error('OpenAI API failed');
}

export async function callCheckApi(
  userContent: string,
  logPrefix: string
): Promise<string> {
  return GLOBAL_API_LIMIT(() => doCallCheckApi(userContent, logPrefix));
}
