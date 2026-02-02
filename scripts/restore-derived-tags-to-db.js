/**
 * バックアップからDERIVEDタグをDBに復元するスクリプト
 * - 重複はスキップ
 * - DBにないタグを追加
 * - tagRanks.jsonにないタグにはCランクを付与
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '../prisma/dev.db');
const backupPath = path.join(__dirname, '../data/derived-tags-backup.json');
const ranksPath = path.join(__dirname, '../config/tagRanks.json');

// tagKey生成（ハッシュ）
function generateTagKey(displayName) {
  const hash = crypto.createHash('md5').update(displayName).digest('hex').slice(0, 8);
  return `tag_${hash}`;
}

// メイン処理
function main() {
  const db = new Database(dbPath);
  
  // バックアップ読み込み
  const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  const allBackupTags = backup.allTags;
  console.log(`バックアップタグ数: ${allBackupTags.length}`);
  
  // 現在のDBのDERIVEDタグ取得
  const existingTags = db.prepare(`SELECT displayName FROM Tag WHERE tagType = 'DERIVED'`).all();
  const existingNames = new Set(existingTags.map(t => t.displayName));
  console.log(`既存DBタグ数: ${existingNames.size}`);
  
  // tagRanks読み込み
  const ranksConfig = JSON.parse(fs.readFileSync(ranksPath, 'utf-8'));
  
  // 追加するタグをフィルタ
  const tagsToAdd = allBackupTags.filter(t => !existingNames.has(t.displayName));
  console.log(`追加するタグ数: ${tagsToAdd.length}`);
  
  // INSERT文準備
  const insertStmt = db.prepare(`
    INSERT INTO Tag (id, tagKey, displayName, tagType, category, createdAt, updatedAt)
    VALUES (?, ?, ?, 'DERIVED', ?, datetime('now'), datetime('now'))
  `);
  
  // トランザクションで追加
  let added = 0;
  let newRanks = 0;
  
  db.transaction(() => {
    for (const tag of tagsToAdd) {
      const tagKey = generateTagKey(tag.displayName);
      const id = crypto.randomUUID();
      const category = tag.category || '未分類';
      
      try {
        insertStmt.run(id, tagKey, tag.displayName, category);
        added++;
        
        // tagRanksにない場合はCを追加
        if (!ranksConfig.ranks[tag.displayName]) {
          ranksConfig.ranks[tag.displayName] = 'C';
          newRanks++;
        }
      } catch (e) {
        console.log(`スキップ: ${tag.displayName} - ${e.message}`);
      }
    }
  })();
  
  // 現在DBにあるタグでranksにないものにもCを追加
  const allDbTags = db.prepare(`SELECT displayName FROM Tag WHERE tagType = 'DERIVED'`).all();
  for (const tag of allDbTags) {
    if (!ranksConfig.ranks[tag.displayName]) {
      ranksConfig.ranks[tag.displayName] = 'C';
      newRanks++;
    }
  }
  
  // tagRanks保存
  ranksConfig.updatedAt = new Date().toISOString();
  fs.writeFileSync(ranksPath, JSON.stringify(ranksConfig, null, 2), 'utf-8');
  
  db.close();
  
  // 結果
  console.log('\n=== 結果 ===');
  console.log(`追加されたタグ: ${added}`);
  console.log(`新規ランク追加: ${newRanks}`);
  
  // 確認
  const db2 = new Database(dbPath, { readonly: true });
  const finalCount = db2.prepare(`SELECT COUNT(*) as cnt FROM Tag WHERE tagType = 'DERIVED'`).get();
  console.log(`最終DBのDERIVEDタグ数: ${finalCount.cnt}`);
  db2.close();
  
  const finalRanks = JSON.parse(fs.readFileSync(ranksPath, 'utf-8'));
  console.log(`tagRanksのエントリ数: ${Object.keys(finalRanks.ranks).length}`);
}

main();
