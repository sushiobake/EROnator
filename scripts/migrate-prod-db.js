/**
 * 本番 Postgres DB にマイグレーションを適用するスクリプト
 *
 * 使い方:
 *   1. .env.local に PROD_DATABASE_URL="postgresql://..." を追記
 *   2. npm run db:migrate:prod
 *
 *   または環境変数で直接指定:
 *   PROD_DATABASE_URL="postgresql://..." npm run db:migrate:prod
 *
 * PROD_DATABASE_URL が未設定の場合は DATABASE_URL を使用します。
 * DATABASE_URL が Postgres でない場合はエラーで終了します。
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');

// .env / .env.local を読み込む（dotenv が無い環境向けに簡易パーサ）
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

loadEnvFile(path.join(root, '.env'));
loadEnvFile(path.join(root, '.env.local'));

const prodUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL || '';

if (!prodUrl.startsWith('postgresql://') && !prodUrl.startsWith('postgres://')) {
  console.error('');
  console.error('ERROR: Postgres の DATABASE_URL が見つかりません。');
  console.error('');
  console.error('.env.local に以下を追記してください:');
  console.error('  PROD_DATABASE_URL="postgresql://<本番のURL>"');
  console.error('');
  console.error('Supabase の場合は Project Settings → Database → Connection string (URI) から取得できます。');
  process.exit(1);
}

const schemaFile = path.join(root, 'prisma', 'schema.prisma');
const postgresSchema = path.join(root, 'prisma', 'schema.postgres.prisma');
const sqliteSchema = path.join(root, 'prisma', 'schema.sqlite.prisma');

// 元のスキーマを保持
const originalSchema = fs.readFileSync(schemaFile, 'utf8');
const maskedUrl = prodUrl.replace(/:\/\/[^@]+@/, '://***:***@');
console.log(`\n本番 DB: ${maskedUrl}`);
console.log('PostgreSQL スキーマに切り替えています...\n');

try {
  fs.copyFileSync(postgresSchema, schemaFile);

  const env = { ...process.env, DATABASE_URL: prodUrl };
  execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: root, env });

  console.log('\nmigrate deploy 完了。');
} catch (e) {
  console.error('\nmigrate deploy に失敗しました:', e.message);
  process.exitCode = 1;
} finally {
  // スキーマを元に戻す（SQLite）
  if (fs.existsSync(sqliteSchema)) {
    fs.copyFileSync(sqliteSchema, schemaFile);
  } else {
    fs.writeFileSync(schemaFile, originalSchema, 'utf8');
  }
  console.log('SQLite スキーマに戻しました。');
}
