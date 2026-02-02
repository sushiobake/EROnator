/**
 * DERIVED再抽出API
 * 既存のDB作品に対してAI分析を再実行する
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { analyzeWithCloudflareAi, analyzeWithHuggingFace, analyzeWithGroq } from '@/server/ai/cloudflareAi';
import { getABTagList } from '@/config/aiPrompt';
import { buildDynamicSystemPrompt } from '@/config/aiPrompt';
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

/**
 * AI分析を実行
 * 優先順位: Groq > Cloudflare > HuggingFace
 */
async function analyzeWork(commentText: string, systemPrompt: string) {
  const aiProvider = process.env.ERONATOR_AI_PROVIDER || 'auto';
  
  // 明示的に指定されている場合
  if (aiProvider === 'groq') {
    return await analyzeWithGroq(commentText, systemPrompt);
  }
  if (aiProvider === 'cloudflare') {
    return await analyzeWithCloudflareAi(commentText, systemPrompt);
  }
  if (aiProvider === 'huggingface') {
    return await analyzeWithHuggingFace(commentText, systemPrompt);
  }
  
  // auto: 設定されているAPIを優先的に使用
  // Groq優先（高速・無料枠大）
  if (process.env.GROQ_API_KEY) {
    console.log('[AI] Using Groq (auto-detected)');
    return await analyzeWithGroq(commentText, systemPrompt);
  }
  
  // Cloudflare
  if (process.env.CLOUDFLARE_WORKER_AI_URL) {
    console.log('[AI] Using Cloudflare (auto-detected)');
    return await analyzeWithCloudflareAi(commentText, systemPrompt);
  }
  
  // HuggingFace（フォールバック）
  if (process.env.HUGGINGFACE_API_TOKEN) {
    console.log('[AI] Using HuggingFace (auto-detected)');
    return await analyzeWithHuggingFace(commentText, systemPrompt);
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

// POST: AI分析を実行してDBに保存
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { workIds } = body;

    if (!Array.isArray(workIds) || workIds.length === 0) {
      return NextResponse.json(
        { error: 'workIds is required' },
        { status: 400 }
      );
    }

    // 作品を取得（workIdで検索 - GETで返すidはworkIdフィールド）
    const works = await prisma.work.findMany({
      where: { workId: { in: workIds } },
    });

    const results: Array<{
      workId: string;
      title: string;
      derivedTags: Array<{ displayName: string; confidence: number; category: string | null; source: string; rank?: string }>;
      characterTags: string[];
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
    
    // 動的にプロンプト生成（最新のOFFICIALタグを使用）
    const systemPrompt = buildDynamicSystemPrompt(officialTagNames);
    
    // A/Bリストを取得（照合用）
    const abTagList = getABTagList();
    const abTagSet = new Set(abTagList.map(t => t.toLowerCase()));
    console.log(`[Reanalyze] A/B tag list loaded: ${abTagList.length} tags`);
    
    // タグランクを取得
    const tagRanks = getTagRanks();
    
    // A/Bリストとの部分一致照合関数
    // 例: 「電マ責め」→「電マ」、「温泉旅行」→「温泉」
    const findMatchingABTag = (tagName: string): string | null => {
      const lowerName = tagName.toLowerCase();
      // 完全一致チェック
      if (abTagSet.has(lowerName)) {
        return abTagList.find(t => t.toLowerCase() === lowerName) || null;
      }
      // 部分一致チェック（A/Bタグがtagに含まれている場合）
      for (const abTag of abTagList) {
        if (lowerName.includes(abTag.toLowerCase()) && abTag.length >= 2) {
          console.log(`[Reanalyze] 部分一致: "${tagName}" → "${abTag}"`);
          return abTag;
        }
      }
      return null;
    };

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
        // OFFICIALタグのSetを作成（除外用、上で取得済み）
        const officialNameSet = new Set(officialTagNames.map(t => t.toLowerCase()));
        
        // AI分析を実行
        let analysis = await analyzeWork(work.commentText, systemPrompt);
        
        // OFFICIALタグを除外
        let filteredTags = analysis.derivedTags.filter(tag => {
          const isOfficial = officialNameSet.has(tag.displayName.toLowerCase());
          if (isOfficial) {
            console.log(`[Reanalyze] ${work.workId}: "${tag.displayName}" は有名タグ(S)のため除外`);
          }
          return !isOfficial;
        });
        
        // A/Bリストとの部分一致照合で変換
        filteredTags = filteredTags.map(tag => {
          const matchedAB = findMatchingABTag(tag.displayName);
          if (matchedAB && matchedAB !== tag.displayName) {
            console.log(`[Reanalyze] ${work.workId}: "${tag.displayName}" → "${matchedAB}" (A/Bリスト一致)`);
            return { ...tag, displayName: matchedAB, source: 'matched' as const };
          }
          return tag;
        });
        
        // 重複を除去（同じdisplayNameのタグが複数ある場合）
        const seen = new Set<string>();
        filteredTags = filteredTags.filter(tag => {
          const lower = tag.displayName.toLowerCase();
          if (seen.has(lower)) return false;
          seen.add(lower);
          return true;
        });
        
        console.log(`[Reanalyze] ${work.workId}: AI returned ${analysis.derivedTags.length} tags, ${filteredTags.length} after filtering`);
        
        // 有効タグが0件なら再取得（1回まで）
        if (filteredTags.length === 0 && analysis.derivedTags.length > 0) {
          console.log(`[Reanalyze] ${work.workId}: 全てSタグと被ったため再取得します...`);
          
          // 再取得用のプロンプトを追加
          const retryPrompt = systemPrompt + `\n\n【追加指示 - 再取得】
先ほどの提案（${analysis.derivedTags.map(t => t.displayName).join('、')}）は全て有名タグ(S)と被っていたため無効でした。

【必ず準有名タグリストから選んでください】
1. 準有名タグリストを上から順に見て、作品に該当するものを探す
2. コメントに直接書いてなくても、内容から推測できるタグを選ぶ
3. 有名タグ(S)は絶対に使わない

例えば、作品が「催淫」「洗脳」系なら → 「催眠」を選ぶ
例えば、作品が「お屋敷」「メイド」系なら → 「屋敷」「家政婦」を選ぶ`;
          
          analysis = await analyzeWork(work.commentText, retryPrompt);
          
          // 再度フィルタ
          const retryFilteredTags = analysis.derivedTags.filter(tag => {
            return !officialNameSet.has(tag.displayName.toLowerCase());
          });
          
          console.log(`[Reanalyze] ${work.workId}: 再取得で ${analysis.derivedTags.length} tags, ${retryFilteredTags.length} after filtering`);
          
          // 再取得結果を使用
          analysis = { ...analysis, derivedTags: retryFilteredTags };
        } else {
          analysis = { ...analysis, derivedTags: filteredTags };
        }
        
        const elapsed = Date.now() - startTime;

        // 既存のDERIVEDタグを削除（上書きモード）
        const existingDerivedTags = await prisma.workTag.findMany({
          where: { workId: work.workId },
          include: { tag: true },
        });
        const derivedTagKeys = existingDerivedTags
          .filter(wt => wt.tag.tagType === 'DERIVED')
          .map(wt => wt.tagKey);
        
        if (derivedTagKeys.length > 0) {
          await prisma.workTag.deleteMany({
            where: {
              workId: work.workId,
              tagKey: { in: derivedTagKeys }
            }
          });
        }

        // DBに保存（OFFICIALは使わない、DERIVEDのみ）
        for (const tag of analysis.derivedTags) {
          // 同名のDERIVEDタグがあるか確認
          const existingDerived = await prisma.tag.findFirst({
            where: { displayName: tag.displayName, tagType: 'DERIVED' }
          });
          
          let finalTagKey: string;
          
          if (existingDerived) {
            // 既存DERIVEDを使用
            finalTagKey = existingDerived.tagKey;
            console.log(`[Reanalyze] Tag: "${tag.displayName}" → 既存DERIVEDを使用 (${finalTagKey})`);
          } else {
            // 新規作成
            finalTagKey = generateTagKey(tag.displayName);
            console.log(`[Reanalyze] Tag: "${tag.displayName}" → 新規DERIVED作成 (${finalTagKey})`);
            
            await prisma.tag.create({
              data: {
                tagKey: finalTagKey,
                displayName: tag.displayName,
                tagType: 'DERIVED',
                category: tag.category || 'その他',
              },
            });
          }

          // WorkTagを作成
          await prisma.workTag.upsert({
            where: {
              workId_tagKey: {
                workId: work.workId,
                tagKey: finalTagKey,
              }
            },
            create: {
              workId: work.workId,
              tagKey: finalTagKey,
              derivedConfidence: tag.confidence,
              derivedSource: existingDerived ? 'matched' : (tag.source || 'suggested'),
            },
            update: {
              derivedConfidence: tag.confidence,
              derivedSource: existingDerived ? 'matched' : (tag.source || 'suggested'),
            },
          });
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

        results.push({
          workId: work.workId,
          title: work.title,
          derivedTags: analysis.derivedTags.map(t => ({
            ...t,
            source: t.source || 'suggested',
            rank: tagRanks[t.displayName] || '',
          })),
          characterTags: analysis.characterTags,
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
