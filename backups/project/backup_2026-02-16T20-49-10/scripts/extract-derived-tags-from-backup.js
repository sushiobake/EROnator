/**
 * バックアップDBからDERIVEDタグを抽出してリスト化
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '..', 'backups', 'dev_before_derived_cleanup.db');

console.log('=== DERIVEDタグ抽出 ===');
console.log(`DB: ${dbPath}`);
console.log('');

const db = new Database(dbPath, { readonly: true });

// DERIVEDタグを取得（workCountも計算）
const tags = db.prepare(`
  SELECT 
    t.tagKey,
    t.displayName,
    t.category,
    COUNT(wt.workId) as workCount
  FROM Tag t
  LEFT JOIN WorkTag wt ON t.tagKey = wt.tagKey
  WHERE t.tagType = 'DERIVED'
  GROUP BY t.tagKey
  ORDER BY workCount DESC, t.displayName
`).all();

console.log(`合計: ${tags.length}件のDERIVEDタグ`);
console.log('');

// カテゴリ別に集計
const byCategory = {};
for (const tag of tags) {
  const cat = tag.category || '未分類';
  if (!byCategory[cat]) {
    byCategory[cat] = [];
  }
  byCategory[cat].push(tag);
}

console.log('=== カテゴリ別 ===');
for (const [cat, catTags] of Object.entries(byCategory)) {
  console.log(`${cat}: ${catTags.length}件`);
}
console.log('');

// CSV形式で出力
const outputPath = path.join(__dirname, '..', 'data', 'derived-tags-backup.csv');
const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const csvLines = ['displayName,category,workCount,action'];
for (const tag of tags) {
  // CSVエスケープ
  const name = tag.displayName.includes(',') ? `"${tag.displayName}"` : tag.displayName;
  const cat = tag.category || '';
  csvLines.push(`${name},${cat},${tag.workCount},`);
}

fs.writeFileSync(outputPath, csvLines.join('\n'), 'utf8');
console.log(`CSV出力: ${outputPath}`);

// JSON形式でも出力（より詳細）
const jsonPath = path.join(__dirname, '..', 'data', 'derived-tags-backup.json');
const jsonData = {
  extractedAt: new Date().toISOString(),
  totalCount: tags.length,
  byCategory: Object.fromEntries(
    Object.entries(byCategory).map(([cat, catTags]) => [
      cat,
      catTags.map(t => ({ displayName: t.displayName, workCount: t.workCount }))
    ])
  ),
  allTags: tags.map(t => ({
    displayName: t.displayName,
    category: t.category,
    workCount: t.workCount
  }))
};
fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');
console.log(`JSON出力: ${jsonPath}`);

// 上位タグを表示
console.log('');
console.log('=== 上位20件（workCount順） ===');
for (let i = 0; i < Math.min(20, tags.length); i++) {
  const t = tags[i];
  console.log(`${(i+1).toString().padStart(2)}. ${t.displayName} (${t.workCount}件) [${t.category || '-'}]`);
}

db.close();
