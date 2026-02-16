# AI統合セットアップガイド

## Hugging Face APIのセットアップ

### 1. Hugging Faceアカウント作成

1. https://huggingface.co/ にアクセス
2. アカウントを作成（無料）
3. メールアドレスを確認

### 2. APIトークンの取得

1. 右上のアイコンをクリック → **Settings**
2. 左メニューから **Access Tokens** を選択
3. **New token** をクリック
4. トークン名を入力（例: `eronator-ai`）
5. **Read** 権限で作成
6. トークンをコピー（**一度しか表示されません**）

### 3. 環境変数の設定

`.env.local` に以下を追加：

```env
# AIプロバイダー選択
ERONATOR_AI_PROVIDER=huggingface

# Hugging Face API設定
HUGGINGFACE_API_TOKEN=your-token-here
HUGGINGFACE_API_URL=https://api-inference.huggingface.co/models/elyza/ELYZA-japanese-Llama-2-7b-instruct
```

### 4. 推奨モデル

**日本語対応モデル（推奨）:**
- `elyza/ELYZA-japanese-Llama-2-7b-instruct` - 日本語に最適化
- `elyza/ELYZA-japanese-Llama-2-7b-fast-instruct` - 高速版

**英語モデル（日本語精度は低い）:**
- `meta-llama/Llama-2-7b-chat-hf` - 汎用的だが日本語精度は低い

## Cloudflare Workers AIのセットアップ（将来のオプション）

### 1. Cloudflare Workersプロジェクト作成

1. Cloudflareダッシュボードにログイン
2. **Workers & Pages** → **Create application**
3. Workerを作成してAI分析エンドポイントを実装

### 2. 環境変数の設定

```env
ERONATOR_AI_PROVIDER=cloudflare
CLOUDFLARE_WORKER_AI_URL=https://your-worker.your-subdomain.workers.dev/analyze
CLOUDFLARE_AI_TOKEN=your-token
```

## 動作確認

1. 開発サーバーを起動: `npm run dev`
2. `http://localhost:3000/admin/tags` にアクセス
3. ファイルをアップロードしてAI分析を実行
4. エラーが出る場合は、ブラウザのコンソールとサーバーログを確認

## トラブルシューティング

### エラー: "モデルが起動中です"
- **原因**: 無料モデルは使用時に起動が必要（10-30秒）
- **対処**: 少し待ってから再試行

### エラー: "JSONを抽出できませんでした"
- **原因**: AIの応答がプロンプト通りでない
- **対処**: プロンプトを調整するか、別のモデルを試す

### エラー: "Rate limit exceeded"
- **原因**: 無料枠の制限に達した
- **対処**: 時間を置いて再試行、または有料プランに移行

## プロンプトの調整

プロンプトは `src/config/aiPrompt.ts` で管理されています。
環境変数 `ERONATOR_AI_PROMPT` で上書き可能です。
