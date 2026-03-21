/**
 * ローカル SQLite（アプリが実際に使う prisma/dev.db）に ContactInquiry テーブルが無い場合だけ作成する。
 * スキーマ全体の db push がデータ損失警告で止まる環境でも、お問い合わせ機能を有効にできる。
 *
 * .env / .env.local の DATABASE_URL を読み、db-push-with-env-local.js と同じ絶対パス解決を行う。
 */
const path = require('path');
const Database = require('better-sqlite3');

const root = path.resolve(__dirname, '..');
try {
  require('dotenv').config({ path: path.join(root, '.env') });
  require('dotenv').config({ path: path.join(root, '.env.local'), override: true });
} catch (_) {}

function resolveSqlitePath() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.startsWith('file:')) {
    console.error('DATABASE_URL が file: で始まる SQLite を指していません。');
    process.exit(1);
  }
  const withoutFile = dbUrl.slice(5);
  const queryStart = withoutFile.indexOf('?');
  const pathPart = queryStart >= 0 ? withoutFile.slice(0, queryStart) : withoutFile;
  if (!pathPart.startsWith('./') && !pathPart.startsWith('.\\')) {
    return pathPart.replace(/\//g, path.sep);
  }
  return path.resolve(root, pathPart);
}

const dbPath = resolveSqlitePath();
console.log('SQLite:', dbPath);

const db = new Database(dbPath);

const createSql = `
CREATE TABLE IF NOT EXISTS "ContactInquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;
const indexSql = `CREATE INDEX IF NOT EXISTS "ContactInquiry_createdAt_idx" ON "ContactInquiry"("createdAt");`;

db.exec(createSql);
db.exec(indexSql);
db.close();

console.log('✅ ContactInquiry テーブル（とインデックス）を確認・作成しました。');
