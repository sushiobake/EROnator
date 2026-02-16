#!/usr/bin/env tsx
/**
 * 作品リスト1ページ目（createdAt desc）のうち、
 * 「眠泊3〜掌で踊る傲慢な女帝…」から「サキュバステードライフ総集編II」までを取得
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

const START_MARKER = '眠泊3'; // 眠泊3〜掌で踊る傲慢な女帝、狩人が獲物に変わる刻〜
const END_MARKER = 'サキュバステードライフ総集編II';

async function main() {
  // 1ページ目 = 先頭150件取得（50件範囲を確実に含むため多め）
  const works = await prisma.work.findMany({
    where: {},
    select: { workId: true, title: true, commentText: true },
    orderBy: { createdAt: 'desc' },
    take: 150,
  });

  let startIdx = works.findIndex((w) => w.title.includes(START_MARKER));
  let endIdx = works.findIndex((w) => w.title.includes(END_MARKER));

  if (startIdx === -1) {
    console.error('Start marker not found:', START_MARKER);
    process.exit(1);
  }
  if (endIdx === -1) {
    console.error('End marker not found:', END_MARKER);
    process.exit(1);
  }

  if (startIdx > endIdx) {
    [startIdx, endIdx] = [endIdx, startIdx];
  }

  const slice = works.slice(startIdx, endIdx + 1);
  const withComment = slice.filter((w) => w.commentText && w.commentText.trim().length > 0);

  const outDir = path.join(process.cwd(), 'data', 'chatgpt-export');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const rawPath = path.join(outDir, 'page1-range-works-raw.json');
  fs.writeFileSync(rawPath, JSON.stringify(slice, null, 2), 'utf-8');
  console.log('Written:', rawPath);
  console.log('Total in range:', slice.length);
  console.log('With comment:', withComment.length);

  // 分析用にコメントありのみ出力（タグ付け対象）
  const forAnalysisPath = path.join(outDir, 'page1-range-works-for-analysis.json');
  fs.writeFileSync(forAnalysisPath, JSON.stringify(withComment, null, 2), 'utf-8');
  console.log('For analysis (with comment):', forAnalysisPath);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
