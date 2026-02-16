#!/usr/bin/env tsx
/**
 * OFFICIALタグの重複確認（同一 displayName で複数 tagKey があるか）
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function norm(s: string): string {
  return (s || '').trim().normalize('NFC');
}

async function main() {
  const tags = await prisma.tag.findMany({
    where: { tagType: 'OFFICIAL' },
    select: { tagKey: true, displayName: true, category: true },
  });

  const byName = new Map<string, Array<{ tagKey: string; category: string | null }>>();
  for (const t of tags) {
    const k = norm(t.displayName);
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k)!.push({ tagKey: t.tagKey, category: t.category });
  }

  const dups = Array.from(byName.entries()).filter(([, arr]) => arr.length > 1);

  console.log('OFFICIAL total:', tags.length);
  console.log('Unique displayName count:', byName.size);
  console.log('Duplicate displayNames:', dups.length);
  if (dups.length > 0) {
    console.log('\nSample duplicates (first 20):');
    dups.slice(0, 20).forEach(([name, arr]) => {
      console.log(`  "${name}" => ${arr.length} keys:`, arr.map((a) => `${a.tagKey} (category=${a.category})`).join(', '));
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
