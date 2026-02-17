# npmスクリプト一覧ガイド

このプロジェクトで使用可能なnpmスクリプトの一覧と説明です。

## 📦 開発・ビルド

### `npm run dev`
ローカル開発サーバーを起動します。
- ポート: `http://localhost:3000`
- ホットリロード対応
- ロックファイルを使用して複数インスタンスの起動を防止

### `npm run dev:clean`
クリーンな状態で開発サーバーを起動します。
- `.next`ディレクトリをクリアしてから起動
- キャッシュ問題の解決に有用

### `npm run build`
本番用ビルドを実行します。
- **自動でスキーマを切り替え**（SQLite/PostgreSQL）
- Prisma Clientを生成
- Next.jsアプリケーションをビルド
- Vercel環境では自動でPostgreSQLスキーマに切り替わります

### `npm run start`
ビルド済みアプリケーションを起動します。
- `npm run build`の後に実行
- 本番環境での起動に使用

### `npm run build:clean`
クリーンな状態でビルドを実行します。
- `.next`ディレクトリをクリアしてからビルド

### `npm run start:clean`
クリーンな状態で起動します。

### `npm run clean`
`.next`ディレクトリをクリアします。

## 🗄️ データベース

### `npm run db:generate`
Prisma Clientを生成します。
- スキーマ変更後に実行が必要

### `npm run db:push`
データベーススキーマをプッシュします。
- マイグレーションファイルを作成せずに直接適用
- 開発環境で使用

### `npm run db:seed`
シードデータを投入します。
- 初期データ（タグなど）をデータベースに投入

### `npm run fix:prisma`
Prismaデータベースの問題を修正します。
- データベース接続エラーなどのトラブルシューティング用

## 📥 データインポート

### `npm run import:batch`
バッチインポートを実行します。
- 作品データを一括インポート
- `data/staging/`ディレクトリのファイルを処理

## 🔄 デプロイ・共有

### `npm run prepare:push`
プレビュー環境にプッシュする準備をします。
- スキーマをPostgreSQLに切り替え
- `develop`ブランチ専用
- **注意**: 現在は自動切り替え機能により、このスクリプトは不要になりました

### `npm run restore:sqlite`
ローカル開発用にスキーマをSQLiteに戻します。
- プレビュー環境にプッシュした後に実行
- **注意**: 現在は自動切り替え機能により、通常は不要です

### `npm run deploy:prod`
本番環境にデプロイします。
- `develop`ブランチを`main`ブランチにマージ
- 本番環境（Vercel）に反映
- スキーマを自動でPostgreSQLに切り替え

## 💾 バックアップ

### `npm run backup:project`
プロジェクト全体のバックアップを作成します。
- `backups/project/backup_YYYY-MM-DDTHH-MM-SS/`に保存
- 以下のファイル・ディレクトリをバックアップ:
  - `src/app/components`
  - `src/app/api`
  - `src/server`
  - `config`
  - `prisma/schema.prisma`
  - `package.json`
  - `tsconfig.json`
  - `next.config.js`
- 30日以上古いバックアップは自動削除

### `npm run backup:admin-tags`
管理者画面のタグ設定をバックアップします。
- タグリストの自動バックアップ

## 🧪 テスト

### `npm run test`
テストを実行します。
- Jestを使用

### `npm run test:watch`
ウォッチモードでテストを実行します。
- ファイル変更を検知して自動再実行

## 🔧 その他

### `npm run lint`
ESLintでコードをチェックします。

### `npm run setup:git-hooks`
Gitフックをセットアップします。
- コミット前に自動バックアップを実行するフックを設定

## 🔌 DMM Affiliate API

### `npm run test:dmm-floor`
DMM Affiliate APIのフロアAPIをテストします。
- FANZAの全フロア一覧を取得
- 漫画関連のフロアを自動検出
- フロアコードとフロアIDを表示
- 環境変数: `DMM_API_ID`, `DMM_AFFILIATE_ID`が必要

## 📝 よく使うコマンドの組み合わせ

### 初回セットアップ
```powershell
npm run db:push
npm run db:seed
npm run dev
```

### 開発中の通常フロー
```powershell
npm run dev
# コードを編集...
npm run backup:project  # 定期的にバックアップ
```

### プレビュー環境に共有
```powershell
git checkout -b share-preview
git add .
git commit -m "変更内容"
git push origin share-preview
# スキーマは自動で切り替わります
```

### 本番環境にデプロイ
```powershell
npm run deploy:prod
```

## ⚠️ 注意事項

1. **スキーマ自動切り替え**: `npm run build`実行時に、環境に応じて自動でSQLite/PostgreSQLスキーマが切り替わります。手動での切り替えは不要です。

2. **バックアップ**: 重要な変更前には`npm run backup:project`を実行することを推奨します。

3. **データベース**: ローカル開発ではSQLite、Vercel環境ではPostgreSQLが自動で使用されます。
