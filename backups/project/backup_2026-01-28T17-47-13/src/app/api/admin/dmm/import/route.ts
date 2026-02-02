/**
 * /api/admin/dmm/import: DMM APIから作品をインポート
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminAllowed } from '@/server/admin/isAdminAllowed';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import crypto from 'crypto';

// DMM API レスポンス型
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
    sample_s: {
      image: string[];
    };
  };
  prices: {
    price: string;
    list_price?: string;
  };
  date: string;
  iteminfo: {
    genre?: Array<{ id: number; name: string }>;
    series?: Array<{ id: number; name: string }>;
    maker?: Array<{ id: number; name: string }>;
    author?: Array<{ id: number; name: string }>;
  };
}

interface ItemListResponse {
  result: {
    status: string | number;
    result_count: number;
    total_count: number;
    first_position: number;
    items: Item[];
  };
}

/**
 * 同人誌フィルタ判定
 */
function isDoujinComic(item: Item): boolean {
  const imageUrl = item.imageURL?.list || item.imageURL?.large || '';
  if (!imageUrl.includes('/digital/comic/')) {
    return false;
  }
  if (item.volume && item.volume.includes('画像') && item.volume.includes('枚')) {
    return false;
  }
  const gameGenres = [7110, 156002, 160045];
  if (item.iteminfo.genre?.some(g => gameGenres.includes(g.id))) {
    return false;
  }
  return true;
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
  if (item.iteminfo.maker?.some(m => 
    aiGenreKeywords.some(keyword => m.name.includes(keyword))
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
 * タグキー生成
 */
function generateTagKey(displayName: string, tagType: 'OFFICIAL' | 'DERIVED'): string {
  const hash = crypto.createHash('sha1').update(displayName, 'utf8').digest('hex').substring(0, 10);
  return tagType === 'OFFICIAL' ? `off_${hash}` : `tag_${hash}`;
}

/**
 * popularityBase計算
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
  if (base < 0) base = 0;
  if (base > 55) base = 55;
  return base;
}

/**
 * 除外すべき公式タグかどうか
 */
function shouldExcludeOfficialTag(displayName: string): boolean {
  const excludePatterns = [
    /^オトナコミック$/i,
    /^コミック$/i,
    /^マンガ$/i,
    /^男性向け$/i,
    /^女性向け$/i,
    /^成人向け$/i,
    /^\d+%OFF/i,
    /^セール/i,
    /^キャンペーン/i,
  ];
  return excludePatterns.some(p => p.test(displayName));
}

export async function POST(request: NextRequest) {
  if (!isAdminAllowed(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await ensurePrismaConnected();

    const body = await request.json();
    const { target = 10, sort = 'rank' } = body;

    // DMM API認証情報
    const apiId = process.env.DMM_API_ID;
    const affiliateId = process.env.DMM_AFFILIATE_ID;

    if (!apiId || !affiliateId) {
      return NextResponse.json(
        { success: false, error: 'DMM API認証情報が設定されていません（.env.localにDMM_API_IDとDMM_AFFILIATE_IDを設定してください）' },
        { status: 500 }
      );
    }

    // DMM APIから作品を取得
    const params = new URLSearchParams({
      api_id: apiId,
      affiliate_id: affiliateId,
      site: 'FANZA',
      service: 'doujin',
      floor: 'digital_doujin',
      hits: String(Math.min(target * 2, 100)), // 目標の2倍を取得（フィルタで減るため）
      offset: '1',
      sort,
      output: 'json',
    });

    const apiUrl = `https://api.dmm.com/affiliate/v3/ItemList?${params.toString()}`;
    console.log(`[DMM Import API] Fetching from DMM API...`);

    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DMM API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json() as ItemListResponse;
    const status = String(data.result.status);
    if (status !== '200') {
      throw new Error(`DMM API returned error: status=${status}`);
    }

    console.log(`[DMM Import API] API returned ${data.result.items.length} items`);

    // 同人誌フィルタ適用
    const filteredItems = data.result.items.filter(isDoujinComic);
    console.log(`[DMM Import API] After filter: ${filteredItems.length} items`);

    let savedCount = 0;
    let skippedCount = 0;
    const savedWorks: Array<{ workId: string; title: string }> = [];
    const skippedWorks: Array<{ workId: string; title: string; reason: string }> = [];

    // DBに保存
    for (const item of filteredItems) {
      if (savedCount >= target) break;

      const workId = item.content_id;
      
      // 既存チェック
      const existing = await prisma.work.findUnique({
        where: { workId },
      });

      if (existing) {
        skippedCount++;
        skippedWorks.push({ workId, title: item.title, reason: '既存' });
        continue;
      }

      const isAi = determineIsAi(item);
      const authorName = getAuthorName(item);
      const reviewCount = item.review?.count ? parseInt(item.review.count.toString(), 10) : null;
      const reviewAverage = item.review?.average ? parseFloat(item.review.average) : null;
      const popularityBase = computePopularityBase(reviewCount, reviewAverage);

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
          popularityBase,
          popularityPlayBonus: 0,
          reviewCount,
          reviewAverage,
          productUrl: item.URL || item.affiliateURL || '',
          affiliateUrl: item.affiliateURL || null,
          thumbnailUrl: item.imageURL.large,
          sourcePayload: JSON.stringify(item),
          contentId: item.content_id,
          releaseDate: item.date || null,
          pageCount: item.volume || null,
          seriesInfo,
          commentText: null,
        },
      });

      // タグを保存
      if (item.iteminfo.genre) {
        for (const genre of item.iteminfo.genre) {
          if (shouldExcludeOfficialTag(genre.name)) continue;

          const tagKey = generateTagKey(genre.name, 'OFFICIAL');
          
          await prisma.tag.upsert({
            where: { tagKey },
            update: {},
            create: {
              tagKey,
              displayName: genre.name,
              tagType: 'OFFICIAL',
              category: 'ジャンル',
            },
          });

          await prisma.workTag.upsert({
            where: { workId_tagKey: { workId, tagKey } },
            update: {},
            create: { workId, tagKey },
          });
        }
      }

      savedCount++;
      savedWorks.push({ workId, title: item.title });
      console.log(`[DMM Import API] Saved: ${workId} - ${item.title.substring(0, 30)}...`);
    }

    return NextResponse.json({
      success: true,
      stats: {
        saved: savedCount,
        skipped: skippedCount,
        apiTotal: data.result.total_count,
      },
      savedWorks,
      skippedWorks: skippedWorks.slice(0, 10), // 最初の10件のみ
    });
  } catch (error) {
    console.error('[DMM Import API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
