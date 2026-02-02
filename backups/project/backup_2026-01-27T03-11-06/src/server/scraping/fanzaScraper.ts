/**
 * FANZA商品ページスクレイピング
 * Puppeteerを使用して年齢確認を突破し、作品コメントを取得
 */

import puppeteer, { type Browser, type Page } from 'puppeteer';

export interface ScrapedWorkData {
  productUrl: string;
  title: string | null;
  authorName: string | null;
  thumbnailUrl: string | null;
  officialTags: string[];
  commentText: string | null;
  rawText: string | null;
  cid: string | null;
}

/**
 * 文字列を正規化（tampermonkeyと同じロジック）
 */
function norm(s: unknown): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * 年齢確認を突破して商品詳細ページにアクセス
 */
async function bypassAgeGate(page: Page, productUrl: string): Promise<boolean> {
  try {
    console.log(`  [年齢確認] 商品詳細ページにアクセス: ${productUrl}`);
    await page.goto(productUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000,
    });

    // 年齢確認ページかどうかを判定
    const isAgeGate = await page.evaluate(() => {
      const title = document.title;
      const bodyText = document.body?.textContent || '';
      return title.includes('年齢認証') || 
             title.includes('年齢確認') ||
             bodyText.includes('18歳') ||
             bodyText.includes('年齢確認');
    });

    if (!isAgeGate) {
      console.log(`  [年齢確認] ✅ 年齢確認なしでアクセス成功`);
      return true;
    }

    console.log(`  [年齢確認] 年齢確認ページを検出`);

    // 年齢確認ボタンを探す
    // 複数のセレクタを試す
    const ageGateSelectors = [
      'button[type="submit"]',
      'button:has-text("はい")',
      'button:has-text("18歳以上")',
      'input[type="submit"]',
      'a[href*="age_check"]',
      '.age-check-button',
      '[data-testid="age-check"]',
    ];

    let clicked = false;
    for (const selector of ageGateSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          console.log(`  [年齢確認] ボタンを検出: ${selector}`);
          await button.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
          clicked = true;
          break;
        }
      } catch (e) {
        // 次のセレクタを試す
        continue;
      }
    }

    if (!clicked) {
      // フォールバック: ページ内の「はい」や「18歳以上」を含むボタンを探す
      const allButtons = await page.$$('button, a, input[type="submit"]');
      for (const button of allButtons) {
        const text = await page.evaluate(el => el.textContent || '', button);
        if (text.includes('はい') || text.includes('18歳以上') || text.includes('同意')) {
          console.log(`  [年齢確認] テキストでボタンを検出: ${text}`);
          await button.click();
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
          clicked = true;
          break;
        }
      }
    }

    if (!clicked) {
      console.log(`  [年齢確認] ⚠️  年齢確認ボタンが見つかりませんでした`);
      return false;
    }

    // 年齢確認を通過したか確認
    const stillAgeGate = await page.evaluate(() => {
      const title = document.title;
      return title.includes('年齢認証') || title.includes('年齢確認');
    });

    if (stillAgeGate) {
      console.log(`  [年齢確認] ❌ 年齢確認を通過できませんでした`);
      return false;
    }

    console.log(`  [年齢確認] ✅ 年齢確認を通過しました`);
    return true;
  } catch (error) {
    console.error(`  [年齢確認] エラー:`, error);
    return false;
  }
}

/**
 * 作品コメントを抽出（tampermonkeyと同じロジック）
 */
