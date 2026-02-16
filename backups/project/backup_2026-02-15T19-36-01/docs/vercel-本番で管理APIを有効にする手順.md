# 本番（Vercel）で管理APIを有効にする手順

ローカル管理画面の「本番の履歴を表示」で 403 が出る場合、本番側に次の3つの環境変数がありません。**Vercel の画面で追加してください。**

---

## やること（5分）

### 1. Vercel を開く

1. ブラウザで **https://vercel.com** を開く
2. ログインする
3. **EROnator のプロジェクト**（あなたがデプロイしているプロジェクト）をクリック

---

### 2. 環境変数の画面へ行く

4. 画面上方の **「Settings」** タブをクリック
5. 左のメニューで **「Environment Variables」** をクリック

---

### 3. 3つの変数を追加する

次の3つを、**1つずつ**追加します。

| 順番 | Name（名前） | Value（値） | 注意 |
|------|--------------|-------------|------|
| ① | `ERONATOR_ADMIN` | `1` | 数字の 1 だけ。引用符は不要 |
| ② | `ERONATOR_ADMIN_PRODUCTION` | `1` | 同上 |
| ③ | `ERONATOR_ADMIN_TOKEN` | （あなたが決めた秘密の文字列） | ローカルの .env.local の `ERONATOR_ADMIN_TOKEN` と**同じ値**にする |

**追加のしかた（1つ目为例）：**

6. **「Add New」** または **「Add」** ボタンをクリック
7. **Key** の欄に `ERONATOR_ADMIN` と入力
8. **Value** の欄に `1` と入力
9. **Environment** で **「Production」** にだけチェックを入れる（Preview には入れなくてよい）
10. **「Save」** をクリック

**2つ目：** 同じ要領で Key に `ERONATOR_ADMIN_PRODUCTION`、Value に `1`、Production にチェック → Save

**3つ目：** Key に `ERONATOR_ADMIN_TOKEN`、Value に**あなたの秘密のトークン**（.env.local の ERONATOR_ADMIN_TOKEN と同じ）、Production にチェック → Save

---

### 4. 本番を再デプロイする

環境変数を変えたので、本番をやり直す必要があります。

11. 画面上方の **「Deployments」** タブをクリック
12. いちばん上にある **本番（Production）** のデプロイの行の、右端の **「⋯」（3点メニュー）** をクリック
13. **「Redeploy」** をクリック
14. 確認が出たら **「Redeploy」** でもう一度クリック
15. デプロイが **Success** になるまで 1〜2 分待つ

---

## 終わったら

- ローカルで **http://localhost:3000/admin/tags** を開く
- **「サービスプレイ履歴」** タブ → **「本番の履歴を表示する」** にチェック
- **「再読み込み」** をクリック

本番の履歴が表示されれば完了です。

---

## まとめ（何を足したか）

| 変数名 | 意味 |
|--------|------|
| ERONATOR_ADMIN | 管理機能を「オン」にする |
| ERONATOR_ADMIN_PRODUCTION | 本番でも管理APIを許可する |
| ERONATOR_ADMIN_TOKEN | 管理画面にログインするための秘密の合言葉（ローカルと本番で同じにする） |
