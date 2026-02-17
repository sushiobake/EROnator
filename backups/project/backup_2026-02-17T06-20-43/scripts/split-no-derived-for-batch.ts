#!/usr/bin/env tsx
/**
 * no-derived-works-for-analysis.json を50件ずつ part-001.json, part-002.json ... に分割
 */

import * as fs from 'fs';
import * as path from 'path';

const BATCH_SIZE = 50;

function main() {
  const srcPath = path.join(process.cwd(), 'data', 'chatgpt-export', 'no-derived-works-for-analysis.json');
  const raw = fs.readFileSync(srcPath, 'utf-8');
  const works: Array<{ workId: string; title: string; commentText: string | null }> = JSON.parse(raw);

  const outDir = path.join(process.cwd(), 'data', 'chatgpt-export');
  let part = 1;
  for (let i = 0; i < works.length; i += BATCH_SIZE) {
    const chunk = works.slice(i, i + BATCH_SIZE);
    const outPath = path.join(outDir, `no-derived-part-${String(part).padStart(3, '0')}.json`);
    fs.writeFileSync(outPath, JSON.stringify(chunk, null, 2), 'utf-8');
    console.log(outPath, chunk.length);
    part++;
  }
  console.log('Total parts:', part - 1);
}

main();
