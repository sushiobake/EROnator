# チェック Phase1/Phase2 分離 設計書（B案）

**作成日: 2026-02-19**

B案: 別ボタンで Phase1 と Phase2 を分離。後から「一括実行」ボタンで A 案相当の自動化も追加可能。

---

## 1. 目的

- **Phase1**: 振り分け判断（タグ済 / 人間確認）、issues、tagChanges.removed。allTags 不要。トークン削減。
- **Phase2**: 人間確認の作品について、tagChanges.added と tagSuggestions.newProposal を出力。allTags 必要。

---

## 2. フォルダ・データフロー

```
pending（チェック待ち）
    │
    │  [Phase1 ボタン]
    ▼
┌─────────────────────────────────────┐
│ Phase1 API (allTags なし)           │
│ → result, checkReasoning, issues,    │
│   tagChanges.removed（added は空）   │
└─────────────────────────────────────┘
    │
    ├─ result: タグ済 ──────────────→ tagged
    │
    └─ result: 人間による確認が必要 ─→ has_issues（問題あり）
                                         │
                                         │  lastCheckTagChanges: { added: [], removed: [...] }
                                         │
                                         │  [Phase2 ボタン]
                                         ▼
                              ┌─────────────────────────────────────┐
                              │ Phase2 API (allTags あり)           │
                              │ → tagChanges.added,                 │
                              │   tagSuggestions.newProposal        │
                              └─────────────────────────────────────┘
                                         │
                                         ▼
                              needs_human_check（人間確認）に移動
                              lastCheckTagChanges をマージ更新
```

---

## 3. API 設計

### 3.1 Phase1 API

**エンドポイント**: `POST /api/admin/groq-check-phase1`

**入力**:
- DB から pending の先頭 1 件を取得
- 作品データ: workId, title, commentText, derivedTags, officialTags, characterName
- **allTags は送らない**

**指示書**: `docs/check-instruction-1item-phase1.md`（後述・別途作成）

**出力形式**:
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
- 不足ありのとき: added は空、issues に「タイトルに〇〇がタグにない」等を記載
- tagSuggestions は Phase1 では出さない

**反映**: 既存 `apply-check` + `apply-check-result` をそのまま使用。result に応じて tagged / has_issues（問題あり）に振り分け。

---

### 3.2 Phase2 API

**エンドポイント**: `POST /api/admin/groq-check-phase2`

**入力**:
- has_issues（問題あり）の作品を対象（1件指定 or 先頭1件）
- 作品データ + **allTags**
- （将来的に）Phase1 の issues / checkReasoning を渡すと精度向上

**指示書**: `docs/check-instruction-1item-phase2.md`（後述・別途作成）

**出力形式**:
```json
{
  "workId": "d_xxx",
  "tagChanges": { "added": ["..."], "removed": [] },
  "tagSuggestions": { "newProposal": "..." }
}
```
- added: allTags の s/a/b から選択
- newProposal: リストにない場合のみ（0〜1個）

**反映**: `apply-check-phase2` または専用スクリプト。has_issues から needs_human_check（人間確認）に移動し、lastCheckTagChanges に added / newProposal を**マージ**して更新。

---

## 4. apply の扱い

### Phase1

- 既存 `apply-check.ts` → `apply-check-result.ts` をそのまま使用
- check-pending.json に Phase1 の出力を保存して実行

### Phase2

- **新規**: `apply-check-phase2.ts` または API 内で直接 DB 更新
- has_issues の作品を needs_human_check に移動し、lastCheckTagChanges を更新
- 既存の removed は維持、added と newProposal を追記・上書き

```
has_issues の作品: { added: [], removed: ["タグA"] }
Phase2 出力: { added: ["催眠", "JK"], newProposal: "新規タグ" }
→ needs_human_check に移動、マージ後: { added: ["催眠", "JK"], removed: ["タグA"], newProposal: "新規タグ" }
```

---

## 5. ManualTagging UI

### 5.1 ボタン配置

| タブ | ボタン | 動作 |
|------|--------|------|
| チェック待ち | Phase1: 振り分けチェック | POST /api/admin/groq-check-phase1 |
| 問題あり | Phase2: 追加提案 | POST /api/admin/groq-check-phase2 |

### 5.2 既存ボタン

- 「Groqで1件チェック」: Phase1 に置き換える、または当面は現行 groq-check-one を残して併存
- 方針: Phase1 実装後、Groqボタンを Phase1 に置き換え。現行 groq-check-one は残しておきフォールバック用にしても可。

### 5.3 Phase2 の対象

- 問題ありタブで、「追加提案がまだない作品」を対象にする
- 判定: lastCheckTagChanges.added が空 かつ 不足あり（issues に含まれる）… だが issues は DB に保存していない
- 簡易案: 問題ありの先頭 1 件を Phase2 に渡す。Phase2 は「不足があれば added/newProposal を出す」と指示。不足がなければ空で返す。
- または: lastCheckTagChanges に `needsProposal?: boolean` を Phase1 で付与し、それがある作品だけ Phase2 対象にする（スキーマ拡張が必要）

**設計選択**: まずは 問題ありの先頭 1 件を Phase2 に渡す方式で実装。Phase2 側で「不足がなければ空を返す」と指示書に書く。

---

## 6. 環境変数

| 変数 | 値 | 用途 |
|------|-----|------|
| GROQ_API_KEY | （設定済み） | Groq API |
| GROQ_CHECK_MODEL | llama-3.3-70b-versatile | Phase1 / Phase2 共通 |

---

## 7. ファイル構成（実装予定）

```
src/app/api/admin/
  groq-check-one/route.ts        … 現行（当面維持 or フォールバック）
  groq-check-phase1/route.ts     … 新規
  groq-check-phase2/route.ts     … 新規

docs/
  check-instruction-1item-phase1.md   … 新規（後回し）
  check-instruction-1item-phase2.md   … 新規（後回し）

scripts/
  apply-check.ts                 … 現行のまま（Phase1 用）
  apply-check-result.ts          … 現行のまま
  apply-check-phase2.ts          … 新規（Phase2 の lastCheckTagChanges マージ）
```

---

## 8. 指示書（後回し・方針のみ）

### Phase1 指示書

- 現行 check-instruction-1item から以下を削除・簡略化:
  - allTags の説明、added のルール、newProposal のルール
  - 追加推奨の注意、有名タグリストの注記
- 残す: 3ステップ、ゴール、出力形式（added は空で返す旨を明記）

### Phase2 指示書

- 不足分について allTags から added を選ぶ
- リストにない場合のみ newProposal（0〜1個）
- 入力: 作品データ + allTags。必要なら Phase1 の issues も渡す

---

## 9. 今後の拡張（A案）

- 「一括チェック」ボタン: Phase1 実行 → result が人間確認なら即 Phase2 実行 → 1 つの結果で apply
- Phase1 / Phase2 の API はそのまま再利用

---

## 10. バックアップ

- `.backup/check-phase-design-20260219/` に現行ファイルを保存済み
