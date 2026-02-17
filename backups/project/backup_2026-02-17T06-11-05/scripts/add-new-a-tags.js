const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '../prisma/dev.db');
const ranksPath = path.join(__dirname, '../config/tagRanks.json');

// 追加候補タグ
const candidates = [
  // 関係性
  { name: '義母', category: '関係性' },
  { name: '義姉', category: '関係性' },
  { name: '義妹', category: '関係性' },
  { name: '叔母', category: '関係性' },
  { name: '上司', category: '関係性' },
  { name: '部下', category: '関係性' },
  { name: '教師', category: '関係性' },
  { name: '生徒', category: '関係性' },
  // 場所
  { name: '教室', category: '場所' },
  { name: 'オフィス', category: '場所' },
  { name: '電車', category: '場所' },
  { name: '公園', category: '場所' },
  { name: 'プール', category: '場所' },
  // シチュエーション
  { name: '催眠', category: 'シチュエーション' },
  { name: '時間停止', category: 'シチュエーション' },
  { name: '透明人間', category: 'シチュエーション' },
  { name: '逆レイプ', category: 'シチュエーション' },
  { name: '寝取られ視点', category: 'シチュエーション' },
  // 属性
  { name: 'ツンデレ', category: '属性' },
  { name: 'クーデレ', category: '属性' },
  { name: 'ボクっ娘', category: '属性' },
  { name: '地雷系', category: '属性' },
  // 体型
  { name: 'ぽっちゃり', category: '体型' },
  { name: 'ムチムチ', category: '体型' },
  { name: 'スレンダー', category: '体型' },
];

const db = new Database(dbPath);

// 既存タグ取得
const existingTags = db.prepare(`SELECT displayName FROM Tag`).all();
const existingNames = new Set(existingTags.map(t => t.displayName.toLowerCase()));

console.log(`既存タグ数: ${existingNames.size}`);

// 重複チェック（部分一致も考慮）
function isDuplicate(name) {
  const lower = name.toLowerCase();
  // 完全一致
  if (existingNames.has(lower)) return true;
  // 既存タグに含まれている or 含んでいる
  for (const existing of existingNames) {
    if (existing.includes(lower) || lower.includes(existing)) {
      // 2文字以上なら重複とみなす
      if (lower.length >= 2 && existing.length >= 2) {
        return true;
      }
    }
  }
  return false;
}

// tagKey生成
function generateTagKey(displayName) {
  const hash = crypto.createHash('md5').update(displayName).digest('hex').slice(0, 8);
  return `tag_${hash}`;
}

// 追加可能なタグをフィルタ
const toAdd = candidates.filter(c => !isDuplicate(c.name));
const duplicates = candidates.filter(c => isDuplicate(c.name));

console.log(`\n重複するタグ（スキップ）:`);
duplicates.forEach(c => console.log(`  - ${c.name}`));

console.log(`\n追加するタグ:`);
toAdd.forEach(c => console.log(`  + ${c.name} (${c.category})`));

// DB追加
const insertStmt = db.prepare(`
  INSERT INTO Tag (id, tagKey, displayName, tagType, category, createdAt, updatedAt)
  VALUES (?, ?, ?, 'DERIVED', ?, datetime('now'), datetime('now'))
`);

// ランク設定
const ranksConfig = JSON.parse(fs.readFileSync(ranksPath, 'utf-8'));

let added = 0;
db.transaction(() => {
  for (const tag of toAdd) {
    const tagKey = generateTagKey(tag.name);
    const id = crypto.randomUUID();
    try {
      insertStmt.run(id, tagKey, tag.name, tag.category);
      ranksConfig.ranks[tag.name] = 'A'; // Aランクに設定
      added++;
    } catch (e) {
      console.log(`エラー: ${tag.name} - ${e.message}`);
    }
  }
})();

// ランク保存
ranksConfig.updatedAt = new Date().toISOString();
fs.writeFileSync(ranksPath, JSON.stringify(ranksConfig, null, 2), 'utf-8');

db.close();

console.log(`\n完了: ${added}件のタグを追加しました`);
