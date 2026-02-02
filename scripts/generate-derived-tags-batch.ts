#!/usr/bin/env tsx
/**
 * 準有名タグ生成バッチ処理
 * 1⃣ 最新100件の作品を取得
 * 2⃣ それらのURLを取得
 * 3⃣ スクレイピングで作品コメントを取得
 * 4⃣ AIで準有名タグを生成してDBに保存
 */

import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { scrapeWorkComment } from '../src/server/scraping/fanzaScraper';
import { analyzeWithHuggingFace } from '../src/server/ai/cloudflareAi';
import { resolveTagKeyForDisplayName } from '../src/server/admin/resolveTagByDisplayName';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config();

const prisma = new PrismaClient();

/**
 * SHA1ハッシュの先頭10桁を取得
 */
function getHash10(text: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha1').update(text, 'utf8').digest('hex').substring(0, 10);
}

/**
 * tagKey を決定論的に生成（既存ロジックと同じ）
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
 * システムプロンプト（現状のまま）
 */
const SYSTEM_PROMPT = `あなたは成人向け同人誌のタグ生成AIです。
作品コメントを読み、その作品に適した「準有名タグ」を生成してください。

準有名タグとは:
- 公式タグ（OFFICIAL）には含まれていないが、作品の特徴を表すタグ
- シチュエーション、属性、関係性などを表現する
- 例: 「温泉」「学園」「年上」「年下」「先輩後輩」など

出力形式（JSON）:
{
  "derivedTags": [
    {
      "displayName": "タグ名",
      "confidence": 0.0-1.0の数値,
      "category": "カテゴリ名（例: シチュエーション、属性、関係性）"
    }
  ],
  "characterTags": ["キャラクター名1", "キャラクター名2"]
}

注意:
- derivedTagsは最大5件まで
- characterTagsは最大1件まで
- 既存の公式タグと重複しないようにする
- 作品コメントから読み取れる情報のみを使用する`;

/**
 * 1⃣ 最新100件の作品を取得
 */
async function getLatestWorks(limit: number = 100) {
  console.log(`\n[1⃣] 最新${limit}件の作品を取得中...`);
  
  const works = await prisma.work.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      workId: true,
      title: true,
      productUrl: true,
    },
  });

  console.log(`  ✅ ${works.length}件の作品を取得しました`);
  return works;
}

/**
 * 2⃣ URLを取得（既にproductUrlとして取得済み）
 */
function getUrls(works: Array<{ productUrl: string }>) {
  console.log(`\n[2⃣] URLを取得中...`);
  const urls = works.map(w => w.productUrl);
  console.log(`  ✅ ${urls.length}件のURLを取得しました`);
  return urls;
}

/**
 * 3⃣ スクレイピングで作品コメントを取得
 */
