# 総合バックアップ — 復元手順

**作成日時**: 2026-02-15  
**用途**: 不具合・バグ発生時にこの時点へ戻すためのバックアップです。

## 含まれるもの

- `src/app/components` — 共通コンポーネント
- `src/app/api` — API ルート
- `src/app/admin` — 管理画面（ManualTagging 等）
- `src/server` — サーバー処理
- `config` — 設定
- `docs` — 指示書・メモ（check-instruction, legacy-ai-tagging-instruction 等）
- `scripts` — スクリプト（apply-check-result.ts, apply-cursor-legacy-ai-batch.ts 等）
- `prisma/schema.prisma` — Prisma スキーマ
- `prisma/dev.db` — 開発用 SQLite DB（この時点のデータ）
- `package.json`, `tsconfig.json`, `next.config.js`

## 復元のやり方

プロジェクトルート（`eronator_mvp0_ws_v1_5_3`）で、このフォルダの内容を上書きコピーしてください。

```powershell
# 例: プロジェクトルートにいる状態で
$bak = "backups\project\backup_2026-02-15T13-36-41"
Copy-Item -Path "$bak\*" -Destination "." -Recurse -Force
```

**注意**: 上記だと `backups` フォルダごと上書きされる可能性があるため、**フォルダ単位で戻す**方が安全です。

```powershell
$bak = "backups\project\backup_2026-02-15T13-36-41"
Copy-Item -Path "$bak\src\*"       -Destination "src\"       -Recurse -Force
Copy-Item -Path "$bak\config\*"    -Destination "config\"    -Recurse -Force
Copy-Item -Path "$bak\docs\*"      -Destination "docs\"      -Recurse -Force
Copy-Item -Path "$bak\scripts\*"   -Destination "scripts\"   -Recurse -Force
Copy-Item -Path "$bak\prisma\*"   -Destination "prisma\"   -Recurse -Force
Copy-Item -Path "$bak\package.json" -Destination "." -Force
Copy-Item -Path "$bak\tsconfig.json" -Destination "." -Force
Copy-Item -Path "$bak\next.config.js" -Destination "." -Force
```

DB を戻すと、このバックアップ時点以降に登録・更新したデータは消えます。必要なら `prisma/dev.db` だけ戻さない選択もできます。
