# .env.local ファイルの設定方法

## 文字化けの解決方法

`.env.local`ファイルが文字化けする場合は、以下の方法で修正してください。

### 方法1: PowerShellで修正（推奨）

```powershell
# 現在の内容をUTF-8で再保存
Get-Content ".env.local" -Raw | Out-File -FilePath ".env.local" -Encoding UTF8 -NoNewline
```

### 方法2: テキストエディタで修正

1. **VS Code**を使用する場合:
   - `.env.local`を開く
   - 右下のエンコーディング表示をクリック
   - 「UTF-8 で保存」を選択

2. **メモ帳**を使用する場合:
   - `.env.local`を開く
   - 「ファイル」→「名前を付けて保存」
   - 「エンコーディング」を「UTF-8」に変更して保存

## ローカル管理画面で本番／プレビューの履歴・お問い合わせを見る

**結論から:** やり方は **2通り**あります。**どちらか一方**で足ります。混ぜても動きますが、意味がかぶります。

| やり方 | `.env.local` に書く行数 | プレビューURLを `.env` に書く？ |
|--------|-------------------------|--------------------------------|
| **A（おすすめ・Vercel）** | **1行** | **書かない**（管理画面の **プレビューURL** 欄に貼る。**クリア**で本番に戻る） |
| **B（許可リストだけ）** | **2行**（同じURLを2変数に） | プレビューを見るたび **カンマで足す**か、Aに切り替え |

---

### A: 本番もプレビューも全部 Vercel（`*.vercel.app`）のとき

`.env.local` には **次の1行だけ** でよいです。

```env
ERONATOR_REMOTE_ADMIN_TRUST_VERCEL_APP=1
```

- **本番URL** は常に `https://eronator.vercel.app` のまま。**プレビュー**だけ試すときは **プレビューURL** 欄に貼る（空なら本番）。**プレビューをクリア**で本番に戻る。プレビュー欄はブラウザに保存（リロード後も残る）。`.env` はデプロイのたびにいじらない。
- `PRODUCTION_APP_URL` / `NEXT_PUBLIC_PRODUCTION_APP_URL` は **必須ではない**（無くても A だけで動く）。

---

### B: 「許可するURLを env に列挙する」方式だけ使うとき（TRUST を付けない）

`.env.local` に **次の2行**（**中身は同じ**）。

```env
PRODUCTION_APP_URL=https://eronator.vercel.app
NEXT_PUBLIC_PRODUCTION_APP_URL=https://eronator.vercel.app
```

- **プレビュー**を見たいときは、**2行とも**の末尾に `,https://そのプレビューのホスト` を足す（デプロイのたびにホストが変わるなら **そのたびに env を直す** → 面倒なので **A の1行**推奨）。

---

### 今「3行」書いている場合（あなたのファイルの形）

```env
PRODUCTION_APP_URL=https://eronator.vercel.app
NEXT_PUBLIC_PRODUCTION_APP_URL=https://eronator.vercel.app
ERONATOR_REMOTE_ADMIN_TRUST_VERCEL_APP=1
```

- **これで問題なく動く。**
- 説明すると: **3行目（TRUST）があれば、プレビューは `.env` に追記しなくてよい。** 上2行は「許可リスト」用で、TRUST と役割がかぶるが、**害はない**。
- スッキリさせるなら **1行目〜2行目を消して 3行目だけ**にしても、Vercel だけなら **同じように使える**。

（TRUST は `https` の `*.vercel.app` だけ許可。ローカル `npm run dev` 専用。）

---

## .env.local ファイルのテンプレート

```env
# データベース接続（ローカル開発用）
DATABASE_URL=file:./prisma/dev.db

# アフィリエイトID
AFFILIATE_ID=

# 管理画面アクセス制御（3重ロック）
ERONATOR_ADMIN=1
ERONATOR_ADMIN_TOKEN=your-secret-token-here

# リモート履歴・お問い合わせ: 「A」なら1行、「B」なら2行（上の表を参照）。3行全部は重複だが動く。
# ERONATOR_REMOTE_ADMIN_TRUST_VERCEL_APP=1
# PRODUCTION_APP_URL=https://eronator.vercel.app
# NEXT_PUBLIC_PRODUCTION_APP_URL=https://eronator.vercel.app

# デバッグ設定（オプション）
ERONATOR_DEBUG=1
ERONATOR_DEBUG_TOKEN=devtoken
NEXT_PUBLIC_DEBUG_TOKEN=devtoken

# AI統合設定（オプション）
ERONATOR_AI_PROVIDER=huggingface
HUGGINGFACE_API_TOKEN=your-huggingface-token
HUGGINGFACE_API_URL=https://api-inference.huggingface.co/models/elyza/ELYZA-japanese-Llama-2-7b-instruct
```

## ローカル SQLite と Prisma（`DATABASE_URL=file:./prisma/dev.db` の注意）

- **Next.js（アプリ）**は `DATABASE_URL` の `file:./...` を**プロジェクトルート（cwd）**からの相対パスとして解決し、`prisma/dev.db` を開きます（`src/server/db/client.ts`）。
- **従来の `npx prisma db push` 単体**は、同じ `file:./prisma/dev.db` を **schema がある `prisma/` フォルダ基準**で解決し、誤って **`prisma/prisma/dev.db`** を更新することがあります（アプリと別ファイル）。
- 対策: **`npm run db:push`** は `scripts/db-push-with-env-local.js` 経由で、上記と同じ絶対パスに直してから `prisma db push` します。
- 管理画面「お問い合わせ」で **`ContactInquiry` が存在しない**と言われた場合:
  1. **`npm run db:ensure-contact-inquiry`** … 実際の `prisma/dev.db` に `ContactInquiry` テーブルだけ安全に追加（スキーマ全体の push がデータ損失警告で止まる場合の回避）。
  2. その後 **`npm run dev` を一度止めて** `npx prisma generate`（Windows で EPERM が出るときはプロセス停止が必要）。

## 管理トークンの設定

`ERONATOR_ADMIN_TOKEN`には、**強力なパスワード**を設定してください。

### 推奨される形式

- **長さ**: 32文字以上
- **文字種**: 英数字 + 記号（`-`, `_`, `@`, `#`, `$`, `%`など）
- **例**: `my-secure-admin-token-2024-xyz123`

### 安全なトークンの生成方法

```powershell
# PowerShellでランダムなトークンを生成
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

または、オンラインツールを使用:
- https://www.random.org/strings/
- 長さ: 32文字以上
- 文字種: 英数字 + 記号

## 注意事項

1. **`.env.local`はGitにコミットしないでください**（`.gitignore`に含まれています）
2. **本番環境では、Vercelの環境変数設定を使用してください**
3. **管理トークンは定期的に変更することを推奨します**
