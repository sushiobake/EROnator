// better-sqlite3で読み取り専用で開く（dev server動作中でもOK）
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
const db = new Database(dbPath, { readonly: true });

// OFFICIALタグを取得
const tags = db.prepare(`
  SELECT 
    t.tagKey,
    t.displayName,
    t.category,
    COUNT(wt.workId) as workCount
  FROM Tag t
  LEFT JOIN WorkTag wt ON t.tagKey = wt.tagKey
  WHERE t.tagType = 'OFFICIAL'
  GROUP BY t.tagKey
  ORDER BY t.displayName
`).all();

// displayNameでグループ化
const grouped = new Map();
for (const tag of tags) {
  const name = tag.displayName;
  if (!grouped.has(name)) {
    grouped.set(name, []);
  }
  grouped.get(name).push(tag);
}

// 重複（2つ以上）があるものを表示
console.log('=== 重複しているOFFICIALタグ ===\n');
let duplicateCount = 0;
let genreTagCount = 0;
const duplicates = [];

for (const [name, tagList] of grouped) {
  if (tagList.length >= 2) {
    duplicateCount++;
    console.log(`【${name}】`);
    
    // ジャンルタグがあるかチェック
    const genreTag = tagList.find(t => t.category === 'ジャンル');
    const nonGenreTag = tagList.find(t => t.category !== 'ジャンル');
    
    for (const t of tagList) {
      const isGenre = t.category === 'ジャンル';
      const marker = isGenre ? ' ← 削除候補' : ' ← 統合先';
      console.log(`  ${t.tagKey} | ${t.category || '(なし)'} | works: ${t.workCount}${marker}`);
    }
    
    if (genreTag && nonGenreTag) {
      genreTagCount++;
      duplicates.push({
        displayName: name,
        sourceTag: genreTag.tagKey,
        sourceCategory: genreTag.category,
        sourceWorkCount: genreTag.workCount,
        targetTag: nonGenreTag.tagKey,
        targetCategory: nonGenreTag.category,
        targetWorkCount: nonGenreTag.workCount,
      });
    }
    console.log('');
  }
}

console.log(`重複タグセット数: ${duplicateCount}`);
console.log(`うち「ジャンル」→ 他カテゴリへ統合可能: ${genreTagCount}`);
console.log('\n=== 統合対象一覧 ===');
for (const d of duplicates) {
  console.log(`${d.displayName}: ${d.sourceTag}(${d.sourceWorkCount}件) → ${d.targetTag}(${d.targetWorkCount}件)`);
}

db.close();
