#!/usr/bin/env tsx
/** 旧AI10件に checkQueueAt = now を設定してチェック待ち先頭に */
import { PrismaClient } from '@prisma/client';

const LEGACY_10 = [
  'd_623317', 'd_150811', 'd_161054', 'd_172858', 'd_177026',
  'd_200670', 'd_219198', 'd_219615', 'd_242308', 'd_251200',
];

const prisma = new PrismaClient();

async function main() {
  const now = new Date().toISOString();
  // Prisma client に checkQueueAt がない場合もあるため raw SQL で実行
  await prisma.$executeRawUnsafe(
    `UPDATE Work SET checkQueueAt = ? WHERE workId IN (${LEGACY_10.map(() => '?').join(',')})`,
    now,
    ...LEGACY_10
  );
  console.log(JSON.stringify({ success: true, count: LEGACY_10.length, checkQueueAt: now }));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
