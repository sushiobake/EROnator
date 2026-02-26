# SQLite バックアップメモ（Postgres 導入前の状態に戻す）

Postgres 導入前に取得したバックアップです。問題が起きた場合、このメモを参照して元に戻せます。

---

## バックアップの場所

```
backups/pre-postgres-20260224-205328/
```

## バックアップに含まれるファイル

| ファイル | 説明 |
|----------|------|
| package.json | npm スクリプト定義 |
| prisma/schema.prisma | メインスキーマ |
| prisma/schema.sqlite.prisma | SQLite 用スキーマ |
| prisma/schema.postgres.prisma | Postgres 用スキーマ |
| scripts/sync-sqlite-to-supabase.ts | 同期スクリプト |
| scripts/run-sync-to-supabase.js | 同期ラッパー |
| scripts/generate-worktag-matrix.js | 行列生成 |
| scripts/restore-sqlite.js | SQLite 復元 |
| scripts/prepare-push.js | デプロイ準備 |
| scripts/auto-switch-schema.js | スキーマ自動切り替え |
| scripts/dev-with-lock.js | 開発サーバー起動 |

---

## 元に戻す手順（推奨: 1コマンド）

```powershell
npm run restore:pre-postgres
```

---

## 元に戻す手順（手動）

### 1. ファイルを復元

`backups/pre-postgres-20260224-205328/` のファイルをプロジェクトルートに上書きコピーする。

### 2. .env.local を SQLite 用に戻す

```
DATABASE_URL=file:./prisma/dev.db
```

（DIRECT_URL は SQLite では不要。あれば削除してよい）

### 3. Prisma を再生成

```powershell
npx prisma generate
```

### 4. Docker Postgres を止める（任意）

```powershell
npm run db:down
```

---

## 復元後の確認

- `npm run dev` で開発サーバーが起動する
- 管理画面で作品一覧が表示される
- シミュレーションが動く（SQLite なので以前と同様の速度）

---

## バックアップ日時

2026-02-24 20:53:28
