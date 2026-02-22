/**
 * Phase2: 問題ありから1件取得し、追加提案（added/newProposal）を出力して人間確認へ
 * POST /api/admin/groq-check-phase2
 *
 * BACKUP: Groq 版 (migration to OpenAI 前)
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(process.cwd());
const INSTRUCTION_PATH = path.join(root, 'docs', 'check-instruction-api2.md');

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
    throw new Error(`check-instruction-api2.md not found: ${INSTRUCTION_PATH}`);
  }
  return fs.readFileSync(INSTRUCTION_PATH, 'utf-8');
}

/** プロンプト構築: 指示書 + 作品データ + allTags */
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

上記1作品について、不足タグの追加提案を出し、指示書の出力形式に従いJSONのみで返せ。`;
}

export async function POST() {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not set' }, { status: 500 });
    }

    const work = await prisma.work.findFirst({
      where: {
        commentText: { not: null },
        manualTaggingFolder: 'has_issues',
      },
      orderBy: [{ updatedAt: 'desc' }],
      include: { workTags: { include: { tag: true } } },
    });

    if (!work) {
      return NextResponse.json({ error: '問題ありの作品がありません' }, { status: 404 });
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

    const model = process.env.GROQ_CHECK_MODEL || 'llama-3.3-70b-versatile';
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
      console.error('[groq-check-phase2] Groq API error:', response.status, errText);
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

    let parsed: {
      workId: string;
      tagChanges?: { added?: string[]; removed?: string[] };
      tagSuggestions?: { newProposal?: string };
    };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON in response');
      parsed = JSON.parse(jsonMatch[0]) as typeof parsed;
    } catch (e) {
      console.error('[groq-check-phase2] Parse error:', e);
      console.error('[groq-check-phase2] Raw:', content.slice(0, 500));
      return NextResponse.json(
        { error: 'Failed to parse Groq response as JSON', raw: content.slice(0, 300) },
        { status: 502 }
      );
    }

    if (!parsed.workId) {
      return NextResponse.json(
        { error: 'Invalid check result: workId is required' },
        { status: 502 }
      );
    }

    const added = Array.isArray(parsed.tagChanges?.added) ? parsed.tagChanges.added : [];
    const newProposal =
      parsed.tagSuggestions?.newProposal && parsed.tagSuggestions.newProposal.trim()
        ? parsed.tagSuggestions.newProposal.trim()
        : undefined;

    const existing = work.lastCheckTagChanges as { added?: string[]; removed?: string[]; newProposal?: string } | null;
    const existingRemoved = Array.isArray(existing?.removed) ? existing.removed : [];
    const merged: { added: string[]; removed: string[]; newProposal?: string } = {
      added,
      removed: existingRemoved,
      ...(newProposal ? { newProposal } : {}),
    };
    const tagChangesJson = JSON.stringify(merged);

    const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');
    if (isPostgres) {
      await prisma.$executeRawUnsafe(
        'UPDATE "Work" SET "manualTaggingFolder" = $1, "updatedAt" = NOW(), "lastCheckTagChanges" = $3, "gameRegistered" = true, "needsReview" = false WHERE "workId" = $2',
        'needs_human_check',
        work.workId,
        tagChangesJson
      );
    } else {
      await prisma.$executeRawUnsafe(
        "UPDATE Work SET manualTaggingFolder = ?, updatedAt = datetime('now'), lastCheckTagChanges = ?, gameRegistered = 1, needsReview = 0 WHERE workId = ?",
        'needs_human_check',
        tagChangesJson,
        work.workId
      );
    }

    return NextResponse.json({
      success: true,
      workId: parsed.workId,
      added,
      newProposal,
    });
  } catch (error) {
    console.error('[groq-check-phase2]', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
