#!/usr/bin/env tsx
/**
 * DMM APIレスポンスにcommentフィールドが含まれているか確認するスクリプト
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config();

interface Item {
  [key: string]: any; // すべてのフィールドを確認するため
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
  }
): Promise<ItemListResponse> {
  const params = new URLSearchParams({
    api_id: apiId,
    affiliate_id: affiliateId,
    site: options.site || 'FANZA',
    service: options.service || 'doujin',
    floor: options.floor || 'digital_doujin',
    hits: String(options.hits || 1),
    offset: String(options.offset || 1),
    sort: options.sort || 'rank',
    output: 'json',
  });

  const url = `https://api.dmm.com/affiliate/v3/ItemList?${params.toString()}`;
  console.log(`[API] Requesting: ${url.replace(apiId, '***').replace(affiliateId, '***')}\n`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as ItemListResponse;

  if (data.result.status !== '200') {
    throw new Error(`API returned error: ${JSON.stringify(data.result)}`);
  }

  return data;
}

function checkCommentField(item: Item): { hasComment: boolean; commentValue: any; allFields: string[] } {
  const allFields = Object.keys(item);
  const hasComment = 'comment' in item;
  const commentValue = hasComment ? item.comment : null;

  return {
    hasComment,
    commentValue,
    allFields,
  };
}

async function main() {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID || process.env.AFFILIATE_ID;

  if (!apiId || !affiliateId) {
    console.error('❌ エラー: DMM_API_IDとDMM_AFFILIATE_IDが設定されていません');
    process.exit(1);
  }

  try {
    console.log('🔍 DMM APIレスポンスのcommentフィールド確認\n');

    // 同人誌で確認
    console.log('【同人誌（doujin）】');
    const doujinData = await fetchItemList(apiId, affiliateId, {
      site: 'FANZA',
      service: 'doujin',
      floor: 'digital_doujin',
      hits: 3,
      offset: 1,
      sort: 'rank',
    });

    for (let i = 0; i < doujinData.result.items.length; i++) {
      const item = doujinData.result.items[i];
      const check = checkCommentField(item);
      console.log(`\n作品 ${i + 1}: ${item.title}`);
      console.log(`  commentフィールド: ${check.hasComment ? '✅ あり' : '❌ なし'}`);
      if (check.hasComment) {
        console.log(`  comment値: ${JSON.stringify(check.commentValue, null, 2)}`);
      }
      console.log(`  全フィールド: ${check.allFields.join(', ')}`);
    }

    // 電子書籍で確認
    console.log('\n\n【電子書籍（ebook）】');
    const ebookData = await fetchItemList(apiId, affiliateId, {
      site: 'FANZA',
      service: 'ebook',
      floor: 'comic',
      hits: 3,
      offset: 1,
      sort: 'rank',
    });

    for (let i = 0; i < ebookData.result.items.length; i++) {
      const item = ebookData.result.items[i];
      const check = checkCommentField(item);
      console.log(`\n作品 ${i + 1}: ${item.title}`);
      console.log(`  commentフィールド: ${check.hasComment ? '✅ あり' : '❌ なし'}`);
      if (check.hasComment) {
        console.log(`  comment値: ${JSON.stringify(check.commentValue, null, 2)}`);
      }
      console.log(`  全フィールド: ${check.allFields.join(', ')}`);
    }

    // 動画で確認
    console.log('\n\n【動画（digital）】');
    const videoData = await fetchItemList(apiId, affiliateId, {
      site: 'FANZA',
      service: 'digital',
      floor: 'videoa',
      hits: 3,
      offset: 1,
      sort: 'rank',
    });

    for (let i = 0; i < videoData.result.items.length; i++) {
      const item = videoData.result.items[i];
      const check = checkCommentField(item);
      console.log(`\n作品 ${i + 1}: ${item.title}`);
      console.log(`  commentフィールド: ${check.hasComment ? '✅ あり' : '❌ なし'}`);
      if (check.hasComment) {
        console.log(`  comment値: ${JSON.stringify(check.commentValue, null, 2)}`);
      }
      console.log(`  全フィールド: ${check.allFields.join(', ')}`);
    }

    console.log('\n\n📊 結論');
    const allItems = [
      ...doujinData.result.items,
      ...ebookData.result.items,
      ...videoData.result.items,
    ];
    const itemsWithComment = allItems.filter(item => 'comment' in item);
    const itemsWithoutComment = allItems.filter(item => !('comment' in item));

    console.log(`  確認した作品数: ${allItems.length}件`);
    console.log(`  commentフィールドあり: ${itemsWithComment.length}件`);
    console.log(`  commentフィールドなし: ${itemsWithoutComment.length}件`);

    if (itemsWithComment.length > 0) {
      console.log('\n✅ commentフィールドは取得可能です！');
      console.log('   ただし、すべての作品に含まれているわけではない可能性があります。');
    } else {
      console.log('\n❌ commentフィールドは取得できませんでした。');
      console.log('   ChatGPTの情報と実際のAPIレスポンスが異なる可能性があります。');
    }

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    if (error instanceof Error) {
      console.error('   メッセージ:', error.message);
    }
    process.exit(1);
  }
}

main();
