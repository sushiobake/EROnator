# デプロイ手順（Vercel + Supabase）

## 概要

このアプリケーションをVercel + Supabaseにデプロイする手順です。

## Phase 1: Supabaseのセットアップ

**詳細な手順は [`supabase-setup-ja.md`](./supabase-setup-ja.md) を参照してください。**

### 1. Supabaseアカウント作成

1. https://supabase.com にアクセス
2. GitHubアカウントでサインアップ（推奨）
3. 「New Project」をクリック

### 2. プロジェクト作成

- **Organization**: 新規作成または既存を選択
- **Name**: プロジェクト名（例: `eronator-mvp0`）
- **Database Password**: 強力なパスワードを設定（**必ずメモする**）
- **Region**: 最寄りのリージョンを選択（例: `Northeast Asia (Tokyo)`）
- **Pricing Plan**: Free を選択

### 3. 接続情報の取得

**詳細な手順は [`supabase-setup-ja.md`](./supabase-setup-ja.md) を参照してください。**

**簡単な手順:**

1. 左サイドバーの **⚙️ Settings**（設定）をクリック
2. 左メニューから **Database**（データベース）をクリック
3. ページを下にスクロールして **Connection pooling**（接続プール）セクションを見つける
4. **Connection string** をコピー
5. `[YOUR-PASSWORD]`の部分を、プロジェクト作成時に設定したパスワードに置き換える
6. 末尾に`?pgbouncer=true&connection_limit=1`を追加

**完成形の例:**
```
postgresql://postgres.xxxxxxxxxxxxx:your-actual-password@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**日本語化について:**
- SupabaseのUIは英語のみですが、ブラウザの翻訳機能（Chrome: 右クリック → 「日本語に翻訳」）を使用できます
- 詳細は [`supabase-setup-ja.md`](./supabase-setup-ja.md) を参照

### 4. 接続情報の保存

`.env.local`ファイルを作成（または`.env`に追加）：

```env
# Supabase PostgreSQL接続URL
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true&connection_limit=1"

# 既存の環境変数
AFFILIATE_ID=""
ERONATOR_DEBUG=1
ERONATOR_DEBUG_TOKEN=devtoken
NEXT_PUBLIC_DEBUG_TOKEN=devtoken
```

**注意**: 
- `[YOUR-PASSWORD]`を実際のパスワードに置き換える
- `[PROJECT-REF]`を実際のプロジェクト参照IDに置き換える
- `?pgbouncer=true&connection_limit=1`はVercel用の接続プール設定（重要）

## Phase 2: Prismaスキーマの変更

### 1. PrismaスキーマをPostgreSQLに変更

`prisma/schema.prisma`の`datasource`を変更：

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 2. Prisma Clientを再生成

```bash
npm run db:generate
```

### 3. データベースにスキーマを適用

```bash
npm run db:push
```

または、マイグレーションを使用する場合：

```bash
npx prisma migrate dev --name init
```

## Phase 3: データ移行（既存データがある場合）

### 1. データ移行スクリプトの実行

既存のSQLiteデータベース（`prisma/dev.db`）がある場合：

```bash
node scripts/migrate-to-postgres.js
```

このスクリプトは後で作成します。

### 2. データの確認

Supabaseのダッシュボードで確認：
- **Table Editor**でテーブルとデータを確認

## Phase 4: Vercelのセットアップ

### 1. リポジトリの準備

**オプションA: GitHubを使用（推奨）**

```bash
git init
git add .
git commit -m "Initial commit for Vercel deployment"
git remote add origin <your-github-repo-url>
git push -u origin main
```

**オプションB: GitLab/Bitbucketを使用**

GitLabやBitbucketでもVercelは対応しています。同様にリポジトリにプッシュしてください。

**オプションC: Vercel CLIを使用（GitHub不要）**

GitHubを使わない場合、Vercel CLIで直接デプロイできます：

```bash
npm i -g vercel
vercel login
vercel
```

### 2. Vercelにサインアップ

1. https://vercel.com にアクセス
2. **サインアップ方法の選択:**
   - **GitHubアカウント**（推奨、自動デプロイに便利）
   - **GitLabアカウント**
   - **Bitbucketアカウント**
   - **メールアドレス**（CLI経由でデプロイする場合）

### 3. プロジェクトをインポート

1. Vercelダッシュボードで「**Add New...**」→「**Project**」
2. GitHubリポジトリを選択
3. **Configure Project**:
   - **Framework Preset**: Next.js（自動検出される）
   - **Root Directory**: `./`（そのまま）
   - **Build Command**: `npm run build`（そのまま）
   - **Output Directory**: `.next`（そのまま）

### 4. 環境変数の設定

**Environment Variables**セクションで以下を追加：

| Name | Value | Environment |
|------|-------|-------------|
| `DATABASE_URL` | Supabaseの接続URL（Phase 1で取得） | Production, Preview, Development |
| `AFFILIATE_ID` | アフィリエイトID（本番用） | Production |
| `ERONATOR_DEBUG` | `0`（本番では無効化） | Production |
| `ERONATOR_DEBUG_TOKEN` | （本番では不要） | - |
| `NEXT_PUBLIC_DEBUG_TOKEN` | （本番では不要） | - |

**重要**: 
- `DATABASE_URL`は`?pgbouncer=true&connection_limit=1`を含める
- Production環境では`ERONATOR_DEBUG=0`に設定

### 5. デプロイ

1. 「**Deploy**」をクリック
2. 数分待つ
3. デプロイ完了後、URLが発行される（例: `your-app.vercel.app`）

## Phase 5: 動作確認

### 1. デプロイされたURLにアクセス

例: `https://your-app.vercel.app`

