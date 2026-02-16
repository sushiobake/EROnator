# Supabaseセットアップ手順（日本語ガイド）

## ブラウザの日本語化

SupabaseのUIは英語のみですが、ブラウザの翻訳機能で日本語化できます：

### Chrome/Edgeの場合
1. Supabaseのページを開く
2. ページ上で右クリック
3. 「日本語に翻訳」を選択

### Firefoxの場合
1. アドオン「To Google Translate」などをインストール
2. または、Google翻訳の拡張機能を使用

## 接続情報の取得手順（詳細）

### Step 1: プロジェクトダッシュボードを開く

1. https://supabase.com にログイン
2. 作成したプロジェクトをクリック
3. プロジェクトダッシュボードが開きます

### Step 2: 設定画面を開く

左サイドバー（縦に並んだメニュー）から：
- **⚙️ Settings**（設定）アイコンをクリック
- または、一番下の方にある **Settings** テキストをクリック

### Step 3: Database設定を開く

Settings画面の左メニューから：
- **Database**（データベース）をクリック
- または、**Database** というテキストリンクをクリック

### Step 4: 接続文字列を探す

Database設定ページで、下にスクロールすると以下のセクションがあります：

#### セクション1: "Connection string"（接続文字列）

このセクションには複数のタブがあります：
- **URI** タブ
- **JDBC** タブ
- **Golang** タブ
- など

**URIタブ**をクリックすると、以下のような文字列が表示されます：

```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
```

**重要**: `[YOUR-PASSWORD]`の部分を、プロジェクト作成時に設定したパスワードに手動で置き換える必要があります。

#### セクション2: "Connection pooling"（接続プール）

このセクションにも接続文字列があります。Vercelにデプロイする場合は、こちらを使用することを推奨します。

**Connection string**をコピーすると、以下のような形式です：

```
postgresql://postgres.xxxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
```

**重要**: 
- `[YOUR-PASSWORD]`を実際のパスワードに置き換える
- Vercel用には、末尾に`?pgbouncer=true&connection_limit=1`を追加

### Step 5: 接続文字列の完成形

最終的な接続文字列の例：

```
postgresql://postgres.xxxxxxxxxxxxx:your-actual-password@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

## 見つからない場合の対処法

### 1. プロジェクトが完全に作成されていない

- プロジェクト作成後、2-3分待ってから再度確認
- ブラウザをリロード（F5）

### 2. 別の場所を確認

- **Settings** → **API** → **Project URL** の下に接続情報がある場合もあります
- または、**Settings** → **Database** → **Connection info** セクション

### 3. 手動で構築

以下の情報を集めて手動で構築することもできます：

1. **Settings** → **Database** → **Connection info** から：
   - **Host**: `db.xxxxxxxxxxxxx.supabase.co`
   - **Database name**: `postgres`
   - **Port**: `5432`
   - **User**: `postgres`
   - **Password**: プロジェクト作成時に設定したパスワード

2. 接続文字列を構築：
   ```
   postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/[DATABASE]
   ```

## 次のステップ

接続文字列を取得したら：
1. `.env.local`ファイルに保存
2. `docs/deployment.md`の「Phase 2: Prismaスキーマの変更」に進む
