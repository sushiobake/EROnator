#!/usr/bin/env tsx
/**
 * Work テーブルに aiChecked カラムを追加する（無ければ）
 * aiChecked=true ＝ AIチェック済（問題なし）→ チェック済み扱い
 * Usage: npx tsx scripts/add-ai-checked-column.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE Work ADD COLUMN aiChecked INTEGER
  `);
  console.log('Added column aiChecked to Work.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    const msg = String((e as Error)?.message ?? '');
    if (msg.includes('duplicate column name')) {
      console.log('Column aiChecked already exists. Skipping.');
      process.exit(0);
    }
    console.error(e);
    process.exit(1);
  });
