#!/usr/bin/env tsx
/**
 * API取得データとスクレイピング取得データの比較
 * 指定された作品の両方のデータを取得して比較表示
 */

import dotenv from 'dotenv';
import path from 'path';
import { URLSearchParams } from 'url';
import { scrapeWorkComment } from '../src/server/scraping/fanzaScraper';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config();

interface ApiItem {
  content_id: string;
  product_id: string;
  title: string;
  volume?: string;
  date?: string;
  URL?: string;
  affiliateURL?: string;
  imageURL?: {
    list?: string;
    small?: string;
    large?: string;
  };
  prices?: {
    price?: string;
    list_price?: string;
    deliveries?: {
      delivery?: Array<{
        type?: string;
        price?: string;
      }>;
    };
  };
  review?: {
    count?: string | number;
    average?: string;
  };
  iteminfo?: {
    genre?: Array<{ id: number; name: string }>;
    series?: Array<{ id: number; name: string }>;
    maker?: Array<{ id: number; name: string }>;
    author?: Array<{ id: number; name: string }>;
    actress?: Array<{ id: number; name: string }>;
    label?: Array<{ id: number; name: string }>;
  };
  [key: string]: any; // その他のフィールド
}

interface ApiResponse {
  result: {
    status: string;
    result_count: number;
    items: ApiItem[];
  };
}

/**
 * DMM APIから作品情報を取得
 */
