/**
 * DERIVEDタグ（A/Bランク）とOFFICIALタグの重複チェック
 * 重複しているものはCに変更
 */
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../prisma/dev.db');
const ranksPath = path.join(__dirname, '../config/tagRanks.json');

const db = new Database(dbPath, { readonly: true });
const ranksConfig = JSON.parse(fs.readFileSync(ranksPath, 'utf-8'));
const ranks = ranksConfig.ranks;

// OFFICIALタグ取得
const officialTags = db.prepare(`SELECT displayName FROM Tag WHERE tagType = 'OFFICIAL'`).all();
const officialNames = new Set(officialTags.map(t => t.displayName.toLowerCase()));
const officialNamesOriginal = new Map(officialTags.map(t => [t.displayName.toLowerCase(), t.displayName]));

console.log(`OFFICIAL tags: ${officialNames.size}`);

// A/Bランクのタグ取得
const aRankTags = Object.entries(ranks).filter(([k, v]) => v === 'A').map(([k]) => k);
const bRankTags = Object.entries(ranks).filter(([k, v]) => v === 'B').map(([k]) => k);

console.log(`\nA rank tags: ${aRankTags.length}`);
console.log(`B rank tags: ${bRankTags.length}`);

// 重複チェック（完全一致または類似）
const toDowngrade = [];

function checkSimilarity(derived, officials) {
  const derivedLower = derived.toLowerCase();
  
  // 完全一致
  if (officials.has(derivedLower)) {
    return officialNamesOriginal.get(derivedLower);
  }
  
  // 部分一致チェック（例: 3P と 3P・4P）
  for (const [officialLower, officialOriginal] of officialNamesOriginal) {
    // derivedがofficialに含まれている
    if (officialLower.includes(derivedLower) && derivedLower.length >= 2) {
      return officialOriginal;
    }
    // officialがderivedに含まれている
    if (derivedLower.includes(officialLower) && officialLower.length >= 2) {
      return officialOriginal;
    }
  }
  
  return null;
}

console.log('\n=== A ランクの重複チェック ===');
for (const tag of aRankTags) {
  const match = checkSimilarity(tag, officialNames);
  if (match) {
    console.log(`  ❌ "${tag}" → OFFICIAL: "${match}"`);
    toDowngrade.push({ tag, reason: `OFFICIAL "${match}" と重複` });
  }
}

console.log('\n=== B ランクの重複チェック ===');
for (const tag of bRankTags) {
  const match = checkSimilarity(tag, officialNames);
  if (match) {
    console.log(`  ❌ "${tag}" → OFFICIAL: "${match}"`);
    toDowngrade.push({ tag, reason: `OFFICIAL "${match}" と重複` });
  }
}

// 追加チェック: 微妙なA/Bタグ（作品固有すぎる、汎用性がない等）
const suspiciousPatternsForDowngrade = [
  // 作品固有系
  /シリーズ$/,
  /編$/,
  /話$/,
  /版$/,
  /^第\d/,
  /\d{4}年/,
  /\d+月/,
  // 数字だけ
  /^\d+$/,
  // 長すぎる（15文字以上）
  /^.{15,}$/,
  // 固有名詞っぽい
  /^[ァ-ヴー]+$/u, // カタカナのみ（人名、タイトルっぽい）
];

console.log('\n=== パターンによる追加チェック ===');
for (const tag of [...aRankTags, ...bRankTags]) {
  if (toDowngrade.some(t => t.tag === tag)) continue; // すでに対象
  
  for (const pattern of suspiciousPatternsForDowngrade) {
    if (pattern.test(tag)) {
      console.log(`  ⚠️ "${tag}" → パターン: ${pattern}`);
      toDowngrade.push({ tag, reason: `パターン ${pattern} にマッチ` });
      break;
    }
  }
}

// 結果サマリー
console.log('\n=== サマリー ===');
console.log(`Cランクへの変更候補: ${toDowngrade.length}件`);
toDowngrade.forEach(t => console.log(`  - ${t.tag}: ${t.reason}`));

// 確認
if (toDowngrade.length > 0) {
  console.log('\n変更を適用しますか？ (y/n)');
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('> ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      for (const { tag } of toDowngrade) {
        ranksConfig.ranks[tag] = 'C';
      }
      ranksConfig.updatedAt = new Date().toISOString();
      fs.writeFileSync(ranksPath, JSON.stringify(ranksConfig, null, 2), 'utf-8');
      console.log('✅ 変更を適用しました');
    } else {
      console.log('キャンセルしました');
    }
    rl.close();
    db.close();
  });
} else {
  console.log('変更候補はありません');
  db.close();
}
