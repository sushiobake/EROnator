/**
 * ビルド時にスキーマを自動切り替え
 * 環境に応じて SQLite または PostgreSQL スキーマを選択
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, '..', 'prisma');
const SCHEMA_FILE = path.join(SCHEMA_DIR, 'schema.prisma');
const SCHEMA_SQLITE = path.join(SCHEMA_DIR, 'schema.sqlite.prisma');
const SCHEMA_POSTGRES = path.join(SCHEMA_DIR, 'schema.postgres.prisma');

// Vercel環境かどうかを判定
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
// DATABASE_URLがPostgreSQLかどうかで判定
const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

if (isVercel || isPostgres) {
  // Vercel環境またはPostgreSQL URL → PostgreSQLスキーマ
  console.log('📝 環境を検出: PostgreSQLスキーマに切り替えます');
  if (fs.existsSync(SCHEMA_POSTGRES)) {
    fs.copyFileSync(SCHEMA_POSTGRES, SCHEMA_FILE);
    console.log('✅ PostgreSQLスキーマに切り替えました');
  } else {
    console.error('❌ schema.postgres.prisma が見つかりません');
    process.exit(1);
  }
} else {
  // ローカル開発環境 → SQLiteスキーマ
  console.log('📝 環境を検出: SQLiteスキーマに切り替えます');
  if (fs.existsSync(SCHEMA_SQLITE)) {
    fs.copyFileSync(SCHEMA_SQLITE, SCHEMA_FILE);
    console.log('✅ SQLiteスキーマに切り替えました');
  } else {
    console.error('❌ schema.sqlite.prisma が見つかりません');
    process.exit(1);
  }
}
