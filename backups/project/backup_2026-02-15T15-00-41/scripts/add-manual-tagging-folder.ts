#!/usr/bin/env tsx
/**
 * manualTaggingFolder カラム追加＋既存データを優先順でフォルダに振り分け
 * 1. DB にカラム追加（存在しなければ）。SQLite / PostgreSQL 両対応。
 * 2. commentText がある作品を 1件ずつ判定して folder をセット
 *
 * 優先順: 要注意 → 人間要チェック → タグ済 → チェック待ち → 未タグ → 旧AIタグ
 * 本番（Postgres）で実行する場合は DATABASE_URL を本番用に設定してから実行。
 * Usage: npx tsx scripts/add-manual-tagging-folder.ts
 */

import * as path from 'path';
import * as fs from 'fs';

// Next.js と同一の DB を使うため .env.local → .env の順で DATABASE_URL を「上書き」で読む
// （dotenv は既存の環境変数を上書きしないため、シェルに Postgres の URL が残っていると
//  スクリプトが Postgres に接続して "no such table: Work" になる）
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
let urlFromFile = loadDatabaseUrl();
if (urlFromFile) {
  // SQLite の file: は相対パスだと Prisma の解釈で別ファイルになることがあるため、絶対パスに正規化する
  const fileMatch = urlFromFile.match(/^file:(\.\/)?(.*?)(\?.*)?$/);
  if (fileMatch) {
    const absolutePath = path.resolve(root, fileMatch[2]);
    const suffix = fileMatch[3] || '';
    urlFromFile = 'file:' + absolutePath.replace(/\\/g, '/') + suffix;
  }
  process.env.DATABASE_URL = urlFromFile;
} else {
  require('dotenv').config({ path: path.join(root, '.env') });
}

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

type Folder = 'needs_review' | 'needs_human_check' | 'tagged' | 'pending' | 'untagged' | 'legacy_ai';

function decideFolder(w: {
  needsReview: boolean | null;
  needsHumanCheck: boolean | null;
  humanChecked: boolean | null;
  tagSource: string | null;
  aiChecked: boolean | null;
  aiAnalyzed: boolean | null;
  hasDerived: boolean;
}): Folder {
  if (w.needsReview === true) return 'needs_review';
  if (w.needsHumanCheck === true && w.humanChecked !== true) return 'needs_human_check';
  if (w.humanChecked === true || w.tagSource === 'human' || w.aiChecked === true) return 'tagged';
  if (w.aiAnalyzed === true) return 'pending';
  if (!w.hasDerived) return 'untagged';
  return 'legacy_ai';
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl) {
    console.error('DATABASE_URL が未設定です。.env または .env.local を確認してください。');
    process.exit(1);
  }
  const isPostgres = dbUrl.startsWith('postgres');
  if (!isPostgres) {
    console.log('接続先 (SQLite):', dbUrl.replace(/^file:(.*)$/, '$1'));
  }

  // 1) カラム追加（SQLite / PostgreSQL 両対応）
  try {
    if (isPostgres) {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "manualTaggingFolder" TEXT'
      );
    } else {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "Work" ADD COLUMN "manualTaggingFolder" TEXT'
      );
    }
    console.log('manualTaggingFolder カラムを追加しました。');
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('duplicate column') || msg.includes('already exists')) {
      console.log('manualTaggingFolder カラムは既に存在します。');
    } else if (msg.includes('no such table') && !isPostgres) {
      console.error(
        'Work テーブルが見つかりません。ローカルの場合: npm run restore:sqlite のあと npx prisma generate を実行し、再度このスクリプトを実行してください。'
      );
      process.exit(1);
    } else {
      throw e;
    }
  }

  // 2) commentText がある作品を取得（フラグ＋派生タグ有無）
  const works = await prisma.work.findMany({
    where: { commentText: { not: null } },
    select: {
      workId: true,
      needsReview: true,
      needsHumanCheck: true,
      humanChecked: true,
      tagSource: true,
      aiChecked: true,
      aiAnalyzed: true,
      workTags: { select: { tag: { select: { tagType: true } } } },
    },
  });

  const hasDerived = (w: { workTags: Array<{ tag: { tagType: string } }> }) =>
    w.workTags.some((wt) => wt.tag.tagType === 'DERIVED');

  let counts: Record<Folder, number> = {
    needs_review: 0,
    needs_human_check: 0,
    tagged: 0,
    pending: 0,
    untagged: 0,
    legacy_ai: 0,
  };

  for (const w of works) {
    const folder = decideFolder({
      needsReview: w.needsReview,
      needsHumanCheck: w.needsHumanCheck,
      humanChecked: w.humanChecked,
      tagSource: w.tagSource,
      aiChecked: w.aiChecked,
      aiAnalyzed: w.aiAnalyzed,
      hasDerived: hasDerived(w),
    });
    counts[folder]++;
    if (isPostgres) {
      await prisma.$executeRaw(
        Prisma.sql`UPDATE "Work" SET "manualTaggingFolder" = ${folder} WHERE "workId" = ${w.workId}`
      );
    } else {
      await prisma.$executeRawUnsafe(
        'UPDATE Work SET manualTaggingFolder = ? WHERE workId = ?',
        folder,
        w.workId
      );
    }
  }

  console.log('フォルダ振り分け結果:', counts);
  console.log('合計:', works.length);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
