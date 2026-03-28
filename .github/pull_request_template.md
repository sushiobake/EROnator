## 概要

<!-- 変更内容を簡潔に -->

## チェックリスト

- [ ] `prisma/` を変えた場合: **`prisma/migrations` にマイグレーションを含めた**（または DB 変更不要である）
- [ ] `schema.sqlite.prisma` と `schema.postgres.prisma` を**両方**更新した（該当する場合）
- [ ] 本番で必要なら **Vercel の環境変数**（`DATABASE_URL` / `DIRECT_URL`）に問題がないことを確認した

<!-- ビルド時に `prisma migrate deploy` が走ります。マイグレーション未適用のままマージすると、ビルド失敗または実行時エラーの原因になります。 -->
