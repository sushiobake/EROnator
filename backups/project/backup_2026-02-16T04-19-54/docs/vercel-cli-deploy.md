# Vercel CLIでデプロイする方法（GitHub不要）

GitHubアカウントを持っていない、またはGitHubを使いたくない場合、Vercel CLIを使って直接デプロイできます。

## 前提条件

- Node.jsがインストールされていること
- プロジェクトがローカルで動作すること

## 手順

### 1. Vercel CLIをインストール

```bash
npm i -g vercel
```

### 2. Vercelにログイン

```bash
vercel login
```

ブラウザが開き、メールアドレスでログインできます。

### 3. プロジェクトをデプロイ

プロジェクトルート（`package.json`があるディレクトリ）で実行：

```bash
vercel
```

初回実行時：
1. **Set up and deploy?** → `Y`（Yes）
2. **Which scope?** → 自分のアカウントを選択
3. **Link to existing project?** → `N`（No、新規プロジェクト）
4. **What's your project's name?** → プロジェクト名を入力（例: `eronator-mvp0`）
5. **In which directory is your code located?** → `./`（そのままEnter）
6. **Want to override the settings?** → `N`（そのままEnter）

### 4. 環境変数の設定

デプロイ後、環境変数を設定します：

```bash
vercel env add DATABASE_URL
```

プロンプトが表示されるので：
- **Environment**: `Production`（本番環境）
- **Value**: Supabaseの接続URLを入力

同様に、他の環境変数も設定：

```bash
vercel env add AFFILIATE_ID
vercel env add ERONATOR_DEBUG
# など
```

または、Vercelダッシュボードから設定：
1. https://vercel.com にアクセス
2. プロジェクトを選択
3. **Settings** → **Environment Variables**
4. 環境変数を追加

### 5. 本番環境にデプロイ

```bash
vercel --prod
```

これで本番環境（`your-app.vercel.app`）にデプロイされます。

### 6. 動作確認

デプロイ完了後、表示されたURLにアクセスして動作確認してください。

## 今後の更新

コードを変更した後、再度デプロイ：

```bash
vercel --prod
```

## メリット

- GitHubアカウントが不要
- コマンドラインから直接デプロイ可能
- 自動デプロイも設定可能（GitHub連携後）

## デメリット

- 自動デプロイ（Git push時の自動デプロイ）は設定できない（GitHub連携が必要）
- 手動で`vercel --prod`を実行する必要がある

## GitHub連携を後から追加する場合

後からGitHubリポジトリを連携して自動デプロイを有効にすることもできます：

1. Vercelダッシュボード → **Settings** → **Git**
2. **Connect Git Repository**をクリック
3. GitHub/GitLab/Bitbucketを選択して連携
