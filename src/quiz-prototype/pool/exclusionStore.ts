/**
 * F@NZA王クイズ プロトタイプ: 除外作品ID の永続化
 *
 * - プール対象から手動で「使わない」と判断した作品IDを
 *   `data/quiz-prototype/excluded-works.json` に保存する。
 * - 本番（Vercel 等の読み取り専用 FS）では書き込み失敗を握り潰す。
 * - 管理ページからの exclude/include API が唯一の呼び出し元。
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const FILE_REL = path.join('data', 'quiz-prototype', 'excluded-works.json');

interface ExclusionFile {
  excluded: string[];
  updatedAt?: string;
}

function filePath(): string {
  return path.join(process.cwd(), FILE_REL);
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(path.dirname(filePath()), { recursive: true });
}

export async function readExclusion(): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(filePath(), 'utf-8');
    const parsed = JSON.parse(raw) as ExclusionFile;
    const arr = Array.isArray(parsed?.excluded) ? parsed.excluded : [];
    return new Set(arr.filter((s) => typeof s === 'string' && s.length > 0));
  } catch {
    return new Set();
  }
}

export async function writeExclusion(ids: Set<string>): Promise<void> {
  try {
    await ensureDir();
    const body: ExclusionFile = {
      excluded: [...ids].sort(),
      updatedAt: new Date().toISOString(),
    };
    await fs.writeFile(filePath(), JSON.stringify(body, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[quiz-prototype/exclusionStore] write failed:', e);
  }
}

export async function addExclusion(workId: string): Promise<Set<string>> {
  const cur = await readExclusion();
  cur.add(workId);
  await writeExclusion(cur);
  return cur;
}

export async function removeExclusion(workId: string): Promise<Set<string>> {
  const cur = await readExclusion();
  cur.delete(workId);
  await writeExclusion(cur);
  return cur;
}
