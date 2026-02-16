/**
 * DERIVEDタグをA/B/Cにランク分けするスクリプト
 * A: 採用（ゲームで使える）
 * B: 検討中
 * C: 不採用
 */

const fs = require('fs');
const path = require('path');

// バックアップからタグを読み込み
const backupPath = path.join(__dirname, '../data/derived-tags-backup.json');
const backup = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));

// 現在のDBからタグを読み込み（後で追加可能）
// const currentTags = ...

const allTags = backup.allTags;

// ランク分けルール
const ranks = {};

// C（不採用）パターン
const C_PATTERNS = {
  // メタ情報・形式
  meta: [
    /^[0-9]+p$/i, /ページ/, /^Part[0-9]/i, /シリーズ[0-9]/, /^[0-9]+$/, /Total/,
    /フルカラー/, /コミック/, /電子版/, /紙版/, /同人誌/, /バージョン/, /同梱/,
    /FANZA/, /メロンブックス/, /ランキング/, /comiket/, /C107/, /2025/, /2024/,
    /サークル/, /実写版/, /英訳/, /translatio/, /限定本/, /ボーナス/, /配信予定/,
    /総集編/, /表紙/, /イラスト/, /漫画本文/, /中編/, /前編/, /二作目/,
    /ブラウザ/, /ファイル/, /アクリル/, /グッズ/, /ASMR/, /ノベルティ/
  ],
  // 一般的すぎる
  generic: [
    /^セックス$/, /^エロ$/, /^オリジナル$/, /^女性$/, /^自分$/, /^穴$/, /^暴力$/,
    /^気持$/, /^事情$/, /^場合$/, /^内容物$/, /^出来事$/, /^所属$/
  ],
  // 意味不明・不完全
  nonsense: [
    /^[a-zA-Z]{1,3}$/, /^Boys$/, /^Love$/, /^SNS$/, /^\w+sh$/, 
    /^カード$/, /^サイズ$/, /^ワケ$/, /^ハマ$/, /^シコ$/, /^フルカラ$/, /^レビュ$/,
    /^ズップス$/, /^カラミ$/, /^バレ$/, /^台詞$/, /^テニス$/, /^サイクロン$/,
    /^キャップ$/, /^ティッシュ$/, /^ガマン$/, /^マグロ$/, /^ループ$/, /^良過$/,
    /^不出来$/, /^四六時中$/, /^刺激的$/, /^礼儀正$/, /^紳士的$/, /^道中立$/
  ],
  // キャラ名・固有名詞（STRUCTURALへ）
  character: [
    /^[ァ-ヶー]+$/, // カタカナのみの名前
    /ちゃん$/, /^BB/, /^アリカ$/, /^ナタリヤ$/, /^マイケル$/, /瑠衣/, /里穂$/,
    /^七沢$/, /^下濃/, /伯爵家/, /金城/
  ],
  // 英語タグ（日本語に統一）
  english: [
    /^Anal$/, /^Bondage$/, /^Chastity$/, /^Coercion$/, /^Fantasy$/, /^Genre$/,
    /^Horror$/, /^Revenge$/, /^Romance$/, /^School/, /^Setting$/, /^Situation$/,
    /^Theme$/, /^Character$/, /^Content$/, /^Family$/, /^Relationship$/,
    /^Sexual/, /^Forced/, /^Black Girl/, /^Magician$/, /^Rookie/
  ],
  // 具体的すぎる（作品固有）
  specific: [
    /ドバイ/, /ネビュラ/, /春衡/, /触手の/, /搾精課/, /ビッチ部/, /チートマッサージ店/,
    /学園スライム/, /学園貯水/, /男女比/, /鼠径部/, /黒棒消し/, /黒海苔/
  ]
};