async function scrapeComments(urls: string[]) {
  console.log(`\n[3⃣] スクレイピングで作品コメントを取得中...`);
  
  const results: Array<{
    url: string;
    commentText: string | null;
    error?: string;
  }> = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`  [${i + 1}/${urls.length}] ${url}`);
    
    try {
      const data = await scrapeWorkComment(url, {
        headless: true,
        timeout: 30000,
      });

      if (data && data.commentText) {
        console.log(`    ✅ 作品コメントを取得: ${data.commentText.length}文字`);
        results.push({
          url,
          commentText: data.commentText,
        });
      } else {
        console.log(`    ⚠️  作品コメントが取得できませんでした`);
        results.push({
          url,
          commentText: null,
        });
      }

      // レート制限対策: リクエスト間に遅延
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機
      }
    } catch (error) {
      console.error(`    ❌ エラー:`, error);
      results.push({
        url,
        commentText: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const successCount = results.filter(r => r.commentText).length;
  console.log(`\n  ✅ 完了: ${successCount}/${urls.length}件の作品コメントを取得`);
  
  return results;
}

/**
 * 4⃣ AIで準有名タグを生成してDBに保存
 */
async function generateAndSaveDerivedTags(
  works: Array<{ workId: string; title: string }>,
  scrapingResults: Array<{ url: string; commentText: string | null; error?: string }>
) {
  console.log(`\n[4⃣] AIで準有名タグを生成してDBに保存中...`);

  // URLとworkIdのマッピング
  const urlToWorkId = new Map<string, string>();
  for (const work of works) {
    urlToWorkId.set(work.productUrl, work.workId);
  }

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < scrapingResults.length; i++) {
    const result = scrapingResults[i];
    const workId = urlToWorkId.get(result.url);

    if (!workId) {
      console.log(`  [${i + 1}/${scrapingResults.length}] workIdが見つかりません: ${result.url}`);
      skipCount++;
      continue;
    }

    if (!result.commentText) {
      console.log(`  [${i + 1}/${scrapingResults.length}] 作品コメントがありません: ${workId}`);
      skipCount++;
      continue;
    }

    console.log(`  [${i + 1}/${scrapingResults.length}] ${workId}: 準有名タグを生成中...`);

    try {
      // AIで準有名タグを生成
      const aiResult = await analyzeWithHuggingFace(result.commentText, SYSTEM_PROMPT);

      if (aiResult.derivedTags.length === 0) {
        console.log(`    ⚠️  準有名タグが生成されませんでした`);
        skipCount++;
        continue;
      }

      console.log(`    ✅ ${aiResult.derivedTags.length}件の準有名タグを生成`);

      // タグをDBに保存（同名の OFFICIAL/DERIVED があればその tagKey を使用）
      for (const tag of aiResult.derivedTags) {
        let finalTagKey = await resolveTagKeyForDisplayName(prisma, tag.displayName);
        if (!finalTagKey) {
          finalTagKey = generateTagKey(tag.displayName, 'DERIVED');
          await prisma.tag.upsert({
            where: { tagKey: finalTagKey },
            update: {
              displayName: tag.displayName,
              tagType: 'DERIVED',
              category: tag.category || null,
            },
            create: {
              tagKey: finalTagKey,
              displayName: tag.displayName,
              tagType: 'DERIVED',
              category: tag.category || null,
            },
          });
        }

        // WorkTagをupsert（derivedConfidenceとsourceを保存）
        await prisma.workTag.upsert({
          where: {
            workId_tagKey: {
              workId,
              tagKey: finalTagKey,
            },
          },
          update: {
            derivedConfidence: tag.confidence,
            derivedSource: tag.source || 'suggested',
          },
          create: {
            workId,
            tagKey: finalTagKey,
            derivedConfidence: tag.confidence,
            derivedSource: tag.source || 'suggested',
          },
        });
      }

      console.log(`    ✅ DBに保存完了`);
      successCount++;

      // レート制限対策: AIリクエスト間に遅延
      if (i < scrapingResults.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 3秒待機
      }
    } catch (error) {
      console.error(`    ❌ エラー:`, error);
      errorCount++;
    }
  }

  console.log(`\n  ✅ 完了:`);
  console.log(`    成功: ${successCount}件`);
  console.log(`    スキップ: ${skipCount}件`);
  console.log(`    エラー: ${errorCount}件`);
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);
  const limit = args.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '100';
  const limitNum = parseInt(limit, 10) || 100;

  console.log('🚀 準有名タグ生成バッチ処理を開始\n');
  console.log(`取得件数: ${limitNum}件\n`);

  try {
    // 1⃣ 最新100件の作品を取得
    const works = await getLatestWorks(limitNum);

    if (works.length === 0) {
      console.log('❌ 作品が見つかりませんでした');
      process.exit(1);
    }

    // 2⃣ URLを取得
    const urls = getUrls(works);

    // 3⃣ スクレイピングで作品コメントを取得
    const scrapingResults = await scrapeComments(urls);

    // 4⃣ AIで準有名タグを生成してDBに保存
    await generateAndSaveDerivedTags(works, scrapingResults);

    console.log('\n✅ バッチ処理完了！');
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
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
