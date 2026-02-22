# チェック 5件バッチ化 設計メモ

作成: 2026-02-20

## 目的

API 呼び出しを 1件ずつ → 5件ずつに変更し、トークン数（主に入力）を削減する。
- 指示文を 5回送る → 1回で済む
- allTags（Phase2）も 5回 → 1回で済む
- 期待: トークン削減により 10,000件あたり $50 → $25〜30 程度になる可能性

問題が起きた場合は `.backup/check-batch-5item-pre-20260220/` から復元して 1件ずつに戻す。

---

## 設計方針

### Phase1

**現在**: 1作品ずつ API 呼び出し、1 JSON 返却  
**変更後**: 5作品をまとめて API 呼び出し、5件分の結果を配列で返却

- **入力**: 指示 + `works: [作品1, 作品2, ..., 作品5]`
- **出力**: `results: [{workId, result, checkReasoning, issues, tagChanges}, ...]`

### Phase2

**現在**: Phase1 で「問題あり」になった作品を 1件ずつ API 呼び出し  
**変更後**: 同一 Phase1 バッチ内で「問題あり」になった作品を最大5件まとめて API 呼び出し

- **入力**: 指示 + allTags + `works: [{...payload, api1Issues, api1CheckReasoning}, ...]`（最大5件）
- **出力**: `results: [{workId, tagChanges, tagSuggestions}, ...]`

Phase2 が 0件（全員タグ済）の場合は API 呼び出ししない。

---

## 変更対象ファイル

| ファイル | 内容 |
|----------|------|
| `docs/check-instruction-api1-batch.md` | **新規**。複数作品対応。入力 `works` 配列、出力 `results` 配列 |
| `docs/check-instruction-api2-batch.md` | **新規**。複数作品対応。入力 `works` 配列、出力 `results` 配列 |
| `src/app/api/admin/groq-check-batch/route.ts` | ループを 5件ずつチャンクに変更。バッチ用指示書を参照 |

※ `check-instruction-api1.md` と `check-instruction-api2.md` は**変更しない**。Phase1単体・Phase2単体は従来の1件用のまま。

`ManualTagging.tsx` は変更不要（ストリーミング形式・進捗表示はそのまま）。

---

## API1 指示書の変更案

### 入力

```json
{
  "works": [
    {
      "workId": "d_xxx",
      "title": "...",
      "commentText": "...",
      "officialTags": [...],
      "additionalSTags": [...],
      "derivedTags": [...],
      "characterName": null
    }
  ]
}
```

### 出力

```json
{
  "results": [
    {
      "workId": "d_xxx",
      "title": "...",
      "result": "タグ済",
      "checkReasoning": { "軸の適切性": "...", "各タグ根拠": "...", "キャラ": "..." }
    },
    {
      "workId": "d_yyy",
      "result": "人間による確認が必要",
      "checkReasoning": {...},
      "issues": ["指摘1"],
      "tagChanges": { "added": [], "removed": [...] }
    }
  ]
}
```

- 各作品の `workId` は入力の順序と対応させる
- `results` の長さは `works` と同じ（省略不可）

---

## API2 指示書の変更案

### 入力

```json
{
  "allTags": { "s": [...], "a": [...], "b": [...] },
  "works": [
    {
      "workId": "d_xxx",
      "title": "...",
      "commentText": "...",
      "officialTags": [...],
      "additionalSTags": [...],
      "derivedTags": [...],
      "characterName": null,
      "api1Issues": ["..."],
      "api1CheckReasoning": {...}
    }
  ]
}
```

### 出力

```json
{
  "results": [
    {
      "workId": "d_xxx",
      "tagChanges": { "added": [...], "removed": [] },
      "tagSuggestions": { "newProposal": "..." }
    }
  ]
}
```

- `works` は Phase1 で「人間による確認が必要」と判断された作品のみ（1〜5件）
- `results` の順序は `works` と一致

---

## route.ts の変更フロー

1. `works` を 5件ずつにチャンク: `chunks = chunksOf(works, 5)`
2. 各チャンクに対して:
   - Phase1: `works: chunk` で 1回 API 呼び出し
   - レスポンスをパース。`results` 配列を取得
   - パース失敗時: 当該チャンクのみ 1件ずつでリトライするか、エラーで終了（要検討）
   - Phase2: `result === '人間による確認が必要'` の作品を抽出
   - Phase2 対象が 1件以上あれば、まとめて 1回 API 呼び出し
   - Phase2 結果を Phase1 結果にマージ
   - チャンク内の各作品について `results.push(item)`, `send(progress)`
3. 全チャンク完了後、DB 反映・CheckBatchRun 保存・`send(done)`（現状と同じ）

---

## エラー・リトライ方針

| ケース | 方針 |
|--------|------|
| Phase1 パース失敗 | 当該 5件を 1件ずつで再試行（フォールバック） |
| Phase2 パース失敗 | 当該作品のみ Phase2 結果を空で扱い、has_issues に |
| API 呼び出し失敗 | 当該チャンクを 1件ずつで再試行 |

※ 最初はシンプルに「パース失敗時はエラーで終了」でもよい。フォールバックは後から追加可能。

---

## バッチサイズの指定

- 固定 5件とする（まずはシンプルに）
- 将来的に `?batchSize=5` のようなクエリで変えることも検討

---

## トークン確認のため

実装後、最初の数十件でレスポンスの `usage`（OpenAI API が返す場合）をログ出力して、1件ずつ vs 5件バッチの差を確認する。
