# Prismaが0件を返す問題の解決方法

## 問題の症状

- PrismaがWorkやTagを0件返す
- 直接SQLiteではデータが存在する
- 「セッションに失敗しました」エラーが発生する

## 根本原因

`prisma/prisma/dev.db`という間違ったDBファイルが存在し、Prismaがそちらを参照している可能性があります。

## 解決方法

### 方法1: 自動修正スクリプトを使用（推奨）

1. **開発サーバーを停止**（Ctrl+C）
2. 以下のコマンドを実行：

```bash
npm run fix:prisma
```

このスクリプトは以下を実行します：
- 間違ったDBファイル（`prisma/prisma/dev.db`）を削除
- Prisma Clientを再生成
- データベースの状態を確認

### 方法2: 手動で修正

1. **開発サーバーを停止**（Ctrl+C）
2. 間違ったDBファイルを削除：

```powershell
Remove-Item -Path "prisma\prisma\dev.db" -Force
```

3. Prisma Clientを再生成：

```bash
npx prisma generate
```

4. 開発サーバーを再起動：

```bash
npm run dev
```

## 予防策

- `src/server/db/client.ts`にDATABASE_URLの検証機能を追加しました
- 間違ったDBファイルが存在する場合、警告が表示されます
- 開発サーバー起動時に自動的に検証されます

## ショートカット

- `Ctrl+Shift+D`: `npm run dev`を実行
- `Ctrl+Shift+C`: `npm run dev:clean`を実行（クリーンアップしてから起動）
