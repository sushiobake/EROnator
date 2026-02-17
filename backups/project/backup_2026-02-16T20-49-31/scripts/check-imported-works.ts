#!/usr/bin/env tsx
/**
 * インポートされた作品を確認するスクリプト
 * 重複した作品や最初のN件を表示
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // 全作品数を取得
    const totalCount = await prisma.work.count();
    console.log(`\n📊 インポートされた作品数: ${totalCount}件\n`);

    // 最初に保存された5件を取得（作成日時昇順）
    const first5Works = await prisma.work.findMany({
      orderBy: { createdAt: 'asc' },
      take: 5,
      include: {
        workTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // 最初の5件を表示
    console.log('=== 最初に保存された5件（作成日時順） ===\n');
    for (let i = 0; i < first5Works.length; i++) {
      const work = first5Works[i];
      const tags = work.workTags.map(wt => wt.tag.displayName).join(', ');
      
      console.log(`${i + 1}. ${work.title}`);
      console.log(`   workId: ${work.workId}`);
      console.log(`   作者: ${work.authorName}`);
      console.log(`   AI判定: ${work.isAi}`);
      console.log(`   レビュー: ${work.reviewCount ? `${work.reviewCount}件 (平均: ${work.reviewAverage?.toFixed(2)})` : 'なし'}`);
      console.log(`   タグ: ${tags || 'なし'}`);
      console.log(`   作成日時: ${work.createdAt.toISOString()}`);
      console.log('');
    }

    // 最新の5件も表示（参考用）
    const latest5Works = await prisma.work.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        workTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    console.log('=== 最新の5件（作成日時順） ===\n');
    for (let i = 0; i < latest5Works.length; i++) {
      const work = latest5Works[i];
      const tags = work.workTags.map(wt => wt.tag.displayName).join(', ');
      
      console.log(`${i + 1}. ${work.title}`);
      console.log(`   workId: ${work.workId}`);
      console.log(`   作者: ${work.authorName}`);
      console.log(`   作成日時: ${work.createdAt.toISOString()}`);
      console.log('');
    }

    // 全作品を取得（統計用）
    const allWorks = await prisma.work.findMany({
      include: {
        workTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    // 重複チェック（同じworkIdが複数あるか）
    const workIdCounts = new Map<string, number>();
    for (const work of allWorks) {
      workIdCounts.set(work.workId, (workIdCounts.get(work.workId) || 0) + 1);
    }

    const duplicates = Array.from(workIdCounts.entries())
      .filter(([, count]) => count > 1)
      .map(([workId]) => workId);

    if (duplicates.length > 0) {
      console.log('\n⚠️  重複しているworkId:');
      for (const workId of duplicates) {
        const works = allWorks.filter(w => w.workId === workId);
        console.log(`  ${workId}: ${works.length}件`);
        for (const work of works) {
          console.log(`    - ${work.title} (作成: ${work.createdAt.toISOString()})`);
        }
      }
    } else {
      console.log('\n✅ 重複はありません');
    }

    // スキップされた可能性のある作品を確認
    // （同じタイトルや似たタイトルがあるか）
    const titleMap = new Map<string, string[]>();
    for (const work of allWorks) {
      if (!titleMap.has(work.title)) {
        titleMap.set(work.title, []);
      }
      titleMap.get(work.title)!.push(work.workId);
    }

    const duplicateTitles = Array.from(titleMap.entries())
      .filter(([, workIds]) => workIds.length > 1);

    if (duplicateTitles.length > 0) {
      console.log('\n⚠️  同じタイトルで異なるworkId:');
      for (const [title, workIds] of duplicateTitles) {
        console.log(`  "${title}": ${workIds.join(', ')}`);
      }
    }

    // 統計情報
    console.log('\n📊 統計情報:');
    console.log(`  総作品数: ${allWorks.length}件`);
    console.log(`  AI判定: ${allWorks.filter(w => w.isAi === 'AI').length}件`);
    console.log(`  HAND判定: ${allWorks.filter(w => w.isAi === 'HAND').length}件`);
    console.log(`  UNKNOWN判定: ${allWorks.filter(w => w.isAi === 'UNKNOWN').length}件`);

    // タグ統計
    const tagCounts = new Map<string, number>();
    for (const work of allWorks) {
      for (const wt of work.workTags) {
        const tagName = wt.tag.displayName;
        tagCounts.set(tagName, (tagCounts.get(tagName) || 0) + 1);
      }
    }

    const topTags = Array.from(tagCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    console.log('\n📊 上位10タグ:');
    for (const [tagName, count] of topTags) {
      console.log(`  ${tagName}: ${count}件`);
    }

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    if (error instanceof Error) {
      console.error('   メッセージ:', error.message);
      console.error('   スタック:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
