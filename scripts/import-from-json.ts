#!/usr/bin/env tsx
/**
 * JSONファイルから作品データをDBにインポートするスクリプト
 * 
 * 使い方:
 *   npm run import:from-json -- data/dmm-api-test/itemlist_2026-01-26T17-24-05.json
 * 
 * 環境変数:
 *   DATABASE_URL: データベースURL（.envから自動読み込み）
 */

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { isTagBanned } from '../src/server/admin/bannedTags';
import { resolveOfficialTagKeyByDisplayName } from '../src/server/admin/resolveTagByDisplayName';

// .env.localを優先的に読み込む
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config(); // .envも読み込む（フォールバック）

const prisma = new PrismaClient();

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
  date?: string;
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
  iteminfo: {
    genre?: Array<{ id: string; name: string }>;
    series?: Array<{ id: string; name: string }>;
    maker?: Array<{ id: string; name: string }>;
    author?: Array<{ id: string; name: string }>;
  };
}

interface ApiResponse {
  status: number;
  result_count: number;
  total_count: number;
  first_position: number;
  items: Item[];
}

/**
 * AI判定
 */
function determineIsAi(item: Item): 'AI' | 'HAND' | 'UNKNOWN' {
  const aiGenreKeywords = ['AI', '人工知能', '機械学習'];
  if (item.iteminfo.genre?.some(g => 
    aiGenreKeywords.some(keyword => g.name.includes(keyword))
  )) {
    return 'AI';
  }

  const aiMakerKeywords = ['AI', '人工知能', '機械学習'];
  if (item.iteminfo.maker?.some(m => 
    aiMakerKeywords.some(keyword => m.name.includes(keyword))
  )) {
    return 'AI';
  }

  const aiTitleKeywords = ['AI生成', 'AIイラスト', 'AI作品'];
  if (aiTitleKeywords.some(keyword => item.title.includes(keyword))) {
    return 'AI';
  }

  return 'UNKNOWN';
}

/**
 * 作者名を取得
 */
function getAuthorName(item: Item): string {
  if (item.iteminfo.author && item.iteminfo.author.length > 0) {
    return item.iteminfo.author.map(a => a.name).join(', ');
  }

  if (item.iteminfo.maker && item.iteminfo.maker.length > 0) {
    return item.iteminfo.maker.map(m => m.name).join(', ');
  }

  return '不明';
}

/**
 * SHA1ハッシュの先頭10桁を取得
 */
function getHash10(text: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha1').update(text, 'utf8').digest('hex').substring(0, 10);
}

/**
 * tagKey を決定論的に生成
 */
function generateTagKey(displayName: string, tagType: 'OFFICIAL' | 'DERIVED' | 'STRUCTURAL'): string {
  const hash10 = getHash10(displayName);
  if (tagType === 'DERIVED') {
    return `tag_${hash10}`;
  } else if (tagType === 'STRUCTURAL') {
    return `char_${hash10}`;
  } else {
    return `off_${hash10}`;
  }
}

/**
 * OFFICIALタグ除外判定
 */
function shouldExcludeOfficialTag(displayName: string): boolean {
  const trimmed = displayName.trim();
  
  const exactMatches = ['新作', '準新作', '旧作', 'イチオシ'];
  if (exactMatches.includes(trimmed)) {
    return true;
  }
  
  const regexPatterns = [
    /^コミケ\d+/,
    /^コミックマーケット/,
    /^J\.?GARDEN\d*/i,
    /^YOU\d+/,
    /赤ブー/,
    /博麗神社例大祭/,
    /^コミティア/i,
    /^エアコミケ/i,
  ];
  
  for (const pattern of regexPatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  return false;
}

/**
 * 作品をDBに保存
 */
async function saveWorkToDb(item: Item): Promise<{ saved: boolean; workId: string }> {
  const workId = item.content_id;
  const isAi = determineIsAi(item);
  const authorName = getAuthorName(item);
  const reviewCount = item.review?.count ? parseInt(item.review.count.toString(), 10) : null;
  const reviewAverage = item.review?.average ? parseFloat(item.review.average) : null;

  // 既存チェック
  const existing = await prisma.work.findUnique({
    where: { workId },
  });

  if (existing) {
    return { saved: false, workId };
  }

  // シリーズ情報（最初の1つのみ）
  const seriesInfo = item.iteminfo.series && item.iteminfo.series.length > 0
    ? JSON.stringify({ id: item.iteminfo.series[0].id, name: item.iteminfo.series[0].name })
    : null;

  // Work作成
  await prisma.work.create({
    data: {
      workId,
      title: item.title,
      authorName,
      isAi,
      popularityBase: 0,
      popularityPlayBonus: 0,
      reviewCount,
      reviewAverage,
      productUrl: item.URL || item.affiliateURL || '',
      affiliateUrl: item.affiliateURL || null,
      thumbnailUrl: item.imageURL.large,
      sourcePayload: JSON.stringify(item),
      // API取得情報
      contentId: item.content_id,
      releaseDate: item.date || null,
      pageCount: item.volume || null,
      seriesInfo,
      // スクレイピング情報（未取得状態）
      commentText: null,
    },
  });

  // Sタグ（OFFICIAL）: 既存のみ紐付け。カテゴリは取得・設定しない。新規Tagは作らない（docs/s-tag-and-banned-tags.md）
  if (item.iteminfo.genre) {
    for (const genre of item.iteminfo.genre) {
      const displayName = genre.name;

      if (isTagBanned(displayName)) continue;

      const tagKey = await resolveOfficialTagKeyByDisplayName(prisma, displayName);
      if (!tagKey) continue;

      await prisma.workTag.upsert({
        where: {
          workId_tagKey: {
            workId,
            tagKey,
          },
        },
        update: {},
        create: {
          workId,
          tagKey,
        },
      });
    }
  }

  return { saved: true, workId };
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ エラー: JSONファイルのパスを指定してください');
    console.error('使い方: npm run import:from-json -- <json-file-path>');
    process.exit(1);
  }

  const jsonPath = path.resolve(process.cwd(), args[0]);

  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ エラー: ファイルが見つかりません: ${jsonPath}`);
    process.exit(1);
  }

  console.log('🚀 JSONファイルから作品データをインポート\n');
  console.log(`ファイル: ${jsonPath}\n`);

  try {
    const fileContent = fs.readFileSync(jsonPath, 'utf-8');
    const data: ApiResponse = JSON.parse(fileContent);

    if (data.status !== 200) {
      console.error(`❌ エラー: APIレスポンスのstatusが200ではありません: ${data.status}`);
      process.exit(1);
    }

    if (!data.items || data.items.length === 0) {
      console.log('⚠️  警告: インポートするデータがありません');
      process.exit(0);
    }

    console.log(`取得件数: ${data.items.length}件\n`);

    let savedCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const result = await saveWorkToDb(item);

      if (result.saved) {
        savedCount++;
        console.log(`[${i + 1}/${data.items.length}] ✓ 保存: ${item.title} (${item.content_id})`);
      } else {
        skippedCount++;
        console.log(`[${i + 1}/${data.items.length}] ⊘ スキップ（既存）: ${item.title} (${item.content_id})`);
      }
    }

    console.log('\n✅ インポート完了');
    console.log(`  保存: ${savedCount}件`);
    console.log(`  スキップ: ${skippedCount}件`);

    // 最終的な作品数を確認
    const totalWorks = await prisma.work.count();
    console.log(`\n現在のDB内作品数: ${totalWorks}件`);
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
