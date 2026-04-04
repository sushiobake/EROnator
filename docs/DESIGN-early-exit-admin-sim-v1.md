# 早期失敗の閾値：管理画面コンフィグ＋シミュ詳細 設計書（v1）

> **更新（方針）**: 早期失敗ロジックの見直し（条件③の廃止・①②の定義変更など）は [DESIGN-early-exit-late-game-ux-v2.md](./DESIGN-early-exit-late-game-ux-v2.md) を正とする。本書の「3指標」「getConfidenceDelta5」前提の記述は、実装追従後は deprecated 扱いとする。

## 1. この設計の目的

1. **運用**: 早期失敗一覧へ切り替える条件（いわゆる「閾値」）を、**JSON を直接編集しなくても**、管理画面から日本語の説明付きで調整できるようにする。
2. **検証**: 管理画面のシミュレーション結果の詳細で、**本番と同じ3指標**・**いまのコンフィグの閾値**・**各条件が「マッチ」したか**を確認でき、閾値の妥当性を観察できるようにする。

本書は **実装の契約**（データの形・画面の責務・受け入れ基準）を固定する。アルゴリズムの数式そのものは既存の `engine.ts`（`shouldEarlyExit` 周辺）を正とする。

---

## 2. 背景（既存仕様の要約）

- 早期失敗は、**クイズに1回答した直後**に評価される（`newQuestionCount` が審査点のとき）。
- 審査点はコンフィグ `flow.earlyExitReview.reviewIndices`（例: 25, 30, 35, 40）。
- 各審査点ごとに **3種類のチェック**があり、**マッチした数**が `requiredConditions` 以上なら失敗一覧へ遷移（デフォルトは **3つ中2つ**）。
- 3つ目の指標は **直近5問の回答パターンから出る代理値**であり、**質問前後の確度の差分ではない**（誤解防止用に必ずUI・説明文に明記する）。

参照コード: `src/server/game/engine.ts` の `getEarlyExitThreshold` / `getConfidenceDelta5` / `shouldEarlyExit`。

---

## 3. 用語（画面表示用の日本語と内部キー）

| 画面での呼び方（案） | 内部・コンフィグ | 意味 |
|----------------------|-------------------|------|
| 1位の確率 | `confidence` | トップ1作品の確率（0〜1）。「確度」に相当。 |
| 実質候補の広さ | `effectiveCandidates` | 候補がまだ広いかの内部指標（既存の候補数表示と整合）。 |
| 直近5問の動き（代理） | `confidenceDelta5`（`getConfidenceDelta5` の戻り） | 直近5問の YES/NO/UNKNOWN の偏りから出した粗い代理値。0 / 0.03 / 0.06 / 十分大きい値 など。 |

**3つの「マッチ」条件**（審査点 `qK` の閾値オブジェクト `thresholds.qK` に対応）:

| ラベル（案） | 判定（`shouldEarlyExit` と同一） |
|--------------|----------------------------------|
| 1位の確率が低い | `confidence < minConfidence` → 1マッチ |
| 実質候補が広い | `effectiveCandidates > maxEffectiveCandidates` → 1マッチ |
| 直近5問がほぼ動いていない（代理） | `confidenceDelta5 <= maxConfidenceDelta5` → 1マッチ |

---

## 4. コンフィグ（データソース）

- **既存のキー**: `config/mvpConfig.json` の `flow.earlyExitReview`（および `thresholds.q25` … `q40`）。
- **Zod**: `src/server/config/schema.ts` で既に許容されている想定。新規キーは不要なら **スキーマ変更なし**でよい。

### 4.1 管理画面で扱うフィールド一覧

| 項目 | JSON パス | 説明（ユーザー向け） |
|------|-----------|----------------------|
| 有効 | `flow.earlyExitReview.enabled` | 早期失敗の審査を行うか。 |
| 審査する問数 | `flow.earlyExitReview.reviewIndices` | 何問目に答えた**直後**に審査するか（例: 25,30,35,40）。 |
| 発動に必要なマッチ数 | `flow.earlyExitReview.requiredConditions` | 3条件のうちいくつマッチしたら失敗一覧へ飛ばすか（通常 2）。 |
| Q25 用 3値 | `thresholds.q25` | 25問目回答直後に使う閾値セット。 |
| Q30 / Q35 / Q40 | `thresholds.q30` … | 同様。 |

各 `qK` オブジェクト:

| 表示ラベル（案） | JSON キー | マッチ条件 |
|------------------|-----------|------------|
| 「1位の確率がこの値**未満**なら1マッチ」 | `minConfidence` | 上表 1行目 |
| 「実質候補がこの値**より大きい**なら1マッチ」 | `maxEffectiveCandidates` | 上表 2行目 |
| 「直近5問の代理がこの値**以下**なら1マッチ」 | `maxConfidenceDelta5` | 上表 3行目 |

### 4.2 UI 配置

- **ファイル**: `src/app/admin/tags/tabs/ConfigTab.tsx`
- **新規セクション**: 折りたたみ **「早期失敗の閾値」**（`CollapsibleSection`）。
- **既存の「特別質問スロット…」**と同様、各入力の下に **短い日本語説明**（1〜3行）を置く。
- **保存**: 既存の `updateConfig` で `flow.earlyExitReview` を丸ごと更新する。保存前バックアップの挙動は既存どおり。

---

## 5. サーバ：シミュレーション結果への拡張

### 5.1 各クイズステップに載せる情報（案）

クイズ1手ごと（`REVEAL` 行は対象外でも可、または空オブジェクト）に、次のような **スナップショット**を付与する。

