#!/usr/bin/env tsx
/**
 * manual-analysis-no-derived-part*.json を1つにマージして
 * manual-analysis-no-derived-424works.json を出力
 */

import * as fs from 'fs';
import * as path from 'path';

const outDir = path.join(process.cwd(), 'data', 'chatgpt-export');
const files = fs.readdirSync(outDir).filter((f) => /^manual-analysis-no-derived-part\d+\.json$/.test(f)).sort((a, b) => {
  const na = parseInt(a.replace(/\D/g, ''), 10);
  const nb = parseInt(b.replace(/\D/g, ''), 10);
  return na - nb;
});

const merged: unknown[] = [];
for (const f of files) {
  const raw = fs.readFileSync(path.join(outDir, f), 'utf-8');
  const arr = JSON.parse(raw);
  if (Array.isArray(arr)) merged.push(...arr);
}

const outPath = path.join(outDir, 'manual-analysis-no-derived-424works.json');
fs.writeFileSync(outPath, JSON.stringify(merged, null, 2), 'utf-8');
console.log('Merged', merged.length, 'items ->', outPath);
