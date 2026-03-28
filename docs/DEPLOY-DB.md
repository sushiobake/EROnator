# デプロイと DB マイグレーション

## いまの動き（② 自動）

`npm run build` の流れは次のとおりです。

1. `auto-switch-schema.js` … `DATABASE_URL` に応じて `schema.prisma` を SQLite / Postgres 用に切り替え
2. **`run-migrate-if-postgres.js`** … Postgres のときだけ **`prisma migrate deploy`**
3. `prisma generate` → `next build`

Vercel は `buildCommand` で `npm run build` を使うため、**本番・プレビューのビルド時に、それぞれの環境の DB へ未適用マイグレーションが適用**されます（`DATABASE_URL` がその環境用に設定されている前提）。

Postgres スキーマから **`directUrl` / `DIRECT_URL` は外してある**（未設定だと Prisma がビルドで P1012 になるため）。`migrate deploy` は **`DATABASE_URL` のみ**を使う。プーラー URL だけでマイグレーションが拒否されるプロバイダのときは、ビルド用に直接接続の `DATABASE_URL` を使う等の対応が必要。

## デメリット・注意（隠れていない前提）

| 項目 | 内容 |
|------|------|
| ビルド失敗 | マイグレーションが失敗すると **ビルド全体が失敗**し、そのデプロイは完了しません。 |
| 接続先の取り違え | `DATABASE_URL` が誤っている環境でビルドすると **誤った DB に migrate が当たる**ため、Vercel の環境変数は環境ごとに正しく分けてください。 |
| 同時デプロイ | 極稀に複数ビルドが同時に migrate するときの競合は Prisma 側のロックで多くは吸収されますが、重いマイグレーション時は窓を空けると安心です。 |
| ローカル `npm run build` | SQLite のときは migrate は **スキップ**されます。 |

## 緊急時だけ migrate をビルドから外す

**非推奨**（スキーマと DB のズレが再発しやすくなります）。

```bash
SKIP_PRISMA_MIGRATE_ON_BUILD=1 npm run build
```

Vercel では該当環境の環境変数に一時的に設定する必要があります。

## 手元で本番相当の DB に当てる

`.env.local` で `DATABASE_URL` を本番用 Postgres に向けたうえで:

```bash
npm run db:migrate:deploy
```

（`migrate-deploy-with-env-local.js` が `.env` / `.env.local` を読みます。）

## スキーマ変更時のルール（再発防止）

- `prisma/schema.sqlite.prisma` と `prisma/schema.postgres.prisma` を揃え、`prisma/migrations` に SQL をコミットする。
- **アプリだけ先にデプロイして DB を後回し**にしない（今回のビルド組み込みで齟齬は減りますが、マイグレーション未コミットのまま push しない）。
