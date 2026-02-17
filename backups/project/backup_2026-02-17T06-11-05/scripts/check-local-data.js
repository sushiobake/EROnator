/**
 * ローカルのSQLiteデータベースのデータを確認するスクリプト
 * .env の DATABASE_URL が SQLite を指している必要がある
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env' });

// SQLite用のPrisma Clientを作成
// 注意: PrismaスキーマがPostgreSQL用なので、直接SQLiteを読み取れない
// 代わりに、バックアップファイルの存在を確認

async function checkLocalData() {
  console.log('🔍 ローカルのデータを確認中...\n');

  try {
    // 現在のデータベースファイルの確認
    const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      console.log(`📦 データベースファイル: prisma/dev.db`);
      console.log(`   サイズ: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   最終更新: ${stats.mtime.toLocaleString('ja-JP')}`);
    } else {
      console.log('❌ prisma/dev.db が見つかりません');
    }

    // バックアップファイルの確認
    const backupsDir = path.join(__dirname, '..', 'backups');
    if (fs.existsSync(backupsDir)) {
      const backups = fs.readdirSync(backupsDir)
        .filter(f => f.endsWith('.db'))
        .map(f => {
          const fullPath = path.join(backupsDir, f);
          const stats = fs.statSync(fullPath);
          return {
            name: f,
            size: stats.size,
            mtime: stats.mtime,
          };
        })
        .sort((a, b) => b.mtime - a.mtime);

      console.log(`\n💾 バックアップファイル: ${backups.length}件`);
      if (backups.length > 0) {
        console.log('   最新のバックアップ:');
        backups.slice(0, 5).forEach(b => {
          console.log(`   - ${b.name} (${(b.size / 1024 / 1024).toFixed(2)} MB, ${b.mtime.toLocaleString('ja-JP')})`);
        });
      }
    }

    console.log('\n⚠️  注意: PrismaスキーマがPostgreSQL用のため、');
    console.log('   SQLiteデータベースの内容を直接確認できません。');
    console.log('   データを移行するには、別の方法が必要です。');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    throw error;
  }
}

// 実行
checkLocalData()
  .then(() => {
    console.log('\n✅ 確認完了');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ エラー:', error);
    process.exit(1);
  });
