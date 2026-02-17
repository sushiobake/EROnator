#!/usr/bin/env tsx
/**
 * Work に taggedAt カラムを追加し、既存のタグ済み作品の taggedAt を updatedAt でバックフィルする。
 * タグ済み一覧の「新しい順」を「タグ済みに入れた日時」で整列できるようにする。
 * Usage: npx tsx scripts/add-tagged-at-and-backfill.ts
 * 初回のみ実行すればよい。
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

const prisma = new PrismaClient();

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  const isPostgres = url.startsWith('postgres');

  if (isPostgres) {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "taggedAt" TIMESTAMPTZ'
    );
    await prisma.$executeRawUnsafe(
      'ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "lastCheckTagChanges" TEXT'
    );
    console.log('Postgres: taggedAt / lastCheckTagChanges カラムを追加しました（既存の場合はスキップ）');
    const result = await prisma.$executeRawUnsafe(
      'UPDATE "Work" SET "taggedAt" = "updatedAt" WHERE "manualTaggingFolder" = $1 AND "taggedAt" IS NULL',
      'tagged'
    );
    const count = typeof result === 'number' ? result : (result as { count?: number })?.count ?? 0;
    console.log('タグ済みのバックフィル:', count, '件');
  } else {
    const tableInfo = await prisma.$queryRawUnsafe<
      Array<{ cid: number; name: string; type: string; notnull: number; dflt_value: unknown; pk: number }>
    >('PRAGMA table_info(Work)');
    const hasTaggedAt = tableInfo.some((c) => c.name === 'taggedAt');
    const hasLastCheck = tableInfo.some((c) => c.name === 'lastCheckTagChanges');
    if (!hasTaggedAt) {
      await prisma.$executeRawUnsafe('ALTER TABLE Work ADD COLUMN taggedAt TEXT');
      console.log('SQLite: taggedAt カラムを追加しました');
    }
    if (!hasLastCheck) {
      await prisma.$executeRawUnsafe('ALTER TABLE Work ADD COLUMN lastCheckTagChanges TEXT');
      console.log('SQLite: lastCheckTagChanges カラムを追加しました');
    }
    if (hasTaggedAt && hasLastCheck) {
      console.log('SQLite: カラムは既に存在します');
    }
    const result = await prisma.$executeRawUnsafe(
      "UPDATE Work SET taggedAt = updatedAt WHERE manualTaggingFolder = 'tagged' AND (taggedAt IS NULL OR taggedAt = '')"
    );
    const count = typeof result === 'number' ? result : (result as { count?: number })?.count ?? 0;
    console.log('タグ済みのバックフィル:', count, '件');
  }

  console.log('完了。タグ済み一覧は「タグ済みに入れた日時」の新しい順で整列されます。');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
