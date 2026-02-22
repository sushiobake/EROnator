/**
 * タグチェック用 AI API クライアント（OpenAI）
 * Phase0/1/2 共通。OPENAI_CHECK_MODEL で上書き可。未設定時は gpt-5-nano。
 * Chat Completions API は reasoning パラメータ非対応のため未使用。
 * 空 content 対策: BATCH_SIZE を 2 に下げて試す等。
 */

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export async function callCheckApi(
  userContent: string,
  logPrefix: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const model = process.env.OPENAI_CHECK_MODEL || 'gpt-5-nano';
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: userContent }],
    max_completion_tokens: 10000,
  };

  const response = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`[${logPrefix}] OpenAI API error:`, response.status, errText);
    let detail = '';
    try {
      const errJson = JSON.parse(errText) as { error?: { message?: string; code?: string } };
      detail = errJson.error?.message || errJson.error?.code || errText.slice(0, 300);
    } catch {
      detail = errText.slice(0, 300);
    }
    throw new Error(`OpenAI API error: ${response.status} - ${detail}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned empty content');
  }

  return content;
}
