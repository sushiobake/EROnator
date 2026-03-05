/**
 * 複数作品の Phase1 + Phase2 連続チェック
 * POST /api/admin/openai-check-batch?count=10
 * チェック待ちから先頭 count 件を取得し、Phase1 → (問題ありなら Phase2) を実行。
 * 結果を CheckBatchRun に保存して返す。
 */

import { NextRequest, NextResponse } from 'next/server';
import pLimit from 'p-limit';
import { prisma } from '@/server/db/client';
import { callCheckApi } from '@/server/checkAiClient';
import { parseAiJson } from '@/server/ai/parseAiJson';
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(process.cwd());
const INSTRUCTION_P1 = path.join(root, 'docs', 'check-instruction-api1-batch.md');
const INSTRUCTION_P2 = path.join(root, 'docs', 'check-instruction-api2-batch.md');
const BATCH_SIZE = 8; // mini で 8件（10件だと empty content になるため）
/** AI API 同時呼び出し数 */
const API_CONCURRENCY = 15;

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
    const concurrencyParam = request.nextUrl.searchParams.get('concurrency');
    const apiConcurrency = concurrencyParam
      ? Math.min(15, Math.max(1, parseInt(concurrencyParam, 10) || 15))
      : API_CONCURRENCY;

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
        const toPayload1 = (work: (typeof works)[0]) => {
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
          return {
            workId: work.workId,
            title: work.title,
            commentText: work.commentText || '',
            officialTags,
            additionalSTags,
            derivedTags,
            characterName: characterTags.length > 0 ? characterTags[0] : null,
          };
        };
        try {
          type Phase1Batch = { results: Phase1Item[] };
          const chunks: Array<{ chunkStart: number; chunk: (typeof works)[0][] }> = [];
          for (let chunkStart = 0; chunkStart < works.length; chunkStart += BATCH_SIZE) {
            chunks.push({
              chunkStart,
              chunk: works.slice(chunkStart, chunkStart + BATCH_SIZE),
            });
          }

          const apiLimit = pLimit(apiConcurrency);
          const chunkResults = await Promise.all(
            chunks.map(({ chunkStart, chunk }) =>
              apiLimit(async (): Promise<{ success: true; chunkStart: number; phase1Items: Phase1Item[] } | { success: false; chunkStart: number; chunk: (typeof works)[0][]; error: string }> => {
                const worksPayload = chunk.map(toPayload1);
                const payload1 = { works: worksPayload };
                const userContent1 = `${inst1}

---

## 作品データ（チェック対象）

${JSON.stringify(payload1, null, 2)}

上記の works 配列の各作品をチェックし、results 配列（works と同じ順序・件数）で返せ。`;

                const parsePhase1 = (raw: string): Phase1Batch => {
                  const jsonMatch1 = raw.match(/\{[\s\S]*\}/);
                  if (!jsonMatch1) throw new Error('No JSON in response');
                  const { data } = parseAiJson<Phase1Batch>(jsonMatch1[0]);
                  if (!Array.isArray(data.results) || data.results.length !== chunk.length) {
                    throw new Error(`results length mismatch: expected ${chunk.length}, got ${data.results?.length ?? 0}`);
                  }
                  return data;
                };

                let content1: string;
                try {
                  content1 = await callCheckApi(userContent1, 'openai-check-batch-p1');
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  return { success: false, chunkStart, chunk, error: msg };
                }

                let parsed1Batch: Phase1Batch;
                try {
                  parsed1Batch = parsePhase1(content1);
                } catch (parseErr) {
                  try {
                    content1 = await callCheckApi(userContent1, 'openai-check-batch-p1');
                    parsed1Batch = parsePhase1(content1);
                  } catch (retryErr) {
                    const msg = retryErr instanceof Error ? retryErr.message : String(retryErr);
                    console.warn(`[openai-check-batch] Phase1 チャンク失敗 (リトライ済) workIds=${chunk.map((w) => w.workId).join(',')}:`, msg);
                    return { success: false, chunkStart, chunk, error: msg };
                  }
                }

                const phase1Items: Phase1Item[] = chunk.map((work, idx) => {
                  const p = parsed1Batch.results[idx];
                  return {
                    workId: p?.workId || work.workId,
                    title: p?.title || work.title,
                    result: p?.result || 'タグ済',
                    checkReasoning: p?.checkReasoning,
                    issues: p?.issues,
                    tagChanges: {
                      added: [],
                      removed: p?.tagChanges?.removed ?? [],
                    },
                  };
                });

                const needsPhase2 = phase1Items.filter((item) => item.result === '人間による確認が必要');
                if (needsPhase2.length > 0) {
                  const worksForP2 = needsPhase2.map((item) => {
                    const work = chunk.find((w) => w.workId === item.workId)!;
                    const p1 = toPayload1(work);
                    return {
                      ...p1,
                      api1Issues: item.issues ?? [],
                      api1CheckReasoning: item.checkReasoning,
                    };
                  });
                  const payload2 = { allTags, works: worksForP2 };
                  const userContent2 = `${inst2}

---

## 作品データ（チェック対象）

${JSON.stringify(payload2, null, 2)}

上記の works 配列の各作品について、API1 が指摘した api1Issues に従い、不足タグの追加提案を出し、results 配列（works と同じ順序・件数）で返せ。`;

                  let content2: string | undefined;
                  try {
                    content2 = await callCheckApi(userContent2, 'openai-check-batch-p2');
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    for (const item of needsPhase2) {
                      item.issues = [...(item.issues || []), `Phase2 失敗: ${msg}`];
                    }
                  }

                  if (content2) {
                    type Phase2Result = { workId?: string; tagChanges?: { added?: string[] }; tagSuggestions?: { newProposal?: string } };
                    type Phase2Batch = { results: Phase2Result[] };
                    try {
                      const jsonMatch2 = content2.match(/\{[\s\S]*\}/);
                      if (jsonMatch2) {
                        const { data: parsed2Batch } = parseAiJson<Phase2Batch>(jsonMatch2[0]);
                        if (Array.isArray(parsed2Batch.results)) {
                          for (let i = 0; i < needsPhase2.length && i < parsed2Batch.results.length; i++) {
                            const item = needsPhase2[i];
                            const p2 = parsed2Batch.results[i];
                            if (p2 && p2.workId === item.workId) {
                              item.tagChanges = {
                                added: p2.tagChanges?.added ?? [],
                                removed: item.tagChanges?.removed ?? [],
                              };
                              if (p2.tagSuggestions?.newProposal?.trim()) {
                                (item as Record<string, unknown>).newProposal = p2.tagSuggestions.newProposal.trim();
                              }
                            }
                          }
                        }
                      }
                    } catch {
                      /* Phase2 パース失敗: そのまま has_issues で扱う */
                    }
                  }
                }

                return { success: true, chunkStart, phase1Items };
              })
            )
          );

          for (const r of chunkResults) {
            if (!r.success) {
              send({ type: 'chunkError', workIds: r.chunk.map((w) => w.workId), error: r.error });
            }
          }

          const successfulChunks = chunkResults.filter((r): r is { success: true; chunkStart: number; phase1Items: Phase1Item[] } => r.success);
          for (const { phase1Items } of successfulChunks.sort((a, b) => a.chunkStart - b.chunkStart)) {
            for (const item of phase1Items) {
              results.push(item);
              send({ type: 'progress', done: results.length, total: totalWorks, workId: item.workId, result: item.result });
            }
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
      console.warn('[openai-check-batch] CheckBatchRun insert failed (table may not exist):', e);
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
    console.error('[openai-check-batch]', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
