/**
 * .env と .env.local を読み込んでから prisma db push を実行する。
 * アプリ（npm run dev）と同じ DATABASE_URL でスキーマを同期し、
 * SessionWeightsSnapshot 等の不足テーブルを追加する。
 *
 * 【重要】SQLite の相対パスは Prisma CLI が prisma/schema.prisma のあるディレクトリ基準で解決する。
 * DATABASE_URL=file:./prisma/dev.db は CLI では prisma/prisma/dev.db になり、アプリ（Next の cwd 基準の
 * prisma/dev.db）と別ファイルを更新してしまう。そのため、ここでプロジェクトルート基準の絶対パスに直してから push する。
 */
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });
require('dotenv').config({ path: path.join(root, '.env.local'), override: true });

/** src/server/db/client.ts と同じ考え方（存在チェックはしない — 新規作成も許可） */
function resolveSqliteDatabaseUrlForPrismaCli() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.startsWith('file:')) return;
  const withoutFile = dbUrl.slice(5);
  const queryStart = withoutFile.indexOf('?');
  const pathPart = queryStart >= 0 ? withoutFile.slice(0, queryStart) : withoutFile;
  const queryPart = queryStart >= 0 ? withoutFile.slice(queryStart) : '';
  if (!pathPart.startsWith('./') && !pathPart.startsWith('.\\')) return;
  const absolutePath = path.resolve(root, pathPart);
  const normalized = absolutePath.replace(/\\/g, '/');
  process.env.DATABASE_URL = 'file:' + normalized + queryPart;
}

console.log('DATABASE_URL (from .env + .env.local):', process.env.DATABASE_URL ? 'set' : 'not set');
resolveSqliteDatabaseUrlForPrismaCli();
if ((process.env.DATABASE_URL || '').startsWith('file:')) {
  console.log('[db:push] SQLite file (resolved for Prisma CLI):', process.env.DATABASE_URL);
}

try {
  require('./auto-switch-schema.js');
} catch (e) {
  console.warn('[db:push] auto-switch-schema:', e.message);
}

const skipGenerate = process.argv.includes('--skip-generate');
execSync(`npx prisma db push${skipGenerate ? ' --skip-generate' : ''}`, {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});
