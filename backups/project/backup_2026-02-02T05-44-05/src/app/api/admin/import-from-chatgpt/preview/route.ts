/**
 * ChatGPTインポートプレビューAPI
 * ファイルをアップロードして整合性チェックと新規タグ検出を行う
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import * as fs from 'fs';
import * as path from 'path';

interface ImportItem {
  workId: string;
  title?: string;
  matchedTags?: Array<{ displayName: string; category?: string }>;
  suggestedTags?: Array<{ displayName: string; category?: string }>;
  characterName?: string | null;
}

interface PreviewWork {
  workId: string;
  dbTitle: string;
  chatgptTitle: string | null;
  titleMatch: boolean;
  matchedTags: Array<{
    displayName: string;
    category: string | null;
    isNew: boolean; // 新規タグかどうか
    existingTagKey?: string;
  }>;
  suggestedTags: Array<{
    displayName: string;
    category: string | null;
    isNew: boolean; // 新規タグかどうか
    existingTagKey?: string;
  }>;
  characterName: string | null;
  hasChanges: boolean; // 変更があるかどうか
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'ファイルが指定されていません' },
        { status: 400 }
      );
    }
    
    // ファイルを読み込み
    const fileContent = await file.text();
    let importData: ImportItem[];
    
    try {
      const parsed = JSON.parse(fileContent);
      // エクスポートファイル形式（metadata, prompt, officialTags, works）か、直接配列か
      if (parsed.works && Array.isArray(parsed.works)) {
        // エクスポートファイル形式から作品データを抽出
        importData = parsed.works;
      } else if (Array.isArray(parsed)) {
        // 直接配列形式
        importData = parsed;
      } else {
        throw new Error('無効なJSON形式です');
      }
    } catch (e) {
      return NextResponse.json(
        { success: false, error: `JSONパースエラー: ${e instanceof Error ? e.message : 'Unknown error'}` },
        { status: 400 }
      );
    }
    
    if (importData.length === 0) {
      return NextResponse.json(
        { success: false, error: '作品データが空です' },
        { status: 400 }
      );
    }
    
    // 整合性チェック
    const workIds = importData.map(item => item.workId);
    const works = await prisma.work.findMany({
      where: {
        workId: { in: workIds }
      },
      select: {
        workId: true,
        title: true,
      }
    });
    
    const workMap = new Map(works.map(w => [w.workId, w]));
    const missingWorkIds = workIds.filter(id => !workMap.has(id));
    
    if (missingWorkIds.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `存在しないworkIdが見つかりました: ${missingWorkIds.slice(0, 5).join(', ')}${missingWorkIds.length > 5 ? '...' : ''}` 
        },
        { status: 400 }
      );
    }
    
    // 既存のDERIVEDタグとSTRUCTURALタグを取得
    const existingWorkTags = await prisma.workTag.findMany({
      where: {
        workId: { in: workIds },
        tag: {
          tagType: { in: ['DERIVED', 'STRUCTURAL'] }
        }
      },
      include: {
        tag: true
      }
    });
    
    const normDisplay = (s: string) => (s || '').trim().normalize('NFC');
    // 既存タグマップを作成（trim・NFC正規化した名前でも照合できるように登録）
    const existingTagMap = new Map<string, { tagKey: string; displayName: string }>();
    existingWorkTags.forEach(wt => {
      const entry = { tagKey: wt.tag.tagKey, displayName: wt.tag.displayName };
      existingTagMap.set(`${wt.workId}_${wt.tag.displayName}`, entry);
      const n = normDisplay(wt.tag.displayName);
      existingTagMap.set(`${wt.workId}_${n}`, entry);
    });
    
    // すべてのDERIVEDタグを取得（新規タグ判定用）
    const allDerivedTags = await prisma.tag.findMany({
      where: {
        tagType: 'DERIVED'
      },
      select: {
        tagKey: true,
        displayName: true,
      }
    });
    
    // displayNameの正規化: trim + NFC（ユニコード正規化）で照合し、既存タグを正しく判定
    const norm = (s: string) => (s || '').trim().normalize('NFC');
    const derivedTagNameMap = new Map<string, string>();
    for (const t of allDerivedTags) {
      derivedTagNameMap.set(t.displayName, t.tagKey);
      derivedTagNameMap.set(norm(t.displayName), t.tagKey);
    }

    // プレビューデータを作成
    const previewWorks: PreviewWork[] = [];

    for (const item of importData) {
      const dbWork = workMap.get(item.workId);
      if (!dbWork) continue;

      const matchedTags = (item.matchedTags || []).map(tag => {
        const raw = tag.displayName || '';
        const name = norm(raw);
        const key = `${item.workId}_${name}`;
        const existing = existingTagMap.get(key) || existingTagMap.get(`${item.workId}_${raw}`);
        const existingTagKey = derivedTagNameMap.get(name) || derivedTagNameMap.get(raw);

        return {
          displayName: tag.displayName,
          category: tag.category || null,
          isNew: !existing && !existingTagKey, // 既存のWorkTagもDERIVEDタグもない場合は新規
          existingTagKey: existingTagKey || undefined,
        };
      });

      const suggestedTags = (item.suggestedTags || []).map(tag => {
        const raw = tag.displayName || '';
        const name = norm(raw);
        const key = `${item.workId}_${name}`;
        const existing = existingTagMap.get(key) || existingTagMap.get(`${item.workId}_${raw}`);
        const existingTagKey = derivedTagNameMap.get(name) || derivedTagNameMap.get(raw);

        return {
          displayName: tag.displayName,
          category: tag.category || null,
          isNew: !existing && !existingTagKey,
          existingTagKey: existingTagKey || undefined,
        };
      });
      
      const hasChanges = matchedTags.some(t => t.isNew) || 
                         suggestedTags.some(t => t.isNew) || 
                         (item.characterName && item.characterName.trim() !== '');
      
      previewWorks.push({
        workId: item.workId,
        dbTitle: dbWork.title,
        chatgptTitle: item.title || null,
        titleMatch: !item.title || item.title === dbWork.title,
        matchedTags,
        suggestedTags,
        characterName: item.characterName || null,
        hasChanges,
      });
    }
    
    // 統計
    const stats = {
      total: previewWorks.length,
      titleMismatches: previewWorks.filter(w => !w.titleMatch).length,
      newMatchedTags: previewWorks.reduce((sum, w) => sum + w.matchedTags.filter(t => t.isNew).length, 0),
      newSuggestedTags: previewWorks.reduce((sum, w) => sum + w.suggestedTags.filter(t => t.isNew).length, 0),
      worksWithChanges: previewWorks.filter(w => w.hasChanges).length,
    };
    
    return NextResponse.json({
      success: true,
      preview: {
        works: previewWorks,
        stats,
      }
    });
  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
