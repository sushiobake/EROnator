/**
 * AI指示（動的プロンプト）のプレビュー
 * 管理画面で「AI指示を表示」により、実際にAIに送っている指示文を確認できる
 * ※API取得時点でSタグは付与されるため、AI分析時は常に「既存タグあり」の形で1本だけ送る
 */

import { NextResponse } from 'next/server';
import { buildDynamicSystemPrompt, getOfficialTagList, getTagsByRank } from '@/config/aiPrompt';

export async function GET() {
  try {
    const officialTags = getOfficialTagList();
    const aTags = getTagsByRank('A');
    const bTags = getTagsByRank('B');
    const cTags = getTagsByRank('C');
    // 代表例: 既存タグあり（分析時は作品ごとに使用禁止リストがその作品の既存Sタグに差し替わる）
    const prompt = buildDynamicSystemPrompt(officialTags, ['母乳']);
    return NextResponse.json({
      prompt,
      meta: {
        officialTagCount: officialTags.length,
        aTagCount: aTags.length,
        bTagCount: bTags.length,
        cTagCount: cTags.length,
      },
    });
  } catch (e) {
    console.error('[ai-prompt-preview]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to build prompt' },
      { status: 500 }
    );
  }
}
