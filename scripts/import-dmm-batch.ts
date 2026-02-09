#!/usr/bin/env tsx
/**
 * DMM Affiliate API - バッチ取得スクリプト
 * sort=rankで人気順に作品を取得し、DBに保存
 * 
 * 使い方:
 *   npm run import:dmm-batch -- --target=100
 *   npm run import:dmm-batch -- --target=1000 --offset=1
 * 
 * 環境変数:
 *   DMM_API_ID: DMM API ID
 *   DMM_AFFILIATE_ID: アフィリエイトID (末尾990-999)
 * 
 * パラメータ:
 *   --target: 目標取得件数（デフォルト: 100）
 *   --offset: 開始offset（デフォルト: 1）
 *   --hits: 1回のリクエストあたりの取得件数（デフォルト: 100、最大: 100）
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

// DATABASE_URLを検証し、クエリパラメータ（?mode=WAL）を処理
function validateDatabaseUrl(): void {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set');
    return;
  }

  // file:./prisma/dev.db?mode=WAL 形式の場合、クエリパラメータを削除して絶対パスに変換
  if (dbUrl.startsWith('file:./')) {
    // クエリパラメータを削除
    const dbUrlWithoutQuery = dbUrl.split('?')[0];
    const relativePath = dbUrlWithoutQuery.replace('file:', '');
    const absolutePath = path.resolve(process.cwd(), relativePath);
    const normalizedPath = absolutePath.replace(/\\/g, '/');
    // クエリパラメータなしで設定（WALモードは後で明示的に有効化）
    process.env.DATABASE_URL = `file:${normalizedPath}`;
    
    // 正しいDBファイルの存在確認
    if (!fs.existsSync(absolutePath)) {
      console.error(`Database file does not exist: ${absolutePath}`);
      return;
    }
  } else if (dbUrl.startsWith('file:') && dbUrl.includes('?')) {
    // 絶対パスの場合でもクエリパラメータを削除
    const dbUrlWithoutQuery = dbUrl.split('?')[0];
    process.env.DATABASE_URL = dbUrlWithoutQuery;
  }
}

// 初期化時にDATABASE_URLを検証
validateDatabaseUrl();

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

/**
 * DMM APIから作品リストを取得
 */
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
    service: options.service || 'doujin', // 同人誌サービス
    floor: options.floor || 'digital_doujin', // 同人フロア
    hits: String(options.hits || 100),
    offset: String(options.offset || 1),
    sort: options.sort || 'rank',
    output: 'json',
  });

  const url = `https://api.dmm.com/affiliate/v3/ItemList?${params.toString()}`;
  console.log(`[API] Requesting item list...`);
  console.log(`[API] URL: ${url.replace(apiId, '***').replace(affiliateId, '***')}`);

  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP error: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const data = await response.json() as ItemListResponse;

  // statusは文字列または数値の可能性がある
  const status = String(data.result.status);
  if (status !== '200') {
    throw new Error(`API returned error: status=${status}, ${JSON.stringify(data.result).substring(0, 500)}`);
  }

  // デバッグ用: 最初の数件のみログ出力
  if (data.result.items.length > 0) {
    console.log(`[API] 取得件数: ${data.result.items.length}件 (total_count: ${data.result.total_count})`);
  }

  return data;
}

/**
 * AI判定（簡易版）
 * ジャンルやメーカー名からAI作品を判定
 */
function determineIsAi(item: Item): 'AI' | 'HAND' | 'UNKNOWN' {
  // ジャンルで判定
  const aiGenreKeywords = ['AI', '人工知能', '機械学習'];
  if (item.iteminfo.genre?.some(g => 
    aiGenreKeywords.some(keyword => g.name.includes(keyword))
  )) {
    return 'AI';
  }

  // メーカー名で判定（AI関連のサークル名）
  const aiMakerKeywords = ['AI', '人工知能', '機械学習'];
  if (item.iteminfo.maker?.some(m => 
    aiMakerKeywords.some(keyword => m.name.includes(keyword))
  )) {
    return 'AI';
  }

  // タイトルで判定（簡易）
  const aiTitleKeywords = ['AI生成', 'AIイラスト', 'AI作品'];
  if (aiTitleKeywords.some(keyword => item.title.includes(keyword))) {
    return 'AI';
  }

  // デフォルトはUNKNOWN（後で手動判定可能）
  return 'UNKNOWN';
}

