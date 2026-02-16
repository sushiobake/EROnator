#!/usr/bin/env tsx
/**
 * 指定した batch JSON の workId が「チェック待ち」に含まれるか確認する
 * Usage: npx tsx scripts/verify-check-pending.ts <jsonFileName>
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const jsonName = process.argv[2];
  if (!jsonName) {
    console.error('Usage: npx tsx scripts/verify-check-pending.ts <jsonFileName>');
    process.exit(1);
  }
  const jsonPath = path.join(process.cwd(), 'data', 'chatgpt-export', jsonName);
  if (!fs.existsSync(jsonPath)) {
    console.error('Not found:', jsonPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const data: Array<{ workId: string; title?: string }> = JSON.parse(raw);
  if (!Array.isArray(data) || data.length === 0) {
    console.error('Empty or invalid JSON array');
    process.exit(1);
  }
  const workIds = data.map((item) => item.workId);
  let works = await prisma.work.findMany({
    where: { workId: { in: workIds } },
    select: {
      workId: true,
      title: true,
      aiAnalyzed: true,
      humanChecked: true,
      tagSource: true,
      checkQueueAt: true,
      needsReview: true,
    },
  });
  const foundIds = new Set(works.map((w) => w.workId));
  const missing = workIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    const alternateIds = missing.flatMap((id) =>
      id.startsWith('cid:') ? [id.replace(/^cid:/, '')] : ['cid:' + id]
    );
    const extra = await prisma.work.findMany({
      where: { workId: { in: alternateIds } },
      select: {
        workId: true,
        title: true,
        aiAnalyzed: true,
        humanChecked: true,
        tagSource: true,
        checkQueueAt: true,
        needsReview: true,
      },
    });
    works = [...works, ...extra];
  }

  const byId = new Map(works.map((w) => [w.workId, w]));
  const jsonToDb = new Map<string, string>();
  for (const w of works) {
    jsonToDb.set(w.workId, w.workId);
    if (w.workId.startsWith('cid:')) {
      jsonToDb.set(w.workId.replace(/^cid:/, ''), w.workId);
    } else {
      jsonToDb.set('cid:' + w.workId, w.workId);
    }
  }

  // チェック待ちの条件（counts/route.ts の pending と同じ）
  const isPending = (w: { aiAnalyzed: boolean | null; humanChecked: boolean | null; tagSource: string | null; needsReview: boolean | null }) =>
    (w.needsReview === false || w.needsReview === null) &&
    w.aiAnalyzed === true &&
    (w.humanChecked === false || w.humanChecked === null) &&
    w.tagSource !== 'human';

  console.log('workId\ttitle\taiAnalyzed\thumanChecked\ttagSource\tcheckQueueAt\t★チェック待ち');
  console.log('---');
  let inPending = 0;
  for (const id of workIds) {
    const dbId = jsonToDb.get(id) ?? id;
    const w = byId.get(dbId);
    if (!w) {
      console.log(`${id}\t(not found in DB)\t-\t-\t-\t-\t-`);
      continue;
    }
    const pending = isPending(w);
    if (pending) inPending++;
    const queueAt = w.checkQueueAt ? w.checkQueueAt.toISOString().slice(0, 19) : '-';
    console.log(
      `${w.workId}\t${(w.title || '').slice(0, 30)}\t${w.aiAnalyzed}\t${w.humanChecked}\t${w.tagSource ?? 'null'}\t${queueAt}\t${pending ? 'YES' : 'NO'}`
    );
  }
  console.log('---');
  console.log(`チェック待ちに含まれる: ${inPending} / ${workIds.length}`);
  if (inPending === workIds.length) {
    console.log('→ 全件、チェック待ちにあります。');
  } else {
    console.log('→ 上記 NO の行はチェック待ち条件を満たしていません。');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
