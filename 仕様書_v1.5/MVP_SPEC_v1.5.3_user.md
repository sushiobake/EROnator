# MVP_SPEC v1.5 (Closed) — MVP仕様書（Akinator寄せ / エロネーター）
**Last updated:** 2026-01-19


**Scope:** The MVP web app that delivers an *Akinator-like* experience for doujin works: users answer questions, the system mixes in confirm-style questions early, and then does a **REVEAL** (big “Is it this?”) with **Yes/No**. If wrong, it continues; after too many REVEAL misses, it shows a **candidate list (N=10)** and optional free-text saving.

---

## 0. What is fixed as FACT (agreed)

- Primary value is **“being guessed / revealed”**, not ranking; recommendations are secondary and can be postponed.
- Answers in QUIZ (except special cases) are **6-choice**:
  1) はい
  2) いいえ
  3) わからない
  4) たぶんそう
  5) たぶん違う
  6) どっちでもいい（オリジナル）
- **AI_GATE** is a separate first question (after age gate):
  - “それはAI作品？” → はい / いいえ / 気にしない
  - This selection filters Works shown thereafter and is **never “softened”** by later logic.
- Confirm policy:
  - Q=6 and Q=10: **must insert a Confirm**.
  - Otherwise, Confirms are inserted based on (a) confidence thresholds and (b) effectiveCandidates threshold.
  - Confirm can happen consecutively (no “must insert explore between”).
- REVEAL trigger (initial): **confidence ≥ 0.70** (parameterizable later).
- REVEAL miss allowance: **3 misses** (counted as REVEAL failures). After 3 misses → FAIL_LIST.
- FAIL_LIST shows **N=10** candidates and provides a “not in list” path.
- popularity:
  - Stored as base value (derived from reviewCount/reviewAverage during data ingestion) and can be increased by play.
  - play bonus initial rule: **SUCCESS only +0.1** (configurable).
  - “+方向のみ” (no decay) for now.
- HardConfirm order: **fixed order** (タイトル頭 → 作者) for now.

---

## 1. User Experience Flow (state contract)

### 1.1 States

1) **AGE_GATE** (if needed)
2) **AI_GATE** (3-choice; filters dataset)
3) **QUIZ** (loop: ask question → 6-choice answer)
4) **REVEAL** (big guess card) — **Yes/No only**
5) **SUCCESS** (correct reveal)
6) **FAIL_LIST** (after 3 REVEAL misses **or** QUIZ reaches maxQuestions=30) — top 10 list + “not in list” + optional free input → save

### 1.2 Transitions

- AI_GATE → QUIZ
- QUIZ → REVEAL when `confidence >= revealThreshold`
- QUIZ → FAIL_LIST when `questionCount >= maxQuestions` (default 30)
- REVEAL:
  - Yes → SUCCESS
  - No → back to QUIZ (with penalty / reweighting)
- REVEAL misses >= 3 → FAIL_LIST
- FAIL_LIST:
  - Select a work from list → treat as “found answer” (no SUCCESS bonus unless we explicitly add later)
  - Not in list → optional free text input → save → end

---

## 2. Data Model (logical)

### 2.1 Work

Required fields for MVP:
- `workId` (internal)
- `title` (string)
- `authorName` (string)
- `isAi` (enum): `AI | HAND | UNKNOWN`  
  - **AI_GATE filtering rule:**
    - AI_GATE=はい → allow `AI` only
    - AI_GATE=いいえ → allow `HAND` only
    - AI_GATE=気にしない → allow all
- `popularityBase` (number; 0..55 target)
- `popularityPlayBonus` (number; starts 0)
- `reviewCount` (int; optional)
- `reviewAverage` (number; optional)
- `sourcePayload` (json; optional “raw source snapshot” insurance)

Optional (future):
- `seriesId` / `seriesTitle`
- `aliases` (array)

