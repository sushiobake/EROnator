/**
 * AI分析モジュール（OpenAI/GPT のみ）
 * reanalyze, tags/analyze 等で使用
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

/**
 * OpenAI API（GPT）経由で分析を実行
 * reanalyze, tags/analyze 等で使用
 */
export async function analyzeWithOpenAi(
  commentText: string,
  systemPrompt: string
): Promise<AiAnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  const model = process.env.OPENAI_CHECK_MODEL || 'gpt-4o-mini';
  const endpoint = 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
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
    console.error('[OpenAI] API error:', response.status, errorBody.slice(0, 300));
    throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned empty content');
  }

  return parseAiAnalysisResult(content);
}

function parseAiAnalysisResult(content: string): AiAnalysisResult {
  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in response');
    parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
  } catch (parseError) {
    console.error('[OpenAI] JSON parse error:', parseError);
    throw new Error(`Failed to parse JSON from OpenAI response: ${parseError}`);
  }

  const toStrArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean) : [];
  const hasNewFormat =
    'additionalSTags' in parsed || 'aTags' in parsed || 'bTags' in parsed || 'cTags' in parsed;

  if (hasNewFormat) {
    const characterTags =
      parsed.characterName && typeof parsed.characterName === 'string'
        ? [parsed.characterName]
        : Array.isArray(parsed.characterTags)
          ? (parsed.characterTags as unknown[]).filter((n): n is string => typeof n === 'string').slice(0, 1)
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

  // 旧形式
  const matchedTags = Array.isArray(parsed.matchedTags)
    ? (parsed.matchedTags as Array<{ displayName: string; confidence?: number; category?: string | null; rank?: string }>)
        .filter((tag) => tag && tag.displayName)
        .map((tag) => ({
          displayName: String(tag.displayName).trim(),
          confidence: typeof tag.confidence === 'number' ? Math.max(0, Math.min(1, tag.confidence)) : 0.9,
          category: tag.category ?? null,
          source: 'matched' as const,
          rank: tag.rank === 'A' || tag.rank === 'B' || tag.rank === 'C' ? tag.rank : undefined,
        }))
    : [];

  const suggestedTags = Array.isArray(parsed.suggestedTags)
    ? (parsed.suggestedTags as Array<{ displayName: string; confidence?: number; category?: string | null }>)
        .filter((tag) => tag && tag.displayName)
        .map((tag) => ({
          displayName: String(tag.displayName).trim(),
          confidence: typeof tag.confidence === 'number' ? Math.max(0, Math.min(1, tag.confidence)) : 0.85,
          category: tag.category ?? null,
          source: 'suggested' as const,
          rank: undefined as string | undefined,
        }))
    : [];

  const legacyTags = Array.isArray(parsed.derivedTags)
    ? (parsed.derivedTags as Array<{ displayName: string; confidence?: number; category?: string | null; source?: string }>)
        .filter((tag) => tag && tag.displayName && typeof tag.confidence === 'number')
        .map((tag) => ({
          displayName: String(tag.displayName).trim(),
          confidence: Math.max(0, Math.min(1, tag.confidence!)),
          category: tag.category ?? null,
          source: (tag.source || 'suggested') as 'matched' | 'suggested',
        }))
    : [];

  const rawDerivedTags =
    matchedTags.length > 0 || suggestedTags.length > 0 ? [...matchedTags, ...suggestedTags] : legacyTags;
  const filterResult = filterDerivedTags(rawDerivedTags, 5);
  const derivedTags = selectTopTags(filterResult.passed, 5);

  let characterTags: string[] = [];
  if (parsed.characterName && typeof parsed.characterName === 'string') {
    characterTags = [parsed.characterName];
  } else if (Array.isArray(parsed.characterTags)) {
    characterTags = (parsed.characterTags as unknown[])
      .filter((name): name is string => typeof name === 'string')
      .slice(0, 1);
  }

  return {
    derivedTags,
    characterTags,
    ...(parsed.needsReview === true && { needsReview: true }),
  };
}
