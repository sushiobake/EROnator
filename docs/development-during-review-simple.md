# 審査中の開発ガイド（初心者向け）

審査提出後、審査が終わるまでの間、**サイトを壊さずに**開発を進める方法です。

## 重要なルール

**今、審査に出したサイト（`https://eronator.vercel.app`）は触らない！**

でも、**別の場所で開発は続けられる**ので安心してください。

## 具体的な例

### 例1: コンフィグをいじったらどうなる？

#### ❌ やってはいけないこと

1. `config/mvpConfig.json` を編集
2. `git add .` → `git commit` → `git push` を実行
3. **結果**: 審査中のサイト（`https://eronator.vercel.app`）が変わってしまう！

#### ✅ 正しいやり方

**手順1: 開発用のブランチを作る**

```powershell
# 現在のブランチを確認（おそらく "main" と表示される）
git branch

# 開発用のブランチを作る（"develop" という名前）
git checkout -b develop

# GitHubに送る
git push -u origin develop
```

**手順2: コンフィグをいじる**

1. `config/mvpConfig.json` を編集（自由に変更OK）
2. 保存

**手順3: 変更を保存する**

```powershell
# 変更したファイルを追加
git add config/mvpConfig.json

# 変更を記録
git commit -m "コンフィグを調整しました"

# ⚠️ 重要: プッシュ前にスキーマを PostgreSQL に切り替え
npm run prepare:push

# GitHubに送る（prepare:push で自動的にスキーマが切り替わっています）
git push origin develop

# ローカル開発用に SQLite に戻す
npm run restore:sqlite
```

**手順4: 変更を確認する**

- Vercelが自動的に「プレビュー環境」を作ってくれます
- Vercelダッシュボード → **Deployments** を開く
- 一番上に「Preview」と書かれたデプロイがある
- そのURLをクリックすると、変更した内容を確認できます
- 例: `https://eronator-git-develop-xxx.vercel.app`

**結果**: 
- ✅ 審査中のサイト（`https://eronator.vercel.app`）は変わらない
- ✅ プレビュー環境で変更内容を確認できる

### 例2: DBを増やしたらどうなる？

#### ❌ やってはいけないこと

1. ローカルでDBにデータを追加
2. `scripts/migrate-sqlite-direct.js` を実行してSupabaseに反映
3. **結果**: 審査中のサイトのDBが変わってしまう！

#### ✅ 正しいやり方

**方法A: ローカル環境でテストする**

1. ローカルのDB（`prisma/dev.db`）にデータを追加
2. ローカルで `npm run dev` を実行
3. `http://localhost:3000` で確認
4. **Supabaseには反映しない**（審査中のDBを触らない）

**方法B: 開発用のSupabaseプロジェクトを作る（上級者向け）**

1. 新しいSupabaseプロジェクトを作成
2. 開発用の環境変数（`DATABASE_URL`）を設定
3. 開発用ブランチ（`develop`）で作業
4. 審査用のSupabaseは触らない

**方法C: 審査通過後に反映する**

1. ローカルでDBを整備
2. 審査通過後、Supabaseに反映
3. これが一番安全

## よくある質問

### Q1: 間違えて `main` ブランチで作業してしまった

**解決方法:**

```powershell
# 変更を元に戻す（まだコミットしていない場合）
git checkout .

# または、変更を破棄する
git reset --hard HEAD
```

**もし既にコミットしてしまった場合:**

```powershell
# 最後のコミットを取り消す（まだpushしていない場合）
git reset --soft HEAD~1

# または、pushしてしまった場合（危険！）
# すぐにVercelダッシュボードで前のデプロイに戻す
```

### Q2: プレビュー環境が作られない

**確認事項:**

1. `develop` ブランチにプッシュしたか確認
   ```powershell
   git branch  # 現在のブランチを確認
   git push origin develop  # developブランチにプッシュ
   ```

2. Vercelダッシュボード → **Deployments** を確認
   - 最新のデプロイに「Preview」と表示されているか確認

### Q3: 審査通過後、どうやって反映するの？

**手順:**

```powershell
# 1. mainブランチに切り替える
git checkout main

# 2. developブランチの変更を取り込む
git merge develop

# 3. GitHubに送る
git push origin main
```

これで、審査中のサイトに変更が反映されます。

## 簡単な覚え方

### 🚫 やってはいけないこと

- `main` ブランチで作業する
- 審査中のサイト（`https://eronator.vercel.app`）を直接変更する
- Supabaseの本番DBを直接変更する

### ✅ やっていいこと

- `develop` ブランチで作業する
- ローカル環境（`http://localhost:3000`）でテストする
- プレビュー環境で確認する
- ローカルのDBをいじる

## 実際の作業フロー

### 1. 開発を始める前

```powershell
# 必ず develop ブランチに切り替える
git checkout develop
```

### 2. 作業する

- コンフィグを編集
- UIを改善
- DBを整備（ローカル環境のみ）

### 3. 変更を保存

```powershell
git add .
git commit -m "変更内容の説明"
git push origin develop
```

### 4. 確認する

- Vercelダッシュボード → Deployments → Preview URLを確認
- または、ローカル環境（`http://localhost:3000`）で確認

### 5. 審査通過後

```powershell
git checkout main
git merge develop
git push origin main
```

## まとめ

- **審査中のサイト**: 触らない（`main` ブランチ）
- **開発用**: 自由に変更OK（`develop` ブランチ）
- **確認方法**: プレビュー環境またはローカル環境
- **反映方法**: 審査通過後に `main` にマージ

これで、審査中のサイトを壊さずに開発を続けられます！