/**
 * 作者名を取得
 */
function getAuthorName(item: Item): string {
  // 優先順位1: author（著者）
  if (item.iteminfo.author && item.iteminfo.author.length > 0) {
    return item.iteminfo.author.map(a => a.name).join(', ');
  }

  // 優先順位2: maker（メーカー/サークル）
  if (item.iteminfo.maker && item.iteminfo.maker.length > 0) {
    return item.iteminfo.maker.map(m => m.name).join(', ');
  }

  // フォールバック
  return '不明';
}

/**
 * popularityBaseを計算（仕様書§9.1に基づく）
 * - reviewCount >= 100 → 50
 * - reviewCount >= 10 → 30
 * - reviewCount >= 1 → 10
 * - reviewCount = 0 → 0
 * - その後 round(reviewAverage) を加算
 * - 0..55 にクランプ
 */
function computePopularityBase(reviewCount: number | null, reviewAverage: number | null): number {
  const rc = reviewCount ?? 0;
  let base = 0;

  if (rc >= 100) base = 50;
  else if (rc >= 10) base = 30;
  else if (rc >= 1) base = 10;
  else base = 0;

  if (reviewAverage != null && !isNaN(reviewAverage)) {
    base += Math.round(reviewAverage);
  }

  // 0..55にクランプ
  if (base < 0) base = 0;
  if (base > 55) base = 55;
  return base;
}

/**
 * 作品をDBに保存
 */
