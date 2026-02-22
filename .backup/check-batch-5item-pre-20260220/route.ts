/**
 * 複数作品の Phase1 + Phase2 連続チェック
 * POST /api/admin/groq-check-batch?count=10
 * チェック待ちから先頭 count 件を取得し、Phase1 → (問題ありなら Phase2) を実行。
 * 結果を CheckBatchRun に保存して返す。
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { callCheckApi } from '@/server/checkAiClient';
import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const root = path.resolve(process.cwd());
const INSTRUCTION_P1 = path.join(root, 'docs', 'check-instruction-api1.md');
const INSTRUCTION_P2 = path.join(root, 'docs', 'check-instruction-api2.md');

function loadInstruction(p: string): string {
  if (!fs.existsSync(p)) throw new Error(`Not found: ${p}`);
  return fs.readFileSync(p, 'utf-8');
}

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

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 500 });
    }

    const countParam = request.nextUrl.searchParams.get('count') || '10';
    const count = Math.min(100, Math.max(1, parseInt(countParam, 10) || 10));

    const works = await prisma.work.findMany({
      where: {
        commentText: { not: null },
        manualTaggingFolder: 'pending',
      },
      orderBy: [{ checkQueueAt: 'desc' }, { updatedAt: 'desc' }],
      take: count,
      include: { workTags: { include: { tag: true } } },
    });

    if (works.length === 0) {
      return NextResponse.json({ error: 'チェック待ちの作品がありません' }, { status: 404 });
    }

    const tagRanks = loadTagRanks();
    const [officialTagsList, derivedTagsList] = await Promise.all([
      prisma.tag.findMany({ where: { tagType: 'OFFICIAL' }, select: { displayName: true } }),
      prisma.tag.findMany({ where: { tagType: 'DERIVED' }, select: { displayName: true } }),
    ]);
    const s = officialTagsList.map((t) => t.displayName);
    const a = derivedTagsList.filter((t) => tagRanks[t.displayName] === 'A').map((t) => t.displayName);
    const b = derivedTagsList.filter((t) => tagRanks[t.displayName] === 'B').map((t) => t.displayName);
    const allTags = { s, a, b };

    const inst1 = loadInstruction(INSTRUCTION_P1);
    const inst2 = loadInstruction(INSTRUCTION_P2);

    type Phase1Item = {
      workId: string;
      title: string;
      result: string;
      checkReasoning?: Record<string, string>;
      issues?: string[];
      tagChanges?: { added: string[]; removed: string[] };
    };

    const results: Phase1Item[] = [];
    const encoder = new TextEncoder();
    const totalWorks = works.length;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
        };
        try {
          for (let i = 0; i < works.length; i++) {
            const work = works[i];
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

      const payload1 = {
        workId: work.workId,
        title: work.title,
        commentText: work.commentText || '',
        officialTags,
        additionalSTags,
        derivedTags,
        characterName: characterTags.length > 0 ? characterTags[0] : null,
      };

      const userContent1 = `${inst1}

---

## 作品データ（チェック対象）

${JSON.stringify(payload1, null, 2)}

上記1作品をチェックし、指示書の出力形式に従いJSONのみで返せ。`;

      let content1: string;
      try {
        content1 = await callCheckApi(userContent1, 'groq-check-batch-p1');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        send({ type: 'error', error: `Phase1 失敗 (${work.workId}): ${msg}` });
        controller.close();
        return;
      }

      let parsed1: Phase1Item;
      try {
        const jsonMatch = content1.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON in response');
        parsed1 = JSON.parse(jsonMatch[0]) as Phase1Item;
      } catch (e) {
        send({ type: 'error', error: `Phase1 パース失敗 (${work.workId})`, raw: content1.slice(0, 300) });
        controller.close();
        return;
      }

      const item: Phase1Item = {
        workId: parsed1.workId || work.workId,
        title: parsed1.title || work.title,
        result: parsed1.result || 'タグ済',
        checkReasoning: parsed1.checkReasoning,
        issues: parsed1.issues,
        tagChanges: {
          added: [],
          removed: parsed1.tagChanges?.removed ?? [],
        },
      };

      // 人間確認が必要 → Phase2 で追加提案
      if (parsed1.result === '人間による確認が必要') {
        const payload2 = {
          ...payload1,
          allTags,
          api1Issues: parsed1.issues ?? [],
          api1CheckReasoning: parsed1.checkReasoning,
        };

        const userContent2 = `${inst2}

---

## 作品データ（チェック対象）

${JSON.stringify(payload2, null, 2)}

上記1作品について、API1 が指摘した api1Issues に従い、不足タグの追加提案を出し、指示書の出力形式に従いJSONのみで返せ。`;

        let content2: string;
        try {
          content2 = await callCheckApi(userContent2, 'groq-check-batch-p2');
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          item.issues = [...(item.issues || []), `Phase2 失敗: ${msg}`];
          results.push(item);
          send({ type: 'progress', done: results.length, total: totalWorks, workId: item.workId, result: item.result });
          continue;
        }

        let parsed2: { workId?: string; tagChanges?: { added?: string[] }; tagSuggestions?: { newProposal?: string } };
        try {
          const jsonMatch = content2.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error('No JSON');
          parsed2 = JSON.parse(jsonMatch[0]) as typeof parsed2;
        } catch {
          results.push(item);
          send({ type: 'progress', done: results.length, total: totalWorks, workId: item.workId, result: item.result });
          continue;
        }

        item.tagChanges = {
          added: parsed2.tagChanges?.added ?? [],
          removed: item.tagChanges?.removed ?? [],
        };
        if (parsed2.tagSuggestions?.newProposal?.trim()) {
          (item as Record<string, unknown>).newProposal = parsed2.tagSuggestions.newProposal.trim();
        }
      }

      results.push(item);
      send({ type: 'progress', done: results.length, total: totalWorks, workId: item.workId, result: item.result });
    }

    // DB 反映（apply-check-result と同等）
    const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');
    // カラムが存在することを保証
    if (isPostgres) {
      await prisma.$executeRawUnsafe('ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "lastCheckReasoning" TEXT');
      await prisma.$executeRawUnsafe('ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "lastCheckResultJson" TEXT');
    } else {
      const tableInfo = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info(Work)');
      if (!tableInfo.some((c) => c.name === 'lastCheckReasoning')) {
        await prisma.$executeRawUnsafe('ALTER TABLE Work ADD COLUMN lastCheckReasoning TEXT');
      }
      if (!tableInfo.some((c) => c.name === 'lastCheckResultJson')) {
        await prisma.$executeRawUnsafe('ALTER TABLE Work ADD COLUMN lastCheckResultJson TEXT');
      }
    }
    for (const item of results) {
      const hasPhase2Proposal = (item.tagChanges?.added?.length ?? 0) > 0 || (item as { newProposal?: string }).newProposal;
      const folder =
        item.result === 'タグ済'
          ? 'tagged'
          : hasPhase2Proposal
            ? 'needs_human_check'
            : 'has_issues';
      const tagChanges =
        folder !== 'tagged'
          ? { added: item.tagChanges?.added ?? [], removed: item.tagChanges?.removed ?? [], newProposal: (item as { newProposal?: string }).newProposal }
          : null;
      const reasoningJson =
        item.checkReasoning && Object.keys(item.checkReasoning).length > 0 ? JSON.stringify(item.checkReasoning) : null;
      const resultJson = JSON.stringify(item);

      if (folder === 'tagged') {
        const taggedAt = new Date().toISOString();
        if (isPostgres) {
          await prisma.$executeRawUnsafe(
            'UPDATE "Work" SET "manualTaggingFolder" = $1, "updatedAt" = NOW(), "taggedAt" = $2::timestamptz, "lastCheckTagChanges" = NULL, "lastCheckReasoning" = $3, "lastCheckResultJson" = $4, "gameRegistered" = true, "needsReview" = false WHERE "workId" = $5',
            folder,
            taggedAt,
            reasoningJson,
            resultJson,
            item.workId
          );
        } else {
          await prisma.$executeRawUnsafe(
            'UPDATE Work SET manualTaggingFolder = ?, updatedAt = datetime(\'now\'), taggedAt = ?, lastCheckTagChanges = NULL, lastCheckReasoning = ?, lastCheckResultJson = ?, gameRegistered = 1, needsReview = 0 WHERE workId = ?',
            folder,
            taggedAt,
            reasoningJson,
            resultJson,
            item.workId
          );
        }
      } else {
        const tagChangesStr = tagChanges ? JSON.stringify(tagChanges) : null;
        if (isPostgres) {
          await prisma.$executeRawUnsafe(
            'UPDATE "Work" SET "manualTaggingFolder" = $1, "updatedAt" = NOW(), "lastCheckTagChanges" = $2, "lastCheckReasoning" = $3, "lastCheckResultJson" = $4, "gameRegistered" = true, "needsReview" = false WHERE "workId" = $5',
            folder,
            tagChangesStr,
            reasoningJson,
            resultJson,
            item.workId
          );
        } else {
          await prisma.$executeRawUnsafe(
            'UPDATE Work SET manualTaggingFolder = ?, updatedAt = datetime(\'now\'), lastCheckTagChanges = ?, lastCheckReasoning = ?, lastCheckResultJson = ?, gameRegistered = 1, needsReview = 0 WHERE workId = ?',
            folder,
            tagChangesStr,
            reasoningJson,
            resultJson,
            item.workId
          );
        }
      }
    }

    // CheckBatchRun に保存（テーブルがなければ作成を試みる）
    try {
      const isPg = (process.env.DATABASE_URL ?? '').startsWith('postgres');
      if (isPg) {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "CheckBatchRun" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "batchSize" INTEGER NOT NULL,
            "resultsJson" TEXT NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);
      } else {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS CheckBatchRun (
            id TEXT PRIMARY KEY,
            batchSize INTEGER NOT NULL,
            resultsJson TEXT NOT NULL,
            createdAt TEXT DEFAULT (datetime('now'))
          )
        `);
      }
    } catch {
      // テーブル既存なら無視
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      if (isPostgres) {
        await prisma.$executeRawUnsafe(
          'INSERT INTO "CheckBatchRun" ("id", "batchSize", "resultsJson") VALUES ($1, $2, $3)',
          batchId,
          results.length,
          JSON.stringify(results)
        );
      } else {
        await prisma.$executeRawUnsafe(
          'INSERT INTO CheckBatchRun (id, batchSize, resultsJson) VALUES (?, ?, ?)',
          batchId,
          results.length,
          JSON.stringify(results)
        );
      }
    } catch (e) {
      console.warn('[groq-check-batch] CheckBatchRun insert failed (table may not exist):', e);
    }

    send({
      type: 'done',
      success: true,
      batchRunId: batchId,
      count: results.length,
      results: results.map((r) => ({ workId: r.workId, title: r.title, result: r.result })),
    });
  } catch (err) {
    send({ type: 'error', error: err instanceof Error ? err.message : String(err) });
  } finally {
    controller.close();
  }
      }
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'application/x-ndjson', 'Transfer-Encoding': 'chunked' },
    });
  } catch (error) {
    console.error('[groq-check-batch]', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
