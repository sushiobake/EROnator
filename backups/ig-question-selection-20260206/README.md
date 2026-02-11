# バックアップ: IG質問選択 導入前 (2026-02-06)

## 含まれるファイル
- `engine.ts` - ゲームエンジン
- `questionSelection.ts` - 質問選択アルゴリズム
- `schema.ts` - 設定スキーマ
- `mvpConfig.json` - 実行時設定

## ロールバック方法

### 方法A: 設定で切替（コードはそのまま）
IG をやめて従来の「p≈0.5」に戻すだけなら、`config/mvpConfig.json` の `algo` に次を追加（または既存を変更）:
```json
"useIGForExploreSelection": false
```
これで従来の選択ロジックに戻ります。

### 方法B: ファイルを完全に戻す
このフォルダのファイルを以下に上書きコピーしてください。
- `engine.ts` → `src/server/game/engine.ts`
- `questionSelection.ts` → `src/server/algo/questionSelection.ts`
- `schema.ts` → `src/server/config/schema.ts`
- `mvpConfig.json` → `config/mvpConfig.json`
