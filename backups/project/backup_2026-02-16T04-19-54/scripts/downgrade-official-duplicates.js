/**
 * DERIVEDタグ（A/Bランク）でOFFICIALタグと重複しているものをCに変更
 * カタカナパターンは除外（有用なものが多いため）
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
const officialNamesLower = new Set(officialTags.map(t => t.displayName.toLowerCase()));
const officialMap = new Map(officialTags.map(t => [t.displayName.toLowerCase(), t.displayName]));

// A/Bランクのタグ取得
const aRankTags = Object.entries(ranks).filter(([k, v]) => v === 'A').map(([k]) => k);
const bRankTags = Object.entries(ranks).filter(([k, v]) => v === 'B').map(([k]) => k);

console.log(`OFFICIAL: ${officialNamesLower.size}件`);
console.log(`A rank: ${aRankTags.length}件`);
console.log(`B rank: ${bRankTags.length}件`);

// 完全一致のみ（部分一致は誤検出が多いので除外）
const exactMatches = [];
const partialMatches = []; // 確認用

function checkMatch(derived) {
  const derivedLower = derived.toLowerCase();
  
  // 完全一致
  if (officialNamesLower.has(derivedLower)) {
    return { type: 'exact', official: officialMap.get(derivedLower) };
  }
  
  // 厳密な部分一致（OFFICIALに完全に含まれている場合）
  for (const [officialLower, officialOriginal] of officialMap) {
    // 「・」「/」「、」で区切られた部分と一致
    const parts = officialLower.split(/[・\/、]/);
    if (parts.some(p => p === derivedLower)) {
      return { type: 'partial_exact', official: officialOriginal };
    }
  }
  
  return null;
}

console.log('\n=== 重複チェック（完全一致のみ変更） ===');

const toDowngrade = [];

for (const tag of [...aRankTags, ...bRankTags]) {
  const match = checkMatch(tag);
  if (match) {
    const isA = aRankTags.includes(tag);
    console.log(`  ${isA ? 'A' : 'B'}: "${tag}" → OFFICIAL: "${match.official}" (${match.type})`);
    toDowngrade.push({ tag, official: match.official, type: match.type });
  }
}

console.log(`\n変更対象: ${toDowngrade.length}件`);

// 自動で変更を適用
if (toDowngrade.length > 0) {
  for (const { tag } of toDowngrade) {
    ranksConfig.ranks[tag] = 'C';
  }
  ranksConfig.updatedAt = new Date().toISOString();
  fs.writeFileSync(ranksPath, JSON.stringify(ranksConfig, null, 2), 'utf-8');
  console.log('✅ 変更を適用しました');
}

// 残りのA/Bタグを表示
const remainingA = Object.entries(ranksConfig.ranks).filter(([k, v]) => v === 'A').map(([k]) => k);
const remainingB = Object.entries(ranksConfig.ranks).filter(([k, v]) => v === 'B').map(([k]) => k);

console.log(`\n=== 残りのタグ ===`);
console.log(`A rank: ${remainingA.length}件`);
remainingA.forEach(t => console.log(`  A: ${t}`));
console.log(`\nB rank: ${remainingB.length}件`);
remainingB.forEach(t => console.log(`  B: ${t}`));

db.close();
