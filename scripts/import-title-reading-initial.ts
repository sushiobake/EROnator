#!/usr/bin/env tsx
/**
 * ChatGPT の出力（workId<TAB>読み1文字）を DB にインポート
 * Usage: npx tsx scripts/import-title-reading-initial.ts
 *   data/chatgpt-export/title-reading-initial-result-*.txt を読み込む
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
const OUT_DIR = path.join(root, 'data', 'chatgpt-export');

const KATAKANA_ONE = /^[ァ-ヶー]$/;

async function main() {
  const files = fs.readdirSync(OUT_DIR)
    .filter((f) => f.startsWith('title-reading-initial-result-') && f.endsWith('.txt'))
    .sort();

  if (files.length === 0) {
    console.log('❌ title-reading-initial-result-*.txt が見つかりません');
    console.log(`   ${OUT_DIR} に ChatGPT の出力を保存してください`);
    process.exit(1);
  }

  const entries: Array<{ workId: string; initial: string }> = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(OUT_DIR, file), 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const tabIdx = trimmed.indexOf('\t');
      if (tabIdx < 0) continue;
      const workId = trimmed.slice(0, tabIdx).trim();
      const initial = trimmed.slice(tabIdx + 1).trim();
      if (!workId) continue;
      if (initial === '?' || !KATAKANA_ONE.test(initial)) continue;
      entries.push({ workId, initial });
    }
  }

  let updated = 0;
  for (const { workId, initial } of entries) {
    const r = await prisma.work.updateMany({
      where: { workId },
      data: { titleReadingInitial: initial },
    });
    updated += r.count;
  }

  console.log(`読み込み: ${entries.length} 件`);
  console.log(`更新: ${updated} 件`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
