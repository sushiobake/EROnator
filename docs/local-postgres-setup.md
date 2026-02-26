# ローカル PostgreSQL セットアップ

シミュレーションを高速化するため、ローカル開発で PostgreSQL を使う手順です。

## 前提

- Docker Desktop がインストール・起動済み
- prisma/dev.db（SQLite）にデータがある

## 手順

### 1. Postgres を起動

```powershell
npm run db:up
```

### 2. 初回のみ: SQLite からデータを移行

```powershell
npm run migrate:local-postgres
```

### 3. .env.local を設定

```
DATABASE_URL=postgresql://postgres:localdev@localhost:5432/eronator
DIRECT_URL=postgresql://postgres:localdev@localhost:5432/eronator
```

### 4. workTagMatrix を生成（初回のみ）

```powershell
npm run generate:worktag-matrix
```

（SQLite から読み取ります。データは移行済みなので同じ内容です）

### 5. 開発サーバー起動

```powershell
npm run dev
```

## 元に戻す（SQLite に戻す）

```powershell
npm run restore:pre-postgres
```

その後、.env.local の DATABASE_URL を以下に戻す:

```
DATABASE_URL=file:./prisma/dev.db
```

Docker を止める場合:

```powershell
npm run db:down
```

## デプロイ時の注意

- **SQLite 使用時**: `npm run sync:supabase` で SQLite → Supabase に同期
- **Postgres 使用時**: `npm run sync:supabase -- --source=postgres` でローカル Postgres → Supabase に同期

`generate:worktag-matrix` は DATABASE_URL に応じて SQLite または Postgres から読み取ります。

## バックアップ

導入前の状態は `backups/pre-postgres-20260224-205328/` に保存されています。
