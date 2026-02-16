#!/usr/bin/env tsx
/**
 * DMM Affiliate API - 商品情報APIテスト
 * FANZAの漫画フロアから作品を取得
 * 
 * 使い方:
 *   tsx scripts/test-dmm-itemlist-api.ts
 *   tsx scripts/test-dmm-itemlist-api.ts --offset=101 --sort=rank
 * 
 * 環境変数:
 *   DMM_API_ID: DMM API ID
 *   DMM_AFFILIATE_ID: アフィリエイトID (末尾990-999)
 * 
 * パラメータ:
 *   --offset: 検索開始位置（デフォルト: 1）
 *   --sort: ソート順（rank, price, -price, date, review, match、デフォルト: date）
 *   --hits: 取得件数（デフォルト: 100、最大: 100）
 */

import dotenv from 'dotenv';
import path from 'path';

// .env.localを優先的に読み込む
const envLocal = dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });
dotenv.config(); // .envも読み込む（フォールバック）

interface Item {
  service_code: string;
  service_name: string;
  floor_code: string;
  floor_name: string;
  category_name: string;
  content_id: string;
  product_id: string;
  title: string;
  volume?: string;
  review?: {
    count: number;
    average: string;
  };
  URL: string;
  affiliateURL: string;
  imageURL: {
    list: string;
    small: string;
    large: string;
  };
  sampleImageURL?: {
    sample_s?: {
      image: string[];
    };
    sample_l?: {
      image: string[];
    };
  };
  prices: {
    price: string;
    list_price?: string;
    deliveries?: {
      delivery: Array<{
        type: string;
        price: string;
        list_price?: string;
      }>;
    };
  };
  date: string;
  iteminfo: {
    genre?: Array<{
      id: number;
      name: string;
    }>;
    series?: Array<{
      id: number;
      name: string;
    }>;
    maker?: Array<{
      id: number;
      name: string;
    }>;
    manufacture?: Array<{
      id: number;
      name: string;
    }>;
    author?: Array<{
      id: number;
      name: string;
    }>;
    actress?: Array<{
      id: number;
      name: string;
      ruby?: string;
    }>;
    label?: Array<{
      id: number;
      name: string;
    }>;
  };
  number?: string;
}

interface ItemListResponse {
  request: {
    parameters: {
      parameter: Array<{
        name: string;
        value: string;
      }>;
    };
  };
  result: {
    status: string;
    result_count: number;
    total_count: number;
    first_position: number;
    items: Item[];
  };
}

/**
 * 同人誌フィルタ判定
 * 同人誌のみを採用（ゲーム/CG集/音声を除外）
 */
function isDoujinComic(item: Item): boolean {
  // 優先順位1: imageURLパス判定
  const imageUrl = item.imageURL?.list || item.imageURL?.large || '';
  if (!imageUrl.includes('/digital/comic/')) {
    return false;
  }

  // 優先順位2: volumeフィールド補助判定（CG集除外）
  if (item.volume && item.volume.includes('画像') && item.volume.includes('枚')) {
    return false; // CG集
  }

  // 優先順位3: ジャンル補助判定（ゲーム除外）
  const gameGenres = [7110, 156002, 160045]; // シミュレーション、ドット制作、ツクール
  if (item.iteminfo.genre?.some(g => gameGenres.includes(g.id))) {
    return false; // ゲーム
  }

  return true;
}

async function fetchItemList(
  apiId: string,
  affiliateId: string,
  options: {
    site?: string;
    service?: string;
    floor?: string;
    hits?: number;
    offset?: number;
    sort?: string;
    gte_date?: string; // 発売日以降
    lte_date?: string; // 発売日以前
  }
): Promise<ItemListResponse> {
  const params = new URLSearchParams({
    api_id: apiId,
    affiliate_id: affiliateId,
    site: options.site || 'FANZA',
    service: options.service || 'doujin', // 同人誌は doujin サービス
    floor: options.floor || 'digital_doujin', // 同人誌フロア
    hits: String(options.hits || 100),
    offset: String(options.offset || 1),
    sort: options.sort || 'date',
    output: 'json',
  });

  // 発売日絞り込み（年別ランキング用）
  if (options.gte_date) {
    params.append('gte_date', options.gte_date);
  }
  if (options.lte_date) {
    params.append('lte_date', options.lte_date);
  }

  const url = `https://api.dmm.com/affiliate/v3/ItemList?${params.toString()}`;
  console.log(`[API] Requesting item list...`);
  console.log(`[API] URL: ${url.replace(apiId, '***').replace(affiliateId, '***')}`);

  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json() as ItemListResponse;

  // statusは文字列の'200'または数値の200の可能性がある
  if (String(data.result.status) !== '200') {
    throw new Error(`API returned error: ${JSON.stringify(data.result)}`);
  }

  return data;
}

