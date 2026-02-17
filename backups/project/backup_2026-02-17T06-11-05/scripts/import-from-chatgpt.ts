/**
 * ChatGPT結果インポートスクリプト
 * ChatGPTの出力（JSON）をDBに取り込む
 * 
 * Usage:
 *   npx ts-node scripts/import-from-chatgpt.ts <input-file>
 * 
 * 入力JSON形式:
 *   [
 *     { "workId": "d_123456", "tags": ["タグ1", "タグ2"] },
 *     ...
 *   ]
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { resolveTagKeyForDisplayName } from '../src/server/admin/resolveTagByDisplayName';

const prisma = new PrismaClient();

interface TagItem {
  displayName: string;
  confidence?: number;
  category?: string | null;
}

interface ImportItem {
  workId: string;
  title?: string; // 検証用（オプション）
  matchedTags?: TagItem[]; // 既存設計準拠
  suggestedTags?: TagItem[]; // 既存設計準拠
  characterName?: string | null;
  // 後方互換性のため（旧形式）
  tags?: string[];
}

function generateTagKey(displayName: string): string {
  const hash = crypto.createHash('sha1').update(displayName, 'utf8').digest('hex').substring(0, 10);
  return `tag_${hash}`;
}

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

async function main() {
  const inputFile = process.argv[2];
  const originalFile = process.argv[3]; // 元のエクスポートファイル（整合性チェック用）
  const skipValidation = process.argv.includes('--skip-validation');
  
  if (!inputFile) {
    console.error('Usage: npx ts-node scripts/import-from-chatgpt.ts <input-file> [original-file] [--skip-validation]');
    console.error('  original-file: 元のエクスポートファイル（整合性チェック用、オプション）');
    process.exit(1);
  }
  
  // ファイルパスを解決
  const inputPath = path.isAbsolute(inputFile) 
    ? inputFile 
    : path.join(process.cwd(), 'data', 'chatgpt-export', inputFile);
  
  if (!fs.existsSync(inputPath)) {
    console.error(`ファイルが見つかりません: ${inputPath}`);
    process.exit(1);
  }
  
  console.log('📥 ChatGPT結果インポート開始');
  console.log(`   ファイル: ${inputPath}`);
  
  // JSONを読み込み
  const content = fs.readFileSync(inputPath, 'utf-8');
  let items: ImportItem[];
  
  try {
    items = JSON.parse(content);
  } catch (e) {
    console.error('JSONパースエラー:', e);
    process.exit(1);
  }
  
  if (!Array.isArray(items)) {
    console.error('JSONは配列形式である必要があります');
    process.exit(1);
  }
  
  console.log(`   データ件数: ${items.length}件`);
  
  // 整合性チェック（元ファイルが指定されている場合）
  if (originalFile && !skipValidation) {
    console.log('');
    console.log('🔍 整合性チェック実行中...');
    const originalPath = path.isAbsolute(originalFile)
      ? originalFile
      : path.join(process.cwd(), originalFile);
    
    if (fs.existsSync(originalPath)) {
      try {
        const originalData = JSON.parse(fs.readFileSync(originalPath, 'utf-8'));
        const originalIds = originalData.map((w: any) => w.workId).sort();
        const outputIds = items.map(w => w.workId).sort();
        
        const missingIds = originalIds.filter((id: string) => !outputIds.includes(id));
        const extraIds = outputIds.filter(id => !originalIds.includes(id));
        
        if (originalData.length !== items.length) {
          console.error(`❌ 件数不一致: 送った${originalData.length}件 → 返ってきた${items.length}件`);
          if (missingIds.length > 0) {
            console.error(`   ⚠️ 不足しているworkId: ${missingIds.join(', ')}`);
          }
          if (extraIds.length > 0) {
            console.error(`   ⚠️ 余分なworkId: ${extraIds.join(', ')}`);
          }
          console.error('');
          console.error('⚠️ 整合性チェックに失敗しました。');
          console.error('   インポートを続行する場合は --skip-validation を指定してください。');
          process.exit(1);
        }
        
        if (missingIds.length > 0 || extraIds.length > 0) {
          console.error(`❌ workId不一致:`);
          if (missingIds.length > 0) {
            console.error(`   ⚠️ 不足: ${missingIds.join(', ')}`);
          }
          if (extraIds.length > 0) {
            console.error(`   ⚠️ 余分: ${extraIds.join(', ')}`);
          }
          console.error('');
          console.error('⚠️ 整合性チェックに失敗しました。');
          console.error('   インポートを続行する場合は --skip-validation を指定してください。');
          process.exit(1);
        }
        
        console.log('✅ 整合性チェックOK');
      } catch (e) {
        console.warn(`⚠️ 整合性チェックエラー: ${e}`);
        console.warn('   チェックをスキップして続行します...');
      }
    } else {
      console.warn(`⚠️ 元ファイルが見つかりません: ${originalPath}`);
      console.warn('   チェックをスキップして続行します...');
    }
    console.log('');
  }
  
  // タグランクを取得
  const tagRanks = getTagRanks();
  
  // 統計
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  let newTagCount = 0;
  
  for (const item of items) {
    if (!item.workId) {
      console.warn(`⚠️ 不正なデータ: ${JSON.stringify(item)}`);
      errorCount++;
      continue;
    }
    
    // 作品が存在するか確認
    const work = await prisma.work.findUnique({
      where: { workId: item.workId }
    });
    
    if (!work) {
      console.warn(`⚠️ 作品が見つかりません: ${item.workId}`);
      skipCount++;
      continue;
    }
    
    // title検証（ずれ防止）
    if (item.title && item.title !== work.title) {
      console.warn(`⚠️ タイトル不一致: ${item.workId}`);
      console.warn(`   ChatGPT: ${item.title}`);
      console.warn(`   DB: ${work.title}`);
      console.warn(`   続行しますが、確認してください`);
    }
    
    // タグを統合（既存設計: matchedTags + suggestedTags、後方互換: tags）
    const allTags: TagItem[] = [];
    if (item.matchedTags && Array.isArray(item.matchedTags)) {
      allTags.push(...item.matchedTags);
    }
    if (item.suggestedTags && Array.isArray(item.suggestedTags)) {
      allTags.push(...item.suggestedTags);
    }
    // 後方互換性（旧形式）
    if (item.tags && Array.isArray(item.tags)) {
      allTags.push(...item.tags.map(t => ({ displayName: t })));
    }
    
    // タグがない場合はスキップ
    if (allTags.length === 0) {
      console.warn(`⚠️ タグが空: ${item.workId} (${work.title})`);
      skipCount++;
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
    
    // 各タグを処理
    for (const tagItem of allTags) {
      const trimmedName = tagItem.displayName.trim();
      if (!trimmedName || trimmedName.length < 2) continue;
      
      // Bタグチェック（Aタグのみ使用すべき）
      const rank = tagRanks[trimmedName];
      if (rank === 'B') {
        console.warn(`⚠️ Bタグ使用: "${trimmedName}" (${item.workId}) - Aタグのみ使用してください`);
      }
      
      // 同名の OFFICIAL/DERIVED が既にあればその tagKey を使う（重複防止）
      let tagKey = await resolveTagKeyForDisplayName(prisma, trimmedName);
      let tag = tagKey ? await prisma.tag.findUnique({ where: { tagKey } }) : null;
      const isSuggested = item.suggestedTags?.some(t => t.displayName === trimmedName);

      if (!tag) {
        if (!isSuggested) {
          console.warn(`⚠️ matchedTagsにリスト外タグ: "${trimmedName}" (${item.workId})`);
          continue; // matchedTagsはリスト内のみ許可
        }
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
        console.log(`   ★ ${trimmedName} (新規タグ - suggested)`);
      } else {
        tagKey = tag.tagKey;
        // ランクがA/Bリストにあるか確認
        const rank = tagRanks[trimmedName];
        if (rank === 'A' || rank === 'B') {
          console.log(`   ✓ ${trimmedName} [${rank}]`);
        }
      }

      // WorkTagを作成
      await prisma.workTag.upsert({
        where: {
          workId_tagKey: {
            workId: item.workId,
            tagKey,
          }
        },
        create: {
          workId: item.workId,
          tagKey,
          derivedSource: isSuggested ? 'chatgpt-suggested' : 'chatgpt-matched',
          derivedConfidence: tagItem.confidence || 1.0,
        },
        update: {
          derivedSource: isSuggested ? 'chatgpt-suggested' : 'chatgpt-matched',
          derivedConfidence: tagItem.confidence || 1.0,
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
  }
  
  console.log(`\n✅ インポート完了`);
  console.log(`   成功: ${successCount}件`);
  console.log(`   スキップ: ${skipCount}件`);
  console.log(`   エラー: ${errorCount}件`);
  console.log(`   新規タグ: ${newTagCount}件`);
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
