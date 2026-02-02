#!/usr/bin/env tsx
/**
 * FANZA年齢確認ページの突破テスト
 * サーバー側で年齢確認を通過して商品詳細ページにアクセスできるか確認
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config();

/**
 * 年齢確認を通過して商品詳細ページにアクセス
 */
async function fetchFanzaPageWithAgeGate(productUrl: string): Promise<{
  success: boolean;
  html: string | null;
  error?: string;
  cookies?: string[];
}> {
  // Cookieを保存するためのMap
  const cookieJar = new Map<string, string>();

  try {
    // Step 1: 商品詳細ページにアクセス（年齢確認ページにリダイレクトされる可能性）
    console.log(`[Step 1] 商品詳細ページにアクセス: ${productUrl}`);
    const firstResponse = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Referer': 'https://www.dmm.co.jp/',
      },
      redirect: 'manual', // リダイレクトを手動で処理
    });

    // Cookieを保存
    const setCookieHeaders = firstResponse.headers.getSetCookie();
    for (const cookie of setCookieHeaders) {
      const [nameValue] = cookie.split(';');
      const [name, value] = nameValue.split('=');
      if (name && value) {
        cookieJar.set(name.trim(), value.trim());
      }
    }

    console.log(`[Step 1] Status: ${firstResponse.status}`);
    console.log(`[Step 1] Cookies: ${Array.from(cookieJar.keys()).join(', ')}`);

    // 年齢確認ページかどうかを判定
    const html = await firstResponse.text();
    const isAgeGatePage = html.includes('18歳') || 
                          html.includes('年齢確認') || 
                          html.includes('age_check') ||
                          html.includes('ageCheck') ||
                          firstResponse.url.includes('age_check');

    if (isAgeGatePage || firstResponse.status === 302 || firstResponse.status === 301) {
      console.log(`[Step 2] 年齢確認ページを検出`);

      // 年齢確認ページのURLを取得
      const ageGateUrl = firstResponse.headers.get('location') || firstResponse.url;
      console.log(`[Step 2] 年齢確認ページURL: ${ageGateUrl}`);

      // 年齢確認フォームを送信
      // FANZAの年齢確認は通常、POSTリクエストで処理される
      // 年齢確認ページのHTMLを解析してフォームのactionとパラメータを取得
      
      // 方法1: POSTリクエストで年齢確認を通過
      // 年齢確認ページのHTMLからフォーム情報を抽出
      const formMatch = html.match(/<form[^>]*action="([^"]*)"[^>]*>/i);
      const formAction = formMatch ? formMatch[1] : ageGateUrl;
      
      // フォームのhiddenフィールドを抽出
      const hiddenInputs = html.match(/<input[^>]*type="hidden"[^>]*>/gi) || [];
      const formData = new URLSearchParams();
      for (const input of hiddenInputs) {
        const nameMatch = input.match(/name="([^"]*)"/i);
        const valueMatch = input.match(/value="([^"]*)"/i);
        if (nameMatch && valueMatch) {
          formData.append(nameMatch[1], valueMatch[1]);
        }
      }
      
      // 年齢確認ボタンのパラメータ（通常は「はい」ボタン）
      formData.append('age_check', '1');
      formData.append('age_check_done', '1');

      console.log(`[Step 3] 年齢確認フォームを送信: ${formAction}`);
      console.log(`[Step 3] フォームデータ: ${formData.toString()}`);
      
      const ageGateResponse = await fetch(formAction, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': ageGateUrl,
          'Cookie': Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; '),
        },
        body: formData.toString(),
        redirect: 'follow',
      });

      // Cookieを更新
      const newSetCookieHeaders = ageGateResponse.headers.getSetCookie();
      for (const cookie of newSetCookieHeaders) {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        if (name && value) {
          cookieJar.set(name.trim(), value.trim());
        }
      }

      console.log(`[Step 3] Status: ${ageGateResponse.status}`);
      console.log(`[Step 3] Final URL: ${ageGateResponse.url}`);
      console.log(`[Step 3] Cookies: ${Array.from(cookieJar.keys()).join(', ')}`);

      // Step 4: 再度商品詳細ページにアクセス（Cookie付き）
      console.log(`[Step 4] 商品詳細ページに再アクセス（Cookie付き）`);
      const finalResponse = await fetch(productUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          'Referer': 'https://www.dmm.co.jp/',
          'Cookie': Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; '),
        },
        redirect: 'follow',
      });

      const finalHtml = await finalResponse.text();
      const isProductPage = finalHtml.includes('作品コメント') || 
                           finalHtml.includes('商品詳細') ||
                           finalHtml.includes('dcd-productDetail');

      if (isProductPage) {
        console.log(`[Step 4] ✅ 商品詳細ページの取得に成功`);
        return {
          success: true,
          html: finalHtml,
          cookies: Array.from(cookieJar.keys()),
        };
      } else {
        console.log(`[Step 4] ❌ 商品詳細ページの取得に失敗（年齢確認ページのまま）`);
        return {
          success: false,
          html: finalHtml,
          error: '年齢確認を通過できませんでした',
          cookies: Array.from(cookieJar.keys()),
        };
      }
    } else {
      // 年齢確認ページではない場合（既に通過済み、または年齢確認が不要）
      console.log(`[Step 1] ✅ 年齢確認なしで商品詳細ページにアクセス成功`);
      return {
        success: true,
        html,
        cookies: Array.from(cookieJar.keys()),
      };
    }
  } catch (error) {
    console.error(`[Error] エラーが発生しました:`, error);
    return {
      success: false,
      html: null,
      error: error instanceof Error ? error.message : String(error),
      cookies: Array.from(cookieJar.keys()),
    };
  }
}

async function main() {
  // テスト用のURL（実際のDBから取得したURLを使用）
  const testUrl = 'https://www.dmm.co.jp/dc/doujin/-/detail/=/cid=d_719191/';

  console.log('🔍 FANZA年齢確認突破テスト\n');
  console.log(`テストURL: ${testUrl}\n`);

  const result = await fetchFanzaPageWithAgeGate(testUrl);

  console.log('\n📊 結果:');
  console.log(`  成功: ${result.success ? '✅' : '❌'}`);
  if (result.error) {
    console.log(`  エラー: ${result.error}`);
  }
  if (result.cookies && result.cookies.length > 0) {
    console.log(`  Cookie: ${result.cookies.join(', ')}`);
  }
  if (result.html) {
    // 作品コメントが含まれているか確認
    const hasComment = result.html.includes('作品コメント') || 
                      result.html.includes('商品詳細') ||
                      result.html.includes('dcd-productDetail');
    console.log(`  作品コメント検出: ${hasComment ? '✅' : '❌'}`);
    
    // HTMLの一部を表示（デバッグ用）
    const preview = result.html.substring(0, 500);
    console.log(`\n  HTMLプレビュー（最初の500文字）:\n  ${preview}...`);
  }

  if (result.success) {
    console.log('\n✅ 年齢確認を突破して商品詳細ページにアクセスできました！');
    console.log('   サーバー側での自動スクレイピングが可能です。');
  } else {
    console.log('\n❌ 年齢確認を突破できませんでした。');
    console.log('   別の方法（Puppeteer/Playwright等）を検討する必要があります。');
  }
}

main();
