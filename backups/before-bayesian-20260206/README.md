# バックアップ: ベイズ更新 導入前 (2026-02-06)

このフォルダは「(1) ベイズ更新」を入れる直前の状態です（IG 質問選択はすでに入れた後）。

## 含まれるファイル
- `engine.ts`
- `weightUpdate.ts`
- `schema.ts`
- `mvpConfig.json`

## ロールバック方法

### 方法A: 設定で切替
`config/mvpConfig.json` の `algo` に `"useBayesianUpdate": false` を追加すると、従来の強度×beta の更新に戻ります。

### 方法B: ファイルを戻す
このフォルダの各ファイルを元のパスに上書きコピーしてください。
