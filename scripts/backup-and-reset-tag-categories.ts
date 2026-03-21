#!/usr/bin/env tsx
/**
 * タグのカテゴリをいったん「未分類」に揃える前のバックアップ＋一括更新。
 * - バックアップ: .backup/tag-category-backup-YYYYMMDD.json に tagKey + category を保存
 * - 更新: 全 Tag の category を '未分類' に設定（tagType は触らない。SABCX はそのまま）
 *
 * Usage: npx tsx scripts/backup-and-reset-tag-categories.ts
 */
import * as path from 'path';
import * as fs from 'fs';

const root = path.resolve(process.cwd());

function loadEnv(): void {
  for (const name of ['.env.local', '.env']) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    const content = fs.readFileSync(p, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim().replace(/^["']|["']$/g, '');
        if (key && !process.env[key]) process.env[key] = val;
      }
    }
    break;
  }
}

loadEnv();
require('dotenv').config({ path: path.join(root, '.env') });
require('dotenv').config({ path: path.join(root, '.env.local') });
// Resolve file: DB path to absolute so script can open DB from any cwd
const dbUrl = process.env.DATABASE_URL ?? '';
if (dbUrl.startsWith('file:')) {
  const fileMatch = dbUrl.match(/^file:(\.\/)?(.*?)(\?.*)?$/);
  if (fileMatch) {
    const absolutePath = path.resolve(root, fileMatch[2]);
    const suffix = fileMatch[3] || '';
    process.env.DATABASE_URL = 'file:' + absolutePath.replace(/\\/g, '/') + suffix;
  }
}

const UNCATEGORIZED = '未分類';

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  const tags = await prisma.tag.findMany({
    select: { tagKey: true, category: true },
    orderBy: { tagKey: 'asc' },
  });

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const backupDir = path.join(root, '.backup');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `tag-category-backup-${date}.json`);
  const backupData = {
    exportedAt: new Date().toISOString(),
    note: 'Tag.tagKey and Tag.category before reset to 未分類',
    count: tags.length,
    tags: tags.map((t) => ({ tagKey: t.tagKey, category: t.category })),
  };
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log('Backup written:', backupPath, `(${tags.length} tags)`);

  const result = await prisma.tag.updateMany({
    data: { category: UNCATEGORIZED },
  });
  console.log('Updated Tag.category to "' + UNCATEGORIZED + '":', result.count, 'rows');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
