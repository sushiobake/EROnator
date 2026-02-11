/**
 * /api/admin/tags/analyze-test
 * 5件など少件数でAI分析を試し、結果だけ返す（DBには保存しない）
 * 最適なAI指示を探すために、systemPrompt を body で上書きして試せる
 *
 * POST body: { workIds?: string[], limit?: number, systemPrompt?: string }
 * - workIds を渡すとその作品で実行（コメントありのみ）
 * - 省略時は「準有名タグなし・古い順」から limit 件（省略時 5）
 * - systemPrompt を渡すとその指示で実行（省略時はデフォルトプロンプト）
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import { analyzeWithConfiguredProvider } from '@/server/ai/cloudflareAi';

const DEFAULT_SYSTEM_PROMPT = `あなたは成人向け同人誌のタグ生成AIです。
作品コメントを読み、その作品に適した「準有名タグ」を生成してください。

準有名タグとは:
- 公式タグ（OFFICIAL）には含まれていないが、作品の特徴を表すタグ
- シチュエーション、属性、関係性などを表現する
- 例: 「温泉」「学園」「年上」「年下」「先輩後輩」など

【重要】JSONのみを出力してください。<think>タグや推論プロセスは不要です。

出力形式:
{"derivedTags":[{"displayName":"タグ名","confidence":0.8,"category":"カテゴリ"}],"characterTags":[]}

ルール:
- derivedTagsは最大5件、characterTagsは最大1件
- 作品コメントから読み取れる情報のみ使用
- 余計なテキストは一切出力しない`;

function getProviderName(): string {
  const p = (process.env.ERONATOR_AI_PROVIDER || 'auto').toLowerCase();
  if (p === 'cloudflare' || (p === 'auto' && process.env.CLOUDFLARE_WORKER_AI_URL)) return 'cloudflare';
  if (p === 'groq' || (p === 'auto' && process.env.GROQ_API_KEY)) return 'groq';
  if (p === 'huggingface' || (p === 'auto' && process.env.HUGGINGFACE_API_TOKEN)) return 'huggingface';
  return 'none';
}

/** GET: 現在のAIプロバイダ名だけ返す（UI表示用） */
export async function GET(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json({ success: true, provider: getProviderName() });
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensurePrismaConnected();

    const body = await request.json().catch(() => ({}));
    const workIds = Array.isArray(body.workIds) ? body.workIds : undefined;
    const limit = Math.min(Math.max(Number(body.limit) || 5, 1), 20);
    const systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt : DEFAULT_SYSTEM_PROMPT;

    let works: Array<{ workId: string; title: string; commentText: string | null }>;
    if (workIds && workIds.length > 0) {
      works = await prisma.work.findMany({
        where: { workId: { in: workIds }, commentText: { not: null } },
        select: { workId: true, title: true, commentText: true },
      });
    } else {
      works = await prisma.work.findMany({
        where: {
          commentText: { not: null },
          workTags: { none: { tag: { tagType: 'DERIVED' } } },
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
        select: { workId: true, title: true, commentText: true },
      });
    }

    if (works.length === 0) {
      return NextResponse.json({
        success: true,
        provider: getProviderName(),
        message: '対象作品が0件です（コメントあり・準有名タグなし）',
        totalElapsedMs: 0,
        results: [],
      });
    }

    const MAX_COMMENT = 8000;
    const results: Array<{
      workId: string;
      title: string;
      commentPreview: string;
      derivedTags: Array<{ displayName: string; confidence: number; category: string | null }>;
      characterTags: string[];
      error?: string;
      elapsedMs?: number;
      usage?: Record<string, unknown>;
    }> = [];
    const usageAccum: Array<Record<string, unknown>> = [];
    const totalStart = Date.now();

    for (const work of works) {
      const comment = work.commentText ? work.commentText.slice(0, MAX_COMMENT) : '';
      const commentPreview = comment.slice(0, 200) + (comment.length > 200 ? '…' : '');
      const workStart = Date.now();
      try {
        const aiResult = await analyzeWithConfiguredProvider(comment, systemPrompt);
        const elapsedMs = Date.now() - workStart;
        if (aiResult.usage) usageAccum.push(aiResult.usage);
        results.push({
          workId: work.workId,
          title: work.title,
          commentPreview,
          derivedTags: aiResult.derivedTags,
          characterTags: aiResult.characterTags,
          elapsedMs,
          usage: aiResult.usage,
        });
      } catch (err) {
        const elapsedMs = Date.now() - workStart;
        results.push({
          workId: work.workId,
          title: work.title,
          commentPreview,
          derivedTags: [],
          characterTags: [],
          error: err instanceof Error ? err.message : String(err),
          elapsedMs,
        });
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    const totalElapsedMs = Date.now() - totalStart;

    return NextResponse.json({
      success: true,
      provider: getProviderName(),
      totalElapsedMs,
      usage: usageAccum.length > 0 ? usageAccum : undefined,
      results,
    });
  } catch (error) {
    console.error('[analyze-test] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
