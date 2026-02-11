# 情報利得（IG）とベイズ更新

## (2) 情報利得（IG）による質問選択

## 概要

EXPLORE_TAG の「次にどの質問を出すか」を、従来の **「p が 0.5 に近いタグを選ぶ」** から、**期待情報利得（Expected Information Gain）** で選ぶようにするオプションを追加しました。

- **期待事後エントロピー** E[H'] = P(YES|q)・H(事後|YES) + P(NO|q)・H(事後|NO) を各候補タグで計算し、**これを最小にするタグ**を選びます（＝情報が最も増える質問を選ぶ）。
- 尤度は「作品がタグを持つとき P(YES)=0.9」「持たないとき P(YES)=0.1」で固定（`questionSelection.ts` の定数で変更可能）。
- **連続 NO で当たりを挟む**ときは従来どおり「p が高いタグ」を選ぶロジックを維持しています（IG は使わない）。

## 設定

`config/mvpConfig.json` の `algo` に以下を追加しています。

```json
"useIGForExploreSelection": true
```

- **true（またはキーなし）**: IG で質問選択（上記の新ロジック）。
- **false**: 従来の「p≈0.5 に近いタグ」で選択。

## ロールバック

**挙動だけ戻す場合**  
`config/mvpConfig.json` で `"useIGForExploreSelection": false` にすれば、従来の選択ロジックに戻ります。コードの差し戻しは不要です。

**ファイルごと戻す場合**  
`backups/ig-question-selection-20260206/` の README に記載のとおり、同フォルダ内のファイルを上書きコピーしてください。

## 変更ファイル（実装時）

- `src/server/algo/questionSelection.ts` — `selectExploreTagByIG` と `entropy` を追加
- `src/server/game/engine.ts` — IG 使用時は `selectExploreTagByIG` を呼ぶよう分岐
- `src/server/config/schema.ts` — `algo.useIGForExploreSelection` を optional で追加
- `config/mvpConfig.json` — `useIGForExploreSelection: true` を追加

## (1) ベイズ更新

重み更新を「強度×beta の乗算」から **事後確率のベイズ更新** に切り替えるオプションです。

- **尤度**: 作品が特徴を持つとき P(YES)=0.98, P(NO)=0.02、持たないとき P(YES)=0.02, P(NO)=0.98（`bayesianEpsilon` で 0 を避ける）。
- PROBABLY_YES / PROBABLY_NO は 0.7/0.3 で同様に更新。UNKNOWN/DONT_CARE は尤度 1（更新なし）。
- **ロールバック**: `config/mvpConfig.json` の `algo.useBayesianUpdate` を **false** にすると従来の更新に戻ります。
- バックアップ: `backups/before-bayesian-20260206/` にベイズ導入前のファイルを保存済み。

## シミュレーションでの確認

管理画面のシミュレーション（単体・バッチ）で、IG・ベイズの有効/無効を切り替えて正解率や質問数を比較することを推奨します。
