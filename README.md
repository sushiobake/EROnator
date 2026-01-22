# エロネーター MVP0

Akinator風の同人作品推測ゲーム（MVP実装）

## デプロイ

Vercel + Supabaseへのデプロイ手順は以下を参照してください：

- **GitHub + Vercel（推奨）**: [`docs/github-vercel-deploy.md`](./docs/github-vercel-deploy.md) - 詳細な手順
- **Vercel CLI（GitHub不要）**: [`docs/vercel-cli-deploy.md`](./docs/vercel-cli-deploy.md)
- **Supabaseセットアップ**: [`docs/supabase-setup-ja.md`](./docs/supabase-setup-ja.md)

## Runbook（確実に動かす手順）

**PowerShellで実行するコマンド（番号付き）:**

1. **環境変数ファイルの準備:**
```powershell
# .env.local がある場合、.env にリネーム
Rename-Item -Path .env.local -NewName .env
# または、.env ファイルを新規作成
@"
DATABASE_URL="file:./prisma/dev.db"
AFFILIATE_ID=""
"@ | Out-File -FilePath .env -Encoding utf8
```

2. **データベースのセットアップ:**
```powershell
npm run db:push
npm run db:seed
```

3. **開発サーバー起動:**
```powershell
npm run dev
```

4. **動作確認（/api/startが200を返すことを確認）:**

**リクエストスキーマ:**
- `aiGateChoice`: 必須。許容値は `"YES"`, `"NO"`, `"DONT_CARE"` のいずれか（enum）

**PowerShellでの確認例:**
```powershell
# 別のPowerShellターミナルで実行
$body = @{aiGateChoice="DONT_CARE"} | ConvertTo-Json
$response = Invoke-WebRequest -Uri http://localhost:3000/api/start -Method POST -ContentType "application/json" -Body $body
$response.StatusCode
# StatusCode が 200 であることを確認
```

**curlでの確認例（Windows PowerShell）:**
```powershell
curl.exe -X POST http://localhost:3000/api/start -H "Content-Type: application/json" -d '{\"aiGateChoice\":\"DONT_CARE\"}'
# HTTP/1.1 200 OK が返ることを確認
```

**正しいリクエスト例（JSON）:**
```json
{
  "aiGateChoice": "DONT_CARE"
}
```

**aiGateChoiceの許容値:**
- `"YES"`: AI作品のみ
- `"NO"`: 手描き作品のみ
- `"DONT_CARE"`: どちらでも良い

5. **10回連続プレイテスト:**
   - ブラウザで `http://localhost:3000` にアクセス
   - AGE_GATE → AI_GATE → 質問 → 回答 を10回連続で実行
   - エラーが発生しないことを確認

**デバッグパネル（ローカル専用）:**

デバッグパネルを有効にするには、`.env`ファイルに以下を追加：

```env
ERONATOR_DEBUG=1
ERONATOR_DEBUG_TOKEN=devtoken
NEXT_PUBLIC_DEBUG_TOKEN=devtoken
```

**注意**: 
- デバッグパネルはローカル専用です（`NODE_ENV !== "production"`で強制OFF）
- 3重ロック（`ERONATOR_DEBUG=1`, `NODE_ENV !== "production"`, トークン一致）が成立した場合のみ表示されます
- 本番環境では絶対に有効になりません（サーバ側で強制OFF）

**popularityPlayBonus無効化（デバッグ中）:**

デバッグ中に `popularityPlayBonus` を無効化するには、`.env`ファイルに以下を追加：

```env
DISABLE_POPULARITY_PLAY_BONUS=1
```

この環境変数が設定されている場合：
- 初期重み計算時に `popularityPlayBonus` は常に0として扱われます
- REVEAL成功時も `popularityPlayBonus` は更新されません（DBに保存されません）

これにより、デバッグ中は `popularityPlayBonus` が常に0のままとなり、デバッグ結果に影響しません。

**設定変更ページ（開発環境のみ）:**

ブラウザから設定を変更するには、`http://localhost:3000/config` にアクセスしてください。

- 各設定項目をフォームで変更できます
- 変更前に自動的にバックアップが作成されます
- バリデーションエラーがある場合は保存されません
- 設定変更後は開発サーバーを再起動してください

**注意**: このページは開発環境（`NODE_ENV !== "production"`）でのみ利用できます。

**異常時の最小復旧手順:**

1. **ポート3000を使用しているプロセスを終了:**
```powershell
# netstatでポート3000を使用しているプロセスを確認
$connections = netstat -ano | Select-String ":3000" | Select-String "LISTENING"
if ($connections) {
    $pid = ($connections -split '\s+')[-1]
    if ($pid) {
        taskkill /PID $pid /F
    }
}
```

2. **ロックファイルと.nextディレクトリを削除:**
```powershell
Remove-Item -Path .dev-lock -ErrorAction SilentlyContinue
Remove-Item -Path .next -Recurse -Force -ErrorAction SilentlyContinue
```

