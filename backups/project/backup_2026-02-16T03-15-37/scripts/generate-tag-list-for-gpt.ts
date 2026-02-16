/**
 * Custom GPTs用タグリスト生成スクリプト
 * A/Bランクのタグリストをテキストファイルで出力
 * 
 * Usage:
 *   npx ts-node scripts/generate-tag-list-for-gpt.ts
 */

import * as fs from 'fs';
import * as path from 'path';

function main() {
  console.log('📋 Custom GPTs用タグリスト生成');
  
  // tagRanks.jsonを読み込み
  const ranksPath = path.join(process.cwd(), 'config', 'tagRanks.json');
  
  if (!fs.existsSync(ranksPath)) {
    console.error('tagRanks.jsonが見つかりません');
    process.exit(1);
  }
  
  const content = fs.readFileSync(ranksPath, 'utf-8');
  const data = JSON.parse(content);
  const ranks = data.ranks || {};
  
  // A/Bランクのタグを抽出
  const aTags: string[] = [];
  const bTags: string[] = [];
  
  for (const [name, rank] of Object.entries(ranks)) {
    if (rank === 'A') aTags.push(name);
    else if (rank === 'B') bTags.push(name);
  }
  
  // ソート
  aTags.sort((a, b) => a.localeCompare(b, 'ja'));
  bTags.sort((a, b) => a.localeCompare(b, 'ja'));
  
  console.log(`   Aランク: ${aTags.length}個`);
  console.log(`   Bランク: ${bTags.length}個`);
  
  // テキストファイル生成
  const output = `# タグリスト（必ずこの中から選んでください）

## Aランク（優先的に使用）
${aTags.join('\n')}

## Bランク（該当すれば使用）
${bTags.join('\n')}

---
上記以外のタグは使用禁止です。
`;

  // 出力
  const outputPath = path.join(process.cwd(), 'config', 'tag-list-for-gpt.txt');
  fs.writeFileSync(outputPath, output, 'utf-8');
  
  console.log(`\n✅ 出力完了: ${outputPath}`);
  console.log(`   このファイルをCustom GPTsの「Knowledge」にアップロードしてください`);
}

main();
