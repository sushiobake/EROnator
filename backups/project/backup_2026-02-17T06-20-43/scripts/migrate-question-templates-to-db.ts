#!/usr/bin/env tsx
/**
 * Phase 2: questionTemplates.json の内容を Tag.questionText にマイグレーション（復元）
 * - バックアップの templates を正として、該当タグの questionText をすべて上書き
 * - 対象: displayName が templates に存在する全タグ（キャラタグ除く）
 * - 除外: キャラタグ（tagType=STRUCTURAL または category=CHARACTER/キャラクター）
 *
 * Usage:
 *   npx tsx scripts/migrate-question-templates-to-db.ts [--dry-run]
 *   npx tsx scripts/migrate-question-templates-to-db.ts --from-backup  # バックアップの JSON を使用
 *
 * 注意: .env.local または .env の DATABASE_URL が SQLite を指していること。
 *       本番（Postgres）で実行する場合は DATABASE_URL を本番用に設定してから実行。
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
  } else {
    process.env.DATABASE_URL = urlFromFile;
  }
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config({ path: path.join(root, '.env') });
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface QuestionTemplatesJson {
  templates?: Record<string, string>;
}

function loadTemplates(fromBackup = false): Record<string, string> {
  const filePath = fromBackup
    ? path.join(process.cwd(), 'backups', 'tag-question-db-migration-2026-02-17-0428', 'questionTemplates.json')
    : path.join(process.cwd(), 'config', 'questionTemplates.json');
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content) as QuestionTemplatesJson;
  return data.templates ?? {};
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const fromBackup = process.argv.includes('--from-backup');
  if (dryRun) {
    console.log('--dry-run: 変更は行いません\n');
  }
  if (fromBackup) {
    console.log('--from-backup: バックアップの questionTemplates.json を使用\n');
  }

  const templates = loadTemplates(fromBackup);
  console.log(`questionTemplates: ${Object.keys(templates).length} 件のテンプレート`);

  const allTags = await prisma.tag.findMany({
    select: { tagKey: true, displayName: true, questionText: true, tagType: true, category: true },
  });

  const isCharacterTag = (tag: { tagType: string; category: string | null }): boolean =>
    tag.tagType === 'STRUCTURAL' || tag.category === 'CHARACTER' || tag.category === 'キャラクター';

  const toMigrate: Array<{ tagKey: string; displayName: string; template: string }> = [];
  let skippedCharacter = 0;
  for (const tag of allTags) {
    if (isCharacterTag(tag)) {
      skippedCharacter++;
      continue;
    }
    const template = templates[tag.displayName];
    if (!template || !template.trim()) continue;
    toMigrate.push({ tagKey: tag.tagKey, displayName: tag.displayName, template: template.trim() });
  }

  console.log(`対象タグ（テンプレートに一致）: ${toMigrate.length} 件`);
  if (skippedCharacter > 0) console.log(`（キャラタグ除外: ${skippedCharacter} 件）`);
  console.log('');

  if (toMigrate.length === 0) {
    console.log('更新対象なし。終了します。');
    return;
  }

  for (let i = 0; i < Math.min(5, toMigrate.length); i++) {
    const m = toMigrate[i];
    console.log(`  [${i + 1}] ${m.displayName} (${m.tagKey})`);
    console.log(`      → "${m.template.substring(0, 40)}${m.template.length > 40 ? '...' : ''}"`);
  }
  if (toMigrate.length > 5) {
    console.log(`  ... 他 ${toMigrate.length - 5} 件`);
  }
  console.log('');

  if (!dryRun) {
    let updated = 0;
    for (const m of toMigrate) {
      await prisma.tag.update({
        where: { tagKey: m.tagKey },
        data: { questionText: m.template },
      });
      updated++;
      if (updated % 100 === 0) {
        console.log(`  ${updated}/${toMigrate.length} 件更新済み`);
      }
    }
    console.log(`\n完了: ${updated} 件のタグを更新しました。`);
  } else {
    console.log(`(dry-run) 上記 ${toMigrate.length} 件を更新する予定でした。`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
