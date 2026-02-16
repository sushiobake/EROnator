/**
 * ChatGPT出力の整合性チェックスクリプト
 * 送ったファイルと返ってきたファイルの整合性を徹底的にチェック
 * 
 * Usage:
 *   npx ts-node scripts/validate-chatgpt-output.ts <input-file> <output-file>
 * 
 * Example:
 *   npx ts-node scripts/validate-chatgpt-output.ts data/chatgpt-export/test-10works.json c:/tool/eronator_tags_output.json
 */

import * as fs from 'fs';
import * as path from 'path';

interface InputWork {
  workId: string;
  title: string;
  commentText: string;
}

interface OutputWork {
  workId: string;
  title?: string;
  matchedTags?: Array<{ displayName: string; category?: string }>;
  suggestedTags?: Array<{ displayName: string; category?: string }>;
  characterName?: string | null;
}

function main() {
  const inputFile = process.argv[2];
  const outputFile = process.argv[3];
  
  if (!inputFile || !outputFile) {
    console.error('Usage: npx ts-node scripts/validate-chatgpt-output.ts <input-file> <output-file>');
    process.exit(1);
  }
  
  // ファイルパスを解決
  const inputPath = path.isAbsolute(inputFile) 
    ? inputFile 
    : path.join(process.cwd(), inputFile);
  const outputPath = path.isAbsolute(outputFile) 
    ? outputFile 
    : path.join(process.cwd(), outputFile);
  
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ 入力ファイルが見つかりません: ${inputPath}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(outputPath)) {
    console.error(`❌ 出力ファイルが見つかりません: ${outputPath}`);
    process.exit(1);
  }
  
  console.log('🔍 ChatGPT出力の整合性チェック開始');
  console.log(`   入力ファイル: ${inputPath}`);
  console.log(`   出力ファイル: ${outputPath}`);
  console.log('');
  
  // JSONを読み込み
  let inputWorks: InputWork[];
  let outputWorks: OutputWork[];
  
  try {
    inputWorks = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    outputWorks = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  } catch (e) {
    console.error('❌ JSONパースエラー:', e);
    process.exit(1);
  }
  
  if (!Array.isArray(inputWorks) || !Array.isArray(outputWorks)) {
    console.error('❌ JSONは配列形式である必要があります');
    process.exit(1);
  }
  
  console.log(`📊 基本情報`);
  console.log(`   送った件数: ${inputWorks.length}件`);
  console.log(`   返ってきた件数: ${outputWorks.length}件`);
  console.log('');
  
  // 1. 件数の一致チェック
  const countMatch = inputWorks.length === outputWorks.length;
  console.log(`1️⃣ 件数の一致: ${countMatch ? '✅ OK' : '❌ NG'}`);
  if (!countMatch) {
    console.log(`   ⚠️ 件数が一致しません（差: ${Math.abs(inputWorks.length - outputWorks.length)}件）`);
  }
  console.log('');
  
  // 2. workIdの順番チェック
  const inputIds = inputWorks.map(w => w.workId);
  const outputIds = outputWorks.map(w => w.workId);
  const orderMatch = JSON.stringify(inputIds) === JSON.stringify(outputIds);
  
  console.log(`2️⃣ workIdの順番: ${orderMatch ? '✅ OK' : '❌ NG'}`);
  if (!orderMatch) {
    console.log(`   ⚠️ 順番が一致しません`);
    console.log(`   送った順番: ${inputIds.slice(0, 5).join(', ')}...`);
    console.log(`   返ってきた順番: ${outputIds.slice(0, 5).join(', ')}...`);
  }
  console.log('');
  
  // 3. workIdの存在チェック（順番無視）
  const inputIdSet = new Set(inputIds);
  const outputIdSet = new Set(outputIds);
  
  const missingIds = inputIds.filter(id => !outputIdSet.has(id));
  const extraIds = outputIds.filter(id => !inputIdSet.has(id));
  
  console.log(`3️⃣ workIdの存在: ${missingIds.length === 0 && extraIds.length === 0 ? '✅ OK' : '❌ NG'}`);
  if (missingIds.length > 0) {
    console.log(`   ⚠️ 不足しているworkId (${missingIds.length}件):`);
    missingIds.forEach(id => {
      const work = inputWorks.find(w => w.workId === id);
      console.log(`      - ${id}: ${work?.title || '不明'}`);
    });
  }
  if (extraIds.length > 0) {
    console.log(`   ⚠️ 余分なworkId (${extraIds.length}件):`);
    extraIds.forEach(id => {
      const work = outputWorks.find(w => w.workId === id);
      console.log(`      - ${id}: ${work?.title || '不明'}`);
    });
  }
  console.log('');
  
  // 4. タイトルの一致チェック
  console.log(`4️⃣ タイトルの一致チェック:`);
  let titleMismatchCount = 0;
  const titleMismatches: Array<{ workId: string; inputTitle: string; outputTitle: string }> = [];
  
  for (const inputWork of inputWorks) {
    const outputWork = outputWorks.find(w => w.workId === inputWork.workId);
    if (!outputWork) continue;
    
    if (outputWork.title && outputWork.title !== inputWork.title) {
      titleMismatchCount++;
      titleMismatches.push({
        workId: inputWork.workId,
        inputTitle: inputWork.title,
        outputTitle: outputWork.title || '(なし)'
      });
    }
  }
  
  if (titleMismatchCount === 0) {
    console.log(`   ✅ すべて一致`);
  } else {
    console.log(`   ❌ ${titleMismatchCount}件の不一致:`);
    titleMismatches.slice(0, 5).forEach(m => {
      console.log(`      - ${m.workId}:`);
      console.log(`        送った: ${m.inputTitle.substring(0, 50)}...`);
      console.log(`        返ってきた: ${m.outputTitle.substring(0, 50)}...`);
    });
    if (titleMismatches.length > 5) {
      console.log(`      ... 他 ${titleMismatches.length - 5}件`);
    }
  }
  console.log('');
  
  // 5. 出力データの品質チェック
  console.log(`5️⃣ 出力データの品質チェック:`);
  let qualityIssues = 0;
  
  for (const outputWork of outputWorks) {
    // workIdが必須
    if (!outputWork.workId) {
      console.log(`   ❌ workIdが空: ${JSON.stringify(outputWork)}`);
      qualityIssues++;
      continue;
    }
    
    // matchedTagsとsuggestedTagsのチェック
    const matchedCount = outputWork.matchedTags?.length || 0;
    const suggestedCount = outputWork.suggestedTags?.length || 0;
    
    if (matchedCount > 3) {
      console.log(`   ⚠️ ${outputWork.workId}: matchedTagsが3個超過 (${matchedCount}個)`);
      qualityIssues++;
    }
    if (suggestedCount > 2) {
      console.log(`   ⚠️ ${outputWork.workId}: suggestedTagsが2個超過 (${suggestedCount}個)`);
      qualityIssues++;
    }
    
    // タグが全くない場合
    if (matchedCount === 0 && suggestedCount === 0) {
      console.log(`   ⚠️ ${outputWork.workId}: タグが1つもありません`);
      qualityIssues++;
    }
  }
  
  if (qualityIssues === 0) {
    console.log(`   ✅ 品質問題なし`);
  } else {
    console.log(`   ⚠️ ${qualityIssues}件の品質問題を検出`);
  }
  console.log('');
  
  // 6. 詳細レポート（最初の5件）
  console.log(`6️⃣ 詳細レポート（最初の5件）:`);
  for (let i = 0; i < Math.min(5, inputWorks.length); i++) {
    const inputWork = inputWorks[i];
    const outputWork = outputWorks.find(w => w.workId === inputWork.workId);
    
    console.log(`   [${i + 1}] ${inputWork.workId}`);
    console.log(`      タイトル: ${inputWork.title.substring(0, 40)}...`);
    if (outputWork) {
      const matchedCount = outputWork.matchedTags?.length || 0;
      const suggestedCount = outputWork.suggestedTags?.length || 0;
      console.log(`      matchedTags: ${matchedCount}個, suggestedTags: ${suggestedCount}個`);
      if (outputWork.characterName) {
        console.log(`      キャラクター: ${outputWork.characterName}`);
      }
    } else {
      console.log(`      ❌ 出力に存在しません`);
    }
    console.log('');
  }
  
  // 総合判定
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const allOk = countMatch && orderMatch && missingIds.length === 0 && extraIds.length === 0 && titleMismatchCount === 0;
  console.log(`総合判定: ${allOk ? '✅ 整合性OK' : '❌ 整合性NG'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (!allOk) {
    console.log('');
    console.log('⚠️ 整合性の問題が検出されました。');
    console.log('   ChatGPTに再処理を依頼するか、手動で修正してください。');
    process.exit(1);
  }
}

main();
