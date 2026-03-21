# 本番（Vercel）で管理APIを有効にする手順

ローカル管理画面の「本番の履歴を表示」で 403 が出る場合、本番側の環境変数を確認してください。

**Vercel 上では `VERCEL=1` が自動で付くため、`ERONATOR_ADMIN_PRODUCTION` は不要です**（コードで同等扱いにしています）。足すのは次の **2つだけ**で足ります。

---

## やること（5分）

### 1. Vercel を開く

1. ブラウザで **https://vercel.com** を開く
2. ログインする
3. **プロジェクト**をクリック

### 2. Environment Variables

4. **Settings** → **Environment Variables**

### 3. 必須は2つ

| Name | Value | Environment |
|------|-------|---------------|
| `ERONATOR_ADMIN` | `1` | Production（プレビューからリモート取得するなら Preview も） |
| `ERONATOR_ADMIN_TOKEN` | ローカル `.env.local` と**同じ**秘密文字列 | 同上 |

**以前ドキュメントにあった `ERONATOR_ADMIN_PRODUCTION` は、Vercel では省略してよいです。**  
（自前サーバーで `NODE_ENV=production` だけ動かす場合は、従来どおり `ERONATOR_ADMIN_PRODUCTION=1` が必要なことがあります。）

### 4. 再デプロイ

環境変数を変えたら **Redeploy** して反映させてください。

---

## 終わったら

- ローカルで管理画面を開き、本番URL・トークンでリモート取得を試す。

---

## まとめ

| 変数名 | Vercel で必要？ |
|--------|-----------------|
| `ERONATOR_ADMIN` | はい（`1`） |
| `ERONATOR_ADMIN_TOKEN` | はい（ローカルと同じ） |
| `ERONATOR_ADMIN_PRODUCTION` | **いいえ**（Vercel は `VERCEL=1` で代替） |

### プレビューデプロイだけ

**`ERONATOR_ADMIN` は不要**です。`ERONATOR_ADMIN_TOKEN` だけ Preview 環境に設定すれば、ローカル管理画面からプレビューURLでリモート取得できます（コードが `VERCEL_ENV=preview` のときトークンのみで許可）。
