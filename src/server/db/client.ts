import { PrismaClient } from '@prisma/client';

// Singleton Prisma client (server-side only)
// Vercel serverless functions用にグローバルスコープで管理
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// Vercel serverless functionsでもグローバルに保持（コールドスタート対策）
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}
