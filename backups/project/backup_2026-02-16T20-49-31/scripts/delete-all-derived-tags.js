/**
 * 全DERIVEDタグを削除するスクリプト
 */

const Database = require('better-sqlite3');
const path = require('path');

const dryRun = process.argv.includes('--dry-run');
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');

console.log('=== 全DERIVEDタグ削除スクリプト ===');
console.log(`モード: ${dryRun ? 'ドライラン' : '実行モード'}`);
console.log('');

const db = new Database(dbPath);

// DERIVEDタグの統計を取得
const stats = db.prepare(`
  SELECT COUNT(*) as tagCount FROM Tag WHERE tagType = 'DERIVED'
`).get();

const workTagStats = db.prepare(`
  SELECT COUNT(*) as workTagCount FROM WorkTag wt
  INNER JOIN Tag t ON wt.tagKey = t.tagKey
  WHERE t.tagType = 'DERIVED'
`).get();

console.log(`DERIVEDタグ数: ${stats.tagCount}件`);
console.log(`関連WorkTag数: ${workTagStats.workTagCount}件`);
console.log('');

if (!dryRun) {
  console.log('削除実行中...');
  
  const runDelete = db.transaction(() => {
    // WorkTagを削除（DERIVEDタグに紐づくもの）
    const deleteWorkTags = db.prepare(`
      DELETE FROM WorkTag WHERE tagKey IN (
        SELECT tagKey FROM Tag WHERE tagType = 'DERIVED'
      )
    `);
    const result1 = deleteWorkTags.run();
    console.log(`  WorkTag削除: ${result1.changes}件`);
    
    // DERIVEDタグを削除
    const deleteTags = db.prepare(`DELETE FROM Tag WHERE tagType = 'DERIVED'`);
    const result2 = deleteTags.run();
    console.log(`  タグ削除: ${result2.changes}件`);
  });
  
  runDelete();
  
  console.log('');
  console.log('[完了]');
} else {
  console.log('[ドライラン] 実行するには --dry-run を外してください');
}

db.close();
