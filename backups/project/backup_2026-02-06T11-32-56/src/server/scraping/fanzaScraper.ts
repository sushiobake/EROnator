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
  reviewCount: number | null;
  reviewAverage: number | null;
  isAi: 'AI' | 'HAND' | 'UNKNOWN' | null;
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
    reviewCount: null,
    reviewAverage: null,
    isAi: null,
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

    // レビュー情報を抽出
    const reviewInfo = await page.evaluate(() => {
      // レビュー数と平均点を取得
      // FANZAのページ構造に基づいてセレクタを調整
      const reviewText = document.body?.textContent || '';
      
      // レビュー数のパターン: "レビュー: 123件" や "レビュー数: 123" や "(123)"
      let reviewCount: number | null = null;
      const reviewCountMatch = reviewText.match(/レビュー[数:]?\s*(\d+)\s*件/);
      if (reviewCountMatch) {
        reviewCount = parseInt(reviewCountMatch[1], 10);
      }
      // パターン2: "レビュー（14）" や "レビュー(14)" 形式
      if (!reviewCount) {
        const reviewCountMatch2 = reviewText.match(/レビュー[（(]\s*(\d+)\s*[）)]/);
        if (reviewCountMatch2) {
          reviewCount = parseInt(reviewCountMatch2[1], 10);
        }
      }
      
      // レビュー平均のパターン（複数のパターンを試す）
      let reviewAverage: number | null = null;
      
      // パターン0: FANZAの専用セレクタを探す（優先度高）
      // d-reviewstars__average, review-average, rating-average など
      const avgSelectors = [
        '.d-reviewstars__average',
        '.review-average',
        '.rating-average',
        '[class*="reviewstars"] [class*="average"]',
        '[class*="review"] [class*="average"]',
        '[data-average]',
        '[data-rating]',
      ];
      for (const sel of avgSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          // data属性をチェック
          const dataAvg = el.getAttribute('data-average') || el.getAttribute('data-rating');
          if (dataAvg) {
            const parsed = parseFloat(dataAvg);
            if (!isNaN(parsed) && parsed > 0 && parsed <= 5) {
              reviewAverage = parsed;
              break;
            }
          }
          // テキストコンテンツをチェック
          const text = String(el.textContent || '').trim();
          const match = text.match(/(\d+\.?\d*)/);
          if (match) {
            const parsed = parseFloat(match[1]);
            if (!isNaN(parsed) && parsed > 0 && parsed <= 5) {
              reviewAverage = parsed;
              break;
            }
          }
        }
      }
      
      // パターン1: テキストから直接検索 "平均: 4.5" や "評価: 4.5"
      if (!reviewAverage) {
        const avgMatch1 = reviewText.match(/(?:平均|評価)[:：]\s*(\d+\.?\d*)/);
        if (avgMatch1) {
          const parsed = parseFloat(avgMatch1[1]);
          if (!isNaN(parsed) && parsed > 0 && parsed <= 5) {
            reviewAverage = parsed;
          }
        }
      }
      
      // パターン2: 星マークの後 "★4.5" や "☆4.5"
      if (!reviewAverage) {
        const avgMatch2 = reviewText.match(/[★☆]\s*(\d+\.?\d*)/);
        if (avgMatch2) {
          const parsed = parseFloat(avgMatch2[1]);
          if (!isNaN(parsed) && parsed > 0 && parsed <= 5) {
            reviewAverage = parsed;
          }
        }
      }
      
      // パターン3: dt/dd形式で「評価」や「平均」を探す
      if (!reviewAverage) {
        const dts = Array.from(document.querySelectorAll('dt'));
        for (const dt of dts) {
          const dtText = String(dt.textContent || '').replace(/\s+/g, ' ').trim();
          if (dtText === '評価' || dtText === '平均' || dtText === 'レビュー平均') {
            const dd = dt.nextElementSibling;
            if (dd && dd.tagName.toLowerCase() === 'dd') {
              const ddText = String(dd.textContent || '').replace(/\s+/g, ' ').trim();
              const avgMatch = ddText.match(/(\d+\.?\d*)/);
              if (avgMatch) {
                const parsed = parseFloat(avgMatch[1]);
                if (!isNaN(parsed) && parsed > 0 && parsed <= 5) {
                  reviewAverage = parsed;
                  break;
                }
              }
            }
          }
        }
      }
      
      // パターン4: 数値/5形式（例: "4.5/5"）
      if (!reviewAverage) {
        const avgMatch4 = reviewText.match(/(\d+\.?\d*)\s*\/\s*5/);
        if (avgMatch4) {
          const parsed = parseFloat(avgMatch4[1]);
          if (!isNaN(parsed) && parsed > 0 && parsed <= 5) {
            reviewAverage = parsed;
          }
        }
      }
      
      // パターン5: "4.50点" や "4.5点" 形式
      if (!reviewAverage) {
        const avgMatch5 = reviewText.match(/(\d+\.?\d*)\s*点/);
        if (avgMatch5) {
          const parsed = parseFloat(avgMatch5[1]);
          if (!isNaN(parsed) && parsed > 0 && parsed <= 5) {
            reviewAverage = parsed;
          }
        }
      }
      
      // パターン6: レビューセクション内の数値（例: "4.50"が単独で表示）
      // レビュー数の近くにある4.xx形式の数値を探す
      if (!reviewAverage && reviewCount) {
        // レビュー関連の要素を探す
        const reviewElements = document.querySelectorAll('[class*="review"], [id*="review"]');
        for (const el of reviewElements) {
          const text = String(el.textContent || '');
          // 4.xx形式（レビュー平均は通常1.00-5.00）
          const matches = text.match(/\b([1-5]\.\d{1,2})\b/g);
          if (matches) {
            for (const m of matches) {
              const parsed = parseFloat(m);
              if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
                reviewAverage = parsed;
                break;
              }
            }
            if (reviewAverage) break;
          }
        }
      }
      
      return { reviewCount, reviewAverage };
    });
    result.reviewCount = reviewInfo.reviewCount;
    result.reviewAverage = reviewInfo.reviewAverage;
    
    // デバッグログ
    console.log(`  [レビュー情報] reviewCount=${reviewInfo.reviewCount}, reviewAverage=${reviewInfo.reviewAverage}`);
    if (reviewInfo.reviewCount === null && reviewInfo.reviewAverage === null) {
      console.log('  [レビュー情報] 警告: レビュー情報を取得できませんでした');
    }

    // isAiを判定（タイトルの左上のカテゴリラベルから）
    // FANZAでは「コミック」または「コミック・AI」という表記がある
    const categoryLabel = await page.evaluate(() => {
      // タイトルの近くのカテゴリラベルを探す
      // 複数のセレクタを試す
      const selectors = [
        '.dcd-productDetail__category',
        '.product-category',
        '.category-label',
        '.genre-label',
        '[class*="category"]',
        '[class*="genre"]',
        'h1 + .category',
        '.dcd-productDetail__title + *',
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = String(el.textContent || '').trim();
          // 「コミック・AI」または「コミック」を含むテキストを探す
          if (text.includes('コミック')) {
            return text;
          }
        }
      }
      
      // フォールバック: タイトル周辺のテキストから探す
      const titleEl = document.querySelector('h1, .dcd-productDetail__title, [itemprop="name"]');
      if (titleEl) {
        const parent = titleEl.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children);
          for (const sibling of siblings) {
            const text = String(sibling.textContent || '').trim();
            if (text.includes('コミック')) {
              return text;
            }
          }
        }
      }
      
      return null;
    });
    
    if (categoryLabel) {
      // 「コミック・AI」を含む場合はAI、「コミック」のみの場合は手書き
      if (categoryLabel.includes('コミック・AI') || categoryLabel.includes('コミック・ AI')) {
        result.isAi = 'AI';
      } else if (categoryLabel.includes('コミック')) {
        result.isAi = 'HAND';
      } else {
        result.isAi = 'UNKNOWN';
      }
    } else {
      // カテゴリラベルが見つからない場合は、rawTextから判定（フォールバック）
      if (result.rawText) {
        const aiKeywords = ['AI', '人工知能', '機械学習', 'AI生成', 'AIイラスト', 'AI作品'];
        const rawTextLower = result.rawText.toLowerCase();
        const hasAiKeyword = aiKeywords.some(keyword => 
          rawTextLower.includes(keyword.toLowerCase())
        );
        
        const hasAiTag = result.officialTags.some(tag => 
          aiKeywords.some(keyword => tag.toLowerCase().includes(keyword.toLowerCase()))
        );
        
        if (hasAiKeyword || hasAiTag) {
          result.isAi = 'AI';
        } else {
          result.isAi = 'UNKNOWN';
        }
      } else {
        result.isAi = 'UNKNOWN';
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
