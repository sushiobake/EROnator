import { PrismaClient } from '@prisma/client';

// Singleton Prisma client (server-side only)
// Vercel serverless functions用にグローバルスコープで管理
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaConnected: boolean | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error', 'warn'],
  });

// Vercel serverless functionsでもグローバルに保持（コールドスタート対策）
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

/**
 * Prisma Clientの接続を確実にする
 * Vercelのサーバーレス関数では、最初のリクエスト時に明示的に接続する必要がある
 */
export async function ensurePrismaConnected(): Promise<void> {
  if (globalForPrisma.prismaConnected) {
    return; // 既に接続済み
  }

  try {
    await prisma.$connect();
    globalForPrisma.prismaConnected = true;
    console.log('Prisma Client connected successfully');
  } catch (error) {
    console.error('Failed to connect Prisma Client:', error);
    globalForPrisma.prismaConnected = false;
    throw error;
  }
}
