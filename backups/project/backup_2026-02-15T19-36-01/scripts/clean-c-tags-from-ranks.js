/**
 * tagRanks.jsonからCランクのタグを削除するスクリプト
 */
const fs = require('fs');
const path = require('path');

const ranksPath = path.join(__dirname, '../config/tagRanks.json');

const content = fs.readFileSync(ranksPath, 'utf-8');
const data = JSON.parse(content);

const ranks = data.ranks || {};

// Cタグをカウント
const cTags = Object.entries(ranks).filter(([_, rank]) => rank === 'C');
console.log(`現在のCタグ数: ${cTags.length}件`);

// Cタグを削除
const newRanks = {};
let removedCount = 0;
for (const [name, rank] of Object.entries(ranks)) {
  if (rank === 'C') {
    removedCount++;
  } else {
    newRanks[name] = rank;
  }
}

// 保存
data.ranks = newRanks;
data.updatedAt = new Date().toISOString();
fs.writeFileSync(ranksPath, JSON.stringify(data, null, 2), 'utf-8');

console.log(`削除したCタグ: ${removedCount}件`);
console.log(`残ったタグ: ${Object.keys(newRanks).length}件`);

// A/Bの内訳
const aCount = Object.values(newRanks).filter(r => r === 'A').length;
const bCount = Object.values(newRanks).filter(r => r === 'B').length;
console.log(`  A: ${aCount}件`);
console.log(`  B: ${bCount}件`);