async function fetchWorkFromApi(contentId: string): Promise<ApiItem | null> {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID;

  if (!apiId || !affiliateId) {
    throw new Error('DMM_API_IDとDMM_AFFILIATE_IDが設定されていません');
  }

  const params = new URLSearchParams({
    api_id: apiId,
    affiliate_id: affiliateId,
    site: 'FANZA',
    service: 'doujin',
    floor: 'digital_doujin',
    hits: '1',
    offset: '1',
    cid: contentId, // 商品IDで検索
    output: 'json',
  });

  const url = `https://api.dmm.com/affiliate/v3/ItemList?${params.toString()}`;
  console.log(`[API] リクエスト: ${url.replace(apiId, '***').replace(affiliateId, '***')}\n`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ApiResponse;

  // statusは文字列の"200"または数値の200の可能性がある
  if (String(data.result.status) !== '200') {
    throw new Error(`API returned error: status=${data.result.status}`);
  }

  if (data.result.items && data.result.items.length > 0) {
    return data.result.items[0];
  }

  return null;
}

/**
 * データを整形して表示
 */
function displayComparison(apiData: ApiItem | null, scrapingData: any) {
  console.log('═'.repeat(80));
  console.log('📊 データ比較結果');
  console.log('═'.repeat(80));
  console.log('');

  // API取得データ
  console.log('【1. API取得データ】');
  console.log('─'.repeat(80));
  if (!apiData) {
    console.log('❌ APIからデータを取得できませんでした');
  } else {
    console.log(`  タイトル: ${apiData.title || 'なし'}`);
    console.log(`  content_id: ${apiData.content_id || 'なし'}`);
    console.log(`  product_id: ${apiData.product_id || 'なし'}`);
    console.log(`  発売日: ${apiData.date || 'なし'}`);
    console.log(`  ページ数/時間: ${apiData.volume || 'なし'}`);
    console.log(`  URL: ${apiData.URL || 'なし'}`);
    console.log(`  affiliateURL: ${apiData.affiliateURL || 'なし'}`);
    console.log(`  画像URL (large): ${apiData.imageURL?.large || 'なし'}`);
    console.log(`  レビュー数: ${apiData.review?.count || 'なし'}`);
    console.log(`  レビュー平均: ${apiData.review?.average || 'なし'}`);
    
    if (apiData.prices) {
      console.log(`  価格: ${apiData.prices.price || 'なし'}`);
      console.log(`  定価: ${apiData.prices.list_price || 'なし'}`);
    }

    if (apiData.iteminfo) {
      if (apiData.iteminfo.genre && apiData.iteminfo.genre.length > 0) {
        console.log(`  ジャンル: ${apiData.iteminfo.genre.map(g => g.name).join(', ')}`);
      }
      if (apiData.iteminfo.series && apiData.iteminfo.series.length > 0) {
        console.log(`  シリーズ: ${apiData.iteminfo.series.map(s => s.name).join(', ')}`);
      }
      if (apiData.iteminfo.maker && apiData.iteminfo.maker.length > 0) {
        console.log(`  メーカー: ${apiData.iteminfo.maker.map(m => m.name).join(', ')}`);
      }
      if (apiData.iteminfo.author && apiData.iteminfo.author.length > 0) {
        console.log(`  作者: ${apiData.iteminfo.author.map(a => a.name).join(', ')}`);
      }
      if (apiData.iteminfo.label && apiData.iteminfo.label.length > 0) {
        console.log(`  レーベル: ${apiData.iteminfo.label.map(l => l.name).join(', ')}`);
      }
    }

    // APIで取得できるが表示していないフィールド
    const apiFields = Object.keys(apiData);
    const displayedFields = [
      'title', 'content_id', 'product_id', 'date', 'volume', 'URL', 'affiliateURL',
      'imageURL', 'review', 'prices', 'iteminfo'
    ];
    const otherFields = apiFields.filter(f => !displayedFields.includes(f));
    if (otherFields.length > 0) {
      console.log(`  その他のフィールド: ${otherFields.join(', ')}`);
    }
  }
  console.log('');

  // スクレイピング取得データ
  console.log('【2. スクレイピング取得データ】');
  console.log('─'.repeat(80));
  if (!scrapingData) {
    console.log('❌ スクレイピングからデータを取得できませんでした');
  } else {
    console.log(`  タイトル: ${scrapingData.title || 'なし'}`);
    console.log(`  CID: ${scrapingData.cid || 'なし'}`);
    console.log(`  作者名: ${scrapingData.authorName || 'なし'}`);
    console.log(`  サムネイルURL: ${scrapingData.thumbnailUrl || 'なし'}`);
    console.log(`  公式タグ数: ${scrapingData.officialTags?.length || 0}件`);
    if (scrapingData.officialTags && scrapingData.officialTags.length > 0) {
      console.log(`  公式タグ: ${scrapingData.officialTags.join(', ')}`);
    }
    console.log(`  作品コメント: ${scrapingData.commentText ? `✅ ${scrapingData.commentText.length}文字` : '❌ なし'}`);
    console.log(`  rawText: ${scrapingData.rawText ? `✅ ${scrapingData.rawText.length}文字` : '❌ なし'}`);
  }
  console.log('');

  // 比較分析
  console.log('【3. 比較分析】');
  console.log('─'.repeat(80));
  
  if (apiData && scrapingData) {
    // 重複する情報
    console.log('📋 重複する情報:');
    console.log('  - タイトル: APIとスクレイピングの両方で取得可能');
    if (apiData.iteminfo?.author && scrapingData.authorName) {
      console.log('  - 作者名: API（iteminfo.author）とスクレイピングの両方で取得可能');
    }
    if (apiData.imageURL?.large && scrapingData.thumbnailUrl) {
      console.log('  - サムネイルURL: API（imageURL.large）とスクレイピングの両方で取得可能');
    }
    if (apiData.iteminfo?.genre && scrapingData.officialTags) {
      console.log('  - ジャンル/タグ: API（iteminfo.genre）とスクレイピング（officialTags）の両方で取得可能');
    }
    console.log('');

    // APIのみで取得できる情報
    console.log('📊 APIのみで取得できる情報:');
    const apiOnly = [
      'content_id / product_id',
      '発売日（date）',
      'ページ数/時間（volume）',
      'affiliateURL',
      '価格情報（prices）',
      'レビュー情報（review）',
      'シリーズ情報（iteminfo.series）',
      'メーカー情報（iteminfo.maker）',
      'レーベル情報（iteminfo.label）',
    ];
    apiOnly.forEach(item => console.log(`  - ${item}`));
    console.log('');

    // スクレイピングのみで取得できる情報
    console.log('🔍 スクレイピングのみで取得できる情報:');
    const scrapingOnly = [
      '作品コメント（commentText）',
      'rawText（dt/ddテキスト + description的なブロック）',
    ];
    scrapingOnly.forEach(item => console.log(`  - ${item}`));
    console.log('');

    // 必要な情報の特定
    console.log('✅ スクレイピングで追加取得すべき情報:');
    console.log('  → 作品コメント（commentText）: 準有名タグ生成に必須');
    console.log('  → rawText: 作品コメント抽出の元データ');
    console.log('');
    console.log('📝 結論:');
    console.log('  - APIで取得できない「作品コメント」をスクレイピングで取得');
    console.log('  - その他の情報はAPIで取得可能なため、スクレイピングでは不要');
    console.log('  - 重複する情報（タイトル、作者名、タグ、サムネイル）はAPIを優先');
  }
  console.log('═'.repeat(80));
}

async function main() {
  // 指定された作品のURLからCIDを抽出
  const testUrl = 'https://www.dmm.co.jp/dc/doujin/-/detail/=/cid=d_704027/';
  const cidMatch = testUrl.match(/\/cid=([^\/?&#]+)\//);
  const contentId = cidMatch ? cidMatch[1] : null;

  if (!contentId) {
    console.error('❌ URLからcontent_idを抽出できませんでした');
    process.exit(1);
  }

  console.log('🔍 API取得データとスクレイピング取得データの比較\n');
  console.log(`テストURL: ${testUrl}`);
  console.log(`content_id: ${contentId}\n`);

  try {
    // APIからデータを取得
    console.log('[1/2] APIからデータを取得中...\n');
    const apiData = await fetchWorkFromApi(contentId);

    // スクレイピングからデータを取得
    console.log('[2/2] スクレイピングからデータを取得中...\n');
    const scrapingData = await scrapeWorkComment(testUrl, {
      headless: true,
      timeout: 30000,
    });

    // 比較表示
    displayComparison(apiData, scrapingData);

    // 作品コメントのプレビュー
    if (scrapingData?.commentText) {
      console.log('\n📝 作品コメント（プレビュー）:');
      console.log('─'.repeat(80));
      const preview = scrapingData.commentText.substring(0, 500);
      console.log(preview);
      if (scrapingData.commentText.length > 500) {
        console.log('...');
      }
      console.log('─'.repeat(80));
    }

    console.log('\n✅ 比較完了！');
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    if (error instanceof Error) {
      console.error('   メッセージ:', error.message);
    }
    process.exit(1);
  }
}

main();
