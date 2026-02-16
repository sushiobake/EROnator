# 人力タグ付け「フォルダ」の本番反映

人力タグ付けを「6フォルダ」方式にしたあと、本番（Supabase/PostgreSQL）で同じように動かすための手順。

---

## やること

1. **本番DBにカラムを追加する**  
   `Work` に `manualTaggingFolder`（TEXT, NULL可）がない場合は追加する。

2. **既存データをフォルダに振り分ける**  
   スクリプト `add-manual-tagging-folder.ts` を**本番の DATABASE_URL** で実行する。

---

## 1. カラム追加（本番が Postgres の場合）

- **Prisma のマイグレーションを使う場合**  
  - ローカルで `manualTaggingFolder` を追加したスキーマで、本番用スキーマ（Postgres）にも同じカラムを追加するマイグレーションを用意する。  
  - 本番では `prisma migrate deploy`（またはプロジェクトのデプロイ手順どおり）で適用する。

- **手動でやる場合**  
  Supabase の SQL エディタなどで次を実行する。

```sql
ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "manualTaggingFolder" TEXT;
```

（SQLite の場合は `IF NOT EXISTS` が使えないので、スクリプト側で「既に存在します」と出ても無視する前提で実行する。）

---

## 2. フォルダ振り分けスクリプトの実行（本番データ向け）

本番の DB に対して、**1回だけ**フォルダを振り分ける。

1. 本番の `DATABASE_URL` を一時的に使う  
   - 例: `.env.supabase` の `DATABASE_URL` をコピーし、`DATABASE_URL=postgresql://...` を export したうえで実行する。  
   - または `dotenv` で `.env.supabase` を読むようにして実行する。

2. プロジェクトルートで実行:

```bash
npx tsx scripts/add-manual-tagging-folder.ts
```

3. スクリプトは次のことをする  
   - カラムが無ければ追加（Postgres の場合は手動で先に追加しておいてもよい）  
   - `commentText` がある全作品について、既存フラグから優先順で 1 つのフォルダを決め、`manualTaggingFolder` を更新する。

4. 実行後  
   - 本番の人力タグ付け画面で、各フォルダの件数が 0 でなくなっていることを確認する。

---

## 注意

- **一覧・件数 API** は `manualTaggingFolder` を raw SQL で参照している。本番でも同じコードで動く（SQLite/Postgres 両方）。
- **.env** と **.env.local** の `DATABASE_URL` は、ローカルでは同じ `prisma/dev.db` を指すようにしておく（デプロイ時は Vercel の環境変数で上書きされるため、本番には影響しない）。
- バックアップから復元した DB で再度フォルダを振り直したいときも、同じスクリプトを再度実行すればよい（カラムは「既に存在します」、中身だけ上書きされる）。

## ローカルで「no such table: Work」や接続できないとき

- **シェルに Postgres の DATABASE_URL が残っている**と、スクリプトが Postgres に接続して「no such table: Work」になる。スクリプトは .env.local の URL で**上書き**するよう修正済み。まだ失敗する場合は、実行前に `$env:DATABASE_URL = $null`（PowerShell）でいったん消してから実行する。
- **対処**: `npm run restore:sqlite` で SQLite スキーマに戻す → `npx prisma generate` → もう一度 `npx tsx scripts/add-manual-tagging-folder.ts` を実行する。
