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

/**
 * Prisma Client の接続を確実にする（Vercel サーバーレス等で初回クエリ前に呼ぶ場合に使用）
 */
export async function ensurePrismaConnected(): Promise<void> {
  if (globalForPrisma.prismaConnected) return;
  try {
    await prisma.$connect();
    globalForPrisma.prismaConnected = true;
    if (process.env.NODE_ENV === 'development') {
      console.log('Prisma Client connected successfully');
    }
  } catch (error) {
    console.error('Failed to connect Prisma Client:', error);
    globalForPrisma.prismaConnected = false;
    throw error;
  }
}
