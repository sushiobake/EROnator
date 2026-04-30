import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/prisma';

let selectedClientPromise: Promise<PrismaClient> | null = null;

async function countRegistered(client: PrismaClient): Promise<number> {
  try {
    return await client.work.count({ where: { gameRegistered: true } });
  } catch {
    return 0;
  }
}

export async function getQuizReadPrismaClient(): Promise<PrismaClient> {
  if (selectedClientPromise) return selectedClientPromise;

  selectedClientPromise = (async () => {
    const primaryCount = await countRegistered(defaultPrisma);
    if (primaryCount > 0) return defaultPrisma;

    // file:./dev.db はこのプロジェクトの実データDBを指す（read only usage）
    const fallback = new PrismaClient({
      datasources: { db: { url: 'file:./dev.db' } },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

    const fallbackCount = await countRegistered(fallback);
    if (fallbackCount > 0) return fallback;

    await fallback.$disconnect();
    return defaultPrisma;
  })();

  return selectedClientPromise;
}