MVP (required / optional):
- `productUrl` (required) — 外部リンク（PR表記・リンク文言固定の対象）。
  - **`productUrl` を取得できない作品はMVPのDBに登録しない（または候補集合から除外）**。
- `thumbnailUrl` (optional) — 公式サムネURL（表示のみ、キャッシュ禁止）。
  - 不明/非許可ホストなら非表示（フォールバック）。

### 2.2 Tag

- `tagKey` (string, stable key)
- `displayName` (string)
- `tagType` (enum): `OFFICIAL | DERIVED | STRUCTURAL`
- `category` (string; nullable) — used for future question templates like “服装系” etc.

Relation:
- Work ↔ Tag (many-to-many)
- For DERIVED tags, optional confidence per work-tag link: `derivedConfidence` (0..1)

### 2.3 Question

A Question is not stored permanently in MVP unless you want analytics. It can be generated from tag templates.

Question kinds:
- `EXPLORE_TAG`: asks about a tag/feature.
- `SOFT_CONFIRM`: “ちょっとズルい質問” (e.g., derived tag like 温泉) — only if data exists.
- `HARD_CONFIRM`: title initial / author match (metadata-based).

---

## 3. Question & Answer Model

### 3.1 Answer choices

- **AI_GATE**（年齢確認の後、QUIZ前に必ず1回）: 3択  
  - はい / いいえ / 気にしない  
  ※以後の候補集合を固定フィルタし、後から覆さない（AI/手描きは特別扱い）

- **QUIZ / Confirm（SOFT/HARD）**: 原則6択（REVEALのみYes/No）  
  - はい  
  - いいえ  
  - わからない  
  - たぶんそう（部分的にそう / そうっぽい）  
  - たぶん違う（そうでもない）  
  - どっちでもいい（オリジナル）

### 3.2 MVP default mapping（answer → strength s）

6択を **単一のスカラー s（-1〜+1）** に落として、重み更新式を1本化する。  
（※「情報量 i」は持たない。強さは s の絶対値で表現する）

| Answer | s |
|---|---:|
| はい | +1.0 |
| たぶんそう | +0.6 |
| わからない | 0 |
| たぶん違う | -0.6 |
| いいえ | -1.0 |
| どっちでもいい | 0 |

**補足**
- 「わからない」「どっちでもいい」は **重み更新はしない（s=0）** が、回数カウント等の状態判定には使う。
- 文言はUI用。内部enumは自由だが、上表のsをデフォルトとして固定する。


## 4. Scoring / Probability Model

### 4.1 Core quantities

For each Work `w`, we keep an unnormalized weight `W(w)`.

- Initialization (after AI_GATE filter):
  - `W(w) = basePrior(w)`
  - Suggested MVP prior:
    - `basePrior(w) = exp( alpha * popularityTotal(w) )`
    - `popularityTotal = popularityBase + popularityPlayBonus`
    - `alpha` is a small coefficient to avoid popularity dominance (config).

We normalize to probabilities:
- `P(w) = W(w) / sum(W)`

### 4.2 Confidence (agreed form)

- `confidence = P(top1)`

(Equivalent to top1 / total after normalization.)

### 4.3 Effective candidates (agreed, with DB-size adjustment)

- `effectiveCandidates = 1 / sum(P(w)^2)`

**Dynamic threshold:**
- We need a threshold that can reflect DB size.
- Proposed config:
  - `effectiveConfirmThreshold = min(200, max(100, round(totalWorks / 100)))`

This keeps a **100–200** band (scales with DB size) and avoids “always Confirm” when totalWorks is small.


---

## 5. Updating weights from an answer

### 5.1 Tag-based questions (EXPLORE_TAG / SOFT_CONFIRM)

Each question corresponds to a binary feature `hasFeature(w)` (tag present).

**DERIVEDタグの二値化（FIX）**
- WorkTag.kind=DERIVED の場合、`hasFeature(w)` は **derivedConfidence ≥ derivedConfidenceThreshold** のとき真。
- デフォルト: **derivedConfidenceThreshold = 0.70**（configで調整可能）
- derivedConfidence が null/欠損の場合は偽（=タグ無し扱い）。

