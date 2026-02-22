# Phase0 タグ付け 設計メモ

**ステータス**: 設計検討中。実装は未着手。

---

## 1. 概要

現行のタグチェック（Phase1+2）と同様の構成で、**Phase0: タグ付け**を API 化する。

| Phase | 役割 | 入力 | 出力 |
|-------|------|------|------|
| **Phase0** | タグ付け | 未タグ作品 | additionalSTags, aTags, bTags, cTags, characterName → チェック待ちへ |
| Phase1 | 振り分けチェック | チェック待ち作品 | タグ済 / 人間による確認が必要 |
| Phase2 | 追加提案 | Phase1 で問題あり | tagChanges.added, newProposal |

---

## 2. 方針

### 大きな設計（タグチェックと同様）

- **5件ずつ**バッチ処理
- 終わったものはすべて**チェック待ち**へ
- **途中経過**をストリーム（NDJSON）で返し、進捗を表示
- 最終的に以下の実行オプションを持つ:
  - **Phase0 のみ**: タグ付け → チェック待ち
  - **Phase0+1+2 連続**: タグ付け → チェック（問題ありなら Phase2）→ tagged / needs_human_check / has_issues

### 指示書

- **もともとのタグ付け指示書**（`docs/legacy-ai-tagging-instruction.md` 等）をベースに
- **チェック指示書**（`docs/check-instruction-api1-batch.md`, `check-instruction-api2-batch.md`）の良いところを反映:
  - 軸・根拠・キャラの3項目チェック観点
  - 推測禁止、細分化レベルの不足は求めない
  - 出力形式（results 配列、JSON のみ）の整理

---

## 3. Phase0 の入出力

### 入力（works 配列・各要素）

- **workId**
- **title**
- **commentText**
- **officialTags**（既存S・DMM由来。追加の前提）

※ allTags（s, a, b）は参照用として渡す。

### 出力（results 配列）

各作品について:

```json
{
  "workId": "d_xxxxxx",
  "title": "作品タイトル",
  "additionalSTags": ["追加Sタグ1"],
  "aTags": ["Aタグ1", "Aタグ2"],
  "bTags": ["Bタグ1"],
  "cTags": [],
  "characterName": "キャラ名",
  "taggingReasoning": {
    "タイトルから": "1行で。",
    "各タグ根拠": "1行で。",
    "キャラ": "1行で。"
  }
}
```

- additionalSTags: allTags.s から。公式Sに存在する語のみ。
- aTags / bTags: allTags.a / allTags.b から。最大2〜3個程度に抑制。
- cTags: 使わない方針（ゲームに反映しない）なら空でよい。
- characterName: commentText に登場人物名があれば代表1人。なければ null。
- **新規タグ禁止**: allTags に無い語は使わない。

---

## 4. API イメージ

### Phase0 のみ

```
POST /api/admin/groq-tag-batch?count=10
```

- 未タグ（または legacy_ai）から先頭 count 件取得
- 5件ずつチャンクで LLM にタグ付け依頼
- 結果を WorkTag に反映し、manualTaggingFolder = 'pending' に
- ストリームで `{ type: 'progress', done, total, workId }` を返す

### Phase0+1+2 連続（将来）

```
POST /api/admin/groq-tag-check-batch?count=10
```

- 未タグから取得 → Phase0 でタグ付け → チェック待ちへ
- 直後に Phase1 → 問題ありなら Phase2
- 最終的に tagged / needs_human_check / has_issues に振り分け

---

## 5. 未タグの取り込み条件

現在の `manualTaggingFolder` と整合:

| フォルダ | Phase0 の対象 |
|----------|---------------|
| untagged | コメントあり・DERIVED なし |
| legacy_ai | AI分析済みだが人間未チェック |

`commentText` が null の作品はスキップ。

---

## 6. 指示書のいいとこどり（案）

### タグ付け指示書から

- 語彙: allTags の s / a / b のみ。新規タグ禁止。
- タイトルを必ず読む。タイトル語を最優先でタグ候補に。
- キャラタグ必須（名前があれば characterName、なければ null）。
- シリーズ系: 数字・続編・総集編・編 があればシリーズタグ1つ。
- 根拠がなければ付けない。0個で提出可。
- 重複・同義語を避ける。

### チェック指示書から

- 推測禁止。明記されていない要素を欠落として指摘しない。
- 軸の適切性・各タグ根拠・キャラの3項目で reasoning を簡潔に。
- 細分化レベルの不足は求めない。
- 出力は JSON のみ。results は works と同じ順序・件数。

### 両方から

- 付けてよい: タイトル・あらすじに明記。背景語も可。
- 付けてはいけない: メタ情報だけ、汎用語、曖昧・広義すぎるタグ。

---

## 7. 実行フロー（Phase0 のみ）

```
1. 未タグから count 件取得（orderBy: updatedAt DESC 等）
2. 5件ずつチャンクに分割
3. 各チャンク:
   a. 指示書 + works ペイロード を LLM に送信
   b. results をパース
   c. 各作品の WorkTag を upsert（additionalS, DERIVED A/B/C, STRUCTURAL）
   d. manualTaggingFolder = 'pending', aiAnalyzed = true
   e. progress をストリーム送信
4. TagBatchRun 的なテーブルに結果を保存（ optional）
5. done をストリーム送信
```

---

## 8. 次のステップ

1. Phase0 用指示書のドラフト（`docs/tag-instruction-phase0-batch.md`）
2. `POST /api/admin/groq-tag-batch` の実装
3. ManualTagging UI に「Phase0: タグ付け」ボタン追加
4. Phase0+1+2 連続の統合（別 PR）

---

## 9. 参照

- `docs/legacy-ai-tagging-instruction.md` - 元のタグ付け指示書
- `docs/ai-tagging-memo.md` - タグ付けルール・学び
- `docs/check-instruction-api1-batch.md` - Phase1 チェック指示書
- `docs/check-instruction-api2-batch.md` - Phase2 チェック指示書
- `.backup/tag-check-5item-20260220/` - タグチェック5件バッチのバックアップ
