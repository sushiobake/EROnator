# タグチェック 5件バッチ バックアップ (2026-02-20)

## 内容

- **groq-check-batch-route.ts**: 5件ずつ Phase1+2 連続チェックの route（本体は `src/app/api/admin/groq-check-batch/route.ts`）
- **check-instruction-api1-batch.md**, **check-instruction-api2-batch.md**: 5件バッチ用指示書（本体は `docs/`）

## 1件ずつに戻す方法

現在のコードベースには **1件用 API が残っている**:

| API | 用途 |
|-----|------|
| `POST /api/admin/groq-check-phase1` | チェック待ち1件の Phase1 のみ |
| `POST /api/admin/groq-check-phase2` | 1件の Phase2（Phase1 で問題ありの場合） |
| `POST /api/admin/groq-check-one` | 1件の Phase1+2 連続（check-instruction-1item.md 使用・ファイル出力） |

### 1件ずつでチェックする手順

1. **管理画面** (`/admin/tags`) の「チェック待ち」タブで
2. **Phase1: 振り分けチェック** ボタンを押す → 1件ずつ Phase1 実行
3. 問題ありなら **has_issues** に移動。Phase2 は別途「Phase2実行」ボタンまたは groq-check-phase2 で実行

### 5件バッチを停止して1件のみにする場合

- `ManualTagging.tsx` の「Phase1+2連続」ボタンの fetch 先を `groq-check-batch` から `groq-check-phase1` に変え、件数選択を 1 に固定する
- または、このバックアップの `groq-check-batch-route.ts` を参考に、`BATCH_SIZE = 1` にした route を別名で作成する

## 復元手順（5件バッチに戻す）

このバックアップ時点では、本体はすでに5件バッチになっている。もし本体を別の形に変更した場合:

- `groq-check-batch-route.ts` を `src/app/api/admin/groq-check-batch/route.ts` に上書き（インポートパス等は Next.js の route 形式に合わせる）
- 指示書は `docs/check-instruction-api1-batch.md`, `docs/check-instruction-api2-batch.md` がそのまま使用されている
