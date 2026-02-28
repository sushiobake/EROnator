# 一括処理パイプライン・チェックポイント・バックグラウンド実装

2026-02-27 実装

## 実装内容

### ① バックアップ

- `backups/project/backup_2026-02-27T12-29-49/` に保存
- 復元手順は `RESTORE-GUIDE.md` を参照

### ② パイプライン 8件ずつ

- Phase0 8件完了 → Phase1+2 8件開始、同時に Phase0 次の8件を継続
- `PIPELINE_UNIT = 8` で Phase0 と Phase1+2 を重ねて実行
- 100件ラウンド = 13チャンク（8×12 + 4）

### ③ チェックポイント・進行状況

- **中断時の再開**: 開始時に `manualTaggingFolder='pending'` の作品があれば、先に Phase1+2 を実行してから本処理を開始
- **進行状況の詳細表示**:
  - `currentWorkId`: 現在処理中の作品ID
  - `detail`: タグ追加数やチェック結果などの補足
  - ラウンド表示の強化

### ④ バックグラウンド実行

- **チェックボックス「バックグラウンド」**: 一括実行ボタン横に追加
- **動作**: チェックONで POST → 即レスポンス、処理はサーバー内で非同期継続
- **進捗確認**: `data/bulk-progress.json` に永続化、`GET /api/admin/bulk-job-status` で取得
- **ProgressPanel**: 5秒ごとにポーリングしてバックグラウンドジョブの進捗を表示

## ファイル変更一覧

| ファイル | 変更内容 |
|----------|----------|
| `src/app/api/admin/bulk-comment-phase012/route.ts` | パイプライン8件、チェックポイント再開、バックグラウンド対応 |
| `src/server/bulk/progressStore.ts` | 新規: 進捗永続化 |
| `src/app/api/admin/bulk-job-status/route.ts` | 新規: 進捗取得API |
| `src/app/admin/components/ProgressPanel.tsx` | 詳細表示、バックグラウンドポーリング |
| `src/app/admin/components/ImportWorkflow.tsx` | バックグラウンドチェックボックス、詳細progress |
| `src/app/admin/context/AdminProgressContext.tsx` | JobProgress に currentWorkId, detail 追加 |
