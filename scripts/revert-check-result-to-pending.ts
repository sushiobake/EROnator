#!/usr/bin/env tsx
/**
 * apply-check-result で tagged に反映した作品を「チェック待ち」(pending) に戻す。
 * Usage: npx tsx scripts/revert-check-result-to-pending.ts data/chatgpt-export/check-result-batch2.json
 */
import * as path from 'path';
import * as fs from 'fs';

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
  } else {
    process.env.DATABASE_URL = urlFromFile;
  }
} else {
  require('dotenv').config({ path: path.join(root, '.env') });
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const jsonPath = process.argv[2] ?? 'data/chatgpt-export/check-result-batch2.json';
  const absPath = path.isAbsolute(jsonPath) ? jsonPath : path.join(root, jsonPath);
  if (!fs.existsSync(absPath)) {
    console.error('ファイルが見つかりません:', absPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(absPath, 'utf-8');
  type Item = { workId: string };
  let list: Item[];
  try {
    const parsed = JSON.parse(raw);
    list = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    console.error('JSON のパースに失敗しました。');
    process.exit(1);
  }

  const workIds = [...new Set(list.map((o) => o.workId).filter(Boolean))] as string[];
  console.log(`対象: ${workIds.length} 件を「チェック待ち」(pending) に戻します。`);

  const works = await prisma.work.findMany({
    where: { workId: { in: workIds } },
    select: { workId: true },
  });
  const foundIds = new Set(works.map((w) => w.workId));
  const missing = workIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    console.warn('DB に存在しない workId（スキップ）:', missing.slice(0, 10).join(', '), missing.length > 10 ? ` …他${missing.length - 10}件` : '');
  }

  const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');
  const targetIds = workIds.filter((id) => foundIds.has(id));

  let updated = 0;
  for (const workId of targetIds) {
    if (isPostgres) {
      await prisma.$executeRawUnsafe(
        'UPDATE "Work" SET "manualTaggingFolder" = $1, "taggedAt" = NULL, "lastCheckTagChanges" = NULL, "updatedAt" = NOW(), "gameRegistered" = true, "needsReview" = false WHERE "workId" = $2',
        'pending',
        workId
      );
    } else {
      await prisma.$executeRawUnsafe(
        'UPDATE Work SET manualTaggingFolder = ?, taggedAt = NULL, lastCheckTagChanges = NULL, updatedAt = datetime(\'now\'), gameRegistered = 1, needsReview = 0 WHERE workId = ?',
        'pending',
        workId
      );
    }
    updated++;
  }

  console.log(`完了: ${updated} 件を「チェック待ち」(pending) に戻しました。`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
