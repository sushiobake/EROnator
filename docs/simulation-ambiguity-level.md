# シミュレーション「曖昧さレベル」詳細

## 概要

曖昧さレベル（1〜10）は、シミュレーターが「ユーザー回答」をどれだけノイズ混じりにするかを制御するパラメータです。

- **L=1**: 常に正解を返す（ノイズなし＝理想的な回答者）
- **L=2〜10**: 正解 / 逆回答 / PROBABLY系 / UNKNOWN を確率で混ぜる

---

## 例外: 新タグ質問は常に UNKNOWN

`docs/DESIGN-new-tag-special-noise-v1.md` のとおり、**新タグ質問**（`kind === 'NEW_TAG_QUESTION'` または `mvpConfig.newTagQuestions` とスロット **2 / 7 / 13**（既定）の組み合わせ）では、曖昧さレベルに関係なく **`UNKNOWN` 固定**。実装は `src/server/simulation/simulationRunner.ts` の `isNewTagQuestionForSimulation` を参照。

---

## 計算式（`pickAnswerFromAmbiguity`）

```typescript
// simulationRunner.ts（旧 route.ts 複製箇所と同一ロジック）
const L = Math.max(1, Math.min(10, Math.round(ambiguityLevel)));
if (L === 1) return correctAnswer;

const wrongRate = 0.0133 * (L - 1);           // 逆回答の確率
const correctRate = L <= 9 ? 1 - 0.1 * (L - 1) : 0.08;  // 正解の確率
const vagueRate = 1 - correctRate - wrongRate;  // 曖昧回答の確率

// SOFT_CONFIRM のときは wrong/vague を半分に
const isSoft = questionKind === 'SOFT_CONFIRM';
const w = isSoft ? 0.5 : 1;
const wrong = wrongRate * w;
const vague = vagueRate * w;
const correct = 1 - wrong - vague;
```

---

## 各レベルの確率（EXPLORE / HARD_CONFIRM の場合）

| L | correctRate | wrongRate | vagueRate | 意味 |
|---|-------------|-----------|-----------|------|
| 1 | 100% | 0% | 0% | 常に正解 |
| 2 | 90% | 1.33% | 8.67% | ほぼ正解、わずかに曖昧 |
| 3 | 80% | 2.67% | 17.33% | 正解が多いが曖昧も増える |
| 4 | 70% | 4% | 26% | |
| 5 | 60% | 5.33% | 34.67% | |
| 6 | 50% | 6.67% | 43.33% | |
| 7 | 40% | 8% | 52% | |
| 8 | 30% | 10.67% | 59.33% | |
| 9 | 20% | 10.67% | 69.33% | |
| 10 | 8% | 12% | 80% | かなり曖昧 |

---

## vague の内訳（曖昧回答の種類）

曖昧回答に当たった場合、以下のように振り分けられます：

| 割合 | 正解がYESのとき | 正解がNOのとき |
|------|-----------------|----------------|
| 75% | PROBABLY_YES | PROBABLY_NO |
| 15% | PROBABLY_NO | PROBABLY_YES |
| 10% | UNKNOWN | UNKNOWN |

---

## SOFT_CONFIRM のとき

SOFT_CONFIRM（DERIVEDタグでの確認）のときは `w=0.5` により：

- `wrong` と `vague` が半分になる
- `correct` が相対的に増える

→ ソフト確認は「当たりやすい」想定で、ノイズを抑えている。

---

## HARD_CONFIRM の扱い

**タイトル頭文字・作者名**の HARD_CONFIRM は、`pickAnswerFromAmbiguity` を通さず **常に正解** を返します（route.ts 379行付近）。

---

## デフォルト設定（2026年時点）

- **サンプル数**: 50
- **曖昧さレベル**: 2

→ 正解90%・逆回答1.33%・曖昧8.67% のバランスで、軽いノイズを想定したシミュレーション。
