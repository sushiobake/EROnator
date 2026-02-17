#!/usr/bin/env tsx
/**
 * Tag テーブルの questionTemplate カラムを questionText にリネーム
 * SQLite 3.35.0+ の RENAME COLUMN を使用
 *
 * Usage: npx tsx scripts/rename-question-template-to-question-text.ts
 *
 * 実行後、prisma generate を実行してください。
 */

import fs from 'fs';
import path from 'path';

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
  }
}

function main() {
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  if (!fs.existsSync(dbPath)) {
    console.error(`DB not found: ${dbPath}`);
    process.exit(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite3 = require('better-sqlite3');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
  const db = sqlite3(dbPath);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const tableInfo = db.prepare("PRAGMA table_info(Tag)").all() as Array<{ name: string }>;
  const hasQuestionTemplate = tableInfo.some((c) => c.name === 'questionTemplate');
  const hasQuestionText = tableInfo.some((c) => c.name === 'questionText');

  if (hasQuestionText && !hasQuestionTemplate) {
    console.log('既に questionText にリネーム済みです。');
    db.close();
    return;
  }
  if (!hasQuestionTemplate) {
    console.log('questionTemplate カラムが見つかりません。スキップします。');
    db.close();
    return;
  }

  try {
    // SQLite 3.35.0+ (2021-03-12)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    db.prepare('ALTER TABLE Tag RENAME COLUMN questionTemplate TO questionText').run();
    console.log('OK: questionTemplate → questionText にリネームしました。');
  } catch (e) {
    console.error('リネームに失敗しました:', e);
    console.error('SQLite 3.35.0 以上が必要です。');
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
