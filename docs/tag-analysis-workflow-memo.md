# タグ分析の流れメモ（手動で依頼されたとき用）

同じ作業をまた依頼されたときに使う手順メモ。

---

## 前提

- 対象: コメント取得済みの作品（commentText が null でない）
- ルール: `data/chatgpt-export/chatgpt-prompt.txt` のAI指示に準拠（S禁止・A/B優先・suggestedはリスト外のみ・characterは固有名0〜1人）

---

## 流れ

### 1. 対象作品の取得

- リスト範囲が「タイトルで〇〇から△△まで」の場合:
  - `scripts/fetch-page1-range-works.ts` を参考に、`createdAt desc` で先頭N件取得 → タイトルで開始・終了マーカーを検索してスライス。
  - 出力: `data/chatgpt-export/page1-range-works-for-analysis.json` のような「workId, title, commentText」のJSON。
- 特定タイトルのみの場合は `scripts/fetch-four-works-comments.ts` のように、タイトル部分一致で findMany して1件ずつ push。
- **タグ未抽出（DERIVED0件）を一括で扱う場合**:
  - `scripts/fetch-no-derived-works.ts` で全件取得 → `data/chatgpt-export/no-derived-works-for-analysis.json`
  - `scripts/split-no-derived-for-batch.ts` で50件ずつ分割 → `no-derived-part-001.json` … `no-derived-part-009.json`
  - 各 part をAI分析し `manual-analysis-no-derived-part1.json` … `part9.json` を保存
  - `scripts/merge-manual-analysis-no-derived.ts` でマージ → `manual-analysis-no-derived-424works.json`
  - `scripts/apply-manual-tags-no-derived.ts` でDB反映

### 2. タグ分析（手動）

- 各作品の commentText から「あらすじ・内容解説」を把握。
- **ステップ1**: S（有名タグ）リストに含まれる／近い語は使わない。
- **ステップ2**: Aランク・Bランクリスト（chatgpt-prompt.txt および config/tagRanks.json）から、作品の特徴に当てはまるタグを **matchedTags** にそのままの表記で追加（最大3個・2個目標）。
- **ステップ3**: S・A/Bにない「作品ならではの特徴」だけ、汎用語で **suggestedTags** に0〜2個。造語・合成語は禁止。
- **characterName**: 固有名詞のキャラが明確なら1人、なければ null。
- 出力形式は1作品あたり:
  - `workId`, `title`, `matchedTags`: `[{ displayName, category }]`, `suggestedTags`: `[{ displayName, category }]`, `characterName`: string | null

### 3. 分析結果JSONの保存

- `data/chatgpt-export/manual-analysis-〇〇.json` のようなファイルに、上記形式の配列で保存。

### 4. DB反映

- `scripts/apply-manual-tags-4works.ts` または `scripts/apply-manual-tags-page1.ts` と同様のスクリプトで:
  - 対象作品の既存 DERIVED の WorkTag を削除
  - 各作品について matchedTags / suggestedTags を DERIVED として Tag がなければ作成し、WorkTag を追加（derivedSource: manual-matched / manual-suggested）
  - characterName があれば STRUCTURAL の Tag がなければ作成し、WorkTag を追加
- 新規 Tag は `generateTagKey(displayName)` で `tag_` + SHA1(displayName) の先頭10文字。STRUCTURAL は同じ関数で tagKey を生成（approve では char 用に別 prefix にしていない場合あり）。

### 5. レポート（任意）

- 件数・所要時間（DB反映はスクリプトの elapsedMs）・クレジット消費（手動のため0）を `docs/manual-tag-analysis-report-〇〇.md` にまとめる。

---

## 参照ファイル

- ルール: `data/chatgpt-export/chatgpt-prompt.txt`
- A/Bランク一覧: `config/tagRanks.json`
- 反映スクリプト例: `scripts/apply-manual-tags-4works.ts`, `scripts/apply-manual-tags-page1.ts`, `scripts/apply-manual-tags-no-derived.ts`（424件用）
