/**
 * Phase0: 未タグ作品のタグ付けバッチ
 * POST /api/admin/groq-tag-batch?count=10&source=untagged
 * 未タグ or legacy_ai から取得し、5件ずつ LLM でタグ付け → チェック待ちへ
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { callCheckApi } from '@/server/checkAiClient';
import { resolveTagKeyForDisplayName } from '@/server/admin/resolveTagByDisplayName';
import { getTitleReadingInitialFromTitle } from '@/server/utils/titleCharType';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

const root = path.resolve(process.cwd());
const INSTRUCTION = path.join(root, 'docs', 'tag-instruction-phase0-batch.md');
const BATCH_SIZE = 8; // mini で 8件（10件だと empty content になるため）

function loadInstruction(): string {
  if (!fs.existsSync(INSTRUCTION)) throw new Error(`Not found: ${INSTRUCTION}`);
  return fs.readFileSync(INSTRUCTION, 'utf-8');
}

function loadTagRanks(): Record<string, string> {
  try {
    const p = path.join(root, 'config', 'tagRanks.json');
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      return data.ranks || {};
    }
  } catch {
    // ignore
  }
  return {};
}

function generateTagKey(displayName: string, tagType: 'DERIVED' | 'STRUCTURAL' = 'DERIVED'): string {
  const hash = crypto.createHash('sha1').update(displayName, 'utf8').digest('hex').substring(0, 10);
  return tagType === 'STRUCTURAL' ? `char_${hash}` : `tag_${hash}`;
}

type Phase0Item = {
  workId: string;
  title: string;
  additionalSTags: string[];
  aTags: string[];
  bTags: string[];
  characterName: string | null;
  titleReadingInitial?: string | null;
  taggingReasoning?: Record<string, string>;
};

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 500 });
    }

    const countParam = request.nextUrl.searchParams.get('count') || '10';
    const count = Math.min(100, Math.max(1, parseInt(countParam, 10) || 10));
    const source = request.nextUrl.searchParams.get('source') || 'untagged'; // untagged | legacy_ai | both
    const folders: string[] =
      source === 'both' ? ['untagged', 'legacy_ai'] : source === 'legacy_ai' ? ['legacy_ai'] : ['untagged'];

    const works = await prisma.work.findMany({
      where: {
        commentText: { not: null },
        manualTaggingFolder: { in: folders },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: count,
      include: { workTags: { include: { tag: true } } },
    });

    if (works.length === 0) {
      return NextResponse.json(
        { error: `対象がありません（${source}）` },
        { status: 404 }
      );
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

    const inst = loadInstruction();
    const officialNameToKey = new Map(
      (await prisma.tag.findMany({ where: { tagType: 'OFFICIAL' }, select: { displayName: true, tagKey: true } })).map(
        (t) => [t.displayName.toLowerCase(), t.tagKey]
      )
    );

    const results: Phase0Item[] = [];
    const encoder = new TextEncoder();
    const totalWorks = works.length;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: object) => {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
        };
        const toPayload = (work: (typeof works)[0]) => {
          const officialTags = work.workTags
            .filter((wt) => wt.tag.tagType === 'OFFICIAL')
            .map((wt) => wt.tag.displayName);
          return {
            workId: work.workId,
            title: work.title,
            commentText: work.commentText || '',
            officialTags,
            allTags,
          };
        };

        try {
          const isPostgresEnsure = (process.env.DATABASE_URL ?? '').startsWith('postgres');
          if (isPostgresEnsure) {
            await prisma.$executeRawUnsafe('ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "lastTaggingReasoning" TEXT');
            await prisma.$executeRawUnsafe('ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "titleReadingInitial" TEXT');
          } else {
            const tableInfo = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info(Work)');
            if (!tableInfo.some((col) => col.name === 'lastTaggingReasoning')) {
              await prisma.$executeRawUnsafe('ALTER TABLE Work ADD COLUMN lastTaggingReasoning TEXT');
            }
            if (!tableInfo.some((col) => col.name === 'titleReadingInitial')) {
              await prisma.$executeRawUnsafe('ALTER TABLE Work ADD COLUMN titleReadingInitial TEXT');
            }
          }

          for (let chunkStart = 0; chunkStart < works.length; chunkStart += BATCH_SIZE) {
            const chunk = works.slice(chunkStart, chunkStart + BATCH_SIZE);
            const worksPayload = chunk.map(toPayload);
            const userContent = `${inst}

---

## 作品データ（タグ付け対象）

${JSON.stringify({ works: worksPayload }, null, 2)}

上記の works 配列の各作品にタグを付け、results 配列（works と同じ順序・件数）で返せ。`;

            let content: string;
            try {
              content = await callCheckApi(userContent, 'groq-tag-batch');
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              send({ type: 'error', error: `Phase0 失敗 (${chunk.map((w) => w.workId).join(',')}): ${msg}` });
              controller.close();
              return;
            }

            type TagBatch = { results: Phase0Item[] };
            let parsed: TagBatch;
            try {
              const jsonMatch = content.match(/\{[\s\S]*\}/);
              if (!jsonMatch) throw new Error('No JSON in response');
              parsed = JSON.parse(jsonMatch[0]) as TagBatch;
              if (!Array.isArray(parsed.results) || parsed.results.length !== chunk.length) {
                throw new Error(
                  `results length mismatch: expected ${chunk.length}, got ${parsed.results?.length ?? 0}`
                );
              }
            } catch (e) {
              send({
                type: 'error',
                error: `Phase0 パース失敗: ${e instanceof Error ? e.message : String(e)}`,
                raw: content.slice(0, 500),
              });
              controller.close();
              return;
            }

            const nowIso = new Date().toISOString();
            const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');

            for (let i = 0; i < chunk.length; i++) {
              const item = parsed.results[i]!;
              const work = chunk[i]!;

              const addS = Array.isArray(item.additionalSTags)
                ? item.additionalSTags.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
                : [];
              const aList = Array.isArray(item.aTags)
                ? item.aTags.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
                : [];
              const bList = Array.isArray(item.bTags)
                ? item.bTags.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
                : [];
              const charName =
                typeof item.characterName === 'string' && item.characterName.trim()
                  ? item.characterName.trim()
                  : null;

              // titleReadingInitial: AI結果を優先。ひらがな/カタカナ始まりは機械的に上書き可能
              let titleReadingInitial: string | null = null;
              if (typeof item.titleReadingInitial === 'string' && item.titleReadingInitial.trim().length === 1) {
                titleReadingInitial = item.titleReadingInitial.trim();
              }
              const mechanicalInitial = getTitleReadingInitialFromTitle(work.title ?? '');
              if (mechanicalInitial) {
                titleReadingInitial = mechanicalInitial; // ひらがな/カタカナは機械設定で確定
              }

              const workId = item.workId || work.workId;

              await prisma.$transaction(async (tx) => {
                const existingWorkTags = await tx.workTag.findMany({
                  where: { workId },
                  include: { tag: true },
                });
                const toDelete: string[] = [];
                for (const wt of existingWorkTags) {
                  if (wt.tag.tagType === 'DERIVED') toDelete.push(wt.tagKey);
                  else if (wt.tag.tagType === 'OFFICIAL' && wt.derivedSource === 'additionalS') toDelete.push(wt.tagKey);
                  else if (wt.tag.tagType === 'STRUCTURAL') toDelete.push(wt.tagKey);
                }
                if (toDelete.length > 0) {
                  await tx.workTag.deleteMany({
                    where: { workId, tagKey: { in: toDelete } },
                  });
                }

                for (const displayName of addS) {
                  const tagKey = officialNameToKey.get(displayName.toLowerCase());
                  if (!tagKey) continue;
                  await tx.workTag.upsert({
                    where: { workId_tagKey: { workId, tagKey } },
                    create: {
                      workId,
                      tagKey,
                      derivedSource: 'additionalS',
                      derivedConfidence: 0.9,
                    },
                    update: { derivedSource: 'additionalS', derivedConfidence: 0.9 },
                  });
                }

                const upsertDerived = async (name: string) => {
                  const trimmed = name.trim();
                  if (!trimmed) return;
                  let tagKey = await resolveTagKeyForDisplayName(
                    tx as Parameters<typeof resolveTagKeyForDisplayName>[0],
                    trimmed
                  );
                  if (!tagKey) {
                    tagKey = generateTagKey(trimmed, 'DERIVED');
                    await tx.tag.create({
                      data: {
                        tagKey,
                        displayName: trimmed,
                        tagType: 'DERIVED',
                        category: 'その他',
                        questionText: `${trimmed}が関係している？`,
                      },
                    });
                  }
                  await tx.workTag.upsert({
                    where: { workId_tagKey: { workId, tagKey } },
                    create: {
                      workId,
                      tagKey,
                      derivedConfidence: 0.9,
                      derivedSource: 'matched',
                    },
                    update: { derivedConfidence: 0.9, derivedSource: 'matched' },
                  });
                };
                for (const name of aList) await upsertDerived(name);
                for (const name of bList) await upsertDerived(name);

                if (charName) {
                  let charTagKey = await tx.tag.findFirst({
                    where: { displayName: charName, tagType: 'STRUCTURAL' },
                    select: { tagKey: true },
                  });
                  if (!charTagKey) {
                    charTagKey = { tagKey: generateTagKey(charName, 'STRUCTURAL') };
                    await tx.tag.create({
                      data: {
                        tagKey: charTagKey.tagKey,
                        displayName: charName,
                        tagType: 'STRUCTURAL',
                        category: 'キャラクター',
                        questionText: `${charName}というキャラクターが登場する？`,
                      },
                    });
                  }
                  await tx.workTag.upsert({
                    where: { workId_tagKey: { workId, tagKey: charTagKey.tagKey } },
                    create: {
                      workId,
                      tagKey: charTagKey.tagKey,
                      derivedSource: 'manual',
                      derivedConfidence: 0.9,
                    },
                    update: { derivedSource: 'manual', derivedConfidence: 0.9 },
                  });
                }

                const taggingReasoningJson =
                  item.taggingReasoning && Object.keys(item.taggingReasoning).length > 0
                    ? JSON.stringify(item.taggingReasoning)
                    : null;
                if (isPostgres) {
                  await tx.$executeRawUnsafe(
                    'UPDATE "Work" SET "manualTaggingFolder" = $1, "updatedAt" = NOW(), "aiAnalyzed" = true, "checkQueueAt" = $2, "lastTaggingReasoning" = $3, "titleReadingInitial" = $4 WHERE "workId" = $5',
                    'pending',
                    nowIso,
                    taggingReasoningJson,
                    titleReadingInitial,
                    workId
                  );
                } else {
                  await tx.$executeRawUnsafe(
                    'UPDATE Work SET manualTaggingFolder = ?, updatedAt = datetime(\'now\'), aiAnalyzed = 1, checkQueueAt = ?, lastTaggingReasoning = ?, titleReadingInitial = ? WHERE workId = ?',
                    'pending',
                    nowIso,
                    taggingReasoningJson,
                    titleReadingInitial,
                    workId
                  );
                }
              });

              results.push({
                workId,
                title: item.title || work.title,
                additionalSTags: addS,
                aTags: aList,
                bTags: bList,
                characterName: charName,
                titleReadingInitial,
                taggingReasoning: item.taggingReasoning,
              });
              send({
                type: 'progress',
                done: results.length,
                total: totalWorks,
                workId,
                tagsAdded: addS.length + aList.length + bList.length + (charName ? 1 : 0),
              });
            }
          }

          send({
            type: 'done',
            success: true,
            count: results.length,
            results: results.map((r) => ({
              workId: r.workId,
              title: r.title,
              additionalSTags: r.additionalSTags.length,
              aTags: r.aTags.length,
              bTags: r.bTags.length,
              characterName: r.characterName ? 1 : 0,
              titleReadingInitial: r.titleReadingInitial ? 1 : 0,
            })),
          });
        } catch (err) {
          send({ type: 'error', error: err instanceof Error ? err.message : String(err) });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'application/x-ndjson', 'Transfer-Encoding': 'chunked' },
    });
  } catch (error) {
    console.error('[groq-tag-batch]', error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