Given answer strength `s`:

- If feature present:
  - `mult = exp( +beta * s )`
- If feature absent:
  - `mult = exp( -beta * s )`

Then:
- `W(w) *= mult`

Properties:
- Yes boosts feature-present works; No boosts feature-absent works.
- Probably answers move weights but less.
- Unknown / Don’t care have s=0 so `mult=1` (no update).

`beta` is a config parameter controlling how fast the distribution sharpens.

### 5.2 HardConfirm questions

HardConfirm questions are binary checks against metadata:

- Title-initial question: “タイトルは ○ から始まる？”
- Author question: “作者（サークル）は ○ ？”

For HardConfirm we still use the same 6-choice answer update rule; the feature is “matches the proposition”.

Order (fixed for now):
1) Title initial
2) Author

---

## 6. Question selection

### 6.1 Explore question selection (information gain style)

For each available tag question `t`, estimate
- `p = sum_{w: hasTag(w)} P(w)`

Choose tags with `p` near 0.5 (balanced split) to maximize information.

Tie-breaker / constraints:
- Avoid repeating near-duplicate tags.
- Respect “available data only” (don’t ask tag questions if coverage is too low).

### 6.2 Confirm insertion rules

We compute at each step:
- `qIndex` = current question number (1-based within quiz)
- `confidence` (P(top1))
- `effectiveCandidates`

Confirm is inserted if ANY:
1) `qIndex == 6` or `qIndex == 10`
2) `confidence in [0.40, 0.60]` (configurable)
3) `effectiveCandidates <= effectiveConfirmThreshold`

**Soft vs Hard Confirm selection:**
- If `confidence >= 0.30` and a SoftConfirm template has data coverage → prefer SoftConfirm.
- Else if `confidence >= 0.50` → prefer HardConfirm.
- If SoftConfirm not available → fallback to HardConfirm.

(These thresholds can be tuned, but MVP defaults are as above.)

---

## 7. REVEAL trigger and after-effects

### 7.1 REVEAL trigger

- If `confidence >= revealThreshold` → enter REVEAL.
- MVP default: `revealThreshold = 0.70`

### 7.2 REVEAL miss handling ("half" idea)

When user answers REVEAL=No:
- increment `revealMissCount`.
- apply penalty to the guessed work:
  - `W(top1) *= revealPenalty (config: algo.revealPenalty)`
  - MVP default: `revealPenalty = 0.5`

Optionally (if needed): also reduce the popularity contribution temporarily for that top work, but **do not** modify `isAi` or AI_GATE.

After 3 misses → FAIL_LIST.

---

## 8. FAIL_LIST and Free Input

### 8.1 Candidate list

- Show top N candidates where `N = 10` (agreed).
- Each entry shows at minimum: title + author (thumbnail optional later).

### 8.2 Not in list

- Provide a “not in list” action.
- MVP: free-text input (work name) + submit → **save** to logs/DB for later curation.

No need to auto-create a Work; just store a record:
- `submittedTitleText`
- `timestamp`
- `aiGateChoice`
- optionally: the last top candidates snapshot

---

## 9. Popularity initialization (review-based)

Because API is not available initially, ingestion is Phase A (semi-manual). We store stable fields and later swap to Phase B (API adapter) without changing the DB schema.

### 9.1 MVP popularityBase from reviewCount/reviewAverage

Default proposal (agreed direction):
- If no reviews → 0
- If reviewCount >= 1 → 10
- If reviewCount >= 10 → 30
- If reviewCount >= 100 → 50
- Then add `round(reviewAverage)`
- Clamp to max 55 for ingestion (because play bonus can lift later)

### 9.2 popularityPlayBonus

- On SUCCESS only: `popularityPlayBonus += 0.1` (configurable)
- No decay in MVP.

---

## 10. Config parameters (must be editable without code rewrite)

