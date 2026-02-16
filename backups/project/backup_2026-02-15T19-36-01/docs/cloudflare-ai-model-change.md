# Cloudflare AI モデル変更手順

## 目的
Llama 3.2 3B → より高性能なモデルに変更して、タグ取得精度を向上させる

---

## 📊 利用可能なモデルと料金

| モデル | 性能 | 料金（入力） | 料金（出力） |
|--------|------|-------------|-------------|
| `@cf/meta/llama-3.2-3b-instruct` | 低 | $0.008 / 1M tokens | $0.024 / 1M tokens |
| `@cf/meta/llama-3.2-11b-vision-instruct` | 中 | $0.010 / 1M tokens | $0.030 / 1M tokens |
| `@cf/meta/llama-3.1-8b-instruct` | 中 | $0.010 / 1M tokens | $0.030 / 1M tokens |
| `@cf/meta/llama-3.1-70b-instruct` | **最高** | $0.060 / 1M tokens | $0.180 / 1M tokens |

### 📈 コスト試算（10,000件の場合）

**現在（3B）:**
- 入力: 約10,000トークン/件 × 10,000件 = 100M tokens → $0.80
- 出力: 約200トークン/件 × 10,000件 = 2M tokens → $0.05
- **合計: 約$0.85**

**70B（最高性能）:**
- 入力: 100M tokens → $6.00
- 出力: 2M tokens → $0.36
- **合計: 約$6.36**

**11B（バランス型・推奨）:**
- 入力: 100M tokens → $1.00
- 出力: 2M tokens → $0.06
- **合計: 約$1.06**

---

## ✅ 推奨: まず 11B でテスト

コストと性能のバランスが良い `llama-3.2-11b-vision-instruct` から試すことをお勧めします。

---

## 🔧 変更手順

### Step 1: Workerコードのモデル名を変更

以下のコードを**全選択してコピー**し、Cloudflare Workerの該当箇所（912行目付近の `raw = await env.AI.run...` から始まる部分）を**置き換え**てください。

---

### 📋 コピペ用コード

#### 【推奨】11B版（バランス型・コスト約$1/10,000件）

```javascript
    let raw;
    let debugInfo = '';
    try {
      raw = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: 1024,
      });
      debugInfo = JSON.stringify(raw).substring(0, 800);
    } catch (e) {
      return new Response(JSON.stringify({
        error: String(e && e.message ? e.message : e),
        additionalSTags: [], aTags: [], bTags: [], cTags: [], characterTags: [],
        debugAiRaw: 'ERROR: ' + String(e),
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
```

---

#### または 8B版（標準性能）

```javascript
    let raw;
    let debugInfo = '';
    try {
      raw = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: 1024,
      });
      debugInfo = JSON.stringify(raw).substring(0, 800);
    } catch (e) {
      return new Response(JSON.stringify({
        error: String(e && e.message ? e.message : e),
        additionalSTags: [], aTags: [], bTags: [], cTags: [], characterTags: [],
        debugAiRaw: 'ERROR: ' + String(e),
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
```

---

#### または 70B版（最高性能・コスト約$6/10,000件）

```javascript
    let raw;
    let debugInfo = '';
    try {
      raw = await env.AI.run('@cf/meta/llama-3.1-70b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: 1024,
      });
      debugInfo = JSON.stringify(raw).substring(0, 800);
    } catch (e) {
      return new Response(JSON.stringify({
        error: String(e && e.message ? e.message : e),
        additionalSTags: [], aTags: [], bTags: [], cTags: [], characterTags: [],
        debugAiRaw: 'ERROR: ' + String(e),
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
```

---

### 📌 置き換える場所

Cloudflare Workerの**912行目付近**を探してください。以下のような箇所です：

```javascript
    let raw;
    try {
      raw = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: 1024,
      });
    } catch (e) {
```

↑ この部分を、上記のコピペ用コードで**丸ごと置き換え**てください。

### Step 2: 保存してデプロイ

Cloudflare Workerの画面で：
1. 「Save and Deploy」をクリック
2. デプロイ完了を待つ（数秒）

### Step 3: テスト実行

ERONATOR側で「再分析」を3件実行して、結果を確認してください。

---

## 📝 結果確認のポイント

- 空の配列が減ったか？
- タグの数が増えたか？
- タグの内容は適切か？

---

## ⚠️ 注意事項

- **11Bでも改善しない場合は、70Bを試してください**
- 70Bは高コストなので、最初は3件だけテストしてください
- モデルを変更しても改善しない場合は、プロンプトの見直しが必要です