| フィールド（案） | 型 | 説明 |
|------------------|-----|------|
| `questionCountAfterAnswer` | number | この回答のあとに相当する `newQuestionCount`（本番と同じ定義）。 |
| `confidence` | number | 回答後のトップ1確率。 |
| `effectiveCandidates` | number | 回答後の実質候補数。 |
| `confidenceDelta5` | number | この時点の履歴で計算した `getConfidenceDelta5`。 |
| `isReviewPoint` | boolean | `questionCountAfterAnswer` が `reviewIndices` に含まれるか。 |
| `reviewKey` | `'q25' \| 'q30' \| 'q35' \| 'q40' \| null` | 審査点ならどのセットを使うか。 |
| `thresholds` | object \| null | その審査点の `minConfidence` / `maxEffectiveCandidates` / `maxConfidenceDelta5`（審査点でなければ null）。 |
| `requiredConditions` | number \| null | コンフィグの `requiredConditions`。 |
| `matchLowConfidence` | boolean | 条件1マッチか。 |
| `matchWideCandidates` | boolean | 条件2マッチか。 |
| `matchFlatDelta5` | boolean | 条件3マッチか。 |
| `matchedCount` | number | 上記3つの真の個数。 |
| `wouldEarlyExit` | boolean | `isReviewPoint` かつ `matchedCount >= requiredConditions` のとき true。 |

**本番の判定式と一致させること**（`shouldEarlyExit` または、同じ式を呼ぶ薄いラッパーから算出）。

### 5.2 実装場所

- **`src/server/simulation/simulationRunner.ts`**: メインループで、回答後・断定ブロック前後のどちらか **既に `confidence` / `effectiveCandidates` / `questionHistory` が揃ったタイミング**でスナップショットを計算し、`steps[i]` にマージする。
- **`src/app/api/admin/simulate/route.ts`**: 単発POST用のループでも **同じ形**を返す（コード重複は共通化を検討）。
- **バッチ（Worker）**: `simulationRunner` 経由なら同じ `steps` に載る。

### 5.3 早期失敗で終了したとき

- 既存の `diagnostic.endedBy === 'EARLY_FAIL_REVIEW'` などと整合。
- 可能なら **`diagnostic.earlyExitSummary`** に、終了した審査点・マッチした条件・実測値・閾値を1行まとめ（任意）。

---

## 6. 管理画面：シミュレーション詳細モーダル

### 6.1 現状

- `src/app/admin/tags/page.tsx` 内で、ステップごとに `effectiveCandidates` や `confidenceAfter` 等を表示。

### 6.2 拡張方針

- 各ステップ行に **「早期失敗チェック」** ブロック（折りたたみ or 審査点の行だけ強調表示）。
- 表示内容:
  - **実測3つ**: 1位の確率、実質候補の広さ、直近5問の代理値。
  - **閾値3つ**: その行が審査点なら `thresholds` を表示。審査点でなければ「この問の直後は審査タイミングではない」と表示するか、次の審査点までの説明のみ。
  - **マッチ**: 3条件それぞれ ○/× またはオンオフ。
  - **合計**: `matchedCount / requiredConditions` と、`wouldEarlyExit` の有無。

### 6.3 視覚的な「閾値に近い」（フェーズ）

- **フェーズ1（必須）**: マッチのオンオフのみ。実装コストが低く、調整に十分使える。
- **フェーズ2（任意）**:
  - 条件1・2: 数値のため「閾値からの距離」（例: 確率が閾値より上/下にどれだけ）を簡易表示し、**マッチ直前**だけ背景色を変える等。
  - 条件3: 離散値のため「近さ」は分かりにくい。**代理値と閾値の並列表記**に留めるのが無難。

---

## 7. 本番デバッグ（任意・非必須）

- `/api/answer` のデバッグ用レスポンスに、審査点のときだけ同スナップショットを載せることは **可能だが本設計の必須スコープ外**。必要なら別タスクとする。

---

## 8. 受け入れ基準

1. 管理画面のコンフィグで `flow.earlyExitReview` を編集・保存でき、リロード後も値が保持される。
2. シミュレーション実行後、詳細で **各クイズステップ**（または審査点）について、**実測3つ・閾値（審査点時）・3マッチの有無・`wouldEarlyExit`** が確認できる。
3. 早期失敗で終了したランでは、**どの審査点で・どの条件が効いたか**が追える（`endedBy` とステップ上の情報の両方で確認可能なら理想）。
4. 本番の `shouldEarlyExit` と **同じ入力なら同じ真偽**になる（回帰防止のため、単体テストまたはエンジンからの関数呼び出し1本化を推奨）。

---

## 9. 非目標（今回やらない）

- 一般プレイ用のゲーム画面に同じ詳細パネルを出すこと。
- `confidenceDelta5` を「真の確度の5問差分」に置き換えること（別改善）。
- 設計書ファイル以外の **新規ドキュメント乱立**（本書と既存の problem-first 設計との重複は、本書を「UI/シミュ拡張」に限定してよい）。

---

## 10. 実装順序の推奨

1. `engine.ts` に **診断用の純関数**（実測値＋閾値＋マッチ3つ＋`wouldEarlyExit`）を追加し、既存 `shouldEarlyExit` と式を共有する。
2. `simulationRunner` / `simulate/route.ts` で `steps` にスナップショットを付与。
3. `ConfigTab.tsx` に「早期失敗の閾値」セクション。
4. `page.tsx` のシミュ詳細モーダルに表示を追加（フェーズ1→任意でフェーズ2）。

---

## 11. 参考：ユーザーの理解との対応

「3つのうち2つ以上がマッチした状態で、25（など）の**審査タイミング**を迎えたら早期失敗になる」という理解は、**`requiredConditions === 2` のとき正しい**。  
ただしマッチは **「その審査点用の閾値セット」**（q25 / q30 …）で評価されるため、25問目と30問目では **閾値の数値が違う**点をUIでも説明に含める。