- `confirm.revealThreshold` (default 0.70)
- `confirm.confidenceConfirmBand` (default [0.40, 0.60])  ※Soft/Hardを混ぜる帯域
- `confirm.qForcedIndices` (default [6, 10])
- `confirm.softConfidenceMin` (default 0.30)
- `confirm.hardConfidenceMin` (default 0.50)

- `flow.effectiveConfirmThresholdFormula` (default "A")
- `flow.effectiveConfirmThresholdParams` (default { min:100, max:200, divisor:100 })
- `flow.maxQuestions` (default 30)
- `flow.maxRevealMisses` (default 3)
- `flow.failListN` (default 10)

- `algo.beta` (weight update strength)
- `algo.alpha` (basePrior strength, default 0.02)
- `algo.derivedConfidenceThreshold` (default 0.70)
- `algo.revealPenalty` (default 0.5)

- `dataQuality.minCoverageMode` (default "AUTO")
- `dataQuality.minCoverageRatio` (default 0.05)
- `dataQuality.minCoverageWorks` (default 20)

- `popularity.playBonusOnSuccess` (default +0.1)

> **Source of truth:** `MVP_CONFIG_SCHEMA_v1.5.md` と `mvpConfig.example.v1.5.json`。スキーマ外キーは禁止。


## 11. MVP0 Acceptance Criteria（17 items）

Cursor実装の「終わり」を判定できるように、MVP0の受け入れ条件を固定する。

1. AGE_GATE を通らないと先に進めない（年齢確認の実装方式は任意だが、状態として必須）。
2. AGE_GATE通過後に AI_GATE を必ず1回表示し、**はい/いいえ/気にしない** を選べる。
3. AI_GATE の選択により候補Work集合がフィルタされ、以後は覆らない（AI/手描きフィルタは厳守）。
4. QUIZ では毎回1問表示され、**6択**で回答できる（§3.1）。
5. 回答後、重み更新→正規化→次の質問選択が**決定論的**に進む（同一入力で同一遷移）。
6. Q=6 と Q=10 では必ず Confirm が出題される（SOFT/HARDは§6.2）。
7. Confirm（SOFT/HARD）も **6択**で回答できる（REVEALのみYes/No）。
8. confidence ≥ revealThreshold（デフォルト0.70）で REVEAL に遷移する。
9. REVEAL で Yes を選ぶと SUCCESS に遷移する。
10. REVEAL で No を選ぶとペナルティ適用＋missCount加算＋QUIZへ戻る（missCountはREVEALの失敗回数）。
11. REVEAL miss が 3回に到達、または QUIZ が maxQuestions=30 に到達したら FAIL_LIST を表示する（上位N=10）。
12. FAIL_LIST で「リスト外」導線があり、自由入力（作品名）を送信→保存（ログ/DB）できる（aiGateChoice 等も保存）。
13. **外部リンク**（FANZA等）には必ずPR表記が表示される（文言・デザインは仮でよいが、表示フックは必須）。
14. 外部リンクの表示文言は固定テンプレを使用し、自動生成しない（例：「FANZAで見る」）。
15. サムネ画像はFANZA側の公式URLのみを**表示**する。自サーバーに画像を保存/キャッシュしない。thumbUrlが不明・非許可ホストなら画像非表示フォールバック。
    - **許可ホストの初期値は空（= MVPでは原則サムネ非表示）で安全側。許可ホストは推測しない。**
16. `AFFILIATE_ID` は環境変数で分離し、本番ドメインのみ本番IDを使用する。staging/devはID無し（または別ID）で誤計測/非承認リスクを避ける。
17. 審査時に第三者が内容確認できる公開状態を維持できるよう、READMEに運用チェックリストがある。

## 12. Implementation / 運用メモ（Cursorが推測しないための柵）

### 12.1 Config placement（FIX）
- チューニング入口は **1つだけ**：`config/mvpConfig.json`。
- 読み込みは **server側**（API Route / Server Action / Route Handler いずれか）で行う。
- 形は `MVP_CONFIG_SCHEMA_v1.5.md` に従う。**スキーマ外キーは起動時エラー**（silent ignore禁止）。