// A（採用）パターン - 使いやすいタグ
const A_TAGS = [
  // 関係性
  '年上', '年下', '幼馴染', '先輩後輩', 'セフレ', '同級生', '兄妹', '人妻', '人妻幼馴染',
  'ハーレム', '禁断関係', '連れ子の関係', '仲間',
  // 属性・職業
  '大学生', '保育士', '会社員', '専業主婦', '家政婦', '整体師', 'メイド',
  '痴女', '清楚', '処女', '黒ギャル', 'ヤンデレ', 'ドM', 'ドS', '淫乱',
  '爆乳', '天真爛漫', '魔法使い', '暗殺者',
  // シチュエーション・場所
  '学園', '学園生活', '学園恋愛', '異世界', '温泉', '混浴', 'ラブホテル', 'ホテル',
  'デリヘル', '風俗', 'エステ', '性感エステ', 'マッサージ',
  '3P', '4P', '乱交', 'ハメ撮り', 'レズプレイ', '寝取り', '近親相姦',
  '調教', '公開調教', '羞恥プレイ',
  // プレイ
  'パイズリ', 'クンニ', '手コキ', '中出し', '潮吹き', '搾乳', '電マ', '乳首責め',
  '初体験', 'コスプレSEX', 'マスターベーション',
  // ジャンル
  '純愛', '恋愛', '初恋', 'ハニートラップ',
  // 設定
  'タワーマンション', 'マンション', 'ビジネスホテル', '別荘', '屋敷', '森', '迷宮',
  '高校', 'キャンパスライフ'
];

// B（検討中）- 使えるかもしれないタグ
const B_TAGS = [
  // 微妙だけど使えそう
  'セックスレス', '借金', '母子家庭', 'カップル', 'ホームステイ', '受験生', '友人',
  '嫉妬', '誘惑', '奴隷', '快楽', '変態性欲', '性欲処理',
  '潜入任務', '反乱', 'トラブル', '罠',
  '一人暮', '対人恐怖症', '気弱女子', '無口',
  // 場所系
  'トイレ', '路地裏', '相席居酒屋', '月面',
  // 属性系（やや具体的）
  'マイクロビキニ', 'コスチューム', 'バンドマン', 'フリータ', '配達員', '政治家'
];

// ランク判定
function classifyTag(tag) {
  const name = tag.displayName;
  
  // まずAリストをチェック
  if (A_TAGS.includes(name)) return 'A';
  
  // Bリストをチェック
  if (B_TAGS.includes(name)) return 'B';
  
  // Cパターンをチェック
  for (const [category, patterns] of Object.entries(C_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(name)) return 'C';
    }
  }
  
  // workCountで判断（複数作品で使われているものは可能性あり）
  if (tag.workCount >= 3) return 'B';
  if (tag.workCount >= 2) return 'B';
  
  // それ以外はCとして、後で人間がチェック
  return 'C';
}

// 分類実行
const results = { A: [], B: [], C: [] };

for (const tag of allTags) {
  const rank = classifyTag(tag);
  ranks[`tag_${Buffer.from(tag.displayName).toString('base64').replace(/[+/=]/g, '_')}`] = rank;
  results[rank].push({
    displayName: tag.displayName,
    category: tag.category,
    workCount: tag.workCount
  });
}

// 結果を出力
console.log('=== 分類結果 ===');
console.log(`A（採用）: ${results.A.length}件`);
console.log(`B（検討中）: ${results.B.length}件`);
console.log(`C（不採用）: ${results.C.length}件`);

console.log('\n=== A（採用） ===');
results.A.forEach(t => console.log(`  ${t.displayName} (${t.category || '未分類'}) [${t.workCount}作品]`));

console.log('\n=== B（検討中） ===');
results.B.forEach(t => console.log(`  ${t.displayName} (${t.category || '未分類'}) [${t.workCount}作品]`));

console.log('\n=== C（不採用）の一部 ===');
results.C.slice(0, 50).forEach(t => console.log(`  ${t.displayName} (${t.category || '未分類'}) [${t.workCount}作品]`));
if (results.C.length > 50) {
  console.log(`  ... 他 ${results.C.length - 50}件`);
}

// tagRanks.jsonを更新
const ranksPath = path.join(__dirname, '../config/tagRanks.json');
const ranksConfig = {
  description: 'DERIVEDタグのランク管理。A=採用, B=検討中, C=不採用',
  updatedAt: new Date().toISOString(),
  ranks: {}
};

// displayNameをキーにしたシンプルな形式で保存
for (const tag of allTags) {
  ranksConfig.ranks[tag.displayName] = classifyTag(tag);
}

fs.writeFileSync(ranksPath, JSON.stringify(ranksConfig, null, 2), 'utf-8');
console.log('\n✅ config/tagRanks.json を更新しました');

// 詳細レポートも出力
const reportPath = path.join(__dirname, '../data/tag-classification-report.json');
fs.writeFileSync(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  summary: {
    A: results.A.length,
    B: results.B.length,
    C: results.C.length,
    total: allTags.length
  },
  tags: {
    A: results.A,
    B: results.B,
    C: results.C
  }
}, null, 2), 'utf-8');
console.log('✅ data/tag-classification-report.json にレポートを出力しました');
