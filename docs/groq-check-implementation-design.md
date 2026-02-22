# Groqチェック 実装設計書

**作成日: 2026-02-20**

旧「Groqで1件チェック」は使用廃止。Phase1 / Phase2 を分離し、1件ずつチェックする方針で新実装する。

---

## 1. 概要

| Phase | API | 対象フォルダ | 入力 | 出力 | ボタン表示 |
|-------|-----|-------------|------|------|-----------|
| Phase1 | groq-check-phase1 | チェック待ち | 作品データ（allTags なし） | 振り分け判断 | チェック待ちタブ |
| Phase2 | groq-check-phase2 | 問題あり | 作品データ + allTags | 追加提案 | 問題ありタブ |

**1件ずつ**実行。バッチは将来の拡張。

---

## 2. データフロー

```
チェック待ち (pending)
    │
    │  [Phase1: 振り分けチェック] ボタン
    ▼
  Phase1 API（allTags なし）
    │
    ├─ result: タグ済 ────────────→ tagged
    │
    └─ result: 人間による確認が必要 ─→ has_issues（問題あり）
                                         │
                                         │  [Phase2: 追加提案] ボタン
                                         ▼
                              Phase2 API（allTags あり）
                                         │
                                         ▼
                              needs_human_check（人間確認）
                              lastCheckTagChanges に added/newProposal をマージ
```

---

## 3. Phase1 API

### エンドポイント

`POST /api/admin/groq-check-phase1`

### 処理

1. **対象取得**: `manualTaggingFolder = 'pending'` の先頭1件
2. **入力構築**: workId, title, commentText, derivedTags, officialTags, characterName（**allTags は含めない**）
3. **指示書**: `docs/check-instruction-api1.md`
4. **Groq API 呼び出し**
5. **結果保存**: `check-pending.json` に1件
6. **反映**: `npx tsx scripts/apply-check.ts` を実行（既存 apply-check → apply-check-result）

### 出力形式（モデルが返す）

```json
{
  "workId": "d_xxx",
  "title": "...",
  "result": "タグ済" | "人間による確認が必要",
  "checkReasoning": { "タイトル照合": "...", "各タグ根拠": "...", "キャラ": "..." },
  "issues": ["..."],
  "tagChanges": { "added": [], "removed": ["..."] }
}
```

### トークン削減

- allTags を送らない → 約 4k〜6k トークン/件の削減
- 指示書は API1 用（簡潔、1行制約）

---

## 4. Phase2 API

### エンドポイント

`POST /api/admin/groq-check-phase2`

### 処理

1. **対象取得**: `manualTaggingFolder = 'has_issues'` の先頭1件
2. **入力構築**: 作品データ + **allTags**（s, a, b）
3. **指示書**: `docs/check-instruction-api2.md`
4. **Groq API 呼び出し**
5. **DB 更新**: 
   - `manualTaggingFolder` を `needs_human_check` に変更
   - `lastCheckTagChanges` をマージ（既存 removed 維持、added / newProposal を追加）
   - `gameRegistered = true`, `needsReview = false`

### 出力形式（モデルが返す）

```json
{
  "workId": "d_xxx",
  "tagChanges": { "added": ["..."], "removed": [] },
  "tagSuggestions": { "newProposal": "..." }
}
```

### Phase2 のマージ

既存の `lastCheckTagChanges` がある場合（Phase1 で removed を出した場合）:

```
既存: { added: [], removed: ["タグA"] }
Phase2: { added: ["催眠", "JK"], newProposal: "新規タグ" }
マージ後: { added: ["催眠", "JK"], removed: ["タグA"], newProposal: "新規タグ" }
```

---

## 5. ManualTagging UI

### ボタン配置

| タブ | ボタン | API | 備考 |
|------|--------|-----|------|
| チェック待ち | Phase1: 振り分けチェック | POST /api/admin/groq-check-phase1 | 旧「Groqで1件チェック」を置換 |
| 問題あり | Phase2: 追加提案 | POST /api/admin/groq-check-phase2 | 新規 |

### 挙動

- **Phase1 成功時**: result に応じて tagged / has_issues に振り分け。タグ済 or 問題ありタブに自動切り替え。
- **Phase2 成功時**: 人間確認タブに自動切り替え。
- **エラー時**: アラート表示。フォルダは変更しない。

### 旧ボタン削除

「Groqで1件チェック」は削除。Phase1 ボタンに統一。

---

## 6. ファイル構成

### 新規

```
src/app/api/admin/
  groq-check-phase1/route.ts   … Phase1 API
  groq-check-phase2/route.ts   … Phase2 API
```

### 変更

```
src/app/admin/components/ManualTagging.tsx
  - チェック待ち: 「Phase1: 振り分けチェック」ボタン（groq-check-phase1）
  - 問題あり: 「Phase2: 追加提案」ボタン（groq-check-phase2）
  - 旧「Groqで1件チェック」削除
```

### 既存のまま

```
scripts/apply-check.ts         … Phase1 用（check-pending.json → apply-check-result）
scripts/apply-check-result.ts  … tagged / has_issues への振り分け
docs/check-instruction-api1.md
docs/check-instruction-api2.md
```

### 廃止（バックアップ済み）

```
src/app/api/admin/groq-check-one/  … 削除 or 空にする
```

---

## 7. 環境変数

| 変数 | 用途 |
|------|------|
| GROQ_API_KEY | Groq API |
| GROQ_CHECK_MODEL | llama-3.3-70b-versatile（推奨） |

---

## 8. 実装順序

1. `groq-check-phase1/route.ts` 作成
2. ManualTagging: チェック待ちのボタンを Phase1 に差し替え
3. 動作確認（1件チェック → タグ済 or 問題あり）
4. `groq-check-phase2/route.ts` 作成
5. ManualTagging: 問題ありタブに Phase2 ボタン追加
6. 動作確認（問題あり → Phase2 → 人間確認）
7. `groq-check-one` フォルダ削除 or 残してフォールバック用にしておく

---

## 9. バックアップ

`.backup/groq-check-redesign-20260220/` に以下を保存済み:

- groq-check-one/route.ts
- ManualTagging.tsx
- apply-check.ts
- apply-check-result.ts
- check-phase-design.md
