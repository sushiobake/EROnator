# 一括コメント取得が途中で止まる問題の分析

## 現象

- **普通のコメント取得**（fetch-comments）: 正常に動作する
- **一括コメント取得**（bulk-comment-phase012）: 途中で止まってしまう

## 普通 vs 一括の違い

| 項目 | 普通（fetch-comments） | 一括（fetchCommentsForWorkIds） |
|------|------------------------|---------------------------------|
| 実行方式 | 直列（`for` ループ） | **12並列**（`pLimit(12)`） |
| レート制限 | **2秒スリープ**（各リクエスト後） | **なし** |
| 同時ブラウザ数 | 1個 | **最大12個** |
| 作品の指定 | 選択した workIds | DB から `commentText: null` を自動取得 |

## 12並列が原因である可能性（高い）

### 1. リソース枯渇（メモリ・CPU）

- `scrapeWorkComment` は **1件ごとに新しい Puppeteer ブラウザを起動・終了**する
- 1ブラウザあたり 100〜200MB 程度のメモリ消費
- **12並列 = 1.2〜2.4GB** 以上のメモリ
- Vercel 等のサーバーレスでは 1GB や 3GB のメモリ制限があり、**OOM kill** でプロセスが突然終了する可能性

### 2. FANZA のレート制限・ブロック

- 12並列で同時にリクエストが飛ぶ
- 同じIPから短時間に大量のリクエスト → **ブロック**される可能性
- 普通版は2秒間隔で丁寧にリクエストしているため問題になりにくい

### 3. 接続数・ファイルディスクリプタ

- 12ブラウザ × 多数のネットワーク接続 = リソース枯渇の可能性
- 特にサーバーレス環境では制限が厳しい

### 4. サーバーレス実行時間制限

- Vercel: 10秒〜60秒（プランによる）
- 1件あたり最大30秒タイムアウト
- 12並列でも最初の8件が同時に処理されるため、長時間実行でプロセスが強制終了される可能性

### 5. 「途中で止まる」の具体的メカニズム

- **エラーで失敗**した場合は `failed++` で catch して続行する → 止まらない
- **止まる** = プロセスが完全に終了する場合を指すと仮定
  - メモリ枯渇で OOM kill
  - サーバーレスタイムアウト
  - Puppeteer がハングして応答しなくなる（12並列で複数ハングするとデッドロック的状態）

## 過去の履歴

- `.backup/pre-pipeline-fix-20260225/` では **SCRAPE_CONCURRENCY = 4** だった
- 現在は **12** に変更されている
- 4 から 12 への変更が「途中で止まる」問題の原因である可能性が高い

## 推奨対策

1. **並列数を下げる**: 12 → 2〜4 に変更（fanzaScraper の scrapeWorkComments でも「concurrencyは小さく設定することを推奨」と記載あり）
2. **レート制限を追加**: 一括でも各リクエスト間に 1〜2秒のスリープを入れる
3. **環境変数で調整可能にする**: 本番/開発で並列数を切り替えられるようにする

## 実装済み対策（2026-03）

- **一括を直列に**: fetchCommentsForWorkIds は pLimit(1) で直列実行（単体 fetch-comments と同じ）
- **一括に2秒スリープ**: 1 件処理ごとに 2 秒待機（単体と同じ間隔で FANZA ブロック回避）
- **待機条件の緩和**: networkidle2 → domcontentloaded、商品詳細要素の waitForSelector（10秒）を追加

## 最適値の探し方（実装済み）

### 1. 環境変数で並列数を切り替え（ベンチマーク用）

- **一括コメント取得**は直列（並列1）固定（単体と同じ動作で安定化）
- `SCRAPE_CONCURRENCY` はベンチマークスクリプト等で使用

### 2. ベンチマークスクリプト

```bash
# 並列 1,2,4,6,8 を順にテスト（各レベル間で30秒待機）
npm run benchmark:scrape

# 並列4のみテスト
npm run benchmark:scrape -- --concurrency 4

# 8件でテスト、レベル間60秒待機
npm run benchmark:scrape -- --count 8 --delay 60
```

- 成功数・失敗数・所要時間を比較
- エラー内容（ERR_CONNECTION_TIMED_OUT 等）を表示
- 推奨並列数を提案

### 3. 可視化（デバッグ用）

**ブラウザを表示して実行:**
```bash
# Linux/Mac
SCRAPE_VISIBLE=1 npm run dev

# Windows PowerShell
$env:SCRAPE_VISIBLE="1"; npm run dev

# または SCRAPE_DEBUG=1 でも同様
```

**失敗時スクリーンショットのみ（ブラウザは非表示）:**
```bash
SCRAPE_SCREENSHOT_ON_FAIL=1 npm run dev
```

**テストスクリプトで可視化:**
```bash
npm run test:scrape-comment -- --visible
```

**ベンチマークで可視化:**
```bash
npm run benchmark:scrape -- --visible --concurrency 1 --count 1
```

スクリーンショット保存先: `data/debug-screenshots/`

### 4. バックアップからの復元

今回のバックアップ: `backups/project/backup_2026-03-01T06-48-04/`

戻す場合（例: bulk-comment-phase012 の route のみ）:
```powershell
copy backups\project\backup_2026-03-01T06-48-04\src\app\api\admin\bulk-comment-phase012\route.ts src\app\api\admin\bulk-comment-phase012\
```

全体を戻す場合: バックアップフォルダ内の `src/`, `scripts/`, `package.json` 等をプロジェクトルートに上書きコピー。
