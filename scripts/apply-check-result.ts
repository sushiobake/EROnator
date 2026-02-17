#!/usr/bin/env tsx
/**
 * AIタグチェック結果の JSON を読み、各作品の manualTaggingFolder を更新する。
 * result が「タグ済」→ tagged、「人間による確認が必要」→ needs_human_check
 * Usage: npx tsx scripts/apply-check-result.ts <JSONファイルパス>
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

function toFolder(result: string): 'tagged' | 'needs_human_check' | null {
  const r = (result || '').trim();
  if (r === 'タグ済') return 'tagged';
  if (r === '人間による確認が必要') return 'needs_human_check';
  return null;
}

async function main() {
  const jsonPath = process.argv[2];
  const inputPayloadPath = process.argv[3]; // 省略可。渡した場合、入力件数と出力件数を照合する
  if (!jsonPath) {
    console.error('Usage: npx tsx scripts/apply-check-result.ts <結果JSONパス> [入力payloadのJSONパス]');
    console.error('  入力パスを渡すと、件数・workId の一致を検証してから反映する。');
    process.exit(1);
  }
  const absPath = path.isAbsolute(jsonPath) ? jsonPath : path.join(root, jsonPath);
  if (!fs.existsSync(absPath)) {
    console.error('ファイルが見つかりません:', absPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(absPath, 'utf-8');
  type Item = { workId: string; result: string; tagChanges?: { added?: string[]; removed?: string[] } };
  let list: Item[];
  try {
    const parsed = JSON.parse(raw);
    list = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    console.error('JSON のパースに失敗しました。');
    process.exit(1);
  }

  if (inputPayloadPath) {
    const inputAbs = path.isAbsolute(inputPayloadPath) ? inputPayloadPath : path.join(root, inputPayloadPath);
    if (!fs.existsSync(inputAbs)) {
      console.error('入力payloadファイルが見つかりません:', inputAbs);
      process.exit(1);
    }
    const inputRaw = fs.readFileSync(inputAbs, 'utf-8');
    let inputArr: Array<{ workId?: string }>;
    try {
      const inputParsed = JSON.parse(inputRaw);
      inputArr = Array.isArray(inputParsed) ? inputParsed : [inputParsed];
    } catch {
      console.error('入力payloadのJSONパースに失敗しました。');
      process.exit(1);
    }
    const inputIds = new Set((inputArr as Array<{ workId?: string }>).map((o) => o.workId).filter(Boolean) as string[]);
    const outputIds = new Set(list.map((o) => o.workId).filter(Boolean));
    const missing = [...inputIds].filter((id) => !outputIds.has(id));
    const extra = [...outputIds].filter((id) => !inputIds.has(id));
    if (missing.length > 0 || extra.length > 0) {
      console.error('件数・workId の照合に失敗しました。反映を中止します。');
      if (missing.length > 0) console.error('  入力にあるが出力に無い workId:', missing.slice(0, 20).join(', '), missing.length > 20 ? ` …他${missing.length - 20}件` : '');
      if (extra.length > 0) console.error('  出力にあるが入力に無い workId:', extra.slice(0, 20).join(', '), extra.length > 20 ? ` …他${extra.length - 20}件` : '');
      process.exit(1);
    }
    console.log(`照合OK: 入力${inputIds.size}件 ＝ 出力${outputIds.size}件`);
  }

  const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');

  if (isPostgres) {
    await prisma.$executeRawUnsafe('ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "lastCheckTagChanges" TEXT');
  } else {
    const tableInfo = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info(Work)');
    if (!tableInfo.some((c) => c.name === 'lastCheckTagChanges')) {
      await prisma.$executeRawUnsafe('ALTER TABLE Work ADD COLUMN lastCheckTagChanges TEXT');
    }
  }

  const requestedWorkIds = [...new Set(list.map((item) => item.workId).filter(Boolean))] as string[];
  let works = await prisma.work.findMany({
    where: { workId: { in: requestedWorkIds } },
  });
  const foundIds = new Set(works.map((w) => w.workId));
  const missing = requestedWorkIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    const alternateIds = missing.flatMap((id) =>
      id.startsWith('cid:') ? [id.replace(/^cid:/, '')] : ['cid:' + id]
    );
    const extra = await prisma.work.findMany({
      where: { workId: { in: alternateIds } },
    });
    works = [...works, ...extra];
  }
  const jsonToDbWorkId = new Map<string, string>();
  for (const w of works) {
    jsonToDbWorkId.set(w.workId, w.workId);
    if (w.workId.startsWith('cid:')) {
      jsonToDbWorkId.set(w.workId.replace(/^cid:/, ''), w.workId);
    } else {
      jsonToDbWorkId.set('cid:' + w.workId, w.workId);
    }
  }

  // 逆順で処理。タグ済にするときは taggedAt を 1 件ごとに 1 秒ずつずらして設定し、
  // 同じ秒でまとめて更新されて順序が不定になることを防ぐ。JSON の先頭＝一覧の先頭になる。
  const listToProcess = [...list].reverse();
  const baseTime = new Date();
  /** ISO 8601 形式。Prisma の DateTime が期待する形式。 */
  function formatTaggedAt(offsetSeconds: number): string {
    const d = new Date(baseTime.getTime() + offsetSeconds * 1000);
    return d.toISOString().slice(0, 19) + 'Z';
  }
  let updated = 0;
  let skipped = 0;
  for (let i = 0; i < listToProcess.length; i++) {
    const item = listToProcess[i]!;
    const workId = item.workId;
    if (!workId) {
      skipped++;
      continue;
    }
    const actualWorkId = jsonToDbWorkId.get(workId);
    if (!actualWorkId) {
      console.warn('DBに存在しない workId のためスキップ:', workId);
      skipped++;
      continue;
    }
    const folder = toFolder(item.result);
    if (!folder) {
      console.warn('不明な result のためスキップ:', workId, item.result);
      skipped++;
      continue;
    }
    const tagChangesJson =
      folder === 'needs_human_check'
        ? JSON.stringify(item.tagChanges ?? { added: [], removed: [] })
        : null;

    // tagged / needs_human_check はゲーム有効（gameRegistered=true, needsReview=false）
    if (folder === 'tagged') {
      // 逆順の i: 0=JSONの最後、listToProcess.length-1=JSONの先頭。先頭を最も新しくする。
      const taggedAtStr = formatTaggedAt(i);
      if (isPostgres) {
        await prisma.$executeRawUnsafe(
          'UPDATE "Work" SET "manualTaggingFolder" = $1, "updatedAt" = $3::timestamp, "taggedAt" = $3::timestamp, "lastCheckTagChanges" = NULL, "gameRegistered" = true, "needsReview" = false WHERE "workId" = $2',
          folder,
          actualWorkId,
          taggedAtStr
        );
      } else {
        await prisma.$executeRawUnsafe(
          'UPDATE Work SET manualTaggingFolder = ?, updatedAt = ?, taggedAt = ?, lastCheckTagChanges = NULL, gameRegistered = 1, needsReview = 0 WHERE workId = ?',
          folder,
          taggedAtStr,
          taggedAtStr,
          actualWorkId
        );
      }
    } else if (isPostgres) {
      await prisma.$executeRawUnsafe(
        'UPDATE "Work" SET "manualTaggingFolder" = $1, "updatedAt" = NOW(), "lastCheckTagChanges" = $3, "gameRegistered" = true, "needsReview" = false WHERE "workId" = $2',
        folder,
        actualWorkId,
        tagChangesJson
      );
    } else {
      await prisma.$executeRawUnsafe(
        'UPDATE Work SET manualTaggingFolder = ?, updatedAt = datetime(\'now\'), lastCheckTagChanges = ?, gameRegistered = 1, needsReview = 0 WHERE workId = ?',
        folder,
        tagChangesJson,
        actualWorkId
      );
    }
    updated++;
  }
  console.log('反映完了:', updated, '件更新', skipped > 0 ? `, ${skipped} 件スキップ` : '');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
