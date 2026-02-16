/**
 * Cloudflare Worker 用のタグリストを出力する
 * config/officialTagsCache.json と config/tagRanks.json を読み、
 * Worker のコードに貼り付ける JavaScript 定数を標準出力に出す。
 *
 * 使い方: node scripts/export-worker-tag-lists.js
 * 出力をコピーし、Worker の「ここに貼るコード」内の S_LIST / A_LIST / B_LIST / C_LIST を置き換える。
 */
const fs = require('fs');
const path = require('path');

const cachePath = path.join(__dirname, '../config/officialTagsCache.json');
const ranksPath = path.join(__dirname, '../config/tagRanks.json');

let sList = [];
try {
  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
  sList = Array.isArray(cache.tags) ? cache.tags : [];
} catch (e) {
  console.error('officialTagsCache.json を読めません:', e.message);
}

let ranks = {};
try {
  const data = JSON.parse(fs.readFileSync(ranksPath, 'utf-8'));
  ranks = data.ranks || {};
} catch (e) {
  console.error('tagRanks.json を読めません:', e.message);
}

const aList = Object.entries(ranks).filter(([, r]) => r === 'A').map(([name]) => name).sort((a, b) => a.localeCompare(b, 'ja'));
const bList = Object.entries(ranks).filter(([, r]) => r === 'B').map(([name]) => name).sort((a, b) => a.localeCompare(b, 'ja'));
const cList = Object.entries(ranks).filter(([, r]) => r === 'C').map(([name]) => name).sort((a, b) => a.localeCompare(b, 'ja'));

function jsArray(arr) {
  return '[\n  ' + arr.map((s) => JSON.stringify(s)).join(',\n  ') + '\n]';
}

console.log('// ========== 以下を Worker の該当定数に貼り付けてください ==========\n');
console.log('const S_LIST = ' + jsArray(sList) + ';');
console.log('const A_LIST = ' + jsArray(aList) + ';');
console.log('const B_LIST = ' + jsArray(bList) + ';');
console.log('const C_LIST = ' + jsArray(cList) + ';');
console.log('\n// ========== 貼り付けここまで ==========');
