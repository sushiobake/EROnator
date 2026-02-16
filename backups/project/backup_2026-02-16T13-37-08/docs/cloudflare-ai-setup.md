# Cloudflare で準有名タグ生成（AI分析）

**プログラミング知識がなくても大丈夫な手順**は、別ファイルにまとめています。  
→ **[Cloudflare Worker をゼロから作る手順（プログラミング不要）](./cloudflare-worker-手順（プログラミング不要）.md)**  
（ログイン後の「何をクリックして、どこにコードを貼るか」を画面操作だけで説明しています。）

---

## 実装状況

- **Cloudflare は実装済み**です。`src/server/ai/cloudflareAi.ts` の `analyzeWithCloudflareAi` が Worker の URL に POST します。
- **準有名タグ生成**（`generate-derived-tags` / `generate-derived-tags-oldest`）は、環境変数に従って **Cloudflare > Groq > Hugging Face** の順でプロバイダを選びます。Cloudflare を使うには以下を設定します。

## 設定

1. **CLOUDFLARE_WORKER_AI_URL**  
   Cloudflare Worker のエンドポイント URL（例: `https://your-worker.your-subdomain.workers.dev/analyze`）。

2. **ERONATOR_AI_PROVIDER=cloudflare**（任意）  
   指定しない場合は「auto」になり、`CLOUDFLARE_WORKER_AI_URL` が設定されていれば Cloudflare が使われます。

3. **CLOUDFLARE_AI_TOKEN**（任意）  
   Worker が Bearer トークンで保護されている場合に設定。

## Worker の仕様

Worker は次の形式で呼ばれます。

- **リクエスト**: `POST`、Body: `{ "commentText": "作品コメント本文", "systemPrompt": "システムプロンプト" }`
- **レスポンス**: `{ "derivedTags": [ { "displayName": "タグ名", "confidence": 0.8, "category": "カテゴリ" } ], "characterTags": [ "キャラ名" ] }`

Worker 内で Cloudflare Workers AI（例: `@cf/meta/llama-3.2-3b-instruct`）を呼び、上記形式に整形して返してください。

## 5件テスト（指示の最適化用）

DB に保存せず、AI の結果だけ返すテスト API があります。

- **エンドポイント**: `POST /api/admin/tags/analyze-test`
- **Body**:
  - `limit`: 件数（省略時 5、最大 20）
  - `workIds`: 指定する場合は作品 ID の配列（省略時は「準有名タグなし・古い順」から取得）
  - `systemPrompt`: 省略時はデフォルト。**指示を変えて試すときはここに上書き**
- **レスポンス**: `{ "provider": "cloudflare", "results": [ { "workId", "title", "commentPreview", "derivedTags", "characterTags", "error?" } ] }`

管理トークン（`x-eronator-admin-token`）が必要です。5件ずつ試して `systemPrompt` を変え、最適な指示を探せます。
