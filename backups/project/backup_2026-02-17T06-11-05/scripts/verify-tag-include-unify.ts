/**
 * config/tagIncludeUnify.json の全タグを一覧し、欠損チェック用の元データとして出力する。
 * 実行: npx ts-node scripts/verify-tag-include-unify.ts
 * または: npx tsx scripts/verify-tag-include-unify.ts
 */

import fs from 'fs';
import path from 'path';

const configPath = path.join(process.cwd(), 'config', 'tagIncludeUnify.json');
const tagCategoriesPath = path.join(process.cwd(), 'config', 'tagCategories.json');

interface Config {
  include?: Record<string, string[]>;
  unify?: string[][];
}

function loadJson<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function main() {
  const config = loadJson<Config>(configPath);
  if (!config) {
    console.error('config/tagIncludeUnify.json を読み込めません');
    process.exit(1);
  }

  const allDisplayNames = new Set<string>();

  console.log('=== include（代表 → 包括されるタグ）===');
  for (const [rep, included] of Object.entries(config.include ?? {})) {
    allDisplayNames.add(rep);
    included.forEach((d) => allDisplayNames.add(d));
    console.log(`  ${rep} → [${included.join(', ')}]`);
  }

  console.log('\n=== unify（同義グループ）===');
  for (const group of config.unify ?? []) {
    group.forEach((d) => allDisplayNames.add(d));
    console.log(`  [${group.join(', ')}]`);
  }

  console.log('\n=== 全 displayName 一覧（config 内）===');
  const sorted = [...allDisplayNames].sort((a, b) => a.localeCompare(b));
  sorted.forEach((d) => console.log(`  ${d}`));
  console.log(`\n合計: ${sorted.length} 件`);

  // tagCategories の tagsByCategory に含まれるか簡易チェック
  const categories = loadJson<{ tagsByCategory?: Record<string, string[]> }>(tagCategoriesPath);
  if (categories?.tagsByCategory) {
    const inCategories = new Set<string>();
    for (const list of Object.values(categories.tagsByCategory)) {
      list.forEach((d) => inCategories.add(d));
    }
    const missingInCategories = sorted.filter((d) => !inCategories.has(d));
    if (missingInCategories.length > 0) {
      console.log('\n=== tagCategories.json の tagsByCategory に未掲載（参考）===');
      missingInCategories.forEach((d) => console.log(`  ${d}`));
      console.log('  ※DBに存在するタグは tagsByCategory に無くても問題ありません');
    }
  }
}

main();
