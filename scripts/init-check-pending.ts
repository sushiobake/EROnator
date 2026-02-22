#!/usr/bin/env tsx
/**
 * check-pending.json を [] で初期化する。
 * 100件チェック等の初回開始時に実行する。再開時は実行しない。
 *
 * Usage: npx tsx scripts/init-check-pending.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(process.cwd());
const EXPORT_DIR = path.join(root, 'data', 'chatgpt-export');
const PENDING_PATH = path.join(EXPORT_DIR, 'check-pending.json');

function main() {
  fs.writeFileSync(PENDING_PATH, '[]', 'utf-8');
  console.log(`${PENDING_PATH} を [] で初期化しました。`);
}

main();
