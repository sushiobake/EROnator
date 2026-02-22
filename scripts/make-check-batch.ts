#!/usr/bin/env tsx
/**
 * check-result.json から指定範囲の 10 件前後を切り出して
 * check-batch-temp.json に保存する補助スクリプト。
 *
 * Usage:
 *   npx tsx scripts/make-check-batch.ts <startIndex> <count>
 *
 * 例: 先頭 10 件を出力する場合
 *   npx tsx scripts/make-check-batch.ts 0 10
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(process.cwd());
const RESULT_PATH = path.join(root, 'data', 'chatgpt-export', 'check-result.json');
const BATCH_TEMP_PATH = path.join(root, 'data', 'chatgpt-export', 'check-batch-temp.json');

function main() {
  const startArg = process.argv[2];
  const countArg = process.argv[3];

  if (!startArg || !countArg) {
    console.error('Usage: npx tsx scripts/make-check-batch.ts <startIndex> <count>');
    process.exit(1);
  }

  const start = Number.parseInt(startArg, 10);
  const count = Number.parseInt(countArg, 10);

  if (!Number.isFinite(start) || !Number.isFinite(count) || start < 0 || count <= 0) {
    console.error('startIndex と count は 0 以上の整数で指定してください。');
    process.exit(1);
  }

  if (!fs.existsSync(RESULT_PATH)) {
    console.error('check-result.json が見つかりません:', RESULT_PATH);
    process.exit(1);
  }

  const raw = fs.readFileSync(RESULT_PATH, 'utf-8');
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('check-result.json のパースに失敗しました:', e);
    process.exit(1);
  }

  const arr = Array.isArray(data) ? data : [data];
  if (arr.length === 0) {
    console.error('check-result.json が空です。');
    process.exit(1);
  }

  const end = Math.min(arr.length, start + count);
  if (start >= arr.length) {
    console.error(`startIndex=${start} は件数 ${arr.length} の範囲外です。`);
    process.exit(1);
  }

  const slice = arr.slice(start, end);
  if (slice.length === 0) {
    console.error('切り出し結果が空です。パラメータを確認してください。');
    process.exit(1);
  }

  fs.writeFileSync(BATCH_TEMP_PATH, JSON.stringify(slice, null, 2), 'utf-8');
  console.log(
    `${path.relative(root, BATCH_TEMP_PATH)} に ${slice.length} 件を書き出しました（index ${start}〜${end - 1}）。`
  );
}

main();

