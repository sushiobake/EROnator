/**
 * config/recommendFamousTags.json をローカル DB から生成する。
 * 実行: npx tsx scripts/generate-recommend-famous-tags-config.ts
 *
 * 事前: schema が SQLite（通常のローカル）、prisma generate 済み
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';

/**
 * .env の DATABASE_URL が別 DB を指しているとタグ 0 件になるため、
 * 既定では prisma/dev.db を絶対パスで使う。本番 DB で生成する場合のみ RECOMMEND_FAMOUS_USE_ENV_DB=1
 */
if (process.env.RECOMMEND_FAMOUS_USE_ENV_DB !== '1') {
  const dbFile = path.resolve(process.cwd(), 'prisma', 'dev.db');
  process.env.DATABASE_URL = 'file:' + dbFile.replace(/\\/g, '/');
}
import { PrismaClient } from '@prisma/client';
import {
  buildSlotsDisplayNamesForConfigFile,
  type RecommendFamousTagsFile,
  FAMOUS_PER_CATEGORY,
  RECOMMEND_CATEGORIES,
} from '../src/server/recommend/famousTagsEngine';

const OUT = path.join(process.cwd(), 'config', 'recommendFamousTags.json');

async function main() {
  const prisma = new PrismaClient();
  try {
    const slots = await buildSlotsDisplayNamesForConfigFile(prisma);
    for (const c of RECOMMEND_CATEGORIES) {
      while (slots[c].length < FAMOUS_PER_CATEGORY) {
        slots[c].push('');
      }
    }
    const payload: RecommendFamousTagsFile = {
      version: 1,
      useConfigSlots: true,
      slots,
    };
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf-8');
    console.log('Wrote', OUT);
    for (const c of RECOMMEND_CATEGORIES) {
      const empty = slots[c].filter((s) => !String(s).trim()).length;
      console.log(`  ${c}: ${FAMOUS_PER_CATEGORY} slots (${empty} empty need manual fill)`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
