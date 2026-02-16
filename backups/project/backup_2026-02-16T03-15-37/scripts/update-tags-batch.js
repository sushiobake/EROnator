/**
 * タグ一括更新スクリプト
 * 1. ベスト・総集編 → カテゴリを「その他」に変更
 * 2. 旧作 → 削除＆禁止タグ追加
 * 3. 輪● → 削除のみ
 * 4. 6つのタグを追加
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
const bannedTagsPath = path.join(__dirname, '..', 'config', 'bannedTags.json');

console.log('=== タグ一括更新スクリプト ===\n');

const db = new Database(dbPath);

// 1. ベスト・総集編のカテゴリを「その他」に変更
console.log('【1】ベスト・総集編 → カテゴリを「その他」に変更');
const updateBest = db.prepare(`UPDATE Tag SET category = 'その他' WHERE displayName = 'ベスト・総集編'`);
const resultBest = updateBest.run();
console.log(`  更新: ${resultBest.changes}件\n`);

// 2. 旧作 → 削除＆禁止タグ追加
console.log('【2】旧作 → 削除＆禁止タグ追加');
const oldWorkTag = db.prepare(`SELECT tagKey FROM Tag WHERE displayName = '旧作'`).get();
if (oldWorkTag) {
  db.prepare(`DELETE FROM WorkTag WHERE tagKey = ?`).run(oldWorkTag.tagKey);
  db.prepare(`DELETE FROM Tag WHERE tagKey = ?`).run(oldWorkTag.tagKey);
  console.log(`  タグ削除完了: ${oldWorkTag.tagKey}`);
  
  // 禁止タグに追加
  const bannedConfig = JSON.parse(fs.readFileSync(bannedTagsPath, 'utf-8'));
  const exists = bannedConfig.bannedTags.some(t => t.pattern === '旧作' && t.type === 'exact');
  if (!exists) {
    bannedConfig.bannedTags.push({
      pattern: '旧作',
      type: 'exact',
      reason: '不要タグ',
      addedAt: new Date().toISOString().split('T')[0],
    });
    fs.writeFileSync(bannedTagsPath, JSON.stringify(bannedConfig, null, 2), 'utf-8');
    console.log('  禁止タグに追加完了');
  } else {
    console.log('  既に禁止タグに存在');
  }
} else {
  console.log('  「旧作」タグは見つかりませんでした');
}
console.log('');

// 3. 輪● → 削除のみ
console.log('【3】輪● → 削除のみ');
const rinTag = db.prepare(`SELECT tagKey FROM Tag WHERE displayName = '輪●'`).get();
if (rinTag) {
  db.prepare(`DELETE FROM WorkTag WHERE tagKey = ?`).run(rinTag.tagKey);
  db.prepare(`DELETE FROM Tag WHERE tagKey = ?`).run(rinTag.tagKey);
  console.log(`  タグ削除完了: ${rinTag.tagKey}`);
} else {
  console.log('  「輪●」タグは見つかりませんでした');
}
console.log('');

// 4. 6つのタグを追加
console.log('【4】新規タグ追加（OFFICIAL / その他）');
const newTags = [
  '擬人化',
  '女主人公のみ',
  'アンソロジー',
  '残虐表現',
  '男無',
  '女性視点',
];

const crypto = require('crypto');
const insertTag = db.prepare(`
  INSERT OR IGNORE INTO Tag (tagKey, displayName, tagType, category, questionTemplate, createdAt, updatedAt)
  VALUES (?, ?, 'OFFICIAL', 'その他', NULL, datetime('now'), datetime('now'))
`);

for (const tagName of newTags) {
  // tagKeyを生成（off_ハッシュ形式）
  const hash = crypto.createHash('md5').update(tagName).digest('hex').substring(0, 10);
  const tagKey = `off_${hash}`;
  
  // 既存チェック
  const existing = db.prepare(`SELECT tagKey FROM Tag WHERE displayName = ?`).get(tagName);
  if (existing) {
    console.log(`  [スキップ] ${tagName} - 既に存在: ${existing.tagKey}`);
  } else {
    insertTag.run(tagKey, tagName);
    console.log(`  [追加] ${tagName} → ${tagKey}`);
  }
}

console.log('\n=== 完了 ===');

db.close();
