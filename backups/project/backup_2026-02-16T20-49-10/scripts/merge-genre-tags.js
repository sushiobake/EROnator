/**
 * ジャンルタグを他のカテゴリに統合するスクリプト
 * 
 * 処理内容:
 * 1. 同じdisplayNameを持つ重複タグを検出
 * 2. 「ジャンル」タグのWorkTagを統合先タグに移行
 * 3. 「ジャンル」タグを削除
 * 
 * 安全対策:
 * - 既に統合先に同じwork-tag組み合わせがある場合はスキップ
 * - ドライランモードで事前確認可能
 */

const Database = require('better-sqlite3');
const path = require('path');

// コマンドライン引数
const dryRun = process.argv.includes('--dry-run');
const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');

console.log(`=== ジャンルタグ統合スクリプト ===`);
console.log(`モード: ${dryRun ? 'ドライラン（変更なし）' : '実行モード'}`);
console.log(`DB: ${dbPath}`);
console.log('');

const db = new Database(dbPath);

// バックアップ用にWALをチェックポイント
if (!dryRun) {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    console.log('WALチェックポイント完了');
  } catch (e) {
    console.log('WALチェックポイントスキップ（既にロック中の可能性）');
  }
}

// OFFICIALタグを取得
const tags = db.prepare(`
  SELECT 
    t.tagKey,
    t.displayName,
    t.category
  FROM Tag t
  WHERE t.tagType = 'OFFICIAL'
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

// 統合対象を抽出
const migrations = [];
for (const [name, tagList] of grouped) {
  if (tagList.length >= 2) {
    // ジャンルタグを探す
    const genreTags = tagList.filter(t => t.category === 'ジャンル');
    const nonGenreTag = tagList.find(t => t.category !== 'ジャンル');
    
    if (genreTags.length > 0 && nonGenreTag) {
      for (const genreTag of genreTags) {
        migrations.push({
          displayName: name,
          sourceTagKey: genreTag.tagKey,
          targetTagKey: nonGenreTag.tagKey,
          targetCategory: nonGenreTag.category,
        });
      }
    }
  }
}

console.log(`統合対象: ${migrations.length}件`);
console.log('');

// 統計
let movedWorkTags = 0;
let skippedWorkTags = 0;
let deletedTags = 0;

// トランザクション開始
const runMigration = db.transaction(() => {
  for (const m of migrations) {
    console.log(`【${m.displayName}】`);
    console.log(`  ${m.sourceTagKey} → ${m.targetTagKey} (${m.targetCategory})`);
    
    // ソースタグのWorkTagを取得
    const sourceWorkTags = db.prepare(`
      SELECT workId, derivedConfidence FROM WorkTag WHERE tagKey = ?
    `).all(m.sourceTagKey);
    
    // 既存のターゲットWorkTagを取得
    const existingTargetWorkIds = new Set(
      db.prepare(`SELECT workId FROM WorkTag WHERE tagKey = ?`).all(m.targetTagKey).map(r => r.workId)
    );
    
    let moved = 0;
    let skipped = 0;
    
    for (const wt of sourceWorkTags) {
      if (existingTargetWorkIds.has(wt.workId)) {
        // 既に存在 → スキップ（ソースは後で削除される）
        skipped++;
        skippedWorkTags++;
      } else {
        // 移行: tagKeyを更新
        if (!dryRun) {
          db.prepare(`UPDATE WorkTag SET tagKey = ? WHERE tagKey = ? AND workId = ?`)
            .run(m.targetTagKey, m.sourceTagKey, wt.workId);
        }
        moved++;
        movedWorkTags++;
      }
    }
    
    console.log(`  WorkTag移行: ${moved}件, スキップ: ${skipped}件`);
    
    // ソースタグの残りのWorkTag（スキップ分）を削除
    if (!dryRun && skipped > 0) {
      db.prepare(`DELETE FROM WorkTag WHERE tagKey = ?`).run(m.sourceTagKey);
    }
    
    // ソースタグを削除
    if (!dryRun) {
      db.prepare(`DELETE FROM Tag WHERE tagKey = ?`).run(m.sourceTagKey);
    }
    deletedTags++;
  }
});

try {
  if (dryRun) {
    // ドライランでも統計は計算するが、実際の変更はしない
    for (const m of migrations) {
      const sourceWorkTags = db.prepare(`
        SELECT workId FROM WorkTag WHERE tagKey = ?
      `).all(m.sourceTagKey);
      
      const existingTargetWorkIds = new Set(
        db.prepare(`SELECT workId FROM WorkTag WHERE tagKey = ?`).all(m.targetTagKey).map(r => r.workId)
      );
      
      for (const wt of sourceWorkTags) {
        if (existingTargetWorkIds.has(wt.workId)) {
          skippedWorkTags++;
        } else {
          movedWorkTags++;
        }
      }
      deletedTags++;
    }
    console.log(`\n[ドライラン] 以下の変更が実行されます:`);
  } else {
    runMigration();
    console.log(`\n[実行完了]`);
  }
  
  console.log(`  WorkTag移行: ${movedWorkTags}件`);
  console.log(`  WorkTagスキップ（重複）: ${skippedWorkTags}件`);
  console.log(`  タグ削除: ${deletedTags}件`);
  
  if (dryRun) {
    console.log(`\n実行するには --dry-run を外して再度実行してください。`);
  }
} catch (e) {
  console.error('エラー:', e.message);
  process.exit(1);
} finally {
  db.close();
}
