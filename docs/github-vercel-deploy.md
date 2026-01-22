# GitHub + Vercel デプロイ手順（詳細版）

## Phase 1: GitHubリポジトリの準備

### Step 1: GitHubでリポジトリを作成

1. https://github.com にログイン
2. 右上の「**+**」アイコンをクリック → 「**New repository**」を選択
3. リポジトリ情報を入力：
   - **Repository name**: `eronator-mvp0`（任意の名前でOK）
   - **Description**: （任意、空欄でもOK）
   - **Visibility**: 
     - **Public**（無料、誰でも見れる）
     - **Private**（有料プランが必要、または無料で3つまで）
   - **Initialize this repository with**: すべて**チェックを外す**（既存のコードをプッシュするため）
4. 「**Create repository**」をクリック

### Step 2: リポジトリのURLをコピー

リポジトリ作成後、表示されるページで：
- 「**Quick setup**」セクションのURLをコピー
- 例: `https://github.com/your-username/eronator-mvp0.git`
- または、SSH形式: `git@github.com:your-username/eronator-mvp0.git`

### Step 3: ローカルでGitを初期化

プロジェクトルート（`package.json`があるディレクトリ）で実行：

```powershell
# Gitリポジトリを初期化
git init

# すべてのファイルをステージング
git add .

# 初回コミット
git commit -m "Initial commit: MVP0 implementation"

# リモートリポジトリを追加（your-username/eronator-mvp0 を実際のリポジトリ名に置き換える）
git remote add origin https://github.com/your-username/eronator-mvp0.git

# メインブランチを設定
git branch -M main

# リモートにプッシュ
git push -u origin main
```

**注意**: 
- `your-username`を実際のGitHubユーザー名に置き換える
- リポジトリ名も実際の名前に置き換える
- 初回プッシュ時、GitHubの認証情報（ユーザー名とパスワード/トークン）を求められる場合があります

### Step 4: プッシュの確認

GitHubのリポジトリページをリロードして、ファイルが表示されていることを確認してください。

## Phase 2: Vercelのセットアップ

### Step 1: Vercelにサインアップ

1. https://vercel.com にアクセス
2. 「**Sign Up**」をクリック
3. 「**Continue with GitHub**」をクリック
4. GitHubの認証画面で「**Authorize Vercel**」をクリック
5. Vercelのダッシュボードが表示されます

### Step 2: プロジェクトをインポート

1. Vercelダッシュボードで「**Add New...**」をクリック
2. 「**Project**」を選択
3. 「**Import Git Repository**」画面で：
   - GitHubリポジトリの一覧が表示されます
   - 作成したリポジトリ（例: `eronator-mvp0`）を選択
   - 「**Import**」をクリック

### Step 3: プロジェクト設定

**Configure Project**画面で以下を確認・設定：

1. **Project Name**: プロジェクト名（そのまま、または変更可）
2. **Framework Preset**: `Next.js`（自動検出される）
3. **Root Directory**: `./`（そのまま）
4. **Build Command**: `npm run build`（そのまま）
5. **Output Directory**: `.next`（そのまま）
6. **Install Command**: `npm install`（そのまま）

**重要**: この時点では「**Deploy**」をクリック**しない**でください。先に環境変数を設定します。

### Step 4: 環境変数の設定

**Environment Variables**セクションで、以下を追加します：

#### 環境変数1: DATABASE_URL

1. 「**Add**」をクリック
2. **Name**: `DATABASE_URL`
3. **Value**: Supabaseの接続URL
   ```
   postgresql://postgres:Matsuko110-@db.qmzxgycowketnvrrdpft.supabase.co:5432/postgres?pgbouncer=true&connection_limit=1
   ```
4. **Environment**: 
   - ✅ **Production**（本番環境）
   - ✅ **Preview**（プレビュー環境）
   - ✅ **Development**（開発環境）
   - すべてにチェックを入れる
5. 「**Save**」をクリック

#### 環境変数2: AFFILIATE_ID

1. 「**Add**」をクリック
2. **Name**: `AFFILIATE_ID`
3. **Value**: （本番用のアフィリエイトID、まだない場合は空文字列 `""`）
4. **Environment**: ✅ **Production** のみ
5. 「**Save**」をクリック

#### 環境変数3: ERONATOR_DEBUG（本番では無効化）

1. 「**Add**」をクリック
2. **Name**: `ERONATOR_DEBUG`
3. **Value**: `0`（本番ではデバッグを無効化）
4. **Environment**: ✅ **Production** のみ
5. 「**Save**」をクリック

**注意**: 
- `ERONATOR_DEBUG_TOKEN`と`NEXT_PUBLIC_DEBUG_TOKEN`は本番環境では設定しない（デバッグ機能は本番で無効化）

### Step 5: デプロイ実行

環境変数の設定が完了したら：

1. 画面下部の「**Deploy**」ボタンをクリック
2. デプロイが開始されます（数分かかります）
3. デプロイ中はログが表示されます

### Step 6: デプロイ完了の確認

デプロイが完了すると：

1. 「**Congratulations!**」というメッセージが表示されます
2. **Deployment URL**が表示されます（例: `https://eronator-mvp0.vercel.app`）
3. 「**Visit**」ボタンをクリックして、デプロイされたサイトを確認

## Phase 3: 動作確認

### Step 1: デプロイされたサイトにアクセス

表示されたURL（例: `https://eronator-mvp0.vercel.app`）にアクセス

### Step 2: 動作確認

1. トップページが表示される
2. 「18歳以上ですか？」→「はい」
3. 「AI作品ですか？」→いずれかを選択
4. セッションが開始され、質問が表示される
5. 質問に回答して、正常に動作することを確認

### Step 3: エラーが発生した場合

- Vercelダッシュボード → **Deployments** → 最新のデプロイをクリック → **Logs**タブでエラーを確認
- 環境変数が正しく設定されているか確認
- Supabaseの接続が正常か確認

## Phase 4: 今後の更新方法

コードを変更した後、GitHubにプッシュすると自動的にデプロイされます：

```powershell
# 変更をコミット
git add .
git commit -m "変更内容の説明"

# GitHubにプッシュ
git push

# Vercelが自動的にデプロイを開始します
```

## トラブルシューティング

### ビルドエラーが発生する

- Vercelの**Logs**タブでエラーを確認
- ローカルで`npm run build`が成功するか確認
- 環境変数が正しく設定されているか確認

### データベース接続エラー

- `DATABASE_URL`が正しく設定されているか確認
- Supabaseのプロジェクトがアクティブか確認
- 接続文字列に`?pgbouncer=true&connection_limit=1`が含まれているか確認

### デプロイが自動的に開始されない

- Vercelダッシュボード → **Settings** → **Git** でリポジトリが連携されているか確認
- GitHubのリポジトリに正しくプッシュされているか確認

## 次のステップ

- [ ] GitHubリポジトリを作成
- [ ] コードをプッシュ
- [ ] Vercelでプロジェクトをインポート
- [ ] 環境変数を設定
- [ ] デプロイ実行
- [ ] 動作確認
- [ ] 独自ドメイン設定（審査通過後）
