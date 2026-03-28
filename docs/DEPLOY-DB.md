# DB マイグレーション運用ガイド

## 基本ルール

スキーマに列を追加 / 変更したとき、**コードのデプロイ前に必ず本番 DB に変更を適用する。**

---

## 通常フロー（列追加・スキーマ変更があるとき）

### 1. ローカルでスキーマを変更しマイグレーションを作る

```bash
# スキーマ編集後
npx prisma migrate dev --name <変更名>
# 例: npx prisma migrate dev --name add_clicked_fanza_work_id
```

### 2. 本番 DB に適用する

```bash
npm run db:migrate:prod
```

- `.env.local` に `PROD_DATABASE_URL="postgresql://..."` が設定されている必要があります。
- 未設定の場合はスクリプトが案内を表示します。

### 3. デプロイする

```bash
npm run deploy:prod
```

- デプロイスクリプトが未適用マイグレーションを検知した場合は確認を求めます。
- 「適用済み」と答えると通常通りデプロイを続行します。

---

## 通常フロー（スキーマ変更なし）

1. `npm run deploy:prod` のみ実行。マイグレーションチェックは自動でスキップされます。

---

## 本番 DB への接続設定

`.env.local` に以下を追記してください（コミットしないこと）:

```
PROD_DATABASE_URL="postgresql://<user>:<password>@<host>:<port>/<db>?sslmode=require"
```

- Supabase: `Project Settings → Database → Connection string (URI)` から取得
- Vercel Postgres: `Storage → Connect → .env.local` から取得

---

## ビルドについて

`npm run build`（Vercel のビルドコマンド）は **マイグレーションを自動実行しません。**
スキーマとコードの同期はデプロイ前に手動で行います。

理由:
- ビルド時の migrate deploy はビルド時間を大幅に増加させる（5〜10 分超）。
- 接続プーラー経由ではマイグレーションが失敗するケースがある。
- 事前適用の方が確実で速い。

---

## スキーマ変更 PR チェックリスト

- [ ] `prisma/migrations/` に migration.sql と migration_postgres.sql が追加されている
- [ ] `npm run db:migrate:prod` で本番 DB に適用済み
- [ ] `npx tsc --noEmit` がエラーなし
