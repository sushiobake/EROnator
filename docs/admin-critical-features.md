# 管理画面 必須機能一覧（再発防止用）

**作成日: 2026-02-22**

本ドキュメントは、管理画面（人力タグ付け）の必須機能を明文化し、誤って削除・欠落する事故を防ぐためのものです。

---

## 事故の概要（2026-02-22）

- **現象**: Phase1+2連続ボタン、進行パネル、問題ありタブなどが消え、タグ付け作業ができなくなった。
- **復旧**: `.backup/progress-and-streaming-20260220/` から ManualTagging を復元し、tags/page.tsx に ProgressPanel・AdminProgressProvider を追加。

---

## 事故の原因分析

| 原因 | 詳細 |
|------|------|
| **バージョン分散** | 完全版が `.backup/` に残り、本番の `src/` には簡略版が入っていた。`.backup` はバックアップ対象外のため、通常バックアップでは復元できなかった。 |
| **依存コンポーネントの取りこぼし** | ProgressPanel は ManualTagging とは別ファイル。tags/page.tsx から ProgressPanel のインポート・描画が抜けていた。 |
| **必須機能の文書化不足** | どの機能が必須かが明文化されておらず、変更時に「削除してよいか」の判断基準がなかった。 |
| **回帰確認チェックリスト不在** | 管理画面を変更したあと、何を確認すべきかのチェックリストがなかった。 |

---

## 必須機能チェックリスト

### 1. ManualTagging.tsx（`src/app/admin/components/ManualTagging.tsx`）

| 機能 | キー文字列（grep検索用） | 説明 |
|------|-------------------------|------|
| Phase1+2連続 | `Phase1+2連続` / `groq-check-batch` | チェック待ちの一括チェック |
| Phase1: 振り分けチェック | `groq-check-phase1` | 1件ずつ振り分け |
| Phase2: 追加提案 | `groq-check-phase2` | 問題ありの1件に追加提案 |
| Phase0: タグ付け | `groq-tag-batch` / `Phase0` | 未タグ→タグ付け |
| Phase0→1→2 一気に | `Phase0→1→2` | 未タグから一括処理 |
| 問題ありタブ | `has_issues` / `問題あり` | フォルダ・タブ |
| 人間確認タブ | `needs_human_check` / `人間確認` | フォルダ・タブ |
| チェック結果一覧 | `showBatchResults` / `batchRuns` | モーダル |
| 実行中表示 | `batchProgress` / `combinedProgress` | 青いバナー |
| useAdminProgress | `useAdminProgress` / `setProgress` | 進行パネル連携 |

### 2. tags/page.tsx（`src/app/admin/tags/page.tsx`）

| 機能 | キー文字列 | 説明 |
|------|-------------|------|
| ProgressPanel | `ProgressPanel` | 右下の進行状況パネル |
| AdminProgressProvider | `AdminProgressProvider` | 進行状況コンテキストの提供 |

### 3. API（`has_issues` 対応）

| ファイル | 必須内容 |
|----------|----------|
| `manual-tagging/works/route.ts` | FOLDERS に `has_issues` を含む |
| `manual-tagging/works/counts/route.ts` | 同上 |
| `manual-tagging/works/[workId]/route.ts` | validFolders に `has_issues` を含む |
| `server/db/sqlite-direct.ts` | FOLDERS に `has_issues` を含む |

---

## 再発防止ルール

### 1. 変更前のバックアップ

- **管理画面（ManualTagging, tags/page, AdminProgressContext, ProgressPanel）を触る前**に必ず `npm run backup:project` を実行する。

### 2. バックアップの検証

- バックアップ後、`npm run verify:admin` で必須機能の存在を確認する（スクリプト参照）。

### 3. 回帰確認の実行

- 管理画面を変更したら、`docs/admin-critical-features.md` のチェックリストに従い、必須機能が残っていることを確認する。

### 4. `.backup` の扱い

- `.backup/` は「動作確認済みの完全版」の保管場所。破棄・上書きする前に必ず `src/` と照合し、必要な差分が `src/` に取り込まれているか確認する。

### 5. 新機能追加時の更新

- 管理画面に新機能を追加したら、本ドキュメントのチェックリストに追記する。

---

## 復元手順（参考）

必須機能が欠落した場合:

1. `npm run backup:project` で現状をバックアップ（上書き防止）。
2. `.backup/progress-and-streaming-20260220/ManualTagging.tsx` を `src/app/admin/components/` にコピー。
3. `has_issues` が API に含まれているか確認。含まれていなければ `docs/admin-critical-features.md` の API セクションを参照して追加。
4. tags/page.tsx に ProgressPanel と AdminProgressProvider が含まれているか確認。
5. 開発サーバーを再起動し、人力タグ付けタブで動作確認。
