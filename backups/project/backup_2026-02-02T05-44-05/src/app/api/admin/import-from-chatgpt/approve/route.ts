/**
 * ChatGPTインポート一括承認API
 * プレビューで確認したデータをDBに反映
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { resolveTagKeyForDisplayName } from '@/server/admin/resolveTagByDisplayName';
import * as crypto from 'crypto';

interface ImportItem {
  workId: string;
  title?: string;
  matchedTags?: Array<{ displayName: string; category?: string }>;
  suggestedTags?: Array<{ displayName: string; category?: string }>;
  characterName?: string | null;
}

function generateTagKey(displayName: string): string {
  const hash = crypto.createHash('sha1').update(displayName, 'utf8').digest('hex').substring(0, 10);
  return `tag_${hash}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { importData } = body;
    
    if (!Array.isArray(importData) || importData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'importDataは配列で1件以上必要です' },
        { status: 400 }
      );
    }
    
    // 作品が存在するか確認
    const workIds = importData.map((item: ImportItem) => item.workId);
    const works = await prisma.work.findMany({
      where: {
        workId: { in: workIds }
      }
    });
    
    if (works.length !== workIds.length) {
      const foundIds = new Set(works.map(w => w.workId));
      const missing = workIds.filter(id => !foundIds.has(id));
      return NextResponse.json(
        { success: false, error: `存在しないworkId: ${missing.join(', ')}` },
        { status: 400 }
      );
    }
    
    const workMap = new Map(works.map(w => [w.workId, w]));
    
    // 統計
    let successCount = 0;
    let errorCount = 0;
    let newTagCount = 0;
    const errors: string[] = [];
    
    for (const item of importData) {
      try {
        const work = workMap.get(item.workId);
        if (!work) {
          errors.push(`${item.workId}: 作品が見つかりません`);
          errorCount++;
          continue;
        }
        
        // 既存のDERIVEDタグを削除（上書きモード）
        const existingTags = await prisma.workTag.findMany({
          where: { workId: item.workId },
          include: { tag: true },
        });
        
        const derivedTagKeys = existingTags
          .filter(wt => wt.tag.tagType === 'DERIVED')
          .map(wt => wt.tagKey);
        
        if (derivedTagKeys.length > 0) {
          await prisma.workTag.deleteMany({
            where: {
              workId: item.workId,
              tagKey: { in: derivedTagKeys }
            }
          });
        }
        
        // matchedTagsとsuggestedTagsを処理
        const allTags: Array<{ displayName: string; category?: string; isSuggested: boolean }> = [];
        if (item.matchedTags) {
          allTags.push(...item.matchedTags.map(t => ({ ...t, isSuggested: false })));
        }
        if (item.suggestedTags) {
          allTags.push(...item.suggestedTags.map(t => ({ ...t, isSuggested: true })));
        }
        
        // 各タグを処理
        for (const tagItem of allTags) {
          const trimmedName = tagItem.displayName.trim();
          if (!trimmedName || trimmedName.length < 2) continue;
          
          // 同名の OFFICIAL/DERIVED が既にあればその tagKey を使う（重複防止）
          let tagKey = await resolveTagKeyForDisplayName(prisma, trimmedName);
          let tag = tagKey ? await prisma.tag.findUnique({ where: { tagKey } }) : null;
          
          if (!tag) {
            tagKey = generateTagKey(trimmedName);
            tag = await prisma.tag.create({
              data: {
                tagKey,
                displayName: trimmedName,
                tagType: 'DERIVED',
                category: tagItem.category || 'その他'
              }
            });
            newTagCount++;
          } else {
            tagKey = tag.tagKey;
          }
          
          // WorkTagを作成
          await prisma.workTag.upsert({
            where: {
              workId_tagKey: {
                workId: item.workId,
                tagKey: tag.tagKey,
              }
            },
            create: {
              workId: item.workId,
              tagKey: tag.tagKey,
              derivedSource: tagItem.isSuggested ? 'chatgpt-suggested' : 'chatgpt-matched',
              derivedConfidence: 1.0,
            },
            update: {
              derivedSource: tagItem.isSuggested ? 'chatgpt-suggested' : 'chatgpt-matched',
              derivedConfidence: 1.0,
            },
          });
        }
        
        // キャラクター名を処理（STRUCTURALタグとして）
        if (item.characterName && item.characterName.trim()) {
          const charName = item.characterName.trim();
          const charTagKey = generateTagKey(charName);
          
          let charTag = await prisma.tag.findFirst({
            where: { displayName: charName, tagType: 'STRUCTURAL' }
          });
          
          if (!charTag) {
            charTag = await prisma.tag.create({
              data: {
                tagKey: charTagKey,
                displayName: charName,
                tagType: 'STRUCTURAL',
                category: 'キャラクター'
              }
            });
          }
          
          await prisma.workTag.upsert({
            where: {
              workId_tagKey: {
                workId: item.workId,
                tagKey: charTag.tagKey,
              }
            },
            create: {
              workId: item.workId,
              tagKey: charTag.tagKey,
            },
            update: {},
          });
        }
        
        successCount++;
      } catch (e) {
        const errorMsg = `${item.workId}: ${e instanceof Error ? e.message : 'Unknown error'}`;
        errors.push(errorMsg);
        errorCount++;
        console.error('Import error for', item.workId, e);
      }
    }
    
    return NextResponse.json({
      success: true,
      stats: {
        total: importData.length,
        success: successCount,
        error: errorCount,
        newTags: newTagCount,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Approve error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
