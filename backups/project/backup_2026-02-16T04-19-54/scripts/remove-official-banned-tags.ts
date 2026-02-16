#!/usr/bin/env tsx
/**
 * OFFICIALタグのうち、取得禁止タグ（config/bannedTags.json）にマッチするものをDBから削除
 * - 該当する WorkTag を削除してから Tag を削除
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface BannedTag {
  pattern: string;
  type: 'exact' | 'startsWith' | 'contains' | 'regex';
  reason: string;
  addedAt: string;
}

function loadBannedTags(): BannedTag[] {
  const p = path.join(process.cwd(), 'config', 'bannedTags.json');
  const raw = fs.readFileSync(p, 'utf-8');
  const config = JSON.parse(raw) as { bannedTags: BannedTag[] };
  return config.bannedTags || [];
}

function isTagBanned(displayName: string, bannedTags: BannedTag[]): boolean {
  for (const banned of bannedTags) {
    switch (banned.type) {
      case 'exact':
        if (displayName === banned.pattern) return true;
        break;
      case 'startsWith':
        if (displayName.startsWith(banned.pattern)) return true;
        break;
      case 'contains':
        if (displayName.includes(banned.pattern)) return true;
        break;
      case 'regex':
        try {
          if (new RegExp(banned.pattern).test(displayName)) return true;
        } catch {
          // skip invalid regex
        }
        break;
    }
  }
  return false;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const bannedTags = loadBannedTags();

  const officialTags = await prisma.tag.findMany({
    where: { tagType: 'OFFICIAL' },
    select: { tagKey: true, displayName: true },
  });

  const toRemove = officialTags.filter((t) => isTagBanned(t.displayName, bannedTags));

  console.log(`取得禁止タグリスト: ${bannedTags.length}件`);
  console.log(`OFFICIALタグ総数: ${officialTags.length}`);
  console.log(`削除対象（禁止にマッチ）: ${toRemove.length}件`);
  if (dryRun) console.log('--dry-run: 変更は行いません\n');

  for (const t of toRemove) {
    const count = await prisma.workTag.count({ where: { tagKey: t.tagKey } });
    console.log(`  [削除] ${t.displayName} (${t.tagKey}) - WorkTag ${count}件`);
  }

  if (!dryRun && toRemove.length > 0) {
    let deletedWT = 0;
    let deletedTag = 0;
    for (const t of toRemove) {
      const r = await prisma.workTag.deleteMany({ where: { tagKey: t.tagKey } });
      deletedWT += r.count;
      await prisma.tag.delete({ where: { tagKey: t.tagKey } });
      deletedTag++;
    }
    console.log(`\n完了: WorkTag ${deletedWT}件削除, Tag ${deletedTag}件削除`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
