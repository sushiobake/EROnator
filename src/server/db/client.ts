import { PrismaClient } from '@prisma/client';

// Singleton Prisma client (server-side only)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// デバッグ: 接続確認（本番では削除）
if (process.env.NODE_ENV !== 'production') {
  console.log('Prisma Client initialized, DATABASE_URL:', process.env.DATABASE_URL ? 'exists' : 'missing');
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
