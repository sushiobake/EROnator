# DBバックアップ

## フォルダ移行前バックアップ (2026-02-15)

- **ファイル**: `dev_before_folder_migration_20260215_144839.db`
- **内容**: 人力タグ付けを「6フォルダ＋移動」方式に変更する直前の SQLite DB コピー
- **作成理由**: フォルダ化・チェック削除の作業前に現状を保存

## 復元方法

作業後に問題があった場合、以下で元の DB に戻せます。

1. アプリ・開発サーバーを止める
2. 現在の `prisma/dev.db` を別名で退避（任意）
3. このフォルダの `dev_before_folder_migration_*.db` を `prisma/dev.db` にコピー
4. アプリを再起動

例 (PowerShell):

```powershell
cd c:\tool\eronator_mvp0_ws_v1_5_3
Copy-Item prisma\dev.db prisma\dev.db.after_folder_migration
Copy-Item prisma\backups\dev_before_folder_migration_20260215_144839.db prisma\dev.db
```
