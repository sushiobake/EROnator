#!/usr/bin/env tsx
/**
 * Work テーブルに needsHumanCheck カラムを追加する（無ければ）
 * Usage: npx tsx scripts/add-needs-human-check-column.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE Work ADD COLUMN needsHumanCheck INTEGER
  `);
  console.log('Added column needsHumanCheck to Work.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    const msg = String((e as Error)?.message ?? '');
    if (msg.includes('duplicate column name')) {
      console.log('Column needsHumanCheck already exists. Skipping.');
      process.exit(0);
    }
    console.error(e);
    process.exit(1);
  });
