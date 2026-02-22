# WorkTag 行列化 速度改善 結果レポート

**作成日**: 2026-02-22  
**結論**: 行列化は実装済みだが、プレビュー環境での体感速度に変化なし（依然 5 秒以上）

---

## 1. 実装状況（確認済み）

### A. WorkTag 行列 (fetchWorkTags) ✅

| 箇所 | 関数 | 状態 |
|------|------|------|
| 717行 | tryEmergencyExploreFallback | fetchWorkTags（行列 or DB） |
| 853行 | selectUnifiedExploreOrSummary | fetchWorkTags |
| 1060行 | selectExploreQuestion | fetchWorkTags |
| 1299行 | processAnswer | fetchWorkTags |

- `workTagMatrix.json` はバンドルに含まれている（.nft.json で確認）
- Vercel ログで `[WorkTag] Matrix loaded, works: 2812` を確認済み

### B. derivedTags (SOFT_CONFIRM) ✅

| 箇所 | 内容 | 状態 |
|------|------|------|
| 305-365行 | selectNextQuestion 内 | 行列あり: Tag のみ DB、workTags は行列から取得 |

- 行列なし時は従来通り prisma で workTags も取得

---

## 2. 改善なしの仮説

1. **derivedTags の実行頻度が低い**  
   shouldConfirm が true になるのは qIndex/confidence に依存。多くの質問は EXPLORE_TAG で、derivedTags 経路は通らない。

2. **ボトルネックが別にある**
   - `ensurePrismaConnected`（コールドスタート時に遅い）
   - `SessionManager.getSession` / `updateSession` / `saveWeightsSnapshot`（Postgres 往復）
   - その他の `prisma.tag.findMany`（tagsInSummaries, tagsForFilter など）
   - Vercel のコールドスタート（1〜3 秒）

3. **行列化した部分の元のコストが想定より小さかった**  
   Supabase の WorkTag クエリが意外と速く、別の処理で時間がかかっている可能性。

---

## 3. 次のアクション（計測でボトルネック特定）

`/api/answer` に計測ログを追加済み:

```
[perf] /api/answer ensurePrismaConnected: Xms
[perf] /api/answer getSession: Xms
[perf] /api/answer saveWeightsSnapshot: Xms
[perf] /api/answer processAnswer: Xms
[perf] /api/answer selectNextQuestion: Xms
[perf] /api/answer updateSession: Xms
[perf] /api/answer TOTAL: Xms
```

→ Vercel Logs で `[perf]` を検索し、どのステップが遅いか確認する。

---

## 4. バックアップ

- `engine.backup.pre-derivedtags-matrix.20260222-141250.ts`
