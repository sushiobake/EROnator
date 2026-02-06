# デバッグモードをデプロイ版（プレビュー）で有効にする

デプロイ先（Vercel のプレビュー環境）でもデバッグパネルを出し、ローカルと「違いがあるか」を確認できるようにするためのメモ。

## いつ設定するか

**デプロイの際にやること**です。コード側の対応は済んでいるので、Vercel の環境変数を設定するだけです。

- **今すぐコードでやることはない**
- **本番用の環境には設定しない**（本番ではデバッグは出さない）

## 設定する環境変数（Preview のみ）

Vercel の **Preview** 用の環境変数に、次の3つを設定する。

| 変数名 | 値 | 説明 |
|--------|-----|------|
| `NEXT_PUBLIC_VERCEL_ENV` | `preview` | プレビューであることをクライアントに伝え、パネル表示を許可する |
| `NEXT_PUBLIC_DEBUG_TOKEN` | （任意のトークン文字列） | クライアントでデバッグパネルを有効にする判定に使う |
| `ERONATOR_DEBUG_TOKEN` | 上と同じトークン | API がデバッグデータを返すかどうかの判定に使う |

- 適用先: **Preview** のみ。Production には設定しない。
- トークンはローカルで使っている `.env.local` の `NEXT_PUBLIC_DEBUG_TOKEN` / `ERONATOR_DEBUG_TOKEN` と同じにすると、同じトークンでプレビューとローカル両方でデバッグできる。

## 動作の整理

- **本番（Production）**: 上記を設定しないため、デバッグは常に無効。
- **プレビュー（Preview）**: 上記を設定すると、トークン一致時にデバッグパネル表示・API のデバッグ返却が有効。
- **ローカル**: 従来どおり `ERONATOR_DEBUG=1` とトークンで有効（`NODE_ENV !== 'production'`）。

実装: `src/server/debug/isDebugAllowed.ts`（API）、`src/app/page.tsx` の `isDebugUIEnabled`（クライアント）。
