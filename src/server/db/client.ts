import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

// Singleton Prisma client (server-side only)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaConnected: boolean | undefined;
};

/** DATABASE_URL の file:./ を絶対パスに変換（Next の cwd 差で別DBを参照しないようにする） */
function normalizeDatabaseUrl(): void {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.startsWith('file:')) return;
  const withoutFile = dbUrl.slice(5);
  const queryStart = withoutFile.indexOf('?');
  const pathPart = queryStart >= 0 ? withoutFile.slice(0, queryStart) : withoutFile;
  const queryPart = queryStart >= 0 ? withoutFile.slice(queryStart) : '';
  if (!pathPart.startsWith('./') && !pathPart.startsWith('.\\')) return;
  const absolutePath = path.resolve(process.cwd(), pathPart);
  if (!fs.existsSync(absolutePath)) {
    console.error('[db] Database file does not exist: ' + absolutePath);
    return;
  }
  const normalized = absolutePath.replace(/\\/g, '/');
  process.env.DATABASE_URL = 'file:' + normalized + queryPart;
}

normalizeDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/** Postgres で SessionWeightsSnapshot が無い場合に作成（Vercel ビルドで migrate が動かない場合のフォールバック） */
const POSTGRES_CREATE_SNAPSHOT_TABLE = `
CREATE TABLE IF NOT EXISTS "SessionWeightsSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "qIndex" INTEGER NOT NULL,
  "weightsJson" TEXT NOT NULL,
  CONSTRAINT "SessionWeightsSnapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("sessionId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SessionWeightsSnapshot_sessionId_qIndex_key" ON "SessionWeightsSnapshot"("sessionId", "qIndex");
CREATE INDEX IF NOT EXISTS "SessionWeightsSnapshot_sessionId_idx" ON "SessionWeightsSnapshot"("sessionId");
`.trim();

/**
 * Prisma Client の接続を確実にする（Vercel サーバーレス等で初回クエリ前に呼ぶ場合に使用）
 * SQLite の場合は WAL モードを有効化して読み書き同時実行を可能にする
 * Postgres の場合は SessionWeightsSnapshot が無ければ作成する（デプロイ先で migrate 未実行対策）
 */
export async function ensurePrismaConnected(): Promise<void> {
  if (globalForPrisma.prismaConnected) return;
  try {
    await prisma.$connect();
    globalForPrisma.prismaConnected = true;

    const dbUrl = process.env.DATABASE_URL ?? '';
    if (dbUrl.startsWith('file:') || dbUrl.startsWith('file://')) {
      try {
        await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL');
        await prisma.$queryRawUnsafe('PRAGMA busy_timeout=5000');
        console.log('[db] SQLite WAL mode enabled, busy_timeout=5000ms');
      } catch (e) {
        console.warn('[db] Failed to set WAL mode:', e);
      }
    } else if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
      try {
        for (const sql of POSTGRES_CREATE_SNAPSHOT_TABLE.split(';').map((s) => s.trim()).filter(Boolean)) {
          await prisma.$executeRawUnsafe(sql);
        }
        console.log('[db] Postgres: SessionWeightsSnapshot table ensured');
      } catch (e) {
        console.warn('[db] Postgres: ensure SessionWeightsSnapshot failed (may already exist):', e);
      }
    }
  } catch (error) {
    console.error('Failed to connect Prisma Client:', error);
    globalForPrisma.prismaConnected = false;
    throw error;
  }
}
