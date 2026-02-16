#!/usr/bin/env tsx
/**
 * 作品コメント取得テスト
 * Puppeteerを使用して年齢確認を突破し、作品コメントを取得
 */

import { scrapeWorkComment } from '../src/server/scraping/fanzaScraper';

async function main() {
  // テスト用のURL（実際のDBから取得したURLを使用）
  const testUrl = 'https://www.dmm.co.jp/dc/doujin/-/detail/=/cid=d_719191/';

  console.log('🔍 作品コメント取得テスト\n');
  console.log(`テストURL: ${testUrl}\n`);

  try {
    const data = await scrapeWorkComment(testUrl, {
      headless: true, // falseにするとブラウザが表示される（デバッグ用）
      timeout: 30000,
    });

    if (!data) {
      console.log('\n❌ 作品コメントの取得に失敗しました');
      process.exit(1);
    }

    console.log('\n📊 取得結果:');
    console.log(`  タイトル: ${data.title || 'なし'}`);
    console.log(`  作者: ${data.authorName || 'なし'}`);
    console.log(`  CID: ${data.cid || 'なし'}`);
    console.log(`  公式タグ数: ${data.officialTags.length}件`);
    if (data.officialTags.length > 0) {
      console.log(`  公式タグ: ${data.officialTags.slice(0, 5).join(', ')}${data.officialTags.length > 5 ? '...' : ''}`);
    }
    console.log(`  作品コメント: ${data.commentText ? `✅ ${data.commentText.length}文字` : '❌ なし'}`);
    console.log(`  rawText: ${data.rawText ? `✅ ${data.rawText.length}文字` : '❌ なし'}`);

    if (data.commentText) {
      console.log('\n📝 作品コメント（最初の500文字）:');
      console.log('─'.repeat(60));
      console.log(data.commentText.substring(0, 500));
      if (data.commentText.length > 500) {
        console.log('...');
      }
      console.log('─'.repeat(60));
    }

    if (data.rawText && !data.commentText) {
      console.log('\n📝 rawText（最初の500文字）:');
      console.log('─'.repeat(60));
      console.log(data.rawText.substring(0, 500));
      if (data.rawText.length > 500) {
        console.log('...');
      }
      console.log('─'.repeat(60));
    }

    console.log('\n✅ テスト成功！');
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    if (error instanceof Error) {
      console.error('   メッセージ:', error.message);
      console.error('   スタック:', error.stack);
    }
    process.exit(1);
  }
}

main();
