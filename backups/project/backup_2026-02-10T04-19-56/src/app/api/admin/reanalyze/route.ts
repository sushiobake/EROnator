/**
 * DERIVED再抽出API
 * 既存のDB作品に対してAI分析を再実行する
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { resolveTagKeyForDisplayName } from '@/server/admin/resolveTagByDisplayName';
import { analyzeWithCloudflareAi, analyzeWithHuggingFace, analyzeWithGroq } from '@/server/ai/cloudflareAi';
import { buildDynamicSystemPrompt, getTagsByRank } from '@/config/aiPrompt';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// タグランクを取得
function getTagRanks(): Record<string, 'A' | 'B' | 'C' | ''> {
  try {
    const ranksPath = path.join(process.cwd(), 'config', 'tagRanks.json');
    if (fs.existsSync(ranksPath)) {
      const content = fs.readFileSync(ranksPath, 'utf-8');
      const data = JSON.parse(content);
      return data.ranks || {};
    }
  } catch (e) {
    console.warn('Failed to load tag ranks:', e);
  }
  return {};
}

/**
 * タグキー生成（既存APIと同じ形式）
 */
function generateTagKey(displayName: string, tagType: 'DERIVED' | 'STRUCTURAL' = 'DERIVED'): string {
  const hash = crypto.createHash('sha1').update(displayName, 'utf8').digest('hex').substring(0, 10);
  return tagType === 'STRUCTURAL' ? `char_${hash}` : `tag_${hash}`;
}

/** 作品＋リストを渡してAI分析。Cloudflare時は最小ペイロードでWorker呼び出し（workId/runId/commentHashで紐付け検証） */
async function analyzeWork(
  work: { workId: string; commentText: string; title: string; workTags: Array<{ tag: { tagType: string; displayName: string } }> },
  lists: { officialTagNames: string[]; aList: string[]; bList: string[]; cList: string[] }
) {
  const alreadyOnWorkOfficialNames = work.workTags
    .filter((wt) => wt.tag.tagType === 'OFFICIAL')
    .map((wt) => wt.tag.displayName);
  const systemPrompt = buildDynamicSystemPrompt(lists.officialTagNames, alreadyOnWorkOfficialNames);
  const aiProvider = process.env.ERONATOR_AI_PROVIDER || 'auto';

  if (aiProvider === 'groq') {
    return await analyzeWithGroq(work.commentText, systemPrompt);
  }
  if (aiProvider === 'cloudflare' && process.env.CLOUDFLARE_WORKER_AI_URL) {
    console.log('[AI] Using Cloudflare (app prompt + tag lists)');
    const commentHash = crypto.createHash('sha256').update(work.commentText, 'utf8').digest('hex');
    return await analyzeWithCloudflareAi(
      {
        title: work.title,
        commentText: work.commentText,
        currentSTags: alreadyOnWorkOfficialNames,
        workId: work.workId,
        runId: crypto.randomUUID(),
        commentHash,
      },
      undefined,
      { filterLists: { s: lists.officialTagNames, a: lists.aList, b: lists.bList, c: lists.cList } }
    );
  }
  if (aiProvider === 'huggingface') {
    return await analyzeWithHuggingFace(work.commentText, systemPrompt);
  }

  if (process.env.GROQ_API_KEY) {
    console.log('[AI] Using Groq (auto-detected)');
    return await analyzeWithGroq(work.commentText, systemPrompt);
  }
  if (process.env.CLOUDFLARE_WORKER_AI_URL) {
    console.log('[AI] Using Cloudflare (auto-detected, app prompt + tag lists)');
    const commentHash = crypto.createHash('sha256').update(work.commentText, 'utf8').digest('hex');
    return await analyzeWithCloudflareAi(
      {
        title: work.title,
        commentText: work.commentText,
        currentSTags: alreadyOnWorkOfficialNames,
        workId: work.workId,
        runId: crypto.randomUUID(),
        commentHash,
      },
      undefined,
      { filterLists: { s: lists.officialTagNames, a: lists.aList, b: lists.bList, c: lists.cList } }
    );
  }
  if (process.env.HUGGINGFACE_API_TOKEN) {
    console.log('[AI] Using HuggingFace (auto-detected)');
    return await analyzeWithHuggingFace(work.commentText, systemPrompt);
  }

  throw new Error('No AI provider configured. Set GROQ_API_KEY, CLOUDFLARE_WORKER_AI_URL, or HUGGINGFACE_API_TOKEN');
}

