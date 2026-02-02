#!/usr/bin/env tsx
/**
 * 作品の詳細情報を確認するスクリプト
 * sourcePayloadから全情報を表示
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // 最初の5件を取得
    const works = await prisma.work.findMany({
      orderBy: { createdAt: 'asc' },
      take: 5,
      include: {
        workTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    console.log(`\n📊 作品詳細情報（最初の5件）\n`);

    for (let i = 0; i < works.length; i++) {
      const work = works[i];
      const tags = work.workTags.map(wt => wt.tag.displayName).join(', ');
      
      console.log(`\n${'='.repeat(80)}`);
      console.log(`${i + 1}. ${work.title}`);
      console.log(`${'='.repeat(80)}`);
      console.log(`workId: ${work.workId}`);
      console.log(`作者: ${work.authorName}`);
      console.log(`AI判定: ${work.isAi}`);
      console.log(`レビュー: ${work.reviewCount ? `${work.reviewCount}件 (平均: ${work.reviewAverage?.toFixed(2)})` : 'なし'}`);
      console.log(`productUrl: ${work.productUrl}`);
      console.log(`thumbnailUrl: ${work.thumbnailUrl || 'なし'}`);
      console.log(`作成日時: ${work.createdAt.toISOString()}`);
      console.log(`\nタグ: ${tags || 'なし'}`);
      
      // sourcePayloadを解析
      if (work.sourcePayload) {
        try {
          const payload = JSON.parse(work.sourcePayload);
          console.log(`\n--- sourcePayload から取得可能な情報 ---`);
          
          // 基本情報
          console.log(`\n【基本情報】`);
          console.log(`  title: ${payload.title || 'なし'}`);
          console.log(`  content_id: ${payload.content_id || 'なし'}`);
          console.log(`  product_id: ${payload.product_id || 'なし'}`);
          console.log(`  volume: ${payload.volume || 'なし'}`);
          console.log(`  date: ${payload.date || 'なし'}`);
          console.log(`  URL: ${payload.URL || 'なし'}`);
          console.log(`  affiliateURL: ${payload.affiliateURL || 'なし'}`);
          
          // 価格情報
          if (payload.prices) {
            console.log(`\n【価格情報】`);
            console.log(`  price: ${payload.prices.price || 'なし'}`);
            console.log(`  list_price: ${payload.prices.list_price || 'なし'}`);
            if (payload.prices.deliveries?.delivery) {
              console.log(`  deliveries:`);
              for (const delivery of payload.prices.deliveries.delivery) {
                console.log(`    - ${delivery.type}: ${delivery.price}円`);
              }
            }
          }
          
          // 画像情報
          if (payload.imageURL) {
            console.log(`\n【画像URL】`);
            console.log(`  list: ${payload.imageURL.list || 'なし'}`);
            console.log(`  small: ${payload.imageURL.small || 'なし'}`);
            console.log(`  large: ${payload.imageURL.large || 'なし'}`);
          }
          
          if (payload.sampleImageURL) {
            console.log(`\n【サンプル画像】`);
            if (payload.sampleImageURL.sample_s?.image) {
              console.log(`  サンプル（小）: ${payload.sampleImageURL.sample_s.image.length}枚`);
            }
            if (payload.sampleImageURL.sample_l?.image) {
              console.log(`  サンプル（大）: ${payload.sampleImageURL.sample_l.image.length}枚`);
            }
          }
          
          // iteminfo詳細
          if (payload.iteminfo) {
            console.log(`\n【iteminfo詳細】`);
            
            if (payload.iteminfo.genre) {
              console.log(`  ジャンル: ${payload.iteminfo.genre.map((g: any) => g.name).join(', ')}`);
            }
            
            if (payload.iteminfo.series) {
              console.log(`  シリーズ: ${payload.iteminfo.series.map((s: any) => s.name).join(', ')}`);
            }
            
            if (payload.iteminfo.maker) {
              console.log(`  メーカー: ${payload.iteminfo.maker.map((m: any) => m.name).join(', ')}`);
            }
            
            if (payload.iteminfo.author) {
              console.log(`  作者（iteminfo）: ${payload.iteminfo.author.map((a: any) => a.name).join(', ')}`);
            }
            
            if (payload.iteminfo.actress) {
              console.log(`  女優: ${payload.iteminfo.actress.map((a: any) => a.name).join(', ')}`);
            }
            
            if (payload.iteminfo.label) {
              console.log(`  レーベル: ${payload.iteminfo.label.map((l: any) => l.name).join(', ')}`);
            }
          }
          
          // レビュー情報
          if (payload.review) {
            console.log(`\n【レビュー情報】`);
            console.log(`  count: ${payload.review.count || 'なし'}`);
            console.log(`  average: ${payload.review.average || 'なし'}`);
          }
          
          // その他のフィールド（説明文、コメントなど）
          console.log(`\n【その他のフィールド】`);
          const knownFields = [
            'title', 'content_id', 'product_id', 'volume', 'date', 'URL', 'affiliateURL',
            'prices', 'imageURL', 'sampleImageURL', 'iteminfo', 'review', 'service_code',
            'service_name', 'floor_code', 'floor_name', 'category_name', 'number'
          ];
          const otherFields = Object.keys(payload).filter(key => !knownFields.includes(key));
          if (otherFields.length > 0) {
            console.log(`  その他のフィールド: ${otherFields.join(', ')}`);
            for (const field of otherFields) {
              const value = payload[field];
              if (typeof value === 'string' && value.length < 200) {
                console.log(`    ${field}: ${value}`);
              } else if (typeof value === 'object') {
                console.log(`    ${field}: [オブジェクト]`);
              } else {
                console.log(`    ${field}: [長い文字列またはその他]`);
              }
            }
          } else {
            console.log(`  その他のフィールド: なし`);
          }
          
        } catch (parseError) {
          console.log(`\n⚠️  sourcePayloadの解析に失敗: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
          console.log(`  生データ（最初の500文字）: ${work.sourcePayload.substring(0, 500)}...`);
        }
      } else {
        console.log(`\n⚠️  sourcePayloadが保存されていません`);
      }
    }

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    if (error instanceof Error) {
      console.error('   メッセージ:', error.message);
      console.error('   スタック:', error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
