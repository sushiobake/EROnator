/**
 * チェック待ちから1件取得し、Groq APIでタグチェックを実行して反映する
 * POST /api/admin/groq-check-one
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const root = path.resolve(process.cwd());
const EXPORT_DIR = path.join(root, 'data', 'chatgpt-export');
const PENDING_PATH = path.join(EXPORT_DIR, 'check-pending.json');
const INSTRUCTION_PATH = path.join(root, 'docs', 'check-instruction-1item.md');

function loadTagRanks(): Record<string, string> {
  try {
    const p = path.join(root, 'config', 'tagRanks.json');
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      const data = JSON.parse(content);
      return data.ranks || {};
    }
  } catch {
    // ignore
  }
  return {};
}

function loadCheckInstruction(): string {
  if (!fs.existsSync(INSTRUCTION_PATH)) {
    throw new Error(`check-instruction-1item.md not found: ${INSTRUCTION_PATH}`);
  }
  return fs.readFileSync(INSTRUCTION_PATH, 'utf-8');
}

/** プロンプト構築: 指示書 + 作品データ（allTags 含む） */
function buildPrompt(instruction: string, work: {
  workId: string;
  title: string;
  commentText: string;
  derivedTags: string[];
  officialTags: string[];
  characterName: string | null;
  allTags: { s: string[]; a: string[]; b: string[] };
}): string {
  const workPayload = {
    workId: work.workId,
    title: work.title,
    commentText: work.commentText,
    derivedTags: work.derivedTags,
    officialTags: work.officialTags,
    characterName: work.characterName,
    allTags: work.allTags,
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
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not set' }, { status: 500 });
    }

    // チェック待ちから1件取得
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

    const tagRanks = loadTagRanks();
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

    const [officialTagsList, derivedTagsList] = await Promise.all([
      prisma.tag.findMany({ where: { tagType: 'OFFICIAL' }, select: { displayName: true } }),
      prisma.tag.findMany({ where: { tagType: 'DERIVED' }, select: { displayName: true } }),
    ]);
    const s = officialTagsList.map((t) => t.displayName);
    const a = derivedTagsList.filter((t) => tagRanks[t.displayName] === 'A').map((t) => t.displayName);
    const b = derivedTagsList.filter((t) => tagRanks[t.displayName] === 'B').map((t) => t.displayName);
    const allTags = { s, a, b };

    const payload = {
      workId: work.workId,
      title: work.title,
      commentText: work.commentText || '',
      derivedTags,
      officialTags: [...officialTags, ...additionalSTags],
      characterName: characterTags.length > 0 ? characterTags[0] : null,
      allTags,
    };

    const model = process.env.GROQ_CHECK_MODEL || 'llama-3.1-8b-instant';
    const instruction = loadCheckInstruction();
    const userContent = buildPrompt(instruction, payload);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: userContent }],
        temperature: 0.2,
        max_tokens: 2500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[groq-check-one] Groq API error:', response.status, errText);
      return NextResponse.json(
        { error: `Groq API error: ${response.status}`, detail: errText },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ error: 'Groq returned empty content' }, { status: 502 });
    }

    let parsed: { workId: string; title: string; result: string; checkReasoning?: object };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
    } catch (e) {
      console.error('[groq-check-one] Parse error:', e);
      console.error('[groq-check-one] Raw:', content.slice(0, 500));
      return NextResponse.json(
        { error: 'Failed to parse Groq response as JSON', raw: content.slice(0, 300) },
        { status: 502 }
      );
    }

    if (!parsed.workId || !parsed.result) {
      return NextResponse.json(
        { error: 'Invalid check result: workId and result are required' },
        { status: 502 }
      );
    }

    const resultArr = [parsed];
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
    console.error('[groq-check-one]', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
