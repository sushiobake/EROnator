#!/usr/bin/env tsx
/**
 * 指定した batch JSON の workId をすべて「チェック済み」にする
 * Usage: npx tsx scripts/mark-batch-checked.ts <jsonFileName>
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const jsonName = process.argv[2];
  if (!jsonName) {
    console.error('Usage: npx tsx scripts/mark-batch-checked.ts <jsonFileName>');
    process.exit(1);
  }
  const jsonPath = path.join(process.cwd(), 'data', 'chatgpt-export', jsonName);
  if (!fs.existsSync(jsonPath)) {
    console.error('Not found:', jsonPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const data: Array<{ workId: string }> = JSON.parse(raw);
  if (!Array.isArray(data) || data.length === 0) {
    console.error('Empty or invalid JSON array');
    process.exit(1);
  }
  const requestedWorkIds = [...new Set(data.map((item) => item.workId))];
  let works = await prisma.work.findMany({
    where: { workId: { in: requestedWorkIds } },
    select: { workId: true },
  });
  const foundIds = new Set(works.map((w) => w.workId));
  const missing = requestedWorkIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    const alternateIds = missing.flatMap((id) =>
      id.startsWith('cid:') ? [id.replace(/^cid:/, '')] : ['cid:' + id]
    );
    const extra = await prisma.work.findMany({
      where: { workId: { in: alternateIds } },
      select: { workId: true },
    });
    works = [...works, ...extra];
  }
  const dbWorkIds = [...new Set(works.map((w) => w.workId))];

  const result = await prisma.work.updateMany({
    where: { workId: { in: dbWorkIds } },
    data: { humanChecked: true },
  });

  console.log(
    JSON.stringify({
      success: true,
      requested: requestedWorkIds.length,
      updated: result.count,
      message: '上記 workId をチェック済み（humanChecked: true）にしました。',
    })
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
