/**
 * .env + .env.local を読み、アプリと同じ DB に SessionWeightsSnapshot が無ければ作成する。
 * 実行: node scripts/ensure-session-weights-table.js（プロジェクトルートで）
 */
const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(root, '.env') });
require('dotenv').config({ path: path.join(root, '.env.local'), override: true });

// アプリと同じく file:./ を絶対パスに
let dbUrl = process.env.DATABASE_URL || '';
if (dbUrl.startsWith('file:')) {
  const withoutFile = dbUrl.slice(5);
  const q = withoutFile.indexOf('?');
  const pathPart = q >= 0 ? withoutFile.slice(0, q) : withoutFile;
  const rest = q >= 0 ? withoutFile.slice(q) : '';
  if (pathPart.startsWith('./') || pathPart.startsWith('.\\')) {
    const abs = path.resolve(process.cwd(), pathPart);
    if (fs.existsSync(abs)) process.env.DATABASE_URL = 'file:' + abs.replace(/\\/g, '/') + rest;
  }
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  const statements = [
    `CREATE TABLE IF NOT EXISTS "SessionWeightsSnapshot" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sessionId" TEXT NOT NULL,
      "qIndex" INTEGER NOT NULL,
      "weightsJson" TEXT NOT NULL,
      CONSTRAINT "SessionWeightsSnapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("sessionId") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "SessionWeightsSnapshot_sessionId_qIndex_key" ON "SessionWeightsSnapshot"("sessionId", "qIndex")`,
    `CREATE INDEX IF NOT EXISTS "SessionWeightsSnapshot_sessionId_idx" ON "SessionWeightsSnapshot"("sessionId")`,
  ];
  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
    console.log('OK:', stmt.slice(0, 55) + '...');
  }
  console.log('SessionWeightsSnapshot table ensured.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
