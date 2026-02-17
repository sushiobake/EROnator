#!/usr/bin/env tsx
/**
 * taggedAt の不正形式を ISO 8601 形式に変換する。
 * - ミリ秒（1771133520951）→ ISO
 * - スペース区切り（2026-02-15 11:06:33）→ ISO（Prisma は T と Z を期待）
 *
 * Usage: npx tsx scripts/fix-tagged-at-format.ts
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

const url = process.env.DATABASE_URL ?? '';
const isPostgres = url.startsWith('postgres');

async function main() {
  if (isPostgres) {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const r1 = await prisma.$executeRawUnsafe(`
      UPDATE "Work"
      SET "taggedAt" = to_timestamp(cast("taggedAt" as bigint) / 1000.0)::timestamptz
      WHERE "taggedAt" IS NOT NULL
        AND "taggedAt" ~ '^\\d+$'
        AND cast("taggedAt" as bigint) > 1000000000000
    `);
    const r2 = await prisma.$executeRawUnsafe(`
      UPDATE "Work"
      SET "taggedAt" = (regexp_replace("taggedAt", ' ', 'T') || 'Z')::timestamptz
      WHERE "taggedAt" IS NOT NULL
        AND "taggedAt" ~ '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$'
    `);
    const c1 = typeof r1 === 'number' ? r1 : (r1 as { count?: number })?.count ?? 0;
    const c2 = typeof r2 === 'number' ? r2 : (r2 as { count?: number })?.count ?? 0;
    console.log('Postgres: 不正形式の taggedAt を', c1 + c2, '件 ISO 形式に変換しました');
  } else {
    const fileMatch = url.match(/^file:(\.\/)?(.*?)(\?.*)?$/);
    const dbPath = fileMatch ? path.resolve(root, fileMatch[2]) : '';
    if (!dbPath || !fs.existsSync(dbPath)) {
      console.error('SQLite DB が見つかりません:', url);
      process.exit(1);
    }
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(dbPath);
    const rows = db.prepare('SELECT workId, taggedAt FROM Work WHERE taggedAt IS NOT NULL').all() as Array<{
      workId: string;
      taggedAt: string | number;
    }>;
    const updateStmt = db.prepare('UPDATE Work SET taggedAt = ? WHERE workId = ?');
    let fixed = 0;
    for (const row of rows) {
      const v = String(row.taggedAt).trim();
      let iso: string | null = null;
      if (/^\d+$/.test(v)) {
        const ms = parseInt(v, 10);
        if (ms >= 1000000000000) iso = new Date(ms).toISOString();
      } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) {
        iso = new Date(v.replace(' ', 'T') + 'Z').toISOString();
      }
      if (iso) {
        updateStmt.run(iso, row.workId);
        fixed++;
      }
    }
    db.close();
    console.log('SQLite: 不正形式の taggedAt を', fixed, '件 ISO 形式に変換しました');
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