async function saveWorkToDb(item: Item): Promise<{ saved: boolean; workId: string }> {
  const workId = item.content_id; // content_idをworkIdとして使用
  const isAi = determineIsAi(item);
  const authorName = getAuthorName(item);
  const reviewCount = item.review?.count ? parseInt(item.review.count.toString(), 10) : null;
  const reviewAverage = item.review?.average ? parseFloat(item.review.average) : null;
  
  // デバッグログ: レビュー情報を確認（常に出力）
  console.log(`  [レビュー情報] reviewCount=${reviewCount}, reviewAverage=${reviewAverage}`);
  if (item.review) {
    console.log(`  [レビュー生データ] raw=${JSON.stringify(item.review)}`);
  } else {
    console.log(`  [レビュー生データ] reviewフィールドなし`);
  }
  
  const popularityBase = computePopularityBase(reviewCount, reviewAverage);

  // 既存チェック（workId）
  const existing = await prisma.work.findUnique({
    where: { workId },
  });

  if (existing) {
    return { saved: false, workId };
  }

  // 同一作品の重複防止: タイトル＋作者が同じ既存作品があればそちらにタグだけ付与
  const title = (item.title ?? '').trim();
  const existingByTitleAuthor = await prisma.work.findFirst({
    where: { title, authorName },
    select: { workId: true },
  });

  if (existingByTitleAuthor) {
    const canonicalWorkId = existingByTitleAuthor.workId;
    if (item.iteminfo.genre) {
      for (const genre of item.iteminfo.genre) {
        const displayName = genre.name;
        if (isTagBanned(displayName)) continue;
        const tagKey = await resolveOfficialTagKeyByDisplayName(prisma, displayName);
        if (!tagKey) continue;
        await prisma.workTag.upsert({
          where: { workId_tagKey: { workId: canonicalWorkId, tagKey } },
          update: {},
          create: { workId: canonicalWorkId, tagKey },
        });
      }
    }
    return { saved: true, workId: canonicalWorkId };
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
      popularityBase, // reviewCount/reviewAverageから計算
      popularityPlayBonus: 0,
      reviewCount,
      reviewAverage,
      productUrl: item.URL || item.affiliateURL || '', // 通常URLを優先、なければaffiliateURL
      affiliateUrl: item.affiliateURL || null, // アフィリエイトリンクを別フィールドに保存
      thumbnailUrl: item.imageURL.large,
      sourcePayload: JSON.stringify(item), // 元データを保存
      // API取得情報
      contentId: item.content_id,
      releaseDate: item.date || null,
      pageCount: item.volume || null,
      seriesInfo,
      // スクレイピング情報（未取得状態）
      commentText: null, // null=未取得
    },
  });

  // Sタグ（OFFICIAL）: 既存のみ紐付け。カテゴリは取得・設定しない。新規Tagは作らない（docs/s-tag-and-banned-tags.md）
  if (item.iteminfo.genre) {
    for (const genre of item.iteminfo.genre) {
      const displayName = genre.name;

      if (isTagBanned(displayName)) continue;

      const tagKey = await resolveOfficialTagKeyByDisplayName(prisma, displayName);
      if (!tagKey) continue; // 既存のOFFICIALがなければスキップ（Sタグは増やさない）

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
 * コマンドライン引数をパース
 */
function parseArgs(): { target: number; offset: number; hits: number } {
  const args = process.argv.slice(2);
  let target = 100;
  let offset = 1;
  let hits = 100;

  for (const arg of args) {
    if (arg.startsWith('--target=')) {
      target = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--offset=')) {
      offset = parseInt(arg.split('=')[1], 10);
    } else if (arg.startsWith('--hits=')) {
      hits = parseInt(arg.split('=')[1], 10);
    }
  }

  return { target, offset, hits };
}

/**
 * メイン処理
 */
async function main() {
  const apiId = process.env.DMM_API_ID;
  const affiliateId = process.env.DMM_AFFILIATE_ID || process.env.AFFILIATE_ID;

  if (!apiId || !affiliateId) {
    console.error('❌ エラー: DMM_API_IDとDMM_AFFILIATE_IDが設定されていません');
    console.error('   .env.localファイルに以下を追加してください:');
    console.error('   DMM_API_ID=your-api-id');
    console.error('   DMM_AFFILIATE_ID=sok-990');
    process.exit(1);
  }

  // Prisma Clientの接続を確立し、WALモードを有効化
  try {
    await prisma.$connect();
    // WALモードを有効化（既に有効な場合は何もしない）
    // PRAGMAは結果を返すため、$queryRawを使用
    const result = await prisma.$queryRaw<Array<{ journal_mode: string }>>`PRAGMA journal_mode=WAL;`;
    const journalMode = result[0]?.journal_mode || 'unknown';
    console.log(`✅ データベース接続を確立しました（Journal Mode: ${journalMode}）\n`);
  } catch (error) {
    console.error('❌ データベース接続エラー:');
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
    }
    process.exit(1);
  }

  const args = parseArgs();
  const { target, offset: startOffset, hits } = args;

  console.log('🚀 DMM Affiliate API - バッチ取得スクリプト\n');
  console.log('設定:');
  console.log(`  目標取得件数: ${target}件`);
  console.log(`  開始offset: ${startOffset}`);
  console.log(`  1回のリクエストあたり: ${hits}件`);
  console.log(`  ソート: rank（人気順）\n`);

  // 開発サーバーが実行中かチェック
  const fs = require('fs');
  const lockFile = path.join(process.cwd(), '.dev-lock');
  if (fs.existsSync(lockFile)) {
    console.warn('⚠️  警告: 開発サーバーが実行中の可能性があります');
    console.warn('   DBがロックされる可能性があります。開発サーバーを停止（Ctrl+C）してから実行することを推奨します。\n');
  }

  let currentOffset = startOffset;
  let totalSaved = 0;
  let totalSkipped = 0;
  let totalFiltered = 0;
  let totalErrors = 0;
  const errorWorks: Array<{ workId: string; error: string }> = [];

  try {
    while (totalSaved < target) {
      console.log(`\n[${new Date().toISOString()}] offset=${currentOffset} から取得開始...`);

      // APIから取得
      const data = await fetchItemList(apiId, affiliateId, {
        site: 'FANZA',
        service: 'doujin',
        floor: 'digital_doujin',
        hits,
        offset: currentOffset,
        sort: 'rank',
      });

      // 同人誌フィルタ適用
      const filteredItems = data.result.items.filter(isDoujinComic);
      const filteredCount = data.result.items.length - filteredItems.length;
      totalFiltered += filteredCount;

      if (filteredCount > 0) {
        console.log(`  フィルタ適用: ${filteredCount}件を除外（ゲーム/CG集/音声など）`);
      }

      console.log(`  フィルタ後: ${filteredItems.length}件（同人誌のみ）`);

      if (filteredItems.length === 0) {
        console.log('  取得できる作品がありません。終了します。');
        break;
      }

      // DBに保存
      let batchSaved = 0;
      let batchSkipped = 0;
      const skippedWorks: Array<{ workId: string; title: string }> = [];

      for (const item of filteredItems) {
        try {
          const result = await saveWorkToDb(item);
          if (result.saved) {
            batchSaved++;
            totalSaved++;
          } else {
            batchSkipped++;
            totalSkipped++;
            skippedWorks.push({ workId: item.content_id, title: item.title });
          }

          // 目標件数に達したら終了
          if (totalSaved >= target) {
            break;
          }
        } catch (itemError) {
          const errorMessage = itemError instanceof Error ? itemError.message : String(itemError);
          const workId = item.content_id || 'unknown';
          
          // DBロックエラーの場合はリトライ
          if (errorMessage.includes('Unable to open the database file') || 
              errorMessage.includes('database is locked') ||
              errorMessage.includes('SQLITE_BUSY') ||
              errorMessage.includes('Error code 14')) {
            // リトライロジック（最大3回、指数バックオフ）
            let retryCount = 0;
            const maxRetries = 3;
            let retrySuccess = false;
            
            while (retryCount < maxRetries && !retrySuccess) {
              retryCount++;
              const delay = Math.pow(2, retryCount) * 100; // 200ms, 400ms, 800ms
              if (retryCount === 1) {
                console.log(`  ⏳ ${workId}: DBロック検出、リトライ中...`);
              }
              await new Promise(resolve => setTimeout(resolve, delay));
              
              try {
                const retryResult = await saveWorkToDb(item);
                if (retryResult.saved) {
                  batchSaved++;
                  totalSaved++;
                  retrySuccess = true;
                  console.log(`  ✅ ${workId}: リトライ成功`);
                } else {
                  batchSkipped++;
                  totalSkipped++;
                  skippedWorks.push({ workId: retryResult.workId, title: item.title });
                  retrySuccess = true; // スキップも成功とみなす
                }
              } catch (retryError) {
                if (retryCount === maxRetries) {
                  totalErrors++;
                  if (totalErrors === 1) {
                    console.error(`  ❌ ${workId}: リトライ失敗。開発サーバーを停止してから再実行してください。`);
                  }
                }
              }
            }
          } else {
            // その他のエラー
            totalErrors++;
            if (errorWorks.length < 3) {
              errorWorks.push({ workId, error: errorMessage });
            }
            if (errorWorks.length <= 3) {
              console.error(`  ❌ ${workId}: ${errorMessage}`);
            }
          }
          // エラーが発生しても続行
        }
      }

      // スキップされた作品を表示
      if (skippedWorks.length > 0) {
        console.log(`  スキップされた作品（重複）:`);
        for (const skipped of skippedWorks) {
          console.log(`    - ${skipped.title} (${skipped.workId})`);
        }
      }

      console.log(`  保存: ${batchSaved}件、スキップ: ${batchSkipped}件（重複）`);
      console.log(`  累計: 保存=${totalSaved}件、スキップ=${totalSkipped}件、フィルタ除外=${totalFiltered}件`);

      // 目標件数に達したら終了
      if (totalSaved >= target) {
        console.log(`\n✅ 目標件数（${target}件）に達しました！`);
        break;
      }

      // 次のoffsetに進む
      currentOffset += hits;

      // APIの上限チェック（offsetの最大値は50000）
      if (currentOffset > 50000) {
        console.log('\n⚠️  offsetの上限（50000）に達しました。');
        break;
      }

      // レート制限対策（1秒待機）
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n📊 最終統計:');
    console.log(`  保存: ${totalSaved}件`);
    console.log(`  スキップ（重複）: ${totalSkipped}件`);
    console.log(`  フィルタ除外: ${totalFiltered}件`);
    if (totalErrors > 0) {
      console.log(`  エラー: ${totalErrors}件`);
      console.log(`  ⚠️  エラーが発生しました。開発サーバーを停止してから再実行してください。`);
    }
    console.log(`  最終offset: ${currentOffset}`);

  } catch (error) {
    console.error('\n❌ エラーが発生しました:');
    if (error instanceof Error) {
      console.error('   メッセージ:', error.message);
      console.error('   スタック:', error.stack);
    } else {
      console.error('   エラー:', JSON.stringify(error, null, 2));
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
