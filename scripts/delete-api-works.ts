#!/usr/bin/env tsx
/**
 * API取得データ（contentIdがある作品）を削除するスクリプト
 * 関連するWorkTagも自動的に削除される（CASCADE）
 * Prismaが使えない場合は直接SQLiteで操作
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config();

async function main() {
  try {
    console.log('🗑️  API取得データの削除\n');

    // DBファイルのパスを取得
    const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
    let dbPath = dbUrl.replace('file:', '');
    
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

    // 直接SQLiteで操作（Prismaがロックされている場合でも動作）
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqlite3 = require('better-sqlite3');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
    const db = sqlite3(dbPath);

    try {
      // 削除対象の件数を確認
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const targetCountResult = db.prepare(`
        SELECT COUNT(*) as count FROM Work WHERE contentId IS NOT NULL
      `).get() as { count: number };
      const targetCount = targetCountResult.count;

      if (targetCount === 0) {
        console.log('✅ 削除対象のデータはありません');
        return;
      }

      console.log(`削除対象: ${targetCount}件（contentIdが設定されている作品）\n`);

      // 確認
      console.log('⚠️  本当に削除しますか？');
      console.log('   この操作は取り消せません。\n');

      // 削除実行（WorkTagはCASCADEで自動削除される）
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = db.prepare(`
        DELETE FROM Work WHERE contentId IS NOT NULL
      `).run();

      console.log(`✅ ${result.changes}件の作品を削除しました`);
      console.log('   （関連するWorkTagも自動的に削除されました）\n');

      // 残りの作品数を確認
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const remainingCountResult = db.prepare('SELECT COUNT(*) as count FROM Work').get() as { count: number };
      const remainingCount = remainingCountResult.count;
      console.log(`📊 残りの作品数: ${remainingCount}件`);

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
