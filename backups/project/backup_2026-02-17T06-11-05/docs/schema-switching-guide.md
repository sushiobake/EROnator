# スキーマ切り替えガイド

ローカル開発（SQLite）と Preview/本番環境（PostgreSQL）で `schema.prisma` を自動的に切り替える仕組みです。

## 概要

- **ローカル開発**: SQLite (`schema.sqlite.prisma`)
- **Preview環境**: PostgreSQL (`schema.postgres.prisma`)
- **本番環境**: PostgreSQL (`schema.postgres.prisma`)

## 使い方

### 1. ローカル開発（通常の作業）

ローカル開発では、`schema.prisma` は SQLite のままです。何もする必要はありません。

```powershell
npm run dev
```

### 2. Preview環境にプッシュ（他人と共有）

`develop` ブランチにプッシュする前に、スキーマを PostgreSQL に切り替えます：

```powershell
# 1. 変更をコミット
git add .
git commit -m "変更内容"

# 2. スキーマを PostgreSQL に切り替え（自動でコミットもされます）
npm run prepare:push

# 3. GitHubにプッシュ
git push origin develop

# 4. ローカル開発用に SQLite に戻す
npm run restore:sqlite
```

**結果:**
- ✅ Preview環境（`https://eronator-git-develop-xxx.vercel.app`）で確認・共有可能
- ✅ 本番環境（`https://eronator.vercel.app`）は変更されない

### 3. 本番環境にデプロイ

「良い感じ」になったら、本番環境に反映します：

```powershell
npm run deploy:prod
```

このコマンドは以下を自動で実行します：
1. `schema.prisma` を PostgreSQL に切り替え
2. `main` ブランチにマージ
3. 本番環境にデプロイ
4. `schema.prisma` を SQLite に戻す

**結果:**
- ✅ 本番環境（`https://eronator.vercel.app`）に反映
- ✅ ローカル開発用に SQLite に戻される

## トラブルシューティング

### エラー: "schema.postgres.prisma が見つかりません"

`prisma/schema.postgres.prisma` ファイルが存在するか確認してください。

### エラー: "schema.sqlite.prisma が見つかりません"

`prisma/schema.sqlite.prisma` ファイルが存在するか確認してください。

### 手動で SQLite に戻す

```powershell
npm run restore:sqlite
```

または、直接コピー：

```powershell
Copy-Item prisma/schema.sqlite.prisma prisma/schema.prisma -Force
```

## 仕組み

- `schema.sqlite.prisma`: ローカル開発用（SQLite）
- `schema.postgres.prisma`: Preview/本番環境用（PostgreSQL）
- `schema.prisma`: 実際に使用されるスキーマ（自動で切り替わる）

Git には `schema.prisma` がコミットされますが、環境に応じて適切なスキーマが使用されます。
