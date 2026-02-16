# 審査中の開発ガイド

審査提出後、審査が終わるまでの間、サイトを変更せずに開発を進める方法です。

## 基本方針

- **Production環境（審査用URL）**: 変更しない（安定版を維持）
- **開発環境**: 自由に変更可能（UI改善、DB整備、実装チェックなど）

## 方法1: Gitブランチ戦略（推奨）

### ブランチ構成

```
main (審査用・変更しない)
  └── develop (開発用・自由に変更可能)
      ├── feature/ui-improvements
      ├── feature/db-cleanup
      └── feature/implementation-checks
```

### 手順

1. **審査用ブランチの保護**
   ```powershell
   # mainブランチを保護（GitHubで設定）
   # GitHub → Settings → Branches → Add rule
   # Branch name pattern: main
   # ✅ Require pull request reviews before merging
   # ✅ Require status checks to pass before merging
   ```

2. **開発用ブランチの作成**
   ```powershell
   # developブランチを作成
   git checkout -b develop
   git push -u origin develop
   ```

3. **開発作業**
   ```powershell
   # 開発用ブランチで作業
   git checkout develop
   
   # UI改善、DB整備など自由に変更
   # ...
   
   # コミット
   git add .
   git commit -m "UI改善: ボタンデザインの調整"
   git push origin develop
   ```

4. **VercelでPreview環境を確認**
   - `develop`ブランチにプッシュすると、Vercelが自動的にPreview環境を作成
   - Preview URL: `https://eronator-git-develop-ユーザー名.vercel.app`
   - このURLで変更内容を確認可能

5. **審査通過後のマージ**
   ```powershell
   # 審査通過後、developブランチをmainにマージ
   git checkout main
   git merge develop
   git push origin main
   ```

## 方法2: Vercelの環境分離

### 環境の使い分け

- **Production環境**: `main`ブランチ → `https://eronator.vercel.app`（審査用・変更しない）
- **Preview環境**: `develop`ブランチ → `https://eronator-git-develop-xxx.vercel.app`（開発用・自由に変更）

### 手順

1. **Production環境の保護**
   - Vercelダッシュボード → Settings → Git
   - Production Branch: `main` に設定
   - これにより、`main`ブランチへのマージのみがProduction環境に反映

2. **Preview環境での開発**
   - `develop`ブランチで作業
   - プッシュすると自動的にPreview環境が作成される
   - Preview URLで変更内容を確認

3. **環境変数の設定**
   - Production環境: 審査用の環境変数（変更しない）
   - Preview環境: 開発用の環境変数（自由に変更可能）
   - Vercelダッシュボード → Settings → Environment Variables で環境ごとに設定可能

## 開発作業の例

### UI改善

```powershell
# developブランチで作業
git checkout develop

# UI改善の実装
# src/app/components/Quiz.tsx などを編集
# ...

# コミット・プッシュ
git add .
git commit -m "UI改善: ボタンデザインの調整、フォントサイズの最適化"
git push origin develop

# Preview環境で確認
# https://eronator-git-develop-xxx.vercel.app
```

### DB整備

```powershell
# developブランチで作業
git checkout develop

# DB整備スクリプトの実行（ローカル環境）
npm run db:cleanup
npm run db:seed

# 変更をコミット
git add .
git commit -m "DB整備: タグデータの整理、作品データの更新"
git push origin develop

# Preview環境で確認
```

### 実装チェック

```powershell
# developブランチで作業
git checkout develop

# 実装チェック用のテスト追加
# src/server/algo/__tests__/ などにテストを追加
# ...

# コミット・プッシュ
git add .
git commit -m "実装チェック: アルゴリズムのテスト追加"
git push origin develop

# Preview環境で確認
```

## 注意事項

### Production環境（審査用）を変更しない

- ✅ `main`ブランチへの直接コミットは避ける
- ✅ `main`ブランチへのマージは審査通過後まで待つ
- ✅ Production環境の環境変数は変更しない

### Preview環境での開発

- ✅ `develop`ブランチで自由に開発可能
- ✅ Preview環境で動作確認
- ✅ 問題なければ審査通過後に`main`にマージ

## 審査通過後の作業

1. **developブランチをmainにマージ**
   ```powershell
   git checkout main
   git merge develop
   git push origin main
   ```

2. **Production環境への反映確認**
   - `https://eronator.vercel.app` で変更内容を確認

3. **必要に応じて独自ドメインの設定**
   - Vercelダッシュボード → Settings → Domains

## トラブルシューティング

### Preview環境が作成されない

- `develop`ブランチにプッシュしたか確認
- Vercelダッシュボード → Deployments で確認

### 環境変数が反映されない

- Vercelダッシュボード → Settings → Environment Variables
- Preview環境用の環境変数が設定されているか確認

### Production環境に誤って変更が反映された

- すぐに`main`ブランチを前のコミットに戻す
- `git revert` または `git reset` を使用

## まとめ

- **Production環境（審査用）**: `main`ブランチ → 変更しない
- **Preview環境（開発用）**: `develop`ブランチ → 自由に変更可能
- **審査通過後**: `develop`を`main`にマージして本番反映

この方法で、審査中のサイトを変更せずに、開発を継続できます。
