/**
 * DATABASE_URL が Postgres の場合のみ prisma migrate deploy を実行する。
 * ビルド時: Vercel ではリモート DB にマイグレーションを適用する。ローカル（SQLite）ではスキップ。
 */
const { execSync } = require('child_process');
const path = require('path');

const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

if (!isPostgres) {
  console.log('[migrate] Skip: DATABASE_URL is not Postgres (local or SQLite).');
  process.exit(0);
}

console.log('[migrate] Running prisma migrate deploy for Postgres...');
const cwd = path.resolve(__dirname, '..');
execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd, env: process.env });
console.log('[migrate] Done.');
