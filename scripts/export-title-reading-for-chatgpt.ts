#!/usr/bin/env tsx
/**
 * titleReadingInitial が未設定の作品を ChatGPT 用にエクスポート
 * 漢字・英字・数字始まりの作品リストを出力
 * Usage: npx tsx scripts/export-title-reading-for-chatgpt.ts
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
const LINES_PER_FILE = 500;

async function main() {
  const works = await prisma.work.findMany({
    where: {
      titleReadingInitial: null,
      commentText: { not: null },
    },
    select: { workId: true, title: true },
    orderBy: { workId: 'asc' },
  });

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const lines = works.map((w) => `${w.workId}\t${(w.title ?? '').replace(/\r?\n/g, ' ')}`);

  const instructionPath = path.join(OUT_DIR, 'title-reading-initial-instruction.txt');
  const instruction = fs.readFileSync(instructionPath, 'utf-8');

  const totalFiles = Math.ceil(lines.length / LINES_PER_FILE);
  for (let i = 0; i < totalFiles; i++) {
    const chunk = lines.slice(i * LINES_PER_FILE, (i + 1) * LINES_PER_FILE);
    const fileNum = String(i + 1).padStart(3, '0');
    const outPath = path.join(OUT_DIR, `title-reading-initial-list-${fileNum}.txt`);
    fs.writeFileSync(outPath, chunk.join('\n'), 'utf-8');
    console.log(`  ${outPath} (${chunk.length} 件)`);

    const pastePath = path.join(OUT_DIR, `title-reading-initial-paste-${fileNum}.txt`);
    const pasteContent = instruction.replace(
      '{{LIST_PLACEHOLDER}}',
      `※ 以下が ${fileNum} 番目のリスト（${chunk.length}件）\n\n${chunk.join('\n')}`
    );
    fs.writeFileSync(pastePath, pasteContent, 'utf-8');
    console.log(`  ${pastePath} (指示+リスト、そのまま貼り付け用)`);
  }

  console.log(`\n合計: ${works.length} 件を ${totalFiles} ファイルに出力`);
  console.log(`\n使い方:`);
  console.log(`  1. title-reading-initial-paste-001.txt 等を開き、全文を ChatGPT に貼り付け`);
  console.log(`  2. ChatGPT の出力を title-reading-initial-result-001.txt 等に保存`);
  console.log(`  3. npm run import:title-reading-initial で DB に反映`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
