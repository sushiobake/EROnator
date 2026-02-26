#!/usr/bin/env tsx
/**
 * 既存作品の titleReadingInitial をバックフィル（ひらがな/カタカナ始まりのみ機械設定）
 * 漢字・英字始まりは Phase0 タグ付け時に AI が設定する。
 * Usage: npx tsx scripts/backfill-title-reading-initial.ts
 */
import * as path from 'path';
import * as fs from 'fs';

const root = path.resolve(process.cwd());
function loadDatabaseUrl(): string | null {
  for (const name of ['.env.local', '.env']) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    const content = fs.readFileSync(p, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^DATABASE_URL=(.+)$/);
      if (match) {
        const val = match[1].trim().replace(/^["']|["']$/g, '');
        if (val) return val;
        break;
      }
    }
  }
  return null;
}
const urlFromFile = loadDatabaseUrl();
if (urlFromFile) {
  const fileMatch = urlFromFile.match(/^file:(\.\/)?(.*?)(\?.*)?$/);
  if (fileMatch) {
    const absolutePath = path.resolve(root, fileMatch[2]);
    const suffix = fileMatch[3] || '';
    process.env.DATABASE_URL = 'file:' + absolutePath.replace(/\\/g, '/') + suffix;
  } else {
    process.env.DATABASE_URL = urlFromFile;
  }
} else {
  require('dotenv').config({ path: path.join(root, '.env') });
}

import { PrismaClient } from '@prisma/client';
import { getTitleReadingInitialFromTitle } from '../src/server/utils/titleCharType';

const prisma = new PrismaClient();

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  const isPostgres = url.startsWith('postgres');

  // カラム追加（既存DB用）
  if (isPostgres) {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "titleReadingInitial" TEXT'
    );
  } else {
    const tableInfo = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info(Work)');
    if (!tableInfo.some((c) => c.name === 'titleReadingInitial')) {
      await prisma.$executeRawUnsafe('ALTER TABLE Work ADD COLUMN titleReadingInitial TEXT');
      console.log('SQLite: titleReadingInitial カラムを追加しました');
    }
  }

  const works = await prisma.work.findMany({
    where: {
      titleReadingInitial: null,
      commentText: { not: null },
    },
    select: { workId: true, title: true },
  });

  const toUpdate: Array<{ workId: string; initial: string }> = [];
  for (const work of works) {
    const initial = getTitleReadingInitialFromTitle(work.title ?? '');
    if (initial) {
      toUpdate.push({ workId: work.workId, initial });
    }
  }

  const BATCH = 100;
  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH);
    await prisma.$transaction(
      batch.map(({ workId, initial }) =>
        prisma.work.update({
          where: { workId },
          data: { titleReadingInitial: initial },
        })
      )
    );
  }

  console.log(`対象: ${works.length} 件（titleReadingInitial が null）`);
  console.log(`更新: ${toUpdate.length} 件（ひらがな/カタカナ始まりを機械設定）`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
