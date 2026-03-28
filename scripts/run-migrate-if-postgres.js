/**
 * DATABASE_URL が Postgres のときだけ prisma migrate deploy を実行する。
 * npm run build（Vercel 本番/プレビュービルド）に組み込み、デプロイ時に未適用マイグレーションを本番/プレビュー DB に当てる。
 *
 * スキップする場合:
 *   SKIP_PRISMA_MIGRATE_ON_BUILD=1  … 緊急時のみ（スキーマズレの再発リスクあり）
 *
 * Vercel: Production / Preview の環境変数に DATABASE_URL がビルド時に渡ること（通常はデフォルトで渡る）。
 */
const { execSync } = require('child_process');
const path = require('path');

if (process.env.SKIP_PRISMA_MIGRATE_ON_BUILD === '1') {
  console.log('[migrate] Skip: SKIP_PRISMA_MIGRATE_ON_BUILD=1');
  process.exit(0);
}

const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://');

if (!isPostgres) {
  console.log('[migrate] Skip: DATABASE_URL is not Postgres (ローカル SQLite ビルドなど)。');
  process.exit(0);
}

console.log('[migrate] Postgres を検出。prisma migrate deploy を実行します…');
const cwd = path.resolve(__dirname, '..');
execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd, env: process.env });
console.log('[migrate] migrate deploy 完了。');
