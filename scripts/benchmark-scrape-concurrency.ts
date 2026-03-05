#!/usr/bin/env tsx
/**
 * コメント取得の並列数ベンチマーク
 * 原因調査・最適値探索用。複数の並列数で同一作品をスクレイピングし、成功数・失敗数・所要時間を比較する。
 *
 * 使い方:
 *   npm run benchmark:scrape                    # 並列 1,2,4,6,8 を順にテスト
 *   npm run benchmark:scrape -- --concurrency 4 # 並列4のみテスト
 *   npm run benchmark:scrape -- --count 8       # 8件でテスト（デフォルト）
 *   npm run benchmark:scrape -- --delay 60      # 各レベル間で60秒待機（レート制限対策）
 */

import pLimit from 'p-limit';
import { PrismaClient } from '@prisma/client';
import { scrapeWorkComment } from '../src/server/scraping/fanzaScraper';

const prisma = new PrismaClient();

interface BenchmarkResult {
  concurrency: number;
  success: number;
  failed: number;
  elapsedMs: number;
  errors: string[];
}

async function runBenchmark(
  urls: string[],
  concurrency: number,
  visible: boolean
): Promise<BenchmarkResult> {
  const limit = pLimit(concurrency);
  const errors: string[] = [];
  let success = 0;
  let failed = 0;

  const start = Date.now();
  await Promise.all(
    urls.map((url) =>
      limit(async () => {
        try {
          const data = await scrapeWorkComment(url, {
            headless: !visible,
            timeout: 30000,
            visible,
            screenshotOnFail: visible,
          });
          if (data?.commentText) {
            success++;
          } else {
            failed++;
            errors.push(`${url}: コメントなし`);
          }
        } catch (err) {
          failed++;
          const msg = err instanceof Error ? err.message : String(err);
          const short = msg.length > 80 ? msg.slice(0, 77) + '...' : msg;
          errors.push(`${url}: ${short}`);
        }
      })
    )
  );
  const elapsedMs = Date.now() - start;

  return { concurrency, success, failed, elapsedMs, errors };
}

function parseArgs(): {
  concurrency: number[];
  count: number;
  delaySec: number;
} {
  const args = process.argv.slice(2);
  let concurrency: number[] = [1, 2, 4, 6, 8];
  let count = 8;
  let delaySec = 30;
  const visible = args.includes('--visible');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--concurrency' && args[i + 1]) {
      concurrency = args[i + 1]
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n >= 1);
      i++;
    } else if (args[i] === '--count' && args[i + 1]) {
      count = Math.max(1, parseInt(args[i + 1], 10) || 8);
      i++;
    } else if (args[i] === '--delay' && args[i + 1]) {
      delaySec = Math.max(0, parseInt(args[i + 1], 10) || 30);
      i++;
    }
  }

  return { concurrency, count, delaySec, visible };
}

async function main() {
  const { concurrency, count, delaySec, visible } = parseArgs();

  console.log('📊 コメント取得 並列数ベンチマーク\n');
  console.log(`  テスト件数: ${count}件`);
  console.log(`  並列レベル: ${concurrency.join(', ')}`);
  console.log(`  レベル間待機: ${delaySec}秒`);
  if (visible) console.log('  👁 可視化モード: ブラウザ表示＋失敗時スクリーンショット');
  console.log('');

  let rows = await prisma.work.findMany({
    where: { commentText: null },
    select: { productUrl: true },
    orderBy: { createdAt: 'desc' },
    take: count,
  });

  if (rows.length === 0) {
    rows = await prisma.work.findMany({
      select: { productUrl: true },
      orderBy: { createdAt: 'desc' },
      take: count,
    });
    if (rows.length > 0) {
      console.log('⚠ コメント未取得作品がないため、既存作品のURLでテストします（DBは更新しません）。\n');
    }
  }

  let urls = rows.map((r) => r.productUrl).filter(Boolean);
  if (urls.length === 0) {
    console.log('⚠ DBに作品がないため、固定のテストURLでベンチマークします。\n');
    urls = [
      'https://www.dmm.co.jp/dc/doujin/-/detail/=/cid=d_719191/',
      'https://www.dmm.co.jp/dc/doujin/-/detail/=/cid=d_096970/',
      'https://www.dmm.co.jp/dc/doujin/-/detail/=/cid=d_114078/',
    ].slice(0, Math.min(count, 3));
  }
  if (urls.length < count) {
    console.log(`⚠ 指定${count}件に対し、${urls.length}件のみ取得しました。\n`);
  }

  const results: BenchmarkResult[] = [];

  for (let i = 0; i < concurrency.length; i++) {
    const c = concurrency[i];
    console.log(`⏳ 並列${c} をテスト中...`);
    const r = await runBenchmark(urls, c, visible);
    results.push(r);
    console.log(
      `   成功: ${r.success} / 失敗: ${r.failed} / ${(r.elapsedMs / 1000).toFixed(1)}秒`
    );
    if (r.errors.length > 0) {
      r.errors.slice(0, 3).forEach((e) => console.log(`   └ ${e}`));
      if (r.errors.length > 3) {
        console.log(`   └ ... 他${r.errors.length - 3}件`);
      }
    }

    if (i < concurrency.length - 1 && delaySec > 0) {
      console.log(`   次のレベルまで ${delaySec}秒 待機...`);
      await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log('📋 結果サマリ');
  console.log('─'.repeat(70));
  console.log(
    '並列数  成功  失敗  所要時間(秒)  1件あたり(秒)  成功率'
  );
  for (const r of results) {
    const avg = r.success + r.failed > 0 ? r.elapsedMs / (r.success + r.failed) / 1000 : 0;
    const rate =
      r.success + r.failed > 0
        ? ((r.success / (r.success + r.failed)) * 100).toFixed(1)
        : '-';
    console.log(
      `${String(r.concurrency).padStart(6)}  ${String(r.success).padStart(4)}  ${String(r.failed).padStart(4)}  ${String((r.elapsedMs / 1000).toFixed(1)).padStart(10)}  ${String(avg.toFixed(1)).padStart(12)}  ${String(rate + '%').padStart(6)}`
    );
  }
  console.log('─'.repeat(70));

  const best = results.reduce((a, b) =>
    a.failed < b.failed
      ? a
      : a.failed === b.failed && a.elapsedMs < b.elapsedMs
        ? a
        : b
  );
  console.log(
    `\n💡 推奨: 並列${best.concurrency}（失敗${best.failed}件、${(best.elapsedMs / 1000).toFixed(1)}秒）`
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
