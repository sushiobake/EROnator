# DMM API バッチ取得ガイド

## 概要

DMM Affiliate APIから作品を取得し、DBに保存するスクリプトです。ソート順（人気順/レビュー順/発売日順）や発売日範囲を指定して取得できます。

## 前提条件

1. **環境変数の設定**
   - `.env.local`に以下を設定：
     ```
     DMM_API_ID=your-api-id
     DMM_AFFILIATE_ID=sok-990
     ```

2. **DBの準備**
   - Prismaのスキーマが最新であること
   - `npm run db:push`でDBを最新化

## 使い方

### 基本的な使い方

```bash
# 100件取得（デフォルト・人気順）
npm run import:dmm-batch

# 1000件取得
npm run import:dmm-batch -- --target=1000

# 指定したoffsetから開始
npm run import:dmm-batch -- --target=100 --offset=101

# レビュー順で取得（過去の有名作品が出やすい）
npm run import:dmm-batch -- --target=500 --sort=review

# 2021年発売のみ、人気順で取得
npm run import:dmm-batch -- --target=200 --sort=rank --gte-date=2021-01-01 --lte-date=2021-12-31
```

### パラメータ

- `--target`: 目標取得件数（デフォルト: 100）
- `--offset`: 開始offset（デフォルト: 1）
- `--hits`: 1回のリクエストあたりの取得件数（デフォルト: 100、最大: 100）
- `--sort`: ソート順（デフォルト: rank）
  - `rank`: 人気順（現在の人気が高い順）
  - `review`: レビュー順（レビュー数・評価が高い順。過去の有名作品が出やすい）
  - `date`: 発売日順（新着順）
- `--gte-date`: 発売日以降（例: `2021-01-01`）。空欄で全期間
- `--lte-date`: 発売日以前（例: `2021-12-31`）。空欄で全期間

### 例

```bash
# 100件取得（1~100件目・人気順）
npm run import:dmm-batch -- --target=100

# 1000件取得（1~1000件目）
npm run import:dmm-batch -- --target=1000

# 101~200件目を取得
npm run import:dmm-batch -- --target=100 --offset=101

# レビュー順で500件（過去の有名作品を拾いやすい）
npm run import:dmm-batch -- --target=500 --sort=review

# 2021年発売の作品を人気順で200件
npm run import:dmm-batch -- --target=200 --sort=rank --gte-date=2021-01-01 --lte-date=2021-12-31
```

## 動作の流れ

1. **APIから取得**
   - 指定したソート順（rank/review/date）で作品を取得
   - 発売日範囲（gte_date/lte_date）で絞り込み可能
   - 1回のリクエストで最大100件取得
   - `offset`を100ずつ増やしてページング

2. **フィルタリング**
   - 同人誌フィルタ適用（`/digital/comic/`のみ採用）
   - ゲーム、CG集、音声を除外

3. **重複チェック**
   - 既存の`workId`（`content_id`）と比較
   - 重複している場合はスキップ

4. **DB保存**
   - `Work`テーブルに作品情報を保存
   - `Tag`テーブルにジャンルタグを保存
   - `WorkTag`テーブルに関連付けを保存

## 統計情報

スクリプト実行中に以下の統計が表示されます：

- **保存**: DBに新規保存された件数
- **スキップ（重複）**: 既存データでスキップされた件数
- **フィルタ除外**: 同人誌フィルタで除外された件数（ゲーム/CG集/音声など）

## 注意点

1. **APIの制限**
   - `offset`の最大値は50000
   - 1回のリクエストで取得できるのは最大100件
   - レート制限対策として、リクエスト間に1秒の待機時間を設けています

2. **フィルタ後の件数**
   - 100件取得しても、フィルタで除外されると実際の件数は少なくなります
   - 例: 100件取得 → 20件除外 → 80件のみ採用
   - 目標件数に達するまで、自動的に次のoffsetから取得を続けます

3. **重複の扱い**
   - 既存の`workId`と重複している場合はスキップされます
   - 既存データは更新されません（既存優先）

4. **AI判定**
   - 簡易的なAI判定を実装しています（ジャンル、メーカー名、タイトルから判定）
   - 判定できない場合は`UNKNOWN`として保存されます
   - 後で手動で修正可能です

## 段階的な取得戦略

### フェーズ①: 100件取得（テスト）

```bash
npm run import:dmm-batch -- --target=100
```

- 人気順で100件取得（デフォルト）
- 同人誌フィルタ適用
- 結果を確認

### 取得方法の使い分け

| ソート | 用途 |
|--------|------|
| `rank` | 現在の人気作品。変動あり |
| `review` | レビュー数が多い過去の有名作品を拾いやすい |
| `date` | 新着順。幅広く取得 |

### フェーズ②: 1000件取得（精度調整）

```bash
npm run import:dmm-batch -- --target=1000
```

- 同じ方法で1000件取得
- 重複チェックで既存作品をスキップ
- 精度調整（質問と断定の精度など）

### フェーズ③: 段階的にDBを増やす

```bash
# 1000件取得済みの場合、1001~2000件目を取得
npm run import:dmm-batch -- --target=1000 --offset=1001
```

- 同じ方法で継続的に取得
- 重複チェックで既存作品をスキップ
- 進捗を記録して「どこまで取得したか」を把握

## トラブルシューティング

### エラー: DMM_API_IDが設定されていません

`.env.local`に`DMM_API_ID`を設定してください。

### エラー: DMM_AFFILIATE_IDが設定されていません

`.env.local`に`DMM_AFFILIATE_ID`を設定してください（末尾990-999が必要）。

### 取得件数が目標に達しない

- フィルタで除外される作品が多い可能性があります
- `offset`を大きくして、次の範囲から取得してください

### DBエラー

- Prismaのスキーマが最新であることを確認
- `npm run db:push`でDBを最新化

## 関連ドキュメント

- [DMM API テストガイド](./dmm-api-test-guide.md)
- [DMM API ID 取得ガイド](./dmm-api-id-guide.md)
- [DMM 同人誌フィルタ分析](./dmm-doujin-filter-analysis.md)
- [DMM ランキング取得戦略](./dmm-ranking-fetch-strategy.md)
