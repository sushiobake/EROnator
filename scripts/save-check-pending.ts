#!/usr/bin/env tsx
/**
 * チェック結果 JSON を UTF-8 で check-pending.json に保存する。
 * PowerShell の > や Out-File で保存すると文字化けするため、このスクリプトを使うこと。
 *
 * Usage: npx tsx scripts/save-check-pending.ts <入力JSONのファイルパス>
 *
 * 例: JSON をエディタに貼り付けて check-result-paste.json に保存したあと、
 *     npx tsx scripts/save-check-pending.ts data/chatgpt-export/check-result-paste.json
 */
import * as fs from 'fs';
import * as path from 'path';

const root = path.resolve(process.cwd());
const EXPORT_DIR = path.join(root, 'data', 'chatgpt-export');
const PENDING_PATH = path.join(EXPORT_DIR, 'check-pending.json');
const RESULT_PATH = path.join(EXPORT_DIR, 'check-result.json');

function looksMojibake(s: string): boolean {
  return /[Ãâãéèêëìíîïòóôöùúûü]|ã[\u0080-\u00bf]|â[\u0080-\u00bf]/.test(s);
}

function fixMojibake(s: string): string {
  if (!s || !looksMojibake(s)) return s;
  try {
    const fixed = Buffer.from(s, 'latin1').toString('utf8');
    if (!fixed || fixed.includes('\uFFFD')) return s;
    return fixed;
  } catch {
    return s;
  }
}

function tryFixJson(raw: string): string {
  if (!looksMojibake(raw)) return raw;
  try {
    return Buffer.from(raw, 'latin1').toString('utf8');
  } catch {
    return raw;
  }
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: npx tsx scripts/save-check-pending.ts <入力JSONのファイルパス>');
    console.error('例: npx tsx scripts/save-check-pending.ts data/chatgpt-export/check-result-paste.json');
    process.exit(1);
  }

  const absInput = path.isAbsolute(inputPath) ? inputPath : path.join(root, inputPath);
  if (!fs.existsSync(absInput)) {
    console.error('ファイルが見つかりません:', absInput);
    process.exit(1);
  }

  let raw = fs.readFileSync(absInput, 'utf-8');
  if (looksMojibake(raw)) {
    raw = tryFixJson(raw);
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('JSON のパースに失敗しました:', e);
    process.exit(1);
  }

  const arr = Array.isArray(data) ? data : [data];
  const json = JSON.stringify(arr, null, 2);
  fs.writeFileSync(PENDING_PATH, json, 'utf-8');
  fs.writeFileSync(RESULT_PATH, json, 'utf-8');
  console.log(`${PENDING_PATH} に保存しました（${arr.length} 件）。`);
  console.log(`${RESULT_PATH} に保存しました。`);
}

main();
