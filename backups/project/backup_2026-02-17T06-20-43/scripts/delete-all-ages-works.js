/**
 * 「全年齢向け」タグを持つ作品を削除するスクリプト
 * エロネーターの対象外作品
 */

const Database = require('better-sqlite3');
const path = require('path');

const dryRun = process.argv.includes('--dry-run');
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');

console.log(`=== 全年齢向け作品削除スクリプト ===`);
console.log(`モード: ${dryRun ? 'ドライラン' : '実行モード'}`);
console.log('');

const db = new Database(dbPath);

// 「全年齢向け」タグを持つ作品を取得
const targetTag = db.prepare(`SELECT tagKey FROM Tag WHERE displayName = '全年齢向け'`).get();

if (!targetTag) {
  console.log('「全年齢向け」タグが見つかりません');
  db.close();
  process.exit(0);
}

console.log(`タグキー: ${targetTag.tagKey}`);

// このタグを持つ作品を取得
const worksToDelete = db.prepare(`
  SELECT w.workId, w.title, w.authorName
  FROM Work w
  INNER JOIN WorkTag wt ON w.workId = wt.workId
  WHERE wt.tagKey = ?
`).all(targetTag.tagKey);

console.log(`削除対象作品: ${worksToDelete.length}件`);
console.log('');

for (const work of worksToDelete) {
  console.log(`[削除] ${work.title} (${work.authorName || '不明'})`);
}

if (!dryRun && worksToDelete.length > 0) {
  console.log('');
  console.log('削除実行中...');
  
  const workIds = worksToDelete.map(w => w.workId);
  
  const runDelete = db.transaction(() => {
    // WorkTagを削除
    const deleteWorkTag = db.prepare(`DELETE FROM WorkTag WHERE workId = ?`);
    for (const workId of workIds) {
      deleteWorkTag.run(workId);
    }
    console.log(`  WorkTag削除完了`);
    
    // Workを削除
    const deleteWork = db.prepare(`DELETE FROM Work WHERE workId = ?`);
    for (const workId of workIds) {
      deleteWork.run(workId);
    }
    console.log(`  Work削除完了`);
  });
  
  runDelete();
  
  console.log('');
  console.log(`[完了] ${worksToDelete.length}件の作品を削除しました`);
} else if (dryRun) {
  console.log('');
  console.log('[ドライラン] 実行するには --dry-run を外してください');
}

db.close();
