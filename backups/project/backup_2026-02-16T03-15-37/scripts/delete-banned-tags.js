/**
 * 禁止タグリストに基づいてタグを削除するスクリプト
 * 「ベスト・総集編」は残す
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dryRun = process.argv.includes('--dry-run');
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
const bannedTagsPath = path.join(__dirname, '..', 'config', 'bannedTags.json');

console.log(`=== 禁止タグ削除スクリプト ===`);
console.log(`モード: ${dryRun ? 'ドライラン' : '実行モード'}`);
console.log('');

// 禁止タグ設定を読み込み
const bannedConfig = JSON.parse(fs.readFileSync(bannedTagsPath, 'utf-8'));
const bannedTags = bannedConfig.bannedTags;

// タグ名が禁止リストにマッチするかチェック
function isTagBanned(tagName, skipPattern = null) {
  for (const banned of bannedTags) {
    // スキップパターン（残すタグ）
    if (skipPattern && tagName === skipPattern) continue;
    
    switch (banned.type) {
      case 'exact':
        if (tagName === banned.pattern) return { matched: true, banned };
        break;
      case 'startsWith':
        if (tagName.startsWith(banned.pattern)) return { matched: true, banned };
        break;
      case 'contains':
        if (tagName.includes(banned.pattern)) return { matched: true, banned };
        break;
      case 'regex':
        try {
          if (new RegExp(banned.pattern).test(tagName)) return { matched: true, banned };
        } catch (e) {
          // 無効な正規表現
        }
        break;
    }
  }
  return { matched: false };
}

const db = new Database(dbPath);

// 全タグを取得
const allTags = db.prepare(`
  SELECT 
    t.tagKey,
    t.displayName,
    t.category,
    COUNT(wt.workId) as workCount
  FROM Tag t
  LEFT JOIN WorkTag wt ON t.tagKey = wt.tagKey
  GROUP BY t.tagKey
  ORDER BY t.displayName
`).all();

// 残すタグ（例外）
const keepPatterns = ['ベスト・総集編'];

// 削除対象を特定
const toDelete = [];
for (const tag of allTags) {
  // 残すパターンに該当する場合はスキップ
  if (keepPatterns.includes(tag.displayName)) {
    console.log(`[残す] ${tag.displayName} (tagKey: ${tag.tagKey})`);
    continue;
  }
  
  const result = isTagBanned(tag.displayName);
  if (result.matched) {
    toDelete.push({
      tagKey: tag.tagKey,
      displayName: tag.displayName,
      category: tag.category,
      workCount: tag.workCount,
      reason: result.banned.reason,
      matchType: result.banned.type,
      matchPattern: result.banned.pattern,
    });
  }
}

console.log('');
console.log(`禁止タグリスト: ${bannedTags.length}件`);
console.log(`削除対象タグ: ${toDelete.length}件`);
console.log('');

// 削除対象を表示
for (const tag of toDelete) {
  console.log(`[削除] ${tag.displayName} (${tag.matchType}: "${tag.matchPattern}") - works: ${tag.workCount}`);
}

if (!dryRun && toDelete.length > 0) {
  console.log('');
  console.log('削除実行中...');
  
  const deleteWorkTag = db.prepare('DELETE FROM WorkTag WHERE tagKey = ?');
  const deleteTag = db.prepare('DELETE FROM Tag WHERE tagKey = ?');
  
  let deletedWorkTags = 0;
  let deletedTags = 0;
  
  const runDelete = db.transaction(() => {
    for (const tag of toDelete) {
      // WorkTagを削除
      const result1 = deleteWorkTag.run(tag.tagKey);
      deletedWorkTags += result1.changes;
      
      // タグを削除
      const result2 = deleteTag.run(tag.tagKey);
      deletedTags += result2.changes;
    }
  });
  
  runDelete();
  
  console.log('');
  console.log(`[完了] WorkTag削除: ${deletedWorkTags}件, タグ削除: ${deletedTags}件`);
} else if (dryRun) {
  console.log('');
  console.log('[ドライラン] 実行するには --dry-run を外してください');
}

db.close();