function parseArgs(): { offset: number; sort: string; hits: number } {
  const args = process.argv.slice(2);
  let offset = 1;
  let sort = 'date';
  let hits = 100;

  for (const arg of args) {
    if (arg.startsWith('--offset=')) {
      offset = parseInt(arg.split('=')[1], 10) || 1;
    } else if (arg.startsWith('--sort=')) {
      sort = arg.split('=')[1] || 'date';
    } else if (arg.startsWith('--hits=')) {
      hits = parseInt(arg.split('=')[1], 10) || 100;
      if (hits > 100) hits = 100; // 最大100件
    }
  }

  return { offset, sort, hits };
}

function displayItemSummary(items: Item[]) {
  console.log(`\n=== 取得した作品一覧（${items.length}件） ===\n`);

  items.forEach((item, index) => {
    console.log(`${index + 1}. ${item.title}`);
    console.log(`   ID: ${item.content_id}`);
    console.log(`   product_id: ${item.product_id}`);
    console.log(`   発売日: ${item.date}`);
    console.log(`   サービス: ${item.service_name} (${item.service_code})`);
    console.log(`   フロア: ${item.floor_name} (${item.floor_code})`);
    console.log(`   カテゴリ: ${item.category_name}`);
    if (item.volume) {
      console.log(`   ページ数/巻数: ${item.volume}`);
    }
    if (item.number) {
      console.log(`   巻数/号数: ${item.number}`);
    }
    if (item.iteminfo.author && item.iteminfo.author.length > 0) {
      console.log(`   作者: ${item.iteminfo.author.map(a => `${a.name} (ID: ${a.id})`).join(', ')}`);
    }
    if (item.iteminfo.genre && item.iteminfo.genre.length > 0) {
      console.log(`   ジャンル (${item.iteminfo.genre.length}件):`);
      item.iteminfo.genre.forEach(g => {
        console.log(`     - ${g.name} (ID: ${g.id})`);
      });
    }
    if (item.iteminfo.series && item.iteminfo.series.length > 0) {
      console.log(`   シリーズ: ${item.iteminfo.series.map(s => `${s.name} (ID: ${s.id})`).join(', ')}`);
    }
    if (item.iteminfo.maker && item.iteminfo.maker.length > 0) {
      console.log(`   メーカー: ${item.iteminfo.maker.map(m => `${m.name} (ID: ${m.id})`).join(', ')}`);
    }
    if (item.iteminfo.manufacture && item.iteminfo.manufacture.length > 0) {
      console.log(`   出版社: ${item.iteminfo.manufacture.map(m => `${m.name} (ID: ${m.id})`).join(', ')}`);
    }
    if (item.review) {
      console.log(`   レビュー: ${item.review.average} (${item.review.count}件)`);
    }
    console.log(`   価格: ${item.prices.price}`);
    if (item.prices.list_price) {
      console.log(`   定価: ${item.prices.list_price}`);
    }
    console.log(`   通常URL: ${item.URL}`);
    console.log(`   アフィリエイトURL: ${item.affiliateURL}`);
    console.log(`   画像URL (list): ${item.imageURL.list}`);
    console.log(`   画像URL (small): ${item.imageURL.small}`);
    console.log(`   画像URL (large): ${item.imageURL.large}`);
    if (item.sampleImageURL) {
      if (item.sampleImageURL.sample_s && item.sampleImageURL.sample_s.image) {
        console.log(`   サンプル画像 (小): ${item.sampleImageURL.sample_s.image.length}枚`);
      }
      if (item.sampleImageURL.sample_l && item.sampleImageURL.sample_l.image) {
        console.log(`   サンプル画像 (大): ${item.sampleImageURL.sample_l.image.length}枚`);
      }
    }
    console.log('');
  });
}