### 12.2 Coverage gate（方式C=AUTO を v1.5に内包して明文化）
- `coverage(tag) = tagWorkCount / totalWorks`
- `dataQuality.minCoverageMode`:
  - `RATIO`: `coverage(tag) >= minCoverageRatio`
  - `WORKS`: `tagWorkCount >= minCoverageWorks`
  - `AUTO`: `coverage(tag) >= max(minCoverageRatio, min(minCoverageWorks, totalWorks) / max(totalWorks, 1))`
  - ※ totalWorks が minCoverageWorks より小さい開発段階でも常時不成立にならないよう、minCoverageWorks は totalWorks でクランプし、さらに 0 除算を避ける。
- MVPデフォルトは `AUTO`（`minCoverageRatio=0.05`, `minCoverageWorks=20`）。

### 12.3 HardConfirm（日本語）生成ルール（FIX）
**目的:** 「当たるはずなのに外れる」を避け、実装の揺れを消す。

#### (A) タイトル頭（TitleInitial）
- 参照元は常に `top1.title`。
- `top1.title` を `normalizeTitleForInitial()` で正規化し、**先頭1文字**を取り出して問う。

`normalizeTitleForInitial(title)`
1. `title = title.normalize('NFKC')`
2. 先頭の空白を除去（半角スペース / 全角スペース / タブ）
3. 先頭が以下の「括弧prefix」で始まる場合、最初の対応する閉じ括弧までを **prefixとして削除**し、2へ戻る（最大3回）
   - 対象: `【...】`, `(... )`, `[... ]`, `{... }`, `＜...＞`, `<...>`, `「...」`, `『...』`, `（...）`, `［...］`, `｛...｝`
4. 先頭の記号を除去して2へ戻る（最大10回）
   - ASCII記号: `!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~`
   - 全角・代表記号: `！＂＃＄％＆＇（）＊＋，－．／：；＜＝＞？＠［＼］＾＿｀｛｜｝～` `★☆◆◇■□・…〜ー—–` など
5. 残った文字列の先頭1文字を返す。空なら `?` を返す。

#### (B) 作者（Author）
- 参照元は常に `top1.authorName`（表示もこの文字列のまま）。
- 判定は **完全一致のみ**（表記揺れ吸収はMVPではやらない）。

#### (C) HardConfirmの順序（FIX）
- HardConfirmは固定順：`TitleInitial → Author`。

### 12.4 決定論（Determinism）
- Tag同点: `tagKey` 昇順。
- Work同点: `P desc → workId asc`。
- その他同点も同様に **完全固定**（順序依存禁止）。

### 12.5 REVEAL再出防止（FIX）
- セッション状態として `revealRejectedWorkIds: Set<workId>` を保持。
- REVEALで `No` になった `workId` は **同一セッション中は再REVEAL禁止**。
- 実装上は `shouldReveal()` で `top1.workId not in revealRejectedWorkIds` を追加条件にする。

---

## 13. Compliance / NFR（MVP必須）
※これは「Spec外の推測」ではなく、**実装と運用の制約**。勝手に省略しない。

1) 外部リンクは全て **PR表記** を持つ（文言・デザインは仮でOK。必ず表示されるフックを実装）
2) リンク文言は固定テンプレを使用し、自動生成しない（例：「FANZAで見る」）
3) サムネ画像はFANZA側の公式URLのみ“表示”する。画像を自サーバーに保存/キャッシュしない。不明な場合は画像を表示しないフォールバックを用意
4) `AFFILIATE_ID` は環境変数で分離。本番ドメインのみ本番IDを使用。staging/devはIDなし（または別ID）にして誤計測/非承認リスクを避ける
5) 審査時に第三者が内容確認できる公開状態を維持（運用要件としてREADMEにチェックリスト化）
