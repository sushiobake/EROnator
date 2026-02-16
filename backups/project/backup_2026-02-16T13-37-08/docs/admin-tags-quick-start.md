# タグ管理機能 クイックスタート

## セットアップ（5分で完了）

### 1. 環境変数の設定

`.env.local` に以下を追加：

```env
# 管理画面アクセス制御
ERONATOR_ADMIN=1
ERONATOR_ADMIN_TOKEN=your-secret-token-here

# AI分析（Hugging Face API）
ERONATOR_AI_PROVIDER=huggingface
HUGGINGFACE_API_TOKEN=your-huggingface-token
```

### 2. Hugging Face APIトークンの取得

1. https://huggingface.co/ にアクセス
2. アカウント作成（無料）
3. Settings → Access Tokens → New token
4. トークンをコピーして `.env.local` に設定

詳細は [`docs/ai-integration-setup.md`](./ai-integration-setup.md) を参照

### 3. 開発サーバー起動

```powershell
npm run dev
```

### 4. 管理画面にアクセス

```
http://localhost:3000/admin/tags
```

## 使い方

1. **管理トークンを入力**: `.env.local` の `ERONATOR_ADMIN_TOKEN` の値を入力
2. **ファイルを選択**: `works_A.txt` または `works_C.txt` をアップロード
3. **読み込みモードを選択**: 全量読み込み / 追加分のみ
4. **ファイルをパース**: 「ファイルをパース」ボタンをクリック
5. **作品を選択**: 分析したい作品にチェックを入れる
6. **AI分析を実行**: 「AI分析を実行」ボタンをクリック
7. **結果を確認**: 分析結果が表示される（実装中）

## 現在の機能

✅ **動作可能:**
- ファイルアップロード・パース
- 作品一覧表示
- 重複チェック表示（黄色ハイライト）
- 作品選択
- AI分析実行（Hugging Face API）

🚧 **実装中:**
- 分析結果の表示・編集UI
- DBインポート機能

## トラブルシューティング

### エラー: "Forbidden"
→ 管理トークンが正しく設定されているか確認

### エラー: "HUGGINGFACE_API_TOKEN is not set"
→ `.env.local` に `HUGGINGFACE_API_TOKEN` を設定

### エラー: "モデルが起動中です"
→ 無料モデルは初回起動に10-30秒かかります。少し待ってから再試行

### AI分析結果が空
→ プロンプトを調整するか、別のモデルを試す（`HUGGINGFACE_API_URL` を変更）