async function extractWorkData(page: Page, productUrl: string): Promise<ScrapedWorkData> {
  const result: ScrapedWorkData = {
    productUrl,
    title: null,
    authorName: null,
    thumbnailUrl: null,
    officialTags: [],
    commentText: null,
    rawText: null,
    cid: null,
  };

  try {
    // cidを抽出
    const cidMatch = productUrl.match(/\/cid=([^\/?&#]+)\//);
    result.cid = cidMatch ? cidMatch[1] : null;

    // タイトルを取得
    const titleRaw = await page.evaluate(() => {
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
      return ogTitle || document.title;
    });
    result.title = norm(titleRaw);

    // サムネイルURLを取得
    const thumbnailRaw = await page.evaluate(() => {
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      return ogImage || null;
    });
    result.thumbnailUrl = thumbnailRaw ? norm(thumbnailRaw) : null;

    // 作者名を取得
    const authorNameRaw = await page.evaluate(() => {
      const labels = ['作者', 'サークル', '著者', '作家'];
      for (const label of labels) {
        const dts = Array.from(document.querySelectorAll('dt'));
        for (const dt of dts) {
          const dtText = String(dt.textContent || '').replace(/\s+/g, ' ').trim();
          if (dtText === label) {
            const dd = dt.nextElementSibling;
            if (dd && dd.tagName.toLowerCase() === 'dd') {
              return String(dd.textContent || '').replace(/\s+/g, ' ').trim();
            }
          }
        }
      }
      return null;
    });
    result.authorName = authorNameRaw ? norm(authorNameRaw) : null;

    // 公式タグを取得
    const tagsRaw = await page.evaluate(() => {
      const labels = ['ジャンル', 'タグ'];
      const tags: string[] = [];
      
      for (const label of labels) {
        const dts = Array.from(document.querySelectorAll('dt'));
        for (const dt of dts) {
          const dtText = String(dt.textContent || '').replace(/\s+/g, ' ').trim();
          if (dtText === label) {
            const dd = dt.nextElementSibling;
            if (dd && dd.tagName.toLowerCase() === 'dd') {
              const elements = dd.querySelectorAll('a, button, span');
              for (const el of elements) {
                const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
                if (text && text.length <= 30) {
                  tags.push(text);
                }
              }
            }
          }
        }
      }
      
      // 重複を除去し、除外タグをフィルタ
      const uniqueTags = Array.from(new Set(tags));
      return uniqueTags.filter((t: string) => !['オプション', '新作', 'セール品'].includes(t));
    });
    result.officialTags = tagsRaw;

    // rawTextを抽出（tampermonkeyと同じロジック）
    const rawParts: string[] = [];

    // dt/ddテキスト
    const dtDdText = await page.evaluate(() => {
      const parts: string[] = [];
      const dts = Array.from(document.querySelectorAll('dt'));
      for (const dt of dts) {
        const dd = dt.nextElementSibling;
        if (!dd || dd.tagName.toLowerCase() !== 'dd') continue;
        const k = String(dt.textContent || '').replace(/\s+/g, ' ').trim();
        const v = String(dd.textContent || '').replace(/\s+/g, ' ').trim();
        if (!k || !v) continue;
        parts.push(`${k}: ${v}`);
      }
      return parts;
    });
    rawParts.push(...dtDdText);

    // description的なブロック
    const descSelectors = [
      '[itemprop="description"]',
      '#detail',
      '.summary',
      '.mg-b20',
      '.dcd-productDetail__text',
    ];

    for (const selector of descSelectors) {
      const text = await page.evaluate((sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const t = String(el.textContent || '').replace(/\s+/g, ' ').trim();
        return t && t.length >= 20 ? t : null;
      }, selector);

      if (text) {
        rawParts.push(text);
      }
    }

    result.rawText = rawParts.join('\n');
    const RAW_TEXT_MAX = 30000;
    if (result.rawText.length > RAW_TEXT_MAX) {
      result.rawText = result.rawText.slice(0, RAW_TEXT_MAX);
    }

    // 作品コメントを抽出（rawTextから「作品コメント」以降を取得）
    if (result.rawText) {
      const marker = '作品コメント';
      const idx = result.rawText.indexOf(marker);
      if (idx !== -1) {
        result.commentText = result.rawText.slice(idx).trim();
      }
    }

  } catch (error) {
    console.error(`  [抽出] エラー:`, error);
  }

  return result;
}

/**
 * 単一の商品ページから作品コメントを取得
 */
export async function scrapeWorkComment(
  productUrl: string,
  options: {
    headless?: boolean;
    timeout?: number;
  } = {}
): Promise<ScrapedWorkData | null> {
  const { headless = true, timeout = 30000 } = options;

  let browser: Browser | null = null;
  try {
    console.log(`[スクレイピング] 開始: ${productUrl}`);

    browser = await puppeteer.launch({
      headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // User-Agentを設定
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // 年齢確認を突破
    const ageGatePassed = await bypassAgeGate(page, productUrl);
    if (!ageGatePassed) {
      console.log(`[スクレイピング] ❌ 年齢確認を突破できませんでした`);
      return null;
    }

    // 作品データを抽出
    const data = await extractWorkData(page, productUrl);

    if (!data.commentText && !data.rawText) {
      console.log(`[スクレイピング] ⚠️  作品コメントが取得できませんでした`);
    } else {
      console.log(`[スクレイピング] ✅ 成功: タイトル=${data.title}, コメント長=${data.commentText?.length || 0}`);
    }

    return data;
  } catch (error) {
    console.error(`[スクレイピング] エラー:`, error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * 複数の商品ページから作品コメントを取得（バッチ処理）
 */
export async function scrapeWorkComments(
  productUrls: string[],
  options: {
    headless?: boolean;
    timeout?: number;
    concurrency?: number; // 並列処理数（デフォルト: 1）
  } = {}
): Promise<Array<{ url: string; data: ScrapedWorkData | null; error?: string }>> {
  const { concurrency = 1 } = options;
  const results: Array<{ url: string; data: ScrapedWorkData | null; error?: string }> = [];

  // 並列処理数が1の場合は順次処理
  if (concurrency === 1) {
    for (const url of productUrls) {
      try {
        const data = await scrapeWorkComment(url, options);
        results.push({ url, data });
        // レート制限対策: リクエスト間に遅延
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        results.push({
          url,
          data: null,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return results;
  }

  // 並列処理（複数のブラウザインスタンスを使用）
  // 注意: リソース消費が大きいため、concurrencyは小さく設定することを推奨
  const chunks: string[][] = [];
  for (let i = 0; i < productUrls.length; i += concurrency) {
    chunks.push(productUrls.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const promises = chunk.map(async (url) => {
      try {
        const data = await scrapeWorkComment(url, options);
        return { url, data };
      } catch (error) {
        return {
          url,
          data: null,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults);

    // チャンク間の遅延
    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  return results;
}
