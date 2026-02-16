#!/usr/bin/env tsx
/**
 * 指定 workId 一覧の現在のタグ（S / A / B / C / キャラ）を JSON で出力。
 * チェック済みタグとの比較用。
 */
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const WORK_IDS = [
  'd_424924', 'd_660402', 'd_710682', 'd_386622', 'd_193358', 'd_715385', 'd_701857', 'd_468031', 'd_570535', 'd_215336',
  'd_505161', 'd_713433', 'd_660491', 'd_721299', 'd_706403', 'd_285327', 'd_695110', 'd_494324', 'd_488912', 'd_276912',
  'd_699024', 'd_489520', 'd_246177', 'd_720383', 'd_236907', 'd_616372', 'd_241918', 'd_567981', 'd_725557', 'd_292463',
];

async function main() {
  const tagRanksPath = path.join(process.cwd(), 'config', 'tagRanks.json');
  let ranks: Record<string, string> = {};
  try {
    const raw = fs.readFileSync(tagRanksPath, 'utf-8');
    const data = JSON.parse(raw);
    ranks = data.ranks || {};
  } catch {
    // ignore
  }

  const works = await prisma.work.findMany({
    where: { workId: { in: WORK_IDS } },
    include: {
      workTags: { include: { tag: true } },
    },
  });

  const byId = new Map(works.map((w) => [w.workId, w]));

  const out: Array<{
    workId: string;
    title: string;
    officialTags: string[];
    aTags: string[];
    bTags: string[];
    cTags: string[];
    characterTags: string[];
  }> = [];

  for (const workId of WORK_IDS) {
    const w = byId.get(workId);
    if (!w) {
      out.push({ workId, title: '', officialTags: [], aTags: [], bTags: [], cTags: [], characterTags: [] });
      continue;
    }

    const officialTags: string[] = [];
    const aTags: string[] = [];
    const bTags: string[] = [];
    const cTags: string[] = [];
    const characterTags: string[] = [];

    for (const wt of w.workTags) {
      const name = wt.tag.displayName;
      if (wt.tag.tagType === 'OFFICIAL') {
        officialTags.push(name);
      } else if (wt.tag.tagType === 'DERIVED') {
        const rank = ranks[name] || 'A';
        if (rank === 'A') aTags.push(name);
        else if (rank === 'B') bTags.push(name);
        else if (rank === 'C') cTags.push(name);
      } else if (wt.tag.tagType === 'STRUCTURAL') {
        characterTags.push(name);
      }
    }

    out.push({
      workId: w.workId,
      title: w.title || '',
      officialTags: officialTags.sort(),
      aTags: aTags.sort(),
      bTags: bTags.sort(),
      cTags: cTags.sort(),
      characterTags: characterTags.sort(),
    });
  }

  console.log(JSON.stringify(out, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
