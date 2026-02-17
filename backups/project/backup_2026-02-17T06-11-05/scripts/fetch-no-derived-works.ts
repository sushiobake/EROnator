#!/usr/bin/env tsx
/**
 * タグ未抽出（DERIVEDタグが0件）かつコメントありの作品を全件取得し、
 * 分析用JSON（workId, title, commentText）を出力する。
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const works = await prisma.work.findMany({
    where: {
      commentText: { not: null },
      NOT: {
        workTags: {
          some: {
            tag: { tagType: 'DERIVED' },
          },
        },
      },
    },
    select: { workId: true, title: true, commentText: true },
    orderBy: { id: 'asc' },
  });

  const withComment = works.filter((w) => w.commentText && String(w.commentText).trim().length > 0);

  const outDir = path.join(process.cwd(), 'data', 'chatgpt-export');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'no-derived-works-for-analysis.json');
  fs.writeFileSync(outPath, JSON.stringify(withComment, null, 2), 'utf-8');

  console.log('Written:', outPath);
  console.log('Total (no DERIVED, with comment):', withComment.length);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
