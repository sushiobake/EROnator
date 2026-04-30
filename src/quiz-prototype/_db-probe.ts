import { PrismaClient } from '@prisma/client';

const tried = new Set<string>();

async function tryCount(url: string) {
  if (tried.has(url)) return null;
  tried.add(url);
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    const total = await p.work.count();
    const registered = await p.work.count({ where: { gameRegistered: true } });
    return { url, total, registered };
  } catch {
    return null;
  } finally {
    await p.$disconnect();
  }
}

(async () => {
  const urls = [
    process.env.DATABASE_URL,
    'file:./prisma/dev.db',
    'file:./dev.db',
    'file:./prisma/prisma/dev.db',
  ].filter((x): x is string => !!x);

  for (const u of urls) {
    const r = await tryCount(u);
    if (r) console.log(JSON.stringify(r));
  }
})();
