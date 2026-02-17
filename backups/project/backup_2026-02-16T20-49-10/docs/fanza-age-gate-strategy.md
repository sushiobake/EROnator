# FANZA年齢確認突破戦略 - 見解

## 質問の要点

**3⃣ができるかどうか**: FANZAのURLは「18歳以上かどうか」という確認が必ず入る。これを突破してURLを開き、そこから適切に取得できるか？

## 現状のtampermonkeyの動作

tampermonkeyは**ブラウザ拡張機能**なので：
- ユーザーが既にブラウザで年齢確認を通過している状態で動作
- ブラウザのセッション/Cookieをそのまま使用
- 年齢確認ページを通過する処理は不要

## サーバー側自動化の課題

### 問題点

1. **年齢確認ページの検出が必要**
   - 初回アクセス時に年齢確認ページにリダイレクトされる
   - 年齢確認ページを検出して処理する必要がある

2. **Cookie/Session管理が必要**
   - 年齢確認を通過するとCookieが設定される（例: `age_check=1`）
   - このCookieを保持して以降のリクエストに含める必要がある

3. **年齢確認フォームの自動送信**
   - 年齢確認ページのフォームを自動送信する必要がある
   - GETパラメータ（`?age_check=1`）またはPOSTリクエスト

### 実装可能性

**結論: 技術的には可能ですが、いくつかの課題があります。**

#### 方法1: Cookie/Session管理による突破（推奨）

```typescript
// 1. 年齢確認ページにアクセス
const ageGateResponse = await fetch(ageGateUrl);

// 2. 年齢確認を通過（GETパラメータまたはPOST）
const confirmedUrl = `${ageGateUrl}?age_check=1`;
const confirmedResponse = await fetch(confirmedUrl, {
  headers: {
    'Cookie': 'age_check=1', // Cookieを設定
  },
});

// 3. Cookieを保存
const cookies = confirmedResponse.headers.getSetCookie();

// 4. 商品詳細ページにアクセス（Cookie付き）
const productResponse = await fetch(productUrl, {
  headers: {
    'Cookie': cookies.join('; '),
  },
});
```

**メリット**:
- 実装が比較的簡単
- リソース消費が少ない

**デメリット**:
- FANZAの実装に依存（変更されると動かなくなる可能性）
- Cookieの有効期限管理が必要

#### 方法2: Puppeteer/Playwrightによる突破（確実だが重い）

```typescript
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch();
const page = await browser.newPage();

// 年齢確認ページにアクセス
await page.goto(productUrl);

// 年齢確認ボタンをクリック
await page.click('button[type="submit"]'); // または適切なセレクタ

// 商品詳細ページが表示されるまで待機
await page.waitForSelector('.dcd-productDetail__text');

// HTMLを取得
const html = await page.content();
```

**メリット**:
- 実際のブラウザを使用するため、確実に動作
- JavaScriptの実行も可能

**デメリット**:
- リソース消費が大きい（メモリ、CPU）
- 処理速度が遅い
- サーバー環境にChrome/Chromiumが必要

## 推奨アプローチ

### Phase 1: Cookie/Session管理による実装（まず試す）

1. **年齢確認ページの検出**
   - HTMLに「18歳」「年齢確認」などのキーワードが含まれているか確認
   - リダイレクト先が年齢確認ページかどうか確認

2. **年齢確認の通過**
   - GETパラメータ `?age_check=1` を試す
   - またはPOSTリクエストで年齢確認フォームを送信

3. **Cookieの保存と再利用**
   - 年齢確認通過後に設定されたCookieを保存
   - 以降のリクエストにCookieを含める

4. **商品詳細ページの取得**
   - Cookie付きで商品詳細ページにアクセス
   - 作品コメントを抽出

### Phase 2: 失敗時のフォールバック（Puppeteer/Playwright）

Phase 1が失敗した場合、Puppeteer/Playwrightを使用する。

## 実装の流れ（提案）

### 1. タグリストから選択

```typescript
// 最新100件の作品を取得
const works = await prisma.work.findMany({
  orderBy: { createdAt: 'desc' },
  take: 100,
  select: {
    workId: true,
    productUrl: true,
  },
});
```

### 2. URLを取得

```typescript
const urls = works.map(w => w.productUrl);
```

### 3. 年齢確認を突破して作品コメントを取得

```typescript
async function scrapeWorkCommentWithAgeGate(productUrl: string): Promise<string | null> {
  // 年齢確認を突破
  const result = await fetchFanzaPageWithAgeGate(productUrl);
  
  if (!result.success || !result.html) {
    return null;
  }
  
  // 作品コメントを抽出（tampermonkeyと同じロジック）
  return extractCommentFromHtml(result.html);
}
```

### 4. AIで準有名タグを抽出

```typescript
async function generateDerivedTags(commentText: string, workId: string) {
  const result = await analyzeWithCloudflareAi(commentText, systemPrompt);
  // DERIVEDタグとして保存
}
```

## 結論

**3⃣は技術的に可能です。** ただし、以下の点に注意が必要です：

1. **Cookie/Session管理**: 年齢確認を通過したCookieを保持する必要がある
2. **FANZAの実装依存**: FANZAの年齢確認の実装が変更されると動かなくなる可能性
3. **フォールバック**: 失敗時の対策（Puppeteer/Playwright）を用意する

**推奨**: まずはCookie/Session管理による実装を試し、失敗した場合はPuppeteer/Playwrightにフォールバックする。

## 次のステップ

1. **テストスクリプトの実行**: `test-fanza-age-gate.ts`で実際に年齢確認を突破できるか確認
2. **成功した場合**: Cookie/Session管理による実装を進める
3. **失敗した場合**: Puppeteer/Playwrightによる実装を検討