3. **開発サーバーを再起動（1回だけ）:**
```powershell
npm run dev
```

**注意**: ロックファイル（`.dev-lock`）が残っているがdevサーバーが動いていない場合は、次回の`npm run dev`実行時に自動的に削除されます。

## 起動手順

### 1. 依存関係のインストール

**PowerShell:**
```powershell
npm install
```

**cmd:**
```cmd
npm install
```

### 2. データベースのセットアップ

**PowerShell（環境変数を設定して実行）:**
```powershell
$env:DATABASE_URL="file:./prisma/dev.db"
npm run db:generate
npm run db:push
npm run db:seed
```

**cmd（環境変数を設定して実行）:**
```cmd
set DATABASE_URL=file:./prisma/dev.db
npm run db:generate
npm run db:push
npm run db:seed
```

**注意**: PowerShellでは`&&`が使えないため、コマンドは1行ずつ実行してください。

### 3. 環境変数の設定

`.env` ファイルを作成し、以下を設定：

```env
# データベース
DATABASE_URL="file:./prisma/dev.db"

# アフィリエイトID（本番ドメインのみ本番ID、staging/devは空または別ID）
AFFILIATE_ID=""
```

**注意**: `.env`ファイルが作成できない場合は、各コマンド実行時に環境変数を直接設定してください（上記2.参照）。

### 4. 開発サーバー起動

**重要**: 
- 複数のターミナルで同時に `npm run dev` を実行しないでください。ロックファイル（`.dev-lock`）で二重起動が検知され、エラーで終了します。
- `.next`ディレクトリの不整合が発生する可能性があります。

**通常起動（PowerShell）:**
```powershell
npm run dev
```

**通常起動（cmd）:**
```cmd
npm run dev
```

**クリーン起動（推奨・PowerShell）:**
```powershell
npm run dev:clean
```

**クリーン起動（推奨・cmd）:**
```cmd
npm run dev:clean
```

ブラウザで `http://localhost:3000` にアクセス

**検証用起動（再現性優先・PowerShell）:**
```powershell
npm run build:clean
npm start
```

**検証用起動（再現性優先・cmd）:**
```cmd
npm run build:clean
npm start
```

**注意**: 検証用起動は `next dev` の代わりに `build + start` で実行します。開発中は `dev`、検証は `start` の二段運用を推奨します。

### 5. ビルド・本番起動

**ビルド（PowerShell）:**
```powershell
npm run build
```

**ビルド（cmd）:**
```cmd
npm run build
```

**クリーンビルド（推奨・PowerShell）:**
```powershell
npm run build:clean
```

**クリーンビルド（推奨・cmd）:**
```cmd
npm run build:clean
```

**本番起動（PowerShell）:**
```powershell
npm start
```

**本番起動（cmd）:**
```cmd
npm start
```

**クリーン本番起動（PowerShell）:**
```powershell
npm run start:clean
```

**クリーン本番起動（cmd）:**
```cmd
npm run start:clean
```

## トラブルシューティング

### `.next` ディレクトリの破損が疑われる場合（手順番号付き）

Next.jsの`.next`ディレクトリが不整合になっている可能性があります。以下の手順を順番に実行してください。

**復旧手順（PowerShell）:**

1. 開発サーバーを停止（Ctrl+C）

2. クリーン起動を実行:
```powershell
npm run dev:clean
```

3. それでも解決しない場合、`.next`を削除してからビルド:
```powershell
npm run clean
npm run build:clean
npm run dev
```

4. それでも解決しない場合、`node_modules`を再生成:
```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
npm run db:generate
npm run build:clean
npm run dev
```

**復旧手順（cmd）:**

1. 開発サーバーを停止（Ctrl+C）

2. クリーン起動を実行:
```cmd
npm run dev:clean
```

3. それでも解決しない場合、`.next`を削除してからビルド:
```cmd
npm run clean
npm run build:clean
npm run dev
```

4. それでも解決しない場合、`node_modules`を再生成:
```cmd
rmdir /s /q node_modules
del package-lock.json
npm install
npm run db:generate
npm run build:clean
npm run dev
```

**注意**: PowerShellでは `&&` が使えないため、コマンドは1行ずつ実行してください。

### `Cannot find module './xxx.js'` エラーが発生した場合

**まず `npm run dev:clean` を試してください。** 上記の「`.next` ディレクトリの破損が疑われる場合」の手順を参照してください。

### 開発サーバーが二重起動エラーで止まる場合

ロックファイル（`.dev-lock`）が残っている可能性があります。

**対処法（PowerShell）:**
```powershell
Remove-Item .dev-lock
npm run dev
```

**対処法（cmd）:**
```cmd
del .dev-lock
npm run dev
```

### データベースエラーが発生した場合

環境変数`DATABASE_URL`が設定されていない可能性があります。以下の手順で確認してください：

