/**
 * Worker Thread 内で使われる prisma スタブ。
 * シミュレーションは全てインメモリキャッシュで動作するため DB 接続は不要。
 * esbuild alias で @/server/db/client をこれに差し替える。
 */
export const prisma = new Proxy({}, {
  get(_target, prop) {
    if (prop === '$connect' || prop === '$disconnect') {
      return () => Promise.resolve();
    }
    throw new Error(`[SimWorker] prisma.${String(prop)} called in worker - this should not happen. All data should be from in-memory cache.`);
  },
});

export async function ensurePrismaConnected(): Promise<void> {
  // no-op in worker
}
