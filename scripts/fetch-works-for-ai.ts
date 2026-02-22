#!/usr/bin/env tsx
/**
 * AI（Cursor別エージェント）用: workIds から DB を参照して作品データを取得
 * Usage: npx tsx scripts/fetch-works-for-ai.ts <workId1> [workId2] ...
 *   or:  npx tsx scripts/fetch-works-for-ai.ts --check <workId1> [workId2] ...
 *   or:  npx tsx scripts/fetch-works-for-ai.ts --check --out <path> <workId1> [workId2] ...
 *
 * --check あり: タグチェック用（derivedTags, officialTags, characterName 含む）
 * --check なし: タグ付け用（workId, title, commentText）
 * --out, -o <path>: 指定時は stdout ではなく該当パスに UTF-8 で直接書き込む。
 *   ※ PowerShell の > でリダイレクトすると文字化け・JSON 崩れするため、必ず --out を使うこと。
 */

import * as fs from 'fs';
import * as path from 'path';

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
import fsPromises from 'fs/promises';

const prisma = new PrismaClient();

const TAG_RANKS_PATH = 'config/tagRanks.json';

async function main() {
  const args = process.argv.slice(2);
  let forCheck = false;
  let outPath: string | null = null;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === '--check') forCheck = true;
    else if (a === '--out' || a === '-o') {
      outPath = args[i + 1] ?? null;
      if (outPath) i++;
    } else rest.push(a);
  }
  const workIds = rest;

  if (workIds.length === 0) {
    console.error('Usage: npx tsx scripts/fetch-works-for-ai.ts [--check] [--out <path>] <workId1> [workId2] ...');
    console.error('  --out: 出力をファイルに直接書く（PowerShell の > は文字化けするため非推奨）');
    process.exit(1);
  }

  const uniqueIds = [...new Set(workIds)];
  const works = await prisma.work.findMany({
    where: { workId: { in: uniqueIds } },
    include: { workTags: { include: { tag: true } } },
  });

  const workMap = new Map(works.map((w) => [w.workId, w]));
  for (const id of uniqueIds) {
    if (!workMap.has(id)) {
      const alt = id.startsWith('cid:') ? id.replace(/^cid:/, '') : 'cid:' + id;
      const extra = await prisma.work.findFirst({ where: { workId: alt }, include: { workTags: { include: { tag: true } } } });
      if (extra) workMap.set(id, extra);
    }
  }

  let tagRanks: Record<string, string> = {};
  try {
    const content = await fsPromises.readFile(path.join(root, TAG_RANKS_PATH), 'utf-8');
    const parsed = JSON.parse(content);
    tagRanks = parsed.ranks || {};
  } catch {
    // ignore
  }

  // all-tags（GPT が探さずに済むよう入力に含める）
  const [officialTags, derivedTags] = await Promise.all([
    prisma.tag.findMany({
      where: { tagType: 'OFFICIAL' },
      select: { displayName: true },
      orderBy: { displayName: 'asc' },
    }),
    prisma.tag.findMany({
      where: { tagType: 'DERIVED' },
      select: { displayName: true },
      orderBy: { displayName: 'asc' },
    }),
  ]);
  const s = officialTags.map((t) => t.displayName);
  const a = derivedTags.filter((t) => tagRanks[t.displayName] === 'A').map((t) => t.displayName);
  const b = derivedTags.filter((t) => tagRanks[t.displayName] === 'B').map((t) => t.displayName);
  const allTags = { s, a, b };

  const results: unknown[] = [];

  for (const wid of uniqueIds) {
    const work = workMap.get(wid);
    if (!work) {
      results.push({ workId: wid, title: '(not found)', commentText: '', _error: 'Work not found in DB' });
      continue;
    }

    if (forCheck) {
      const officialTags = work.workTags
        .filter((wt) => wt.tag.tagType === 'OFFICIAL' && wt.derivedSource !== 'additionalS')
        .map((wt) => wt.tag.displayName);
      const additionalSTags = work.workTags
        .filter((wt) => wt.tag.tagType === 'OFFICIAL' && wt.derivedSource === 'additionalS')
        .map((wt) => wt.tag.displayName);
      const derivedTags = work.workTags
        .filter((wt) => wt.tag.tagType === 'DERIVED')
        .map((wt) => ({ displayName: wt.tag.displayName, category: wt.tag.category }));
      const aTags = derivedTags.filter((t) => tagRanks[t.displayName] === 'A').map((t) => t.displayName);
      const bTags = derivedTags.filter((t) => tagRanks[t.displayName] === 'B').map((t) => t.displayName);
      const cTagsFromRanks = derivedTags.filter((t) => tagRanks[t.displayName] === 'C').map((t) => t.displayName);
      const unranked = derivedTags.filter(
        (t) => !(tagRanks[t.displayName] === 'A' || tagRanks[t.displayName] === 'B' || tagRanks[t.displayName] === 'C')
      ).map((t) => t.displayName);
      const cTags = [...cTagsFromRanks, ...unranked];
      const characterTags = work.workTags
        .filter((wt) => wt.tag.tagType === 'STRUCTURAL')
        .map((wt) => wt.tag.displayName);

      results.push({
        workId: work.workId,
        title: work.title,
        commentText: work.commentText || '',
        derivedTags: [...aTags, ...bTags, ...cTags],
        officialTags: [...officialTags, ...additionalSTags],
        characterName: characterTags.length > 0 ? characterTags[0] : null,
      });
    } else {
      const comment = (work.commentText || '').slice(0, 3000);
      results.push({
        workId: work.workId,
        title: work.title,
        commentText: comment + (comment.length >= 3000 ? '\n...(省略)' : ''),
      });
    }
  }

  const output = { allTags, works: results };
  const jsonStr = JSON.stringify(output, null, 2);

  if (outPath) {
    const absOut = path.isAbsolute(outPath) ? outPath : path.join(root, outPath);
    fs.writeFileSync(absOut, jsonStr, 'utf8');
    console.error(`出力を ${absOut} に保存しました。`);
  } else {
    console.log(jsonStr);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