**PowerShell:**
```powershell
$env:DATABASE_URL="file:./prisma/dev.db"
npm run db:push
```

**cmd:**
```cmd
set DATABASE_URL=file:./prisma/dev.db
npm run db:push
```

### 連続リロード/数回プレイ後にエラーが発生した場合

`.next`ディレクトリの不整合が原因の可能性があります。上記の「`.next` ディレクトリの破損が疑われる場合」の手順を参照してください。

### 開発サーバーの安定性を優先する場合

`next dev` でエラーが再発する場合は、検証用起動（`build + start`）を使用してください。

**検証用起動（PowerShell）:**
```powershell
npm run build:clean
npm start
```

**検証用起動（cmd）:**
```cmd
npm run build:clean
npm start
```

**注意**: 
- 検証用起動は `next dev` の代わりに `build + start` で実行します
- 開発中は `dev`、検証は `start` の二段運用を推奨します
- `start` は再現性が高く、`.next` の不整合が発生しにくいです

## 利用可能なnpmスクリプト

- `npm run dev`: 開発サーバー起動
- `npm run dev:clean`: `.next`を削除してから開発サーバー起動（推奨）
- `npm run build`: 本番ビルド
- `npm run build:clean`: `.next`を削除してから本番ビルド（推奨）
- `npm run start`: 本番サーバー起動
- `npm run start:clean`: `.next`を削除→ビルド→本番サーバー起動
- `npm run clean`: `.next`ディレクトリを削除（復旧用）
- `npm test`: ユニットテスト実行
- `npm run db:generate`: Prismaクライアント生成
- `npm run db:push`: データベース作成・マイグレーション
- `npm run db:seed`: 初期データ投入

## ポート

- 開発サーバー: `3000`（デフォルト）

## 必要な環境変数

- `DATABASE_URL`: SQLiteデータベースのパス（例: `file:./prisma/dev.db`）
- `AFFILIATE_ID`: アフィリエイトID（本番ドメインのみ本番IDを使用、staging/devは空または別ID）

  - 本番環境: 本番アフィリエイトIDを設定
  - staging/dev環境: 空文字列または別ID（誤計測/非承認リスク回避）

## 審査用チェックリスト

### 受け入れ条件（17項目）

1. ✅ AGE_GATE を通らないと先に進めない
2. ✅ AGE_GATE通過後に AI_GATE を必ず1回表示し、**はい/いいえ/気にしない** を選べる
3. ✅ AI_GATE の選択により候補Work集合がフィルタされ、以後は覆らない
4. ✅ QUIZ では毎回1問表示され、**6択**で回答できる
5. ✅ 回答後、重み更新→正規化→次の質問選択が**決定論的**に進む
6. ✅ Q=6 と Q=10 では必ず Confirm が出題される
7. ✅ Confirm（SOFT/HARD）も **6択**で回答できる
8. ✅ confidence ≥ revealThreshold（デフォルト0.70）で REVEAL に遷移する
9. ✅ REVEAL で Yes を選ぶと SUCCESS に遷移する
10. ✅ REVEAL で No を選ぶとペナルティ適用＋missCount加算＋QUIZへ戻る
11. ✅ REVEAL miss が 3回に到達、または QUIZ が maxQuestions=30 に到達したら FAIL_LIST を表示する
12. ✅ FAIL_LIST で「リスト外」導線があり、自由入力（作品名）を送信→保存できる
13. ✅ **外部リンク**（FANZA等）には必ずPR表記が表示される
14. ✅ 外部リンクの表示文言は固定テンプレを使用し、自動生成しない
15. ✅ サムネ画像は公式URLのみを**表示**する。自サーバー保存/キャッシュ禁止。非許可ホストなら非表示
16. ✅ `AFFILIATE_ID` は環境変数で分離し、本番ドメインのみ本番IDを使用する
17. ✅ READMEに運用チェックリストがある

### Compliance/NFR

- ✅ 外部リンクにPR表記を表示（`ExternalLink`コンポーネント）
- ✅ リンク文言は固定テンプレート使用（「FANZAで見る」固定）
- ✅ サムネは公式URL表示のみ（許可ホスト初期値空、`allowedHosts.ts`）
- ✅ AFFILIATE_IDは環境変数で分離（`AFFILIATE_ID` → `NEXT_PUBLIC_AFFILIATE_ID`）
- ✅ データ露出ポリシー遵守（works/tags/質問プール全量をフロント配布しない、DTO変換関数で明示）

## 設定ファイル

- `config/mvpConfig.json`: チューニングパラメータ（スキーマ外キーは起動時エラー）

## データインポート

`importBatch.json` を読み取り、Prisma(SQLite)のDBへ反映する手順は [`docs/import.md`](docs/import.md) を参照してください。

**クイックスタート:**
```powershell
npm run import:batch -- data/import/your-file.json
```

## 技術スタック

- Next.js (App Router) + TypeScript
- SQLite + Prisma
- zod (configバリデーション)