// GET: 再抽出対象の作品一覧を取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'no_derived'; // 'no_derived' | 'all'
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 作品を取得
    const where = mode === 'no_derived' 
      ? {
          commentText: { not: null },
          // DERIVEDタグがない作品
          NOT: {
            workTags: {
              some: {
                tag: { tagType: 'DERIVED' }
              }
            }
          }
        }
      : {
          commentText: { not: null },
        };

    const [works, total] = await Promise.all([
      prisma.work.findMany({
        where,
        include: {
          workTags: {
            include: { tag: true }
          }
        },
        orderBy: { id: 'asc' },
        take: limit,
        skip: offset,
      }),
      prisma.work.count({ where }),
    ]);

    // レスポンス用に整形（workIdを使用 - WorkTagの外部キー参照先）
    const worksData = works.map(w => ({
      id: w.workId, // WorkTagの参照先はworkIdフィールド
      title: w.title,
      commentText: w.commentText,
      existingTags: w.workTags
        .filter(wt => wt.tag.tagType === 'DERIVED')
        .map(wt => ({
          displayName: wt.tag.displayName,
          category: wt.tag.category,
        })),
    }));

    return NextResponse.json({
      works: worksData,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching works for reanalysis:', error);
    return NextResponse.json(
      { error: 'Failed to fetch works' },
      { status: 500 }
    );
  }
}