### 2. 動作確認

- トップページが表示される
- 年齢確認 → AI選択 → 質問が表示される
- データベース接続が正常に動作している

### 3. エラーが発生した場合

- Vercelの**Logs**タブでエラーを確認
- 環境変数が正しく設定されているか確認
- Supabaseの接続が正常か確認

## Phase 6: 独自ドメインの設定（オプション、審査通過後）

### 1. ドメインを取得

- 例: `yourdomain.com`
- ドメイン取得サービス（例: Namecheap, Google Domains）で取得

### 2. Vercelでドメインを設定

1. Vercelダッシュボード → **Settings** → **Domains**
2. 「**Add Domain**」をクリック
3. ドメイン名を入力（例: `yourdomain.com`）
4. DNS設定の指示に従う

### 3. DNS設定

ドメイン提供元のDNS設定で以下を追加：

- **Type**: `CNAME`
- **Name**: `@` または `www`
- **Value**: `cname.vercel-dns.com`

### 4. SSL証明書の自動発行

Vercelが自動的にSSL証明書を発行（数分〜数時間）

## トラブルシューティング

### データベース接続エラー

- `DATABASE_URL`に`?pgbouncer=true&connection_limit=1`が含まれているか確認
- Supabaseのパスワードが正しいか確認
- Supabaseのプロジェクトがアクティブか確認

### ビルドエラー

- `npm run build`がローカルで成功するか確認
- 環境変数が正しく設定されているか確認
- Prisma Clientが正しく生成されているか確認（`npm run db:generate`）

### デプロイ後のエラー

- Vercelの**Logs**タブでエラーを確認
- Supabaseの**Logs**タブでクエリエラーを確認
- 環境変数がProduction環境に設定されているか確認

## 次のステップ

- [ ] Supabaseプロジェクト作成
- [ ] PrismaスキーマをPostgreSQLに変更
- [ ] データ移行スクリプトの作成・実行
- [ ] GitHubにプッシュ
- [ ] Vercelでデプロイ
- [ ] 動作確認
- [ ] 独自ドメイン設定（審査通過後）
