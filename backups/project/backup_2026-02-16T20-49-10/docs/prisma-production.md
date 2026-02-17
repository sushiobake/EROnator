# Prisma と本番環境

Prisma は本番環境で広く使われている ORM です。このプロジェクトでも本番で問題なく利用できます。

## 本番デプロイ時の手順

1. **マイグレーションの適用**
   - 開発では `prisma migrate dev` でマイグレーションを作成・適用します。
   - 本番では **`prisma migrate deploy`** を使います（対話なしで既存マイグレーションを適用）。
   - Vercel などではビルド時に `prisma generate` を実行し、デプロイ後の起動時やビルドフックで `prisma migrate deploy` を実行する構成にすることが多いです。

2. **環境変数**
   - 本番の `DATABASE_URL` を正しく設定してください（SQLite の場合はファイルパス、PostgreSQL の場合は接続文字列など）。

3. **SQLite の場合**
   - ファイルベースのため、サーバーレス（Vercel 等）では **書き込みが永続化されない** ことがあります（読み取り専用ファイルシステムやエフェメラルな環境）。
   - 本番で永続的な DB が必要な場合は、**PostgreSQL や MySQL など外部 DB の利用**を検討してください（例: Vercel Postgres、Supabase、PlanetScale）。

4. **接続プール（PostgreSQL/MySQL の場合）**
   - サーバーレスでは接続数制限に注意し、必要に応じて Prisma の接続プールや PgBouncer などを検討してください。

## まとめ

- **Prisma 自体は本番で問題なく使えます。**
- 本番では `prisma migrate deploy` でスキーマを適用し、`DATABASE_URL` を本番用に設定するだけです。
- DB が SQLite の場合は、デプロイ先がファイル永続化を保証しているか確認し、必要なら Postgres 等への移行を検討してください。
