#!/usr/bin/env tsx
/**
 * バッチ（10件分のJSON）を check-pending.json に追記する。
 * 100件等の増分処理で、10件ずつ処理→即追記→メモリ破棄 のループに使う。
 *
 * Usage: npx tsx scripts/append-check-batch.ts <バッチJSONのファイルパス>
 *
 * 例: 10件分のJSONを data/chatgpt-export/check-batch-temp.json に保存したあと、
 *     npx tsx scripts/append-check-batch.ts data/chatgpt-export/check-batch-temp.json
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(process.cwd());
const EXPORT_DIR = path.join(root, 'data', 'chatgpt-export');
const PENDING_PATH = path.join(EXPORT_DIR, 'check-pending.json');

function main() {
  const batchPath = process.argv[2];
  if (!batchPath) {
    console.error('Usage: npx tsx scripts/append-check-batch.ts <バッチJSONのファイルパス>');
    process.exit(1);
  }

  const absBatch = path.isAbsolute(batchPath) ? batchPath : path.join(root, batchPath);
  if (!fs.existsSync(absBatch)) {
    console.error('ファイルが見つかりません:', absBatch);
    process.exit(1);
  }

  let batchData: unknown;
  try {
    let raw = fs.readFileSync(absBatch, 'utf-8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // BOM 除去
    batchData = JSON.parse(raw);
  } catch (e) {
    console.error('バッチJSONのパースに失敗しました:', e);
    process.exit(1);
  }

  const batchArr = Array.isArray(batchData) ? batchData : [batchData];
  if (batchArr.length === 0) {
    console.error('バッチが空です。');
    process.exit(1);
  }

  let existing: unknown[] = [];
  if (fs.existsSync(PENDING_PATH)) {
    try {
      const raw = fs.readFileSync(PENDING_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      existing = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      console.error('check-pending.json の読取に失敗しました。初期化し直してください。');
      process.exit(1);
    }
  }

  const merged = [...existing, ...batchArr];
  fs.writeFileSync(PENDING_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  console.log(`${batchArr.length} 件を追記しました（合計 ${merged.length} 件）。`);
}

main();
