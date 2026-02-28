# 「fetch failed」原因調査（100件一括実行時・Phase0開始時）

## 現象

100件の一括処理（bulk-comment-phase012）実行中、**Phase0 が始まったタイミング**で「fetch failed」が表示される。
ローカル実行。Vercel は後から同期する想定。

## 結論：AI API（callCheckApi）の fetch 失敗が原因 ★★★

エラーの伝播経路を追跡した結果：

1. **callCheckApi**（`src/server/checkAiClient.ts`）が AI API へ `fetch()` する
2. その fetch がネットワークエラーで失敗 → `TypeError: fetch failed` をスロー
3. **groq-tag-batch** の `Promise.all` が reject → catch で `send({ type: 'error', error: 'fetch failed' })`
4. **bulk-comment-phase012** が consumeStream で受け取り → クライアントに転送
5. クライアントの alert に「fetch failed」が表示される

→ **Phase0 開始時 = groq-tag-batch が callCheckApi を呼ぶタイミング**なので、AI API への fetch 失敗が原因。

## 想定される具体的な原因（AI API 側）

| 原因 | 説明 |
|------|------|
| **ECONNRESET** | リモート（AI API）が接続を切断。API 側のタイムアウト、過負荷、プロキシの切断など |
| **4並列リクエスト** | 並列化で 4 本同時に AI API へ接続。レート制限や接続数制限に抵触する可能性 |
| **タイムアウト** | callCheckApi に timeout 未設定。API が遅いと長時間待機し、途中で切断される可能性 |
| **エンドポイント不一致** | checkAiClient は `api.openai.com` 固定。Groq 利用時は `api.groq.com` が必要 |
| **プロキシ／ファイアウォール** | 社内ネットワーク等で外部 API への接続が制限・切断される |

## checkAiClient の現状

- エンドポイント: `https://api.openai.com/v1/chat/completions`（**固定**）
- API キー: `OPENAI_API_KEY`
- モデル: `OPENAI_CHECK_MODEL` または `gpt-5-nano`
- **timeout 未設定**
- **err.cause のログ出力なし**（Node.js 18+ の fetch は cause に詳細を格納）

## 対策案（実装済み）

1. **checkAiClient の改善**（実装済み）:
   - `err.cause` をログ出力（再現時にターミナルで詳細を確認可能）
   - timeout 120秒を追加（`OPENAI_CHECK_TIMEOUT_MS` で上書き可）
   - `OPENAI_CHECK_ENDPOINT` でエンドポイント切り替え（Groq: `https://api.groq.com/openai/v1/chat/completions`）
   - `GROQ_API_KEY` をサポート（Groq 利用時）

2. **API 並列数の一時削減**: `API_CONCURRENCY` を 4 → 2 に下げて再試行（groq-tag-batch, groq-check-batch）

## 再現時の確認手順

1. 100件で再実行
2. ターミナル（`npm run dev` のログ）で `[groq-tag-batch] AI API fetch failed:` を確認
3. その直後の `cause` の内容を確認（ECONNRESET, ETIMEDOUT 等）
