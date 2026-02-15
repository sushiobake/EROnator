#!/usr/bin/env tsx
/**
 * 過去ログ（旧AIタグとして取得した JSON）に含まれる workId をすべてリストアップし、
 * それらを今の「旧AIタグ」フォルダ（manualTaggingFolder = 'legacy_ai'）に振り分ける。
 *
 * 条件では決めず、ログに「旧AIタグに入っていた」と記録された作品だけを legacy_ai に戻す。
 * Usage: npx tsx scripts/set-legacy-ai-from-past-logs.ts
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

const LEGACY_AI_JSON_DIR = path.join(root, 'data', 'chatgpt-export');
const LEGACY_AI_GLOBS = [
  'legacy-ai-10-for-cursor.json',
  'cursor-analysis-legacy-ai-5-batch4.json',
  'cursor-analysis-legacy-ai-5-batch5.json',
  'cursor-analysis-legacy-ai-5-batch6.json',
  'cursor-analysis-legacy-ai-5-batch7.json',
  'cursor-analysis-legacy-ai-5-batch8.json',
  'cursor-analysis-legacy-ai-5-batch9.json',
  'cursor-analysis-legacy-ai-5-batch10.json',
  'cursor-analysis-legacy-ai-5-batch11.json',
  'cursor-analysis-legacy-ai-5-batch12.json',
  'cursor-analysis-legacy-ai-5-batch13.json',
  'cursor-analysis-legacy-ai-5-batch14.json',
  'cursor-analysis-legacy-ai-5-batch15.json',
  'cursor-analysis-legacy-ai-5-batch16.json',
  'cursor-analysis-legacy-ai-5-batch17.json',
  'cursor-analysis-legacy-ai-5-batch18.json',
  'cursor-analysis-legacy-ai-5-batch19.json',
  'cursor-analysis-legacy-ai-5-batch20.json',
  'cursor-analysis-legacy-ai-5-batch21.json',
  'cursor-analysis-legacy-ai-5-batch22.json',
  'cursor-analysis-legacy-ai-10.json',
  'cursor-analysis-legacy-ai-10-batch2.json',
  'cursor-analysis-legacy-ai-10-batch3.json',
  'temp-legacy-ai-10-raw.json',
  'temp-legacy-ai-10-offset10-raw.json',
  'temp-legacy-ai-5-batch11-raw.json',
];

function extractWorkIdsFromFile(filePath: string): string[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(raw);
  const ids: string[] = [];
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item.workId === 'string') ids.push(item.workId.trim());
    }
    return ids;
  }
  if (data && Array.isArray(data.works)) {
    for (const item of data.works) {
      if (item && typeof item.workId === 'string') ids.push(item.workId.trim());
      if (item?.work && typeof item.work.workId === 'string') ids.push(item.work.workId.trim());
    }
    return ids;
  }
  return ids;
}

async function main() {
  const allIds = new Set<string>();
  for (const name of LEGACY_AI_GLOBS) {
    const filePath = path.join(LEGACY_AI_JSON_DIR, name);
    if (!fs.existsSync(filePath)) {
      console.warn('Skip (not found):', name);
      continue;
    }
    try {
      const ids = extractWorkIdsFromFile(filePath);
      ids.forEach((id) => allIds.add(id));
    } catch (e) {
      console.warn('Skip (parse error):', name, e);
    }
  }

  const workIdsFromLogs = [...allIds];
  console.log('過去ログから抽出した workId 数:', workIdsFromLogs.length);

  if (workIdsFromLogs.length === 0) {
    console.log('対象が0件のため終了します。');
    process.exit(0);
  }

  // DB には "d_xxx" または "cid:d_xxx" のどちらかで入っている可能性がある
  const works = await prisma.work.findMany({
    where: {
      workId: { in: workIdsFromLogs },
      commentText: { not: null },
    },
    select: { workId: true },
  });
  const foundIds = new Set(works.map((w) => w.workId));
  const missing = workIdsFromLogs.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    const alternateIds = missing.flatMap((id) =>
      id.startsWith('cid:') ? [id.replace(/^cid:/, '')] : ['cid:' + id]
    );
    const extra = await prisma.work.findMany({
      where: { workId: { in: alternateIds }, commentText: { not: null } },
      select: { workId: true },
    });
    works.push(...extra);
  }

  const toUpdate = [...new Set(works.map((w) => w.workId))];
  console.log('DB に存在し commentText あり（更新対象）:', toUpdate.length);

  const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');
  let updated = 0;
  for (const workId of toUpdate) {
    if (isPostgres) {
      await prisma.$executeRawUnsafe(
        'UPDATE "Work" SET "manualTaggingFolder" = $1 WHERE "workId" = $2',
        'legacy_ai',
        workId
      );
    } else {
      await prisma.$executeRawUnsafe(
        'UPDATE Work SET manualTaggingFolder = ? WHERE workId = ?',
        'legacy_ai',
        workId
      );
    }
    updated++;
  }

  console.log('manualTaggingFolder = legacy_ai に更新した件数:', updated);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
