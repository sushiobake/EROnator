/**
 * 重複・authorName表記揺れの調査スクリプト
 * SQLiteを直接読んで実施（Prismaのスキーマ切り替えに依存しない）
 */
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(process.cwd(), 'prisma/dev.db');
if (!fs.existsSync(dbPath)) {
  console.error('prisma/dev.db が見つかりません');
  process.exit(1);
}

const Database = require('better-sqlite3');
const db = new Database(dbPath, { readonly: true });

console.log('=== 調査: 重複・authorName 表記揺れ ===\n');

// 1. 重複（同一 title + trim(authorName) で複数件）
const all = db.prepare('SELECT workId, title, authorName FROM Work').all();
const key = (w) => `${(w.title ?? '').trim()}\t${(w.authorName ?? '').trim()}`;
const groups = new Map();
for (const w of all) {
  const k = key(w);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(w);
}
const dupGroups = [...groups.entries()].filter(([, arr]) => arr.length > 1);
console.log('【1】重複（同一 title+author、複数 workId）');
console.log(`  グループ数: ${dupGroups.length}`);
console.log(`  重複Work合計: ${dupGroups.reduce((s, [, arr]) => s + arr.length - 1, 0)} 件\n`);
if (dupGroups.length > 0) {
  dupGroups.slice(0, 15).forEach(([k, works], i) => {
    const [title, author] = k.split('\t');
    console.log(`  ${i + 1}. 「${title.slice(0, 35)}…」 (${author})`);
    works.forEach(w => console.log(`     - ${w.workId}`));
  });
  if (dupGroups.length > 15) console.log(`  ... 他 ${dupGroups.length - 15} グループ`);
}
console.log('');

// 2. 同じタイトルで異なる workId（author は問わない）
const titleMap = new Map();
for (const w of all) {
  const t = (w.title ?? '').trim();
  if (!titleMap.has(t)) titleMap.set(t, []);
  titleMap.get(t).push(w);
}
const sameTitleDiffId = [...titleMap.entries()].filter(([, arr]) => arr.length > 1);
console.log('【2】同じタイトルで異なる workId');
console.log(`  該当タイトル数: ${sameTitleDiffId.length}`);
const totalDupByTitle = sameTitleDiffId.reduce((s, [, arr]) => s + arr.length, 0);
console.log(`  該当Work合計: ${totalDupByTitle} 件\n`);
if (sameTitleDiffId.length > 0 && sameTitleDiffId.length <= 15) {
  sameTitleDiffId.slice(0, 5).forEach(([title, works], i) => {
    const authors = [...new Set(works.map(w => w.authorName))];
    console.log(`  ${i + 1}. 「${title.slice(0, 40)}…」`);
    console.log(`     作者: ${authors.join(' / ')}`);
    console.log(`     workIds: ${works.map(w => w.workId).join(', ')}`);
  });
}
console.log('');

// 3. authorName の表記揺れ（同一論理作者で複数パターン）
// trim して正規化した authorName ごとに、元の authorName のバリエーションを集計
const authorVariants = new Map();
for (const w of all) {
  const raw = (w.authorName ?? '').trim();
  const norm = raw; // ここでは trim のみ
  if (!authorVariants.has(norm)) authorVariants.set(norm, new Set());
  authorVariants.get(norm).add(w.authorName); // 元の値を記録（空白違いを検出）
}
// 元の authorName が複数ある = 表記揺れ
const variantGroups = [...authorVariants.entries()].filter(([, set]) => set.size > 1);
console.log('【3】authorName の表記揺れ（trim後は同じだが元の文字列が複数パターン）');
console.log(`  該当作者数（論理単位）: ${variantGroups.length}`);
let totalVariants = 0;
variantGroups.forEach(([, set]) => { totalVariants += set.size; });
console.log(`   authorName バリエーション合計: ${totalVariants} パターン\n`);
if (variantGroups.length > 0) {
  variantGroups.slice(0, 10).forEach(([norm, set], i) => {
    const arr = [...set];
    console.log(`  ${i + 1}. 正規化後: "${norm}"`);
    arr.forEach(a => {
      const show = JSON.stringify(a);
      const hex = Buffer.from(a, 'utf8').toString('hex').slice(0, 32);
      console.log(`     - ${show} (先頭hex: ${hex}...)`);
    });
  });
  if (variantGroups.length > 10) console.log(`  ... 他 ${variantGroups.length - 10} 件`);
}
console.log('');

// 4. あいがも堂 に限定して authorName の実際の値を確認
const aigamo = all.filter(w => (w.authorName ?? '').includes('あいがも堂'));
const aigamoAuthors = [...new Set(aigamo.map(w => w.authorName))];
console.log('【4】「あいがも堂」を含む作品（スクショの例）');
console.log(`  作品数: ${aigamo.length}`);
console.log(`  authorName の実際の値（種類数）: ${aigamoAuthors.length}`);
aigamoAuthors.forEach((a, i) => {
  const repr = JSON.stringify(a);
  const len = Buffer.byteLength(a, 'utf8');
  console.log(`    ${i + 1}. ${repr} (length=${a.length}, bytes=${len})`);
});
console.log('');

// 5. 全体統計
console.log('【5】全体');
console.log(`  総Work数: ${all.length}`);
console.log(`  authorName ユニーク数（生）: ${new Set(all.map(w => w.authorName)).size}`);
console.log(`  authorName ユニーク数（trim後）: ${new Set(all.map(w => (w.authorName ?? '').trim())).size}`);

db.close();
console.log('\n完了');
