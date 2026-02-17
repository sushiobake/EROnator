# タグ管理・インポート機能 実装メモ

## ページ構成

- **パス**: `/admin/tags`
- **アクセス制御**: 3重ロック（`isAdminAllowed()`）
  - `ERONATOR_ADMIN=1`
  - `NODE_ENV !== 'production'` または `ERONATOR_ADMIN_PRODUCTION=1`
  - `x-eronator-admin-token` ヘッダー

## ファイル形式

- **works_A.txt**: 全量データ（既存+新規）
- **works_C.txt**: 追加分のみ

## 機能フロー

1. ファイルアップロード → パース
2. 作品一覧表示（重複チェック結果表示）
3. 作品選択（チェックボックス）
4. AI分析実行（バッチ処理、5作品ずつ）
5. 分析結果確認・編集
6. DBインポート実行

## 重複対処

- 既存の`importBatch.cjs`のロジックを活用
- UIで重複作品を黄色ハイライト表示
- インポート前に確認可能

## AI分析

- **プロンプト管理**: `src/config/aiPrompt.ts`（環境変数で上書き可能）
- **AIサービス**: Hugging Face Inference API（デフォルト、無料枠あり）
- **代替案**: Cloudflare Workers AI（環境変数で切り替え可能）
- **バッチサイズ**: 5作品ずつ
- **進捗表示**: リアルタイム更新

## 環境変数

```env
# 管理画面アクセス制御
ERONATOR_ADMIN=1
ERONATOR_ADMIN_PRODUCTION=1  # 本番環境で使用する場合
ERONATOR_ADMIN_TOKEN=your-secret-token

# AI分析プロンプト（オプション）
ERONATOR_AI_PROMPT=カスタムプロンプト...

# AIプロバイダー選択（'huggingface' または 'cloudflare'）
ERONATOR_AI_PROVIDER=huggingface

# Hugging Face API設定
HUGGINGFACE_API_TOKEN=your-token-here
HUGGINGFACE_API_URL=https://api-inference.huggingface.co/models/elyza/ELYZA-japanese-Llama-2-7b-instruct

# Cloudflare Workers AI（オプション、将来使用する場合）
CLOUDFLARE_WORKER_AI_URL=https://your-worker.your-subdomain.workers.dev/analyze
CLOUDFLARE_AI_TOKEN=...
```

## 実装状況

- [x] アクセス制御関数 `isAdminAllowed()`
- [x] ファイルパーサー `parseWorksFile()`
- [x] `/api/admin/tags/parse` API
- [x] `/admin/tags` ページ（基本UI）
- [x] プロンプト管理 `src/config/aiPrompt.ts`
- [x] 重複チェック機能（UI表示、黄色ハイライト）
- [x] Hugging Face API統合
- [x] Cloudflare Workers AI統合（準備済み）
- [x] `/api/admin/tags/analyze` API（バッチ処理対応）
- [ ] 分析結果表示・編集UI
- [ ] DBインポート機能統合