function displayStatistics(data: ItemListResponse) {
  console.log('\n=== 取得統計 ===\n');
  console.log(`総件数: ${data.result.total_count}件`);
  console.log(`取得件数: ${data.result.result_count}件`);
  console.log(`開始位置: ${data.result.first_position}`);
  console.log(`次の開始位置: ${data.result.first_position + data.result.result_count}`);
  
  if (data.result.total_count > data.result.first_position + data.result.result_count - 1) {
    console.log(`\n💡 次の100件を取得するには:`);
    console.log(`   tsx scripts/test-dmm-itemlist-api.ts --offset=${data.result.first_position + data.result.result_count}`);
  }
}

async function main() {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID || process.env.AFFILIATE_ID;

  if (!apiId) {
    console.error('❌ エラー: DMM_API_IDが設定されていません');
    console.error('   .env.localファイルに以下を追加してください:');
    console.error('   DMM_API_ID=your-api-id');
    process.exit(1);
  }

  if (!affiliateId) {
    console.error('❌ エラー: アフィリエイトIDが設定されていません');
    console.error('   .env.localファイルに以下を追加してください:');
    console.error('   DMM_AFFILIATE_ID=sok-990');
    process.exit(1);
  }

  const args = parseArgs();

  console.log('現在の環境変数確認:');
  console.log(`DMM_API_ID: ${apiId ? '設定済み' : '未設定'}`);
  console.log(`DMM_AFFILIATE_ID: ${affiliateId}`);
  console.log('\nリクエストパラメータ:');
  console.log(`  site: FANZA`);
  console.log(`  service: doujin (同人誌)`);
  console.log(`  floor: digital_doujin (同人)`);
  console.log(`  hits: ${args.hits}`);
  console.log(`  offset: ${args.offset}`);
  console.log(`  sort: ${args.sort}`);
  console.log('  同人誌フィルタ: 有効（/digital/comic/ のみ採用）');
  console.log('');

  try {
    console.log('🚀 DMM Affiliate API - 商品情報APIテスト\n');

    const data = await fetchItemList(apiId, affiliateId, {
      site: 'FANZA',
      service: 'doujin', // 同人誌サービス
      floor: 'digital_doujin', // 同人フロア
      hits: args.hits,
      offset: args.offset,
      sort: args.sort,
    });

    // 同人誌フィルタ適用
    const filteredItems = data.result.items.filter(isDoujinComic);
    const filteredCount = data.result.items.length - filteredItems.length;
    
    if (filteredCount > 0) {
      console.log(`\n⚠️  同人誌フィルタ適用: ${filteredCount}件を除外（ゲーム/CG集/音声など）`);
      console.log(`   採用: ${filteredItems.length}件`);
    }

    // フィルタ後のデータで統計を更新
    const filteredData: ItemListResponse = {
      ...data,
      result: {
        ...data.result,
        items: filteredItems,
        result_count: filteredItems.length,
      },
    };

    displayStatistics(filteredData);
    displayItemSummary(filteredData.result.items);

    // JSON形式でも出力（詳細確認用）
    console.log('\n=== 取得データのJSON形式（フィルタ後） ===\n');
    console.log(JSON.stringify(filteredData.result.items, null, 2));

    // ファイルにも保存（オプション）
    const fs = require('fs');
    const path = require('path');
    const outputDir = path.join(process.cwd(), 'data', 'dmm-api-test');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputFile = path.join(outputDir, `itemlist_${timestamp}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(filteredData.result, null, 2), 'utf-8');
    console.log(`\n💾 データをファイルに保存しました: ${outputFile}`);

    console.log('\n✅ テスト完了');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    if (error instanceof Error) {
      console.error('   メッセージ:', error.message);
    }
    process.exit(1);
  }
}

main();
