# 本番で /admin を 404 にする変更のバックアップ

## 変更内容
- `src/app/admin/layout.tsx` を**新規作成**し、本番（Vercel デプロイ）では `notFound()` を呼んで管理画面を表示しないようにした。

## 戻し方（revert）
1. **作成したファイルを削除する**
   - `src/app/admin/layout.tsx` を削除するだけで、従来どおり本番でも /admin にアクセスできるようになります。

## 判定条件
- `VERCEL_ENV === 'production'` のときのみ 404。ローカル（`npm run dev` や Vercel の Preview）では従来どおり管理画面が開けます。
