# WorkTag 行列化 実装メモ

## 何に困っているのか

- **現象**: プレビューデプロイ版で質問の間が約 3 秒かかり、ゲーム体験として重い
- **原因**: 1 問ごとに `/api/answer` が `prisma.workTag.findMany({ where: { workId: { in: 2800件 } } })` を実行し、約 3.5 万行を DB から取得している
- **将来**: 作品が 1 万件になるとさらに遅くなり、スケールしない
- **アキネイター**: 作品×タグ→Yes/No の行列を事前計算し、ランタイムではメモリ参照のみ。DB クエリ不要。

---

## だから何をするのか

- WorkTag の「作品×タグ」マッピングを**事前に JSON ファイルにエクスポート**し、ランタイムでは**メモリ参照のみ**で `workHasTag` を実現する
- DB への WorkTag クエリを**廃止**し、1 問あたりのレイテンシを大幅短縮する

---

## どういう方針なのか

1. **方法**: ファイルをバンドルし、モジュールスコープでキャッシュ（サーバーレスでも同一インスタンス内で再利用）
2. **生成タイミング**: `sync:supabase` 後に手動で `npm run generate:worktag-matrix` を実行し、生成ファイルをコミット
3. **互換性**: engine 内の `prisma.workTag.findMany` 呼び出しを、行列を返すヘルパーに置き換える。既存の `workTagMap` / `workHasTag` 等のロジックは維持
4. **derivedConfidence**: DERIVED タグの閾値判定に必要。行列に `(workId, tagKey) → derivedConfidence` を含める

---

## 具体的に何をするか

### 1. 行列のフォーマット

```json
{
  "version": 1,
  "generatedAt": "2026-02-21T...",
  "workCount": 2812,
  "workTags": {
    "workId1": [["tagKey1", 0.95], ["tagKey2", null], ...],
    "workId2": [["tagKey1", null], ...]
  }
}
```

- `workTags[workId]`: その作品が持つタグの配列。各要素は `[tagKey, derivedConfidence]`（null は OFFICIAL 等）
- 互換性のため、`{ workId, tagKey, derivedConfidence }[]` 形式でも返せるヘルパーを用意

### 2. 生成スクリプト `scripts/generate-worktag-matrix.js`

- SQLite (`prisma/dev.db`) の Work から `gameRegistered=true, needsReview=false` の workId 一覧を取得
- それらの WorkTag を `SELECT workId, tagKey, derivedConfidence FROM WorkTag WHERE workId IN (...)` で取得
- `data/workTagMatrix.json` に出力
- `package.json` に `"generate:worktag-matrix": "node scripts/generate-worktag-matrix.js"` を追加

### 3. ローダー `src/server/game/workTagMatrix.ts`

- `getWorkTagMatrix()`: モジュールスコープでキャッシュ、`data/workTagMatrix.json` を遅延ロード
- `getWorkTagsForWorks(workIds: string[])`: `{ workId, tagKey, derivedConfidence }[]` を返す（既存の findMany と同じ型）
- ファイルがない場合は `null` を返し、engine は DB にフォールバック（安全のため）

### 4. engine.ts の変更箇所

| 行付近 | 関数 | 現状 | 変更 |
|--------|------|------|------|
| 653 | tryEmergencyExploreFallback | prisma.workTag.findMany | getWorkTagsForWorks(workIds) ※derivedConfidence 不要 |
| 792 | selectUnifiedExploreOrSummary | prisma.workTag.findMany | getWorkTagsForWorks(workIds) |
| 1002 | selectExploreQuestion | prisma.workTag.findMany | getWorkTagsForWorks(workIds) |
| 1249 | processAnswer (EXPLORE_TAG/SOFT_CONFIRM) | prisma.workTag.findMany (groupTagKeys で絞り込み) | 行列から groupTagKeys に該当するものをフィルタ |
| 282-358 | selectNextQuestion (SOFT_CONFIRM derivedTags) | prisma.tag + workTags include | derivedTags 取得は Tag のみ DB、workTags は行列から |

**注意**: 282 行付近の `derivedTags` は `prisma.tag.findMany` に `workTags: { where: { workId: in, derivedConfidence: gte } }` が含まれる。これを「Tag を DB から取得し、各 Tag の workTags を行列から取得」に分割する必要がある。

### 5. フォールバック方針

- `workTagMatrix.json` が存在しない、またはロード失敗 → 従来通り `prisma.workTag.findMany` を使用
- 環境変数 `DISABLE_WORKTAG_MATRIX=1` で行列を無効化（デバッグ用）

### 6. バグになりそうなポイント（チェックリスト）

- [ ] まとめ質問: `summary:` プレフィックス。行列は tagKey のみ。summary は displayName 複数→tagKey 複数の対応。selectUnifiedExploreOrSummary 内の `workHasTag(wid, 'summary:'+id)` は、summary の displayNames に属する tagKey のいずれかを work が持っていれば true。行列の workTags は tagKey のみなので、`summaryTagKeysMap.get(id)` と照合すればよい。既存ロジックと同じ。
- [ ] DERIVED derivedConfidence: processAnswer で groupTagKeys に含まれる WorkTag の derivedConfidence を参照。行列に derivedConfidence を含めること。
- [ ] processAnswer の groupTagKeys: まとめのときは summaryDisplayNames→Tag→tagKeys。通常は askedTag の displayName→getGroupDisplayNames→Tag→tagKeys。その後 workTags を `workId in workIds AND tagKey in groupTagKeys` で取得。行列からは workIds と groupTagKeys を指定してフィルタ可能。
- [ ] 行列に無い workId: 生成後に追加された作品。行列は gameRegistered の作品のみ。セッションの weights は start 時に AI_GATE フィルタ後。つまり全 workId は行列に含まれる想定。万が一含まれなければ、その work は「タグ0」として扱う（workHasTag=false）。
- [ ] 282 行 derivedTags: Tag は DERIVED で usedTagKeys に無いもの。workTags は workId in weights, derivedConfidence >= threshold。行列から「tagKey が DERIVED 一覧に含まれる AND workId in weights AND derivedConfidence >= threshold」のペアを取得し、tagKey ごとに workIds を集計。Tag の workTags を模倣した構造を組み立てる。

---

## 実施手順

1. 本メモ作成 ✅
2. `scripts/generate-worktag-matrix.js` 実装 ✅
3. `src/server/game/workTagMatrixLoader.ts` 実装 ✅
4. `engine.ts` 修正（fetchWorkTags で 4 箇所置換）✅
5. `package.json` に generate:worktag-matrix 追加 ✅
6. `npm run generate:worktag-matrix` 実行 ✅ → `data/workTagMatrix.json` 生成済み
7. ローカルで `npm run dev` → ゲーム開始〜数問回答で動作確認 ※要確認
8. `npm run build` → AdminProgressContext の型エラーで失敗（workTagMatrix とは無関係）
9. 問題なければコミット・デプロイ

---

## ロールバック

- `workTagMatrix.json` を削除するか、`DISABLE_WORKTAG_MATRIX=1` を設定すると従来の DB 経由に戻る
- engine のフォールバック分岐を残しておく
