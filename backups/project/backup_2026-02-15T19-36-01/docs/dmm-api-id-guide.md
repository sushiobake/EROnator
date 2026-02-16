# DMM Affiliate API ID 取得ガイド

DMM Affiliate APIを使用するために必要な**API ID**の取得方法です。

## API IDとは

DMM Affiliate APIを呼び出すために必要な認証情報です。
- アフィリエイトID（`sok-001`など）とは別物です
- 管理画面で発行されるユニークな文字列です

## 取得手順

### ステップ1: DMM Affiliate管理画面にログイン

1. https://affiliate.dmm.com/ にアクセス
2. あなたのアカウントでログイン

### ステップ2: API設定ページを探す

管理画面のメニューから以下を探してください：

- **「Webサービス/API」**
- **「API設定」**
- **「ツール」→「API」**
- **「設定」→「API」**

### ステップ3: API IDを確認

API設定ページに以下のような情報が表示されているはずです：

```
API ID: xxxxxxxxxxxxxx
アフィリエイトID: sok-001
```

この**API ID**をコピーしてください。

## 環境変数に設定

取得したAPI IDを`.env`ファイルに追加：

```env
DMM_API_ID=Rbb32LFV0FLeUMh5Bn3f
DMM_AFFILIATE_ID=affiliate-990
```

**重要**: 
- API ID: `Rbb32LFV0FLeUMh5Bn3f`（2025年1月取得）
- API用アフィリエイトID: 末尾990～999のものが発行されています（管理画面で確認してください）
- 通常のアフィリエイトID（`sok-001`）とは別のIDです

## トラブルシューティング

### API設定ページが見つからない

- 審査が通ったばかりの場合、API機能が有効化されるまで時間がかかる可能性があります
- DMM Affiliateのヘルプページで「API」を検索
- サポートに問い合わせ：「API IDの取得方法を教えてください」

### API IDが表示されない

- アカウントの権限を確認
- 審査ステータスを確認（審査通過が必要）
- DMM Affiliateのサポートに問い合わせ

## 参考

- DMM Affiliate APIリファレンス: https://affiliate.dmm.com/api/
- サポート: DMM Affiliate管理画面から問い合わせ可能
