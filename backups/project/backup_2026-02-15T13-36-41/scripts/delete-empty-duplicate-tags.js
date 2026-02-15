/**
 * works: 0 の重複タグを削除するスクリプト
 * 
 * 条件:
 * - 同じdisplayNameを持つタグが複数ある
 * - そのうちworks: 0のタグを削除
 */

const Database = require('better-sqlite3');
const path = require('path');

const dryRun = process.argv.includes('--dry-run');
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');

console.log(`=== 空の重複タグ削除スクリプト ===`);
console.log(`モード: ${dryRun ? 'ドライラン' : '実行モード'}`);
console.log('');

const db = new Database(dbPath);

// OFFICIALタグを取得（workCount付き）
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

// 削除対象を抽出
const toDelete = [];
for (const [name, tagList] of grouped) {
  if (tagList.length >= 2) {
    // works: 0 のタグを削除対象に
    const nonEmptyTags = tagList.filter(t => t.workCount > 0);
    const emptyTags = tagList.filter(t => t.workCount === 0);
    
    // 非空タグがある場合のみ、空タグを削除
    if (nonEmptyTags.length > 0 && emptyTags.length > 0) {
      for (const emptyTag of emptyTags) {
        toDelete.push({
          displayName: name,
          tagKey: emptyTag.tagKey,
          category: emptyTag.category,
          keepTag: nonEmptyTags[0].tagKey,
          keepCategory: nonEmptyTags[0].category,
          keepWorkCount: nonEmptyTags[0].workCount,
        });
      }
    }
  }
}

console.log(`削除対象: ${toDelete.length}件`);
console.log('');

for (const d of toDelete) {
  console.log(`【${d.displayName}】`);
  console.log(`  削除: ${d.tagKey} (${d.category || 'なし'}, works: 0)`);
  console.log(`  残す: ${d.keepTag} (${d.keepCategory || 'なし'}, works: ${d.keepWorkCount})`);
  
  if (!dryRun) {
    db.prepare(`DELETE FROM Tag WHERE tagKey = ?`).run(d.tagKey);
  }
}

console.log('');
if (dryRun) {
  console.log(`[ドライラン] ${toDelete.length}件のタグが削除されます`);
  console.log(`実行するには --dry-run を外して再度実行してください。`);
} else {
  console.log(`[実行完了] ${toDelete.length}件のタグを削除しました`);
}

db.close();
