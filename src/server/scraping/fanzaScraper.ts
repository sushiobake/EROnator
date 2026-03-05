/**
 * FANZA商品ページスクレイピング
 * Puppeteerを使用して年齢確認を突破し、作品コメントを取得
 * ブラウザプール管理で起動コストを削減
 */

import fs from 'fs';
import path from 'path';
import puppeteer, { type Browser, type Page } from 'puppeteer';

/** 失敗時スクリーンショット保存先 */
const DEBUG_SCREENSHOT_DIR = path.join(process.cwd(), 'data', 'debug-screenshots');

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-accelerated-2d-canvas',
  '--disable-gpu',
  '--disable-extensions',
  '--disable-background-networking',
  '--disable-default-apps',
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// --- Browser Pool ---
let _poolBrowser: Browser | null = null;
let _poolRefCount = 0;
let _poolCloseTimer: ReturnType<typeof setTimeout> | null = null;
const POOL_IDLE_TIMEOUT_MS = 60_000;

async function acquireBrowser(headless: boolean): Promise<Browser> {
  if (_poolCloseTimer) { clearTimeout(_poolCloseTimer); _poolCloseTimer = null; }

  if (_poolBrowser && _poolBrowser.connected) {
    _poolRefCount++;
    return _poolBrowser;
  }

  _poolBrowser = await puppeteer.launch({ headless, args: BROWSER_ARGS });
  _poolRefCount = 1;
  return _poolBrowser;
}

function releaseBrowser(): void {
  _poolRefCount = Math.max(0, _poolRefCount - 1);
  if (_poolRefCount === 0 && _poolBrowser) {
    if (_poolCloseTimer) clearTimeout(_poolCloseTimer);
    _poolCloseTimer = setTimeout(async () => {
      if (_poolRefCount === 0 && _poolBrowser) {
        try { await _poolBrowser.close(); } catch { /* */ }
        _poolBrowser = null;
      }
    }, POOL_IDLE_TIMEOUT_MS);
  }
}

