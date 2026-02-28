/**
 * Phase1: チェック待ちから1件取得し、振り分け判断のみ実行（allTags なし）
 * POST /api/admin/openai-check-phase1
 * OpenAI GPT-5-mini 使用
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { callCheckApi } from '@/server/checkAiClient';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const root = path.resolve(process.cwd());
const EXPORT_DIR = path.join(root, 'data', 'chatgpt-export');
const PENDING_PATH = path.join(EXPORT_DIR, 'check-pending.json');
const INSTRUCTION_PATH = path.join(root, 'docs', 'check-instruction-api1.md');

function loadCheckInstruction(): string {
  if (!fs.existsSync(INSTRUCTION_PATH)) {
    throw new Error(`check-instruction-api1.md not found: ${INSTRUCTION_PATH}`);
  }
  return fs.readFileSync(INSTRUCTION_PATH, 'utf-8');
}

/** プロンプト構築: 指示書 + 作品データ（allTags なし） */
function buildPrompt(instruction: string, work: {
  workId: string;
  title: string;
  commentText: string;
  officialTags: string[];
  additionalSTags: string[];
  derivedTags: string[];
  characterName: string | null;
}): string {
  const workPayload = {
    workId: work.workId,
    title: work.title,
    commentText: work.commentText,
    officialTags: work.officialTags,
    additionalSTags: work.additionalSTags,
    derivedTags: work.derivedTags,
    characterName: work.characterName,
  };
  const workJson = JSON.stringify(workPayload, null, 2);
  return `${instruction}

---

## 作品データ（チェック対象）

${workJson}

上記1作品をチェックし、指示書の出力形式に従いJSONのみで返せ。`;
}

export async function POST() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 500 });
    }

    const work = await prisma.work.findFirst({
      where: {
        commentText: { not: null },
        manualTaggingFolder: 'pending',
      },
      orderBy: [{ checkQueueAt: 'desc' }, { updatedAt: 'desc' }],
      include: { workTags: { include: { tag: true } } },
    });

    if (!work) {
      return NextResponse.json({ error: 'チェック待ちの作品がありません' }, { status: 404 });
    }

    const officialTags = work.workTags
      .filter((wt) => wt.tag.tagType === 'OFFICIAL' && wt.derivedSource !== 'additionalS')
      .map((wt) => wt.tag.displayName);
    const additionalSTags = work.workTags
      .filter((wt) => wt.tag.tagType === 'OFFICIAL' && wt.derivedSource === 'additionalS')
      .map((wt) => wt.tag.displayName);
    const derivedTags = work.workTags
      .filter((wt) => wt.tag.tagType === 'DERIVED')
      .map((wt) => wt.tag.displayName);
    const characterTags = work.workTags
      .filter((wt) => wt.tag.tagType === 'STRUCTURAL')
      .map((wt) => wt.tag.displayName);

    const payload = {
      workId: work.workId,
      title: work.title,
      commentText: work.commentText || '',
      officialTags,
      additionalSTags,
      derivedTags,
      characterName: characterTags.length > 0 ? characterTags[0] : null,
    };

    const instruction = loadCheckInstruction();
    const userContent = buildPrompt(instruction, payload);

    let content: string;
    try {
      content = await callCheckApi(userContent, 'openai-check-phase1');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: msg },
        { status: 502 }
      );
    }

    let parsed: { workId: string; title: string; result: string; checkReasoning?: object; issues?: string[]; tagChanges?: { added?: string[]; removed?: string[] } };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
    } catch (e) {
      console.error('[openai-check-phase1] Parse error:', e);
      console.error('[openai-check-phase1] Raw:', content.slice(0, 500));
      return NextResponse.json(
        { error: 'Failed to parse AI response as JSON', raw: content.slice(0, 300) },
        { status: 502 }
      );
    }

    if (!parsed.workId || !parsed.result) {
      return NextResponse.json(
        { error: 'Invalid check result: workId and result are required' },
        { status: 502 }
      );
    }

    const resultArr = [{ ...parsed, tagChanges: { added: [], removed: parsed.tagChanges?.removed ?? [] } }];
    fs.writeFileSync(PENDING_PATH, JSON.stringify(resultArr, null, 2), 'utf-8');

    const result = spawnSync(
      process.platform === 'win32' ? 'cmd.exe' : 'sh',
      process.platform === 'win32'
        ? ['/d', '/s', '/c', 'npx', 'tsx', 'scripts/apply-check.ts']
        : ['-c', 'npx tsx scripts/apply-check.ts'],
      { cwd: root, stdio: 'inherit' }
    );

    if (result.status !== 0) {
      return NextResponse.json(
        { error: 'apply-check failed', status: result.status },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      workId: parsed.workId,
      result: parsed.result,
    });
  } catch (error) {
    console.error('[openai-check-phase1]', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
