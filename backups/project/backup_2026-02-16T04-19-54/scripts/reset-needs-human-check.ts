#!/usr/bin/env tsx
/**
 * 全作品の needsHumanCheck を null に戻す（人間要チェックタブを 0 件にする）
 * AIチェックで「問題あり」とされた作品だけ、あらためて needsHumanCheck=true にすればよい。
 * Usage: npx tsx scripts/reset-needs-human-check.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$executeRawUnsafe(`
    UPDATE Work SET needsHumanCheck = NULL WHERE needsHumanCheck = 1
  `);
  console.log(JSON.stringify({ success: true, message: 'needsHumanCheck を全件 NULL にしました。人間要チェックタブは 0 件になります。', updated: result }));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
