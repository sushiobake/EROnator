#!/usr/bin/env tsx
/**
 * tagging-pending.json を読み、アーカイブして apply-cursor-legacy-ai-batch を実行する。
 * 成功時のみ pending を削除。失敗時は pending を残して retry 可能に。
 *
 * Usage: npx tsx scripts/apply-tagging.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';

const root = path.resolve(process.cwd());
const EXPORT_DIR = path.join(root, 'data', 'chatgpt-export');
const PENDING_PATH = path.join(EXPORT_DIR, 'tagging-pending.json');

function formatArchivalName(count: number): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `tagging-${y}${m}${d}-${h}${min}${s}-${count}.json`;
}

function main() {
  if (!fs.existsSync(PENDING_PATH)) {
    console.error('tagging-pending.json が見つかりません。先に JSON を保存してください。');
    process.exit(1);
  }

  const raw = fs.readFileSync(PENDING_PATH, 'utf-8');
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    console.error('JSON のパースに失敗しました。');
    process.exit(1);
  }

  const arr = Array.isArray(data) ? data : [data];
  if (arr.length === 0) {
    console.error('データが空です。');
    process.exit(1);
  }

  const archivalName = formatArchivalName(arr.length);
  const archivalPath = path.join(EXPORT_DIR, archivalName);
  fs.writeFileSync(archivalPath, JSON.stringify(arr, null, 2), 'utf-8');
  console.log('アーカイブ:', archivalName);

  const result = spawnSync(`npx tsx scripts/apply-cursor-legacy-ai-batch.ts ${archivalName}`, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
  });

  if (result.status === 0) {
    fs.unlinkSync(PENDING_PATH);
    console.log('完了。tagging-pending.json を削除しました。');
  } else {
    console.error('apply が失敗しました。tagging-pending.json は残しています。修正後に再実行してください。');
    process.exit(result.status ?? 1);
  }
}

main();
