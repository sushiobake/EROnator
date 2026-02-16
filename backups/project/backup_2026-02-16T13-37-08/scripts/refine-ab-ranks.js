/**
 * A/Bランクの追加精査
 * - OFFICIALと類似しているもの
 * - 作品固有すぎるもの
 * - メタ情報
 * - 汎用性が低いもの
 */
const fs = require('fs');
const path = require('path');

const ranksPath = path.join(__dirname, '../config/tagRanks.json');
const ranksConfig = JSON.parse(fs.readFileSync(ranksPath, 'utf-8'));
const ranks = ranksConfig.ranks;

// Cにダウングレードするタグ（理由付き）
const downgradeList = [
  // OFFICIALと類似（完全一致ではないが重複感あり）
  { tag: '学園', reason: 'OFFICIAL「学園もの」と類似' },
  { tag: '年下', reason: 'OFFICIAL「年下攻め」と類似' },
  { tag: '先輩後輩', reason: 'OFFICIAL「後輩」と類似' },
  { tag: '異世界', reason: 'OFFICIAL「異世界転生」と類似' },
  { tag: '性感エステ', reason: 'OFFICIAL「エステ」と重複' },
  { tag: '学園恋愛', reason: 'OFFICIAL「恋愛」と重複' },
  { tag: '羞恥プレイ', reason: 'OFFICIAL「羞恥」と類似' },
  { tag: 'コスプレSEX', reason: 'OFFICIAL「コスプレ」と類似' },
  { tag: '高校', reason: 'OFFICIAL「高校生」と類似' },
  { tag: 'レズプレイ', reason: 'OFFICIAL「レズ」と類似' },
  { tag: '調教', reason: 'OFFICIAL「調教」あり' },
  { tag: '爆乳', reason: 'OFFICIAL「爆乳」あり' },
  { tag: '年上/年下', reason: 'OFFICIAL「年上」「年下攻め」と重複' },
  
  // メタ情報・フォーマット
  { tag: 'フルカラー', reason: 'メタ情報（作品形式）' },
  { tag: 'ASMR', reason: 'メタ情報（作品形式）' },
  
  // 作品固有・長すぎる
  { tag: 'ブラック企業を辞めた退職代行', reason: '作品固有すぎる' },
  { tag: '退職代行', reason: '汎用性低い' },
  
  // 汎用性が低い・一般名詞
  { tag: 'ラーメン', reason: 'エロとの関連が薄い' },
  { tag: 'テニス', reason: 'エロとの関連が薄い' },
  { tag: 'SNS', reason: '汎用的すぎる' },
  { tag: '月面', reason: '特殊すぎる' },
  { tag: '政治家', reason: '汎用性低い' },
  { tag: 'バンドマン', reason: '汎用性低い' },
  { tag: 'フリータ', reason: '汎用性低い' },
  { tag: 'マットレス', reason: '意味不明' },
  { tag: '反乱', reason: 'エロとの関連が薄い' },
  { tag: '路地裏', reason: '汎用性低い' },
  { tag: '潜入任務', reason: '汎用性低い' },
  { tag: '罠', reason: '曖昧' },
  { tag: '仲間', reason: '曖昧すぎる' },
  { tag: '森', reason: '一般名詞すぎる' },
  { tag: '迷宮', reason: '特殊すぎる' },
];

console.log('=== Cにダウングレードするタグ ===');
let downgraded = 0;
for (const { tag, reason } of downgradeList) {
  const currentRank = ranks[tag];
  if (currentRank && currentRank !== 'C') {
    console.log(`  ${currentRank} → C: "${tag}" (${reason})`);
    ranks[tag] = 'C';
    downgraded++;
  }
}

console.log(`\n${downgraded}件をCに変更しました`);

// 保存
ranksConfig.updatedAt = new Date().toISOString();
fs.writeFileSync(ranksPath, JSON.stringify(ranksConfig, null, 2), 'utf-8');

// 最終結果
const finalA = Object.entries(ranks).filter(([k, v]) => v === 'A').map(([k]) => k);
const finalB = Object.entries(ranks).filter(([k, v]) => v === 'B').map(([k]) => k);

console.log(`\n=== 最終結果 ===`);
console.log(`A rank: ${finalA.length}件`);
finalA.sort().forEach(t => console.log(`  A: ${t}`));
console.log(`\nB rank: ${finalB.length}件`);
finalB.sort().forEach(t => console.log(`  B: ${t}`));
