/**
 * ChatGPTインポートのロールバックスクリプト
 * インポートしたDERIVEDタグとSTRUCTURALタグ（characterName）を削除
 * 
 * Usage:
 *   npx ts-node scripts/rollback-chatgpt-import.ts [workIds...]
 * 
 * 引数なし: すべてのchatgpt由来のタグを削除
 * workIds指定: 指定した作品のタグのみ削除
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const workIds = process.argv.slice(2);
  
  console.log('🔄 ChatGPTインポートのロールバック開始');
  
  if (workIds.length > 0) {
    console.log(`   対象作品: ${workIds.length}件`);
    workIds.forEach(id => console.log(`     - ${id}`));
  } else {
    console.log('   対象: すべてのchatgpt由来タグ');
  }
  console.log('');
  
  // 削除対象のWorkTagを取得
  // まずchatgpt由来のDERIVEDタグを取得
  const chatgptWorkTags = await prisma.workTag.findMany({
    where: workIds.length > 0
      ? {
          workId: { in: workIds },
          derivedSource: { in: ['chatgpt-matched', 'chatgpt-suggested'] }
        }
      : {
          derivedSource: { in: ['chatgpt-matched', 'chatgpt-suggested'] }
        },
    include: {
      tag: true,
      work: {
        select: {
          workId: true,
          title: true
        }
      }
    }
  });
  
  // STRUCTURALタグ（キャラクター名）も取得
  const structuralWorkTags = await prisma.workTag.findMany({
    where: workIds.length > 0
      ? {
          workId: { in: workIds },
          tag: {
            tagType: 'STRUCTURAL'
          }
        }
      : {
          tag: {
            tagType: 'STRUCTURAL'
          }
        },
    include: {
      tag: true,
      work: {
        select: {
          workId: true,
          title: true
        }
      }
    }
  });
  
  // 重複を除去して結合
  const workTagsToDelete = [...chatgptWorkTags];
  const existingKeys = new Set(chatgptWorkTags.map(wt => `${wt.workId}_${wt.tagKey}`));
  structuralWorkTags.forEach(wt => {
    if (!existingKeys.has(`${wt.workId}_${wt.tagKey}`)) {
      workTagsToDelete.push(wt);
    }
  });
  
  console.log(`   削除対象: ${workTagsToDelete.length}件のWorkTag`);
  
  if (workTagsToDelete.length === 0) {
    console.log('   ✅ 削除対象がありません');
    return;
  }
  
  // 統計
  const byWork = new Map<string, number>();
  const byTag = new Map<string, number>();
  
  workTagsToDelete.forEach(wt => {
    byWork.set(wt.workId, (byWork.get(wt.workId) || 0) + 1);
    byTag.set(wt.tag.displayName, (byTag.get(wt.tag.displayName) || 0) + 1);
  });
  
  console.log(`   影響を受ける作品: ${byWork.size}件`);
  console.log(`   影響を受けるタグ: ${byTag.size}件`);
  console.log('');
  
  // 削除実行
  const tagKeysToDelete = [...new Set(workTagsToDelete.map(wt => wt.tagKey))];
  const workIdsToDelete = workIds.length > 0 ? workIds : [...new Set(workTagsToDelete.map(wt => wt.workId))];
  
  // chatgpt由来のDERIVEDタグを削除
  const deleted1 = await prisma.workTag.deleteMany({
    where: {
      workId: { in: workIdsToDelete },
      derivedSource: { in: ['chatgpt-matched', 'chatgpt-suggested'] }
    }
  });
  
  // STRUCTURALタグを削除
  const deleted2 = await prisma.workTag.deleteMany({
    where: {
      workId: { in: workIdsToDelete },
      tag: {
        tagType: 'STRUCTURAL'
      }
    }
  });
  
  const deleted = { count: deleted1.count + deleted2.count };
  
  console.log(`✅ ${deleted.count}件のWorkTagを削除しました`);
  
  // 使用されなくなったDERIVEDタグを削除（STRUCTURALは残す）
  const orphanedDerivedTags = await prisma.tag.findMany({
    where: {
      tagType: 'DERIVED',
      workTags: {
        none: {}
      }
    }
  });
  
  if (orphanedDerivedTags.length > 0) {
    const deletedTags = await prisma.tag.deleteMany({
      where: {
        tagType: 'DERIVED',
        workTags: {
          none: {}
        }
      }
    });
    console.log(`✅ ${deletedTags.count}件の孤立DERIVEDタグを削除しました`);
  }
  
  console.log('');
  console.log('📊 削除詳細:');
  console.log('   作品別:');
  Array.from(byWork.entries()).slice(0, 10).forEach(([workId, count]) => {
    const work = workTagsToDelete.find(wt => wt.workId === workId)?.work;
    console.log(`     ${workId}: ${count}件 ${work?.title.substring(0, 30) || ''}`);
  });
  if (byWork.size > 10) {
    console.log(`     ... 他 ${byWork.size - 10}件`);
  }
  
  console.log('');
  console.log('   タグ別:');
  Array.from(byTag.entries()).slice(0, 10).forEach(([tagName, count]) => {
    console.log(`     ${tagName}: ${count}件`);
  });
  if (byTag.size > 10) {
    console.log(`     ... 他 ${byTag.size - 10}件`);
  }
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