async function saveScreenshotOnFail(
  page: Page | null,
  productUrl: string,
  reason: string
): Promise<void> {
  if (!page) return;
  try {
    fs.mkdirSync(DEBUG_SCREENSHOT_DIR, { recursive: true });
    const cid = productUrl.match(/cid=([^/?#]+)/)?.[1] ?? 'unknown';
    const safeReason = reason.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const filename = `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}_${cid}_${safeReason}.png`;
    const filepath = path.join(DEBUG_SCREENSHOT_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    console.error(`  [スクレイピング] 失敗時スクリーンショット保存: ${filepath}`);
  } catch (e) {
    console.error(`  [スクレイピング] スクリーンショット保存失敗:`, e);
  }
}

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
  commentSkippedReason?: 'too_short' | 'not_found';
}

function norm(s: unknown): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

async function bypassAgeGate(page: Page, productUrl: string): Promise<boolean> {
  try {
    await page.goto(productUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    const isAgeGate = await page.evaluate(() => {
      const title = document.title;
      const bodyText = document.body?.textContent || '';
      return title.includes('年齢認証') || 
             title.includes('年齢確認') ||
             bodyText.includes('18歳') ||
             bodyText.includes('年齢確認');
    });

    if (!isAgeGate) return true;

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
          await button.click();
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 });
          clicked = true;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!clicked) {
      const allButtons = await page.$$('button, a, input[type="submit"]');
      for (const button of allButtons) {
        const text = await page.evaluate(el => el.textContent || '', button);
        if (text.includes('はい') || text.includes('18歳以上') || text.includes('同意')) {
          await button.click();
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 });
          clicked = true;
          break;
        }
      }
    }

    if (!clicked) return false;

    const stillAgeGate = await page.evaluate(() => {
      const title = document.title;
      return title.includes('年齢認証') || title.includes('年齢確認');
    });

    if (stillAgeGate) return false;
    return true;
  } catch (error) {
    console.error(`  [年齢確認] エラー:`, error);
    return false;
  }
}

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
    const cidMatch = productUrl.match(/\/cid=([^\/?&#]+)\//);
    result.cid = cidMatch ? cidMatch[1] : null;

    const titleRaw = await page.evaluate(() => {
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
      return ogTitle || document.title;
    });
    result.title = norm(titleRaw);

    const thumbnailRaw = await page.evaluate(() => {
      const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
      return ogImage || null;
    });
    result.thumbnailUrl = thumbnailRaw ? norm(thumbnailRaw) : null;

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
      
      const uniqueTags = Array.from(new Set(tags));
      return uniqueTags.filter((t: string) => !['オプション', '新作', 'セール品'].includes(t));
    });
    result.officialTags = tagsRaw;

    const rawParts: string[] = [];

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

    const descSelectors = [
      '[itemprop="description"]',
      '#detail',
      '.summary',
      '.mg-b20',
      '.dcd-productDetail__text',
    ];

    const DESC_MIN_LENGTH = 5;
    for (const selector of descSelectors) {
      const text = await page.evaluate((sel: string) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const t = String(el.textContent || '').replace(/\s+/g, ' ').trim();
        return t || null;
      }, selector);

      if (text) {
        if (text.length < DESC_MIN_LENGTH) {
          result.commentSkippedReason = 'too_short';
          continue;
        }
        rawParts.push(text);
      }
    }

    result.rawText = rawParts.join('\n');
    const RAW_TEXT_MAX = 30000;
    if (result.rawText.length > RAW_TEXT_MAX) {
      result.rawText = result.rawText.slice(0, RAW_TEXT_MAX);
    }

    if (result.rawText) {
      const marker = '作品コメント';
      const idx = result.rawText.indexOf(marker);
      if (idx !== -1) {
        result.commentText = result.rawText.slice(idx).trim();
      } else if (!result.commentSkippedReason) {
        result.commentSkippedReason = 'not_found';
      }
    } else if (!result.commentSkippedReason) {
      result.commentSkippedReason = 'not_found';
    }

    const reviewInfo = await page.evaluate(() => {
      const reviewText = document.body?.textContent || '';
      
      let reviewCount: number | null = null;
      const reviewCountMatch = reviewText.match(/レビュー[数:]?\s*(\d+)\s*件/);
      if (reviewCountMatch) {
        reviewCount = parseInt(reviewCountMatch[1], 10);
      }
      if (!reviewCount) {
        const reviewCountMatch2 = reviewText.match(/レビュー[（(]\s*(\d+)\s*[）)]/);
        if (reviewCountMatch2) {
          reviewCount = parseInt(reviewCountMatch2[1], 10);
        }
      }
      
      let reviewAverage: number | null = null;
      
      const avgSelectors = [
        '.d-reviewstars__average', '.review-average', '.rating-average',
        '[class*="reviewstars"] [class*="average"]', '[class*="review"] [class*="average"]',
        '[data-average]', '[data-rating]',
      ];
      for (const sel of avgSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const dataAvg = el.getAttribute('data-average') || el.getAttribute('data-rating');
          if (dataAvg) { const p = parseFloat(dataAvg); if (!isNaN(p) && p > 0 && p <= 5) { reviewAverage = p; break; } }
          const text = String(el.textContent || '').trim();
          const match = text.match(/(\d+\.?\d*)/);
          if (match) { const p = parseFloat(match[1]); if (!isNaN(p) && p > 0 && p <= 5) { reviewAverage = p; break; } }
        }
      }
      
      if (!reviewAverage) {
        const m = reviewText.match(/(?:平均|評価)[:：]\s*(\d+\.?\d*)/);
        if (m) { const p = parseFloat(m[1]); if (!isNaN(p) && p > 0 && p <= 5) reviewAverage = p; }
      }
      if (!reviewAverage) {
        const m = reviewText.match(/[★☆]\s*(\d+\.?\d*)/);
        if (m) { const p = parseFloat(m[1]); if (!isNaN(p) && p > 0 && p <= 5) reviewAverage = p; }
      }
      if (!reviewAverage) {
        const dts = Array.from(document.querySelectorAll('dt'));
        for (const dt of dts) {
          const dtText = String(dt.textContent || '').replace(/\s+/g, ' ').trim();
          if (dtText === '評価' || dtText === '平均' || dtText === 'レビュー平均') {
            const dd = dt.nextElementSibling;
            if (dd && dd.tagName.toLowerCase() === 'dd') {
              const m = String(dd.textContent || '').trim().match(/(\d+\.?\d*)/);
              if (m) { const p = parseFloat(m[1]); if (!isNaN(p) && p > 0 && p <= 5) { reviewAverage = p; break; } }
            }
          }
        }
      }
      if (!reviewAverage) {
        const m = reviewText.match(/(\d+\.?\d*)\s*\/\s*5/);
        if (m) { const p = parseFloat(m[1]); if (!isNaN(p) && p > 0 && p <= 5) reviewAverage = p; }
      }
      if (!reviewAverage) {
        const m = reviewText.match(/(\d+\.?\d*)\s*点/);
        if (m) { const p = parseFloat(m[1]); if (!isNaN(p) && p > 0 && p <= 5) reviewAverage = p; }
      }
      if (!reviewAverage && reviewCount) {
        const reviewElements = document.querySelectorAll('[class*="review"], [id*="review"]');
        for (const el of reviewElements) {
          const text = String(el.textContent || '');
          const matches = text.match(/\b([1-5]\.\d{1,2})\b/g);
          if (matches) {
            for (const m of matches) {
              const p = parseFloat(m);
              if (!isNaN(p) && p >= 1 && p <= 5) { reviewAverage = p; break; }
            }
            if (reviewAverage) break;
          }
        }
      }
      
      return { reviewCount, reviewAverage };
    });
    result.reviewCount = reviewInfo.reviewCount;
    result.reviewAverage = reviewInfo.reviewAverage;

    const categoryLabel = await page.evaluate(() => {
      const selectors = [
        '.dcd-productDetail__category', '.product-category', '.category-label',
        '.genre-label', '[class*="category"]', '[class*="genre"]',
        'h1 + .category', '.dcd-productDetail__title + *',
      ];
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = String(el.textContent || '').trim();
          if (text.includes('コミック')) return text;
        }
      }
      const titleEl = document.querySelector('h1, .dcd-productDetail__title, [itemprop="name"]');
      if (titleEl) {
        const parent = titleEl.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children);
          for (const sibling of siblings) {
            const text = String(sibling.textContent || '').trim();
            if (text.includes('コミック')) return text;
          }
        }
      }
      return null;
    });
    
    if (categoryLabel) {
      if (categoryLabel.includes('コミック・AI') || categoryLabel.includes('コミック・ AI')) {
        result.isAi = 'AI';
      } else if (categoryLabel.includes('コミック')) {
        result.isAi = 'HAND';
      } else {
        result.isAi = 'UNKNOWN';
      }
    } else {
      if (result.rawText) {
        const aiKeywords = ['AI', '人工知能', '機械学習', 'AI生成', 'AIイラスト', 'AI作品'];
        const rawTextLower = result.rawText.toLowerCase();
        const hasAiKeyword = aiKeywords.some(keyword => rawTextLower.includes(keyword.toLowerCase()));
        const hasAiTag = result.officialTags.some(tag => aiKeywords.some(keyword => tag.toLowerCase().includes(keyword.toLowerCase())));
        result.isAi = (hasAiKeyword || hasAiTag) ? 'AI' : 'UNKNOWN';
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
 * 単一の商品ページから作品コメントを取得（ブラウザプール使用）
 */
export async function scrapeWorkComment(
  productUrl: string,
  options: {
    headless?: boolean;
    timeout?: number;
    visible?: boolean;
    screenshotOnFail?: boolean;
  } = {}
): Promise<ScrapedWorkData | null> {
  const envVisible = process.env.SCRAPE_VISIBLE === '1' || process.env.SCRAPE_DEBUG === '1';
  const envScreenshot = process.env.SCRAPE_SCREENSHOT_ON_FAIL === '1' || envVisible;

  const headless = options.visible || envVisible ? false : (options.headless ?? true);
  const screenshotOnFail = options.screenshotOnFail ?? envScreenshot;

  let page: Page | null = null;
  try {
    const browser = await acquireBrowser(headless);
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent(UA);

    const ageGatePassed = await bypassAgeGate(page, productUrl);
    if (!ageGatePassed) {
      if (screenshotOnFail) await saveScreenshotOnFail(page, productUrl, 'age_gate_failed');
      return null;
    }

    try {
      await page.waitForSelector('dt, dd, [itemprop="description"]', { timeout: 8000 });
    } catch {
      // 要素が見つからなくても抽出を試行
    }

    const data = await extractWorkData(page, productUrl);

    if (!data?.commentText && screenshotOnFail) {
      await saveScreenshotOnFail(page, productUrl, 'comment_extract_failed');
    }

    return data;
  } catch (error) {
    console.error(`[スクレイピング] エラー:`, error);
    if (screenshotOnFail && page) {
      await saveScreenshotOnFail(page, productUrl, 'exception');
    }
    return null;
  } finally {
    if (page) {
      try { await page.close(); } catch { /* */ }
    }
    releaseBrowser();
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
    concurrency?: number;
  } = {}
): Promise<Array<{ url: string; data: ScrapedWorkData | null; error?: string }>> {
  const { concurrency = 1 } = options;
  const results: Array<{ url: string; data: ScrapedWorkData | null; error?: string }> = [];

  if (concurrency === 1) {
    for (const url of productUrls) {
      try {
        const data = await scrapeWorkComment(url, options);
        results.push({ url, data });
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

    if (chunks.indexOf(chunk) < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }

  return results;
}
