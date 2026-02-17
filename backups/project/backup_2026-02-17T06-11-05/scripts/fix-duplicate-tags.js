/**
 * 同名タグの重複を検出・削除するスクリプト
 * 使われていない方を削除します
 */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../prisma/dev.db');
const db = new Database(dbPath);

console.log('🔍 同名タグの重複を検出中...\n');

// 同名タグを検出
const duplicates = db.prepare(`
  SELECT displayName, COUNT(*) as count
  FROM Tag
  GROUP BY displayName
  HAVING COUNT(*) > 1
`).all();

if (duplicates.length === 0) {
  console.log('✅ 重複タグはありませんでした。');
  db.close();
  process.exit(0);
}

console.log(`⚠️ ${duplicates.length}個の重複タグ名が見つかりました:\n`);

let deletedCount = 0;

for (const dup of duplicates) {
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`タグ名: "${dup.displayName}" (${dup.count}個)`);
  
  // このdisplayNameを持つ全てのタグを取得
  const tags = db.prepare(`
    SELECT t.tagKey, t.tagType, t.category,
           (SELECT COUNT(*) FROM WorkTag wt WHERE wt.tagKey = t.tagKey) as usageCount
    FROM Tag t
    WHERE t.displayName = ?
    ORDER BY usageCount DESC
  `).all(dup.displayName);
  
  tags.forEach((tag, i) => {
    console.log(`  ${i + 1}. ${tag.tagKey}`);
    console.log(`     type: ${tag.tagType}, category: ${tag.category || 'null'}`);
    console.log(`     使用回数: ${tag.usageCount}件`);
  });
  
  // 使用回数が最も多いものを残し、他は削除
  const [keep, ...toDelete] = tags;
  
  if (toDelete.length > 0) {
    console.log(`\n  → 残す: ${keep.tagKey} (${keep.usageCount}件使用)`);
    
    for (const del of toDelete) {
      if (del.usageCount > 0) {
        // 使用中のタグは、WorkTagを残すタグに付け替える
        console.log(`  → ${del.tagKey} の ${del.usageCount}件を ${keep.tagKey} に付け替え`);
        
        // 既に同じworkIdでkeep.tagKeyが存在する場合はスキップ
        const existingWorkTags = db.prepare(`
          SELECT workId FROM WorkTag WHERE tagKey = ?
        `).all(del.tagKey);
        
        for (const wt of existingWorkTags) {
          const alreadyExists = db.prepare(`
            SELECT 1 FROM WorkTag WHERE workId = ? AND tagKey = ?
          `).get(wt.workId, keep.tagKey);
          
          if (!alreadyExists) {
            db.prepare(`
              UPDATE WorkTag SET tagKey = ? WHERE workId = ? AND tagKey = ?
            `).run(keep.tagKey, wt.workId, del.tagKey);
          } else {
            // 既にあるので削除
            db.prepare(`
              DELETE FROM WorkTag WHERE workId = ? AND tagKey = ?
            `).run(wt.workId, del.tagKey);
          }
        }
      }
      
      // タグを削除
      db.prepare(`DELETE FROM Tag WHERE tagKey = ?`).run(del.tagKey);
      console.log(`  → 削除: ${del.tagKey}`);
      deletedCount++;
    }
  }
  console.log('');
}

console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`✅ 完了: ${deletedCount}個のタグを削除しました`);

db.close();
