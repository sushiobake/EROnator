const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, '..', 'prisma', 'dev.db'), { readonly: true });

const derivedTags = db.prepare(`
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

console.log(`=== DERIVEDタグ一覧 (${derivedTags.length}件) ===\n`);

// カテゴリ別に集計
const byCategory = new Map();
for (const tag of derivedTags) {
  const cat = tag.category || '(なし)';
  if (!byCategory.has(cat)) byCategory.set(cat, []);
  byCategory.get(cat).push(tag);
}

console.log('=== カテゴリ別統計 ===');
for (const [cat, tags] of byCategory) {
  const totalWorks = tags.reduce((sum, t) => sum + t.workCount, 0);
  console.log(`${cat}: ${tags.length}件 (WorkTag: ${totalWorks})`);
}

console.log('\n=== 作品数順 上位30件 ===');
derivedTags.slice(0, 30).forEach((t, i) => {
  console.log(`${(i+1).toString().padStart(2)}. ${t.displayName.padEnd(20)} | works: ${t.workCount.toString().padStart(3)} | ${t.category || '(なし)'}`);
});

console.log('\n=== 作品数0件のタグ ===');
const zeroWorkTags = derivedTags.filter(t => t.workCount === 0);
console.log(`0件タグ: ${zeroWorkTags.length}件`);
if (zeroWorkTags.length <= 20) {
  zeroWorkTags.forEach(t => console.log(`  - ${t.displayName}`));
} else {
  zeroWorkTags.slice(0, 20).forEach(t => console.log(`  - ${t.displayName}`));
  console.log(`  ... 他 ${zeroWorkTags.length - 20}件`);
}

console.log('\n=== カテゴリ別詳細 ===');
for (const [cat, tags] of byCategory) {
  console.log(`\n【${cat}】${tags.length}件`);
  tags.slice(0, 15).forEach(t => {
    console.log(`  ${t.displayName.padEnd(25)} works: ${t.workCount}`);
  });
  if (tags.length > 15) {
    console.log(`  ... 他 ${tags.length - 15}件`);
  }
}

db.close();