// POST: AI分析を実行。save=true（省略時）ならDBに保存、save=falseなら結果だけ返す（プレビュー・承認制用）
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workIds, save: saveToDb = true } = body;

    if (!Array.isArray(workIds) || workIds.length === 0) {
      return NextResponse.json(
        { error: 'workIds is required' },
        { status: 400 }
      );
    }

    // 作品を取得（workTags + tag を含め、追加S用の「既に付いているタグ」をプロンプトに渡す）
    const works = await prisma.work.findMany({
      where: { workId: { in: workIds } },
      include: { workTags: { include: { tag: true } } },
    });

    const results: Array<{
      workId: string;
      title: string;
      derivedTags: Array<{ displayName: string; confidence: number; category: string | null; source: string; rank?: string }>;
      additionalSTags?: string[];
      aTags?: string[];
      bTags?: string[];
      cTags?: string[];
      characterTags: string[];
      needsReview?: boolean;
      elapsed: number;
      error?: string;
    }> = [];

    // OFFICIALタグをDBから直接取得（キャッシュではなく最新）
    const officialTagsFromDb = await prisma.tag.findMany({
      where: { tagType: 'OFFICIAL' },
      select: { displayName: true }
    });
    const officialTagNames = officialTagsFromDb.map(t => t.displayName);
    console.log(`[Reanalyze] Loaded ${officialTagNames.length} OFFICIAL tags from DB`);
    const aList = getTagsByRank('A');
    const bList = getTagsByRank('B');
    const cList = getTagsByRank('C');
    const lists = { officialTagNames, aList, bList, cList };

    const officialNameToKey = new Map(
      (await prisma.tag.findMany({ where: { tagType: 'OFFICIAL' }, select: { displayName: true, tagKey: true } })).map(
        t => [t.displayName.toLowerCase(), t.tagKey]
      )
    );
    
    const tagRanks = getTagRanks();

    for (const work of works) {
      if (!work.commentText) {
        results.push({
          workId: work.workId,
          title: work.title,
          derivedTags: [],
          characterTags: [],
          elapsed: 0,
          error: 'No commentText',
        });
        continue;
      }

      const startTime = Date.now();
      try {
        const analysis = await analyzeWork(
          {
            workId: work.workId,
            title: work.title,
            commentText: work.commentText ?? '',
            workTags: work.workTags.map((wt) => ({
              tag: { tagType: wt.tag.tagType, displayName: wt.tag.displayName },
            })),
          },
          lists
        );
        const elapsed = Date.now() - startTime;
        const resultNeedsReview = (analysis as { needsReview?: boolean }).needsReview === true;
        const validationFailed = (analysis as { validationFailed?: boolean }).validationFailed === true;

        const useNewFormat = analysis.additionalSTags !== undefined;

        if (saveToDb && !validationFailed) {
          const existingWorkTags = await prisma.workTag.findMany({
            where: { workId: work.workId },
            include: { tag: true },
          });
          const toDelete: string[] = [];
          for (const wt of existingWorkTags) {
            if (wt.tag.tagType === 'DERIVED') toDelete.push(wt.tagKey);
            else if (wt.tag.tagType === 'OFFICIAL' && wt.derivedSource === 'additionalS') toDelete.push(wt.tagKey);
          }
          if (toDelete.length > 0) {
            await prisma.workTag.deleteMany({
              where: { workId: work.workId, tagKey: { in: toDelete } },
            });
          }

          if (useNewFormat) {
            const addSRaw = analysis.additionalSTags ?? [];
            const addS = addSRaw.filter(name => officialNameToKey.has(name.trim().toLowerCase()));
            if (addSRaw.length > addS.length) {
              console.log(`[Reanalyze] ${work.workId}: 追加SでS一覧にない語を除外 ${addSRaw.length}→${addS.length}`);
            }
            const aTags = analysis.aTags ?? [];
            const bTags = analysis.bTags ?? [];
            const cTags = analysis.cTags ?? [];
            console.log(`[Reanalyze] ${work.workId}: 追加S=${addS.length} A=${aTags.length} B=${bTags.length} C=${cTags.length}`);

            for (const displayName of addS) {
              const tagKey = officialNameToKey.get(displayName.toLowerCase());
              if (!tagKey) continue;
              await prisma.workTag.upsert({
                where: {
                  workId_tagKey: { workId: work.workId, tagKey },
                },
                create: {
                  workId: work.workId,
                  tagKey,
                  derivedSource: 'additionalS',
                  derivedConfidence: 0.9,
                },
                update: { derivedSource: 'additionalS', derivedConfidence: 0.9 },
              });
            }

            const allAbc = [...aTags, ...bTags, ...cTags];
            const seenAbc = new Set<string>();
            for (const displayName of allAbc) {
              const lower = displayName.toLowerCase();
              if (seenAbc.has(lower)) continue;
              seenAbc.add(lower);
              let finalTagKey = await resolveTagKeyForDisplayName(prisma, displayName);
              const hadExisting = finalTagKey != null;
              if (!finalTagKey) {
                finalTagKey = generateTagKey(displayName);
                await prisma.tag.create({
                  data: {
                    tagKey: finalTagKey,
                    displayName,
                    tagType: 'DERIVED',
                    category: 'その他',
                    questionTemplate: `${displayName}が特徴的だったりするのかしら？`,
                  },
                });
              }
              await prisma.workTag.upsert({
                where: {
                  workId_tagKey: { workId: work.workId, tagKey: finalTagKey },
                },
                create: {
                  workId: work.workId,
                  tagKey: finalTagKey,
                  derivedConfidence: 0.9,
                  derivedSource: hadExisting ? 'matched' : 'matched',
                },
                update: { derivedConfidence: 0.9, derivedSource: 'matched' },
              });
            }
          } else {
            const officialNameSet = new Set(officialTagNames.map(t => t.toLowerCase()));
            let filteredTags = analysis.derivedTags.filter(tag => !officialNameSet.has(tag.displayName.toLowerCase()));
            const seen = new Set<string>();
            filteredTags = filteredTags.filter(tag => {
              const lower = tag.displayName.toLowerCase();
              if (seen.has(lower)) return false;
              seen.add(lower);
              return true;
            });
            for (const tag of filteredTags) {
              let finalTagKey = await resolveTagKeyForDisplayName(prisma, tag.displayName);
              const hadExisting = finalTagKey != null;
              if (!finalTagKey) {
                finalTagKey = generateTagKey(tag.displayName);
                await prisma.tag.create({
                  data: {
                    tagKey: finalTagKey,
                    displayName: tag.displayName,
                    tagType: 'DERIVED',
                    category: tag.category || 'その他',
                    questionTemplate: `${tag.displayName}が特徴的だったりするのかしら？`,
                  },
                });
              }
              await prisma.workTag.upsert({
                where: {
                  workId_tagKey: { workId: work.workId, tagKey: finalTagKey },
                },
                create: {
                  workId: work.workId,
                  tagKey: finalTagKey,
                  derivedConfidence: tag.confidence,
                  derivedSource: hadExisting ? 'matched' : (tag.source || 'suggested'),
                },
                update: {
                  derivedConfidence: tag.confidence,
                  derivedSource: hadExisting ? 'matched' : (tag.source || 'suggested'),
                },
              });
            }
          }

          // キャラクタータグを保存（1つのみ）
        if (analysis.characterTags && analysis.characterTags.length > 0) {
          const charName = analysis.characterTags[0];
          console.log(`[Reanalyze] ${work.workId}: キャラクター名 "${charName}" を保存`);
          
          // 既存のキャラクタータグを削除
          const existingCharTags = await prisma.workTag.findMany({
            where: { workId: work.workId },
            include: { tag: true },
          });
          const charTagKeys = existingCharTags
            .filter(wt => wt.tag.tagType === 'STRUCTURAL')
            .map(wt => wt.tagKey);
          
          if (charTagKeys.length > 0) {
            await prisma.workTag.deleteMany({
              where: {
                workId: work.workId,
                tagKey: { in: charTagKeys }
              }
            });
          }
          
          // 新しいキャラクタータグを作成
          const charTagKey = generateTagKey(charName, 'STRUCTURAL');
          
          // 同名のSTRUCTURALタグがあるか確認
          const existingCharTag = await prisma.tag.findFirst({
            where: { displayName: charName, tagType: 'STRUCTURAL' }
          });
          
          if (!existingCharTag) {
            await prisma.tag.create({
              data: {
                tagKey: charTagKey,
                displayName: charName,
                tagType: 'STRUCTURAL',
                category: 'キャラクター',
                questionTemplate: `${charName}というキャラクターが登場する？`,
              },
            });
          }
          
          await prisma.workTag.create({
            data: {
              workId: work.workId,
              tagKey: existingCharTag?.tagKey || charTagKey,
            },
          });
          }

          // AIタグ付け済みマーク＋要注意フラグを反映
          await prisma.work.update({
            where: { workId: work.workId },
            data: {
              tagSource: 'ai',
              ...((resultNeedsReview || validationFailed) && { needsReview: true }),
            },
          });
        } else if (saveToDb && validationFailed) {
          await prisma.work.update({
            where: { workId: work.workId },
            data: { needsReview: true },
          });
        }

        const resultAdditionalS =
          useNewFormat && (analysis.additionalSTags ?? []).length > 0
            ? (analysis.additionalSTags ?? []).filter(name => officialNameToKey.has(name.trim().toLowerCase()))
            : undefined;
        results.push({
          workId: work.workId,
          title: work.title,
          derivedTags: (analysis.derivedTags ?? []).map(t => ({
            ...t,
            source: t.source || 'suggested',
            rank: t.rank ?? tagRanks[t.displayName] ?? '',
          })),
          ...(analysis.additionalSTags !== undefined && {
            additionalSTags: resultAdditionalS ?? [],
            aTags: analysis.aTags ?? [],
            bTags: analysis.bTags ?? [],
            cTags: analysis.cTags ?? [],
          }),
          characterTags: analysis.characterTags ?? [],
          ...(resultNeedsReview && { needsReview: true }),
          elapsed,
        });
      } catch (error) {
        results.push({
          workId: work.workId,
          title: work.title,
          derivedTags: [],
          characterTags: [],
          elapsed: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const totalElapsed = results.reduce((sum, r) => sum + r.elapsed, 0);
    const avgElapsed = results.length > 0 ? Math.round(totalElapsed / results.length) : 0;

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        success: results.filter(r => !r.error).length,
        failed: results.filter(r => r.error).length,
        totalElapsed,
        avgElapsed,
      },
    });
  } catch (error) {
    console.error('Error in reanalysis:', error);
    return NextResponse.json(
      { error: 'Failed to reanalyze' },
      { status: 500 }
    );
  }
}
