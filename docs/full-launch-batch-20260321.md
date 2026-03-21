# 本番向け一括変更（2026-03-21）

## バックアップ

`npm run backup:project` 実行済みの場合、最新は `backups/project/backup_*` にあります。復元手順は各バックアップ内 `HOW_TO_RESTORE.md` を参照。

## DB: ContactInquiry テーブル

本番・ローカルで Prisma のマイグレーションまたは `db push` を実行し、`ContactInquiry` を作成してください。

- ソース・オブ・トゥルース: `prisma/schema.sqlite.prisma` と `prisma/schema.postgres.prisma`
- ビルド時に `schema.prisma` は自動で上書きされます（`scripts/auto-switch-schema.js`）

例（ローカル SQLite）:

```bash
npm run db:push
```

## 追加・変更の概要

| 項目 | 内容 |
|------|------|
| お問い合わせ | `POST /api/contact` → DB。管理画面タブ「お問い合わせ」 |
| 法務ページ | `/privacy`, `/terms`, `/affiliate` |
| フッター | 全ページ下部に上記＋`/contact` へのリンク |
| Success 保存 | html2canvas + 共有 `MosaicImage`（推薦モードと同系） |
| トースト | `page.tsx` の `alert` を置換 |
| セッション消失 | API `code: SESSION_NOT_FOUND` で localStorage 掃除＋トップへ |
| Vercel Analytics | `AppProviders` 内（Vercel 外では no-op に近い） |
| SEO | `robots.ts`, `sitemap.ts` |
| 404/エラー | `not-found.tsx`, `error.tsx` |
| favicon | `layout` metadata で `inari_thinking_opening.png`（ロゴ画像が追加されたら差し替え可） |

## アフィリエイト

本番の `NEXT_PUBLIC_SITE_URL` を正しく設定すると、`sitemap.xml` / `robots.txt` のベース URL が一致します。
