# DMM API インポート 仕様

「売上・人気順で新規作品をDBに追加します（最大100件/回）」の現状仕様と、フロント・APIの不整合の整理です。

---

## 1. 全体の流れ

1. **管理画面**（`ImportWorkflow.tsx`）の「1️⃣ APIインポート」タブで「取得件数」を入力（1〜100件）し、「インポート」ボタンを押す
2. **API**（`/api/admin/dmm/import`）が DMM Affiliate API を呼び出し、FANZA 同人フロアの作品を取得
3. 同人誌フィルタをかけたうえで、**DBにまだない作品だけ**を `Work` として保存し、ジャンルを `Tag`（OFFICIAL）と `WorkTag` として保存
4. 結果（追加件数・スキップ件数）を返す

---

## 2. API側の仕様（`/api/admin/dmm/import`）

### リクエスト

- **メソッド**: POST
- **Body**: JSON
  - `target`（任意）: 新規として保存したい**目標件数**。未指定時は **10**
  - `sort`（任意）: DMM API のソート。未指定時は **`rank`**（人気・売上順）
  - `offset`（任意）: **開始オフセット**（何位から取得するか）。未指定時は **1**（1位から）

### DMM API 呼び出し

- **エンドポイント**: `https://api.dmm.com/affiliate/v3/ItemList`
- **パラメータ**:
  - `site`: FANZA
  - `service`: doujin
  - `floor`: digital_doujin
  - **`hits`**: `Math.min(target * 2, 100)`  
    → 目標の2倍を取得（同人誌フィルタで減る想定）。**最大100件**
  - `offset`: リクエストの `offset`（既定値 1、1位から）
  - `sort`: リクエストの `sort`（既定 `rank`）
  - `output`: json

### 同人誌フィルタ（`isDoujinComic`）

- `imageURL` に `/digital/comic/` を含む
- `volume` が「画像○枚」のみのものは除外（画像集扱い）
- ゲーム系ジャンル（7110, 156002, 160045）は除外

### DB保存ルール

- **workId**: DMM の `content_id`
- 既に同じ `workId` が DB にあれば **スキップ**（新規追加しない）
- フィルタ通過分を**先頭から順に**処理し、**新規保存が `target` 件に達したら打ち切り**
- 保存する内容: Work（title, authorName, isAi, popularityBase, reviewCount, reviewAverage, URL, サムネ, sourcePayload, など）＋ ジャンルを OFFICIAL タグとして WorkTag に保存

### レスポンス

```json
{
  "success": true,
  "stats": {
      "saved": 新規保存件数,
      "skipped": スキップ件数（既存＋フィルタ等）,
      "apiTotal": DMM APIの total_count,
      "offsetUsed": 使用したオフセット,
      "nextSuggestedOffset": 次回推奨オフセット（offset + hits）
    },
  "savedWorks": [ { "workId", "title" }, ... ],
  "skippedWorks": [ 先頭10件のみ ]
}
```

---

## 3. フロント側の仕様（ImportWorkflow）

- **取得件数**: `apiCount`（state、初期値 20、1〜100）
- **送信**: `POST /api/admin/dmm/import` に  
  `body: JSON.stringify({ hits: Math.min(apiCount, 100) })`  
  → **APIは `hits` を見ておらず、`target` と `sort` だけ参照**
- **結果表示**: `data.imported` と `data.skipped` を参照  
  → **APIは `stats.saved` と `stats.skipped` を返す**

---

## 4. 不整合（バグ）

| 項目 | フロント | API | 結果 |
|------|----------|-----|------|
| 件数パラメータ | `hits: apiCount` を送る | `target` のみ読む（既定 10） | **取得件数が常に 10 件になる**（UIで 20 や 100 にしても無視される） |
| 結果のキー | `data.imported`, `data.skipped` | `data.stats.saved`, `data.stats.skipped` | **追加・スキップ件数が表示されない／undefined になる可能性** |

---

## 5. 「最大100件/回」の意味

- **DMM API**: 1リクエストで取得できるのは **最大 100 件**（`hits` の上限）
- **当API**: `target` で「新規で何件まで保存するか」を指定。DMM には `target * 2` を `hits` で要求（上限 100）
- そのため「1回のインポートで DMM から取れるのは最大 100 件」「そのうち新規として保存するのは最大 `target` 件（実質 50 件まで。`target*2 ≤ 100` のとき）」という仕様になる

## 6. 段階的インポート（オフセット指定）

- **`offset` パラメータ**: 何位から取得するかを指定（1=1位から、501=501位から）
- **段階的インポート戦略**: 
  - 1回目: `offset=1`, `target=50` → 1〜50位
  - 2回目: `offset=501`, `target=50` → 501〜550位
  - 3回目: `offset=1001`, `target=50` → 1001〜1050位
  - ... 繰り返しで幅広い範囲を効率よくカバー
- **次回推奨オフセット**: API レスポンスの `nextSuggestedOffset` に「次に取るべきオフセット」が含まれる（`offset + hits`）
- **メリット**: 9900位〜10000位を取るのに10000件チェック不要。段階的に取れば効率的

---

## 7. 修正案（簡潔）

1. **フロント**:  
   - 送信を `{ target: apiCount, sort: 'rank', offset: apiOffset }` に変更（`hits` は送らない）  
   - 結果を `data.stats.saved` と `data.stats.skipped` で受け取り、表示する
   - 「開始オフセット」入力欄を追加し、段階的インポートを可能にする
   - `nextSuggestedOffset` を表示し、次回の推奨オフセットを提案する
2. **API**:  
   - `offset` パラメータを受け取り、DMM API の `offset` に渡す（既定値: 1）
   - レスポンスに `offsetUsed` と `nextSuggestedOffset` を含める

必要なら、上記に沿ったパッチ案（差分）も出します。
