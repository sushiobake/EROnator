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

## .env.local ファイルのテンプレート

```env
# データベース接続（ローカル開発用）
DATABASE_URL=file:./prisma/dev.db

# アフィリエイトID
AFFILIATE_ID=

# 管理画面アクセス制御（3重ロック）
ERONATOR_ADMIN=1
ERONATOR_ADMIN_TOKEN=your-secret-token-here

# 本番の履歴をローカル管理画面で見る場合（オプション）
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
