/**
 * ChatGPT用エクスポートスクリプト
 * DERIVEDタグ未付与の作品をJSON形式で出力
 * 
 * Usage:
 *   npx ts-node scripts/export-for-chatgpt.ts [options]
 * 
 * Options:
 *   --limit=100      出力件数（デフォルト: 100）
 *   --offset=0       スキップ件数（デフォルト: 0）
 *   --all            全作品を出力（DERIVEDタグ有無関係なく）
 *   --output=file    出力ファイル名（デフォルト: chatgpt-input-{timestamp}.json）
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface ExportWork {
  workId: string;
  title: string;
  commentText: string;
}

async function main() {
  const args = process.argv.slice(2);
  
  // オプション解析
  const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '100');
  const offset = parseInt(args.find(a => a.startsWith('--offset='))?.split('=')[1] || '0');
  const all = args.includes('--all');
  const outputArg = args.find(a => a.startsWith('--output='))?.split('=')[1];
  
  console.log('📤 ChatGPT用エクスポート開始');
  console.log(`   Limit: ${limit}, Offset: ${offset}, Mode: ${all ? '全作品' : 'タグ未付与のみ'}`);
  
  // DB接続テスト
  const testCount = await prisma.work.count();
  console.log(`   DB接続テスト: ${testCount}作品`);
  
  // 作品を取得
  const where = all 
    ? { commentText: { not: null } }
    : {
        commentText: { not: null },
        NOT: {
          workTags: {
            some: {
              tag: { tagType: 'DERIVED' }
            }
          }
        }
      };
  
  const [works, total] = await Promise.all([
    prisma.work.findMany({
      where,
      select: {
        workId: true,
        title: true,
        commentText: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.work.count({ where }),
  ]);
  
  console.log(`   対象作品: ${total}件中 ${works.length}件を出力`);
  
  if (works.length === 0) {
    console.log('⚠️ 出力対象の作品がありません');
    return;
  }
  
  // エクスポートデータを作成
  const exportData: ExportWork[] = works.map(w => ({
    workId: w.workId,
    title: w.title,
    commentText: w.commentText || '',
  }));
  
  // 出力ファイル名
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputDir = path.join(process.cwd(), 'data', 'chatgpt-export');
  const outputFile = outputArg || `chatgpt-input-${timestamp}.json`;
  const outputPath = path.join(outputDir, outputFile);
  
  // ディレクトリ作成
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // JSON出力
  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
  
  console.log(`✅ エクスポート完了`);
  console.log(`   ファイル: ${outputPath}`);
  console.log(`   作品数: ${exportData.length}件`);
  
  // 次のバッチ用情報
  if (offset + works.length < total) {
    console.log(`\n📌 次のバッチ: --offset=${offset + limit}`);
  }
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
