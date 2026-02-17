#!/usr/bin/env tsx
/**
 * DBの状態を確認するスクリプト
 * 作品数、最新5件、最古5件を表示
 * Prismaが使えない場合は直接SQLiteで確認
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config();

async function main() {
  try {
    console.log('📊 DB状態確認\n');

    // DBファイルのパスを取得
    const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
    let dbPath = dbUrl.replace('file:', '');
    
    // クエリパラメータ（?mode=WALなど）を削除
    const queryIndex = dbPath.indexOf('?');
    if (queryIndex !== -1) {
      dbPath = dbPath.substring(0, queryIndex);
    }
    
    // 相対パスの場合は絶対パスに変換
    if (!path.isAbsolute(dbPath)) {
      dbPath = path.resolve(process.cwd(), dbPath);
    }

    // DBファイルの存在確認
    if (!fs.existsSync(dbPath)) {
      console.error(`❌ DBファイルが見つかりません: ${dbPath}`);
      console.error('   開発サーバーを起動してDBを作成してください');
      process.exit(1);
    }

    // 直接SQLiteで確認（Prismaがロックされている場合でも動作）
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqlite3 = require('better-sqlite3');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const db = sqlite3(dbPath, { readonly: true });

    try {
      // 全作品数
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const totalCountResult = db.prepare('SELECT COUNT(*) as count FROM Work').get() as { count: number };
      const totalCount = totalCountResult.count;
      console.log(`総作品数: ${totalCount}件\n`);

      if (totalCount === 0) {
        console.log('⚠️  DBに作品がありません');
        console.log('\n💡 次のコマンドでデータを取得できます:');
        console.log('   npm run import:dmm-batch -- --target=100');
        return;
      }

      // 最新5件（createdAt DESC）
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const latestWorks = db.prepare(`
        SELECT workId, title, authorName, createdAt, contentId, releaseDate
        FROM Work
        ORDER BY createdAt DESC
        LIMIT 5
      `).all() as Array<{
        workId: string;
        title: string;
        authorName: string;
        createdAt: string;
        contentId: string | null;
        releaseDate: string | null;
      }>;

      console.log('📅 最新5件（1ページ目に表示される）:');
      latestWorks.forEach((work, i) => {
        console.log(`  ${i + 1}. ${work.title}`);
        console.log(`     ID: ${work.workId} | 作者: ${work.authorName}`);
        console.log(`     作成日時: ${work.createdAt}`);
        if (work.contentId) console.log(`     contentId: ${work.contentId}`);
        if (work.releaseDate) console.log(`     発売日: ${work.releaseDate}`);
        console.log('');
      });

      // 最古5件（createdAt ASC）
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const oldestWorks = db.prepare(`
        SELECT workId, title, authorName, createdAt
        FROM Work
        ORDER BY createdAt ASC
        LIMIT 5
      `).all() as Array<{
        workId: string;
        title: string;
        authorName: string;
        createdAt: string;
      }>;

      console.log('📅 最古5件:');
      oldestWorks.forEach((work, i) => {
        console.log(`  ${i + 1}. ${work.title}`);
        console.log(`     ID: ${work.workId} | 作成日時: ${work.createdAt}`);
        console.log('');
      });

      // API取得データの有無（contentIdがあるかどうか）
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const apiDataResult = db.prepare(`
        SELECT COUNT(*) as count FROM Work WHERE contentId IS NOT NULL
      `).get() as { count: number };
      const apiDataCount = apiDataResult.count;

      console.log(`\n📡 API取得データ: ${apiDataCount}件（contentIdが設定されている作品）`);
      console.log(`📝 手動入力データ: ${totalCount - apiDataCount}件`);

      if (apiDataCount === 0 && totalCount > 0) {
        console.log('\n💡 API取得データがありません。次のコマンドで取得できます:');
        console.log('   npm run import:dmm-batch -- --target=100');
      }

    } finally {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      db.close();
    }

  } catch (error) {
    console.error('❌ エラー:', error);
    if (error instanceof Error) {
      if (error.message.includes('Unable to open the database file')) {
        console.error('\n💡 開発サーバーが実行中でDBがロックされている可能性があります');
        console.error('   開発サーバーを停止（Ctrl+C）してから再実行してください');
      }
    }
    process.exit(1);
  }
}

main();
