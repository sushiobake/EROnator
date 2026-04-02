# 特別質問の流れ（Special Question Flow）

最終更新: 2026-04-02（設計 v1.5・実装整合）

## 概要

- **ベースの特別枠**は `mvpConfig.flow.specialQuestionSlotIndices` で指定（既定: **Q3, Q5, Q9, Q12**）。
- 特別質問のいずれかで「わからない」と答えた場合、**Q11** が UNKNOWN 補填として特別枠に乗ることがある（動的）。Q11 固定コンテンツは置かない。
- **救済スロット**は `mvpConfig.flow.rescueSpecialCondition.slotIndices`（既定: **Q16, Q20, Q24**）。`effectiveCandidates` と `confidence` の条件を満たすときのみ、AUTHOR_CHAR_TYPE / TITLE_SYLLABLE_2（前提あり）/ TITLE_LENGTH_STYLE などから選ぶ。
- **新タグ質問**は `newTagQuestions.slotIndices`（既定 **Q2, Q7, Q13**）。有効時はその番号で **通常探索より優先**。
- **ノイズ誘導**（`NOISE_GUIDE_RECOMMEND`）: **Q5（TITLE_SYLLABLE）と Q12（TITLE_LENGTH_STYLE または TITLE_CHAR_TYPE）の両方が UNKNOWN** のあと、**次の1問**で出す。新タグ・補填より **最優先**。YES で推薦モードへ。
- 文言・閾値の多くは **`config/specialQuestions.json`** と **`config/mvpConfig.json`**。

---

## スロットと候補プール（実装準拠）

| 質問番号 | 内容 |
|----------|------|
| **Q3** | **SERIES** または **POPULARITY**（Q9 と合わせて両方1回ずつ出る想定） |
| **Q5** | **TITLE_SYLLABLE**（50音・行）固定 |
| **Q9** | **SERIES / POPULARITY** のうち Q3 で出なかった方 |
| **Q11** | 固定枠なし。特別質問で UNKNOWN が出た場合の **補填**としてこの番号に特別が乗ることがある |
| **Q12** | **TITLE_LENGTH_STYLE** または **TITLE_CHAR_TYPE** をランダムに1つ |
| **Q16, Q20, Q24** | **救済**（条件付き）。AUTHOR_CHAR_TYPE、TITLE_SYLLABLE_2（Q5 が YES/NO で終わっていること）、TITLE_LENGTH_STYLE などから `mvpConfig` に応じて選ぶ |

`flow.specialQuestionSlotIndices` を変えれば、上記の「番号」とエンジンの対応を変えられる（既定は 3,5,9,12）。

---

## 特別質問タイプ一覧

| タイプ | 概要 |
|--------|------|
| **SERIES** | シリーズ／総集編系タグ |
| **POPULARITY** | 有名度しきい値（`specialQuestions.json` 等） |
| **TITLE_SYLLABLE** | 50音・行（`titleReadingInitial` 利用） |
| **TITLE_CHAR_TYPE** | タイトル先頭の文字種 |
| **TITLE_LENGTH_STYLE** | タイトル長（長め／短め。YES 最小文字数・NO 最大文字数は設定可） |
| **TITLE_SYLLABLE_2** | 救済。TITLE_SYLLABLE の続き（枝） |
| **AUTHOR_CHAR_TYPE** | 作者名の文字種（救済中心） |

---

## ゲーム内の出題優先（`selectNextQuestion`）

同一 `qIndex` で競合する場合の **確定順**（抜粋）:

1. **ノイズ誘導**（条件を満たすとき）
2. **新タグ質問**（スロットに該当し、未出の variant があるとき）
3. 既存の **特別質問枠**（`specialQuestionSlotIndices` + UNKNOWN 補填の Q11）
4. 通常の探索・確認・REVEAL 判定など

※ 新タグ3本目が Q13 かつノイズも Q13 の条件がある場合は、ノイズ優先。ノイズ後に新タグをずらすロジックあり（実装参照）。

---

## 設定ファイル

| ファイル | 内容 |
|----------|------|
| **config/mvpConfig.json** | `flow.specialQuestionSlotIndices`、`flow.rescueSpecialCondition`、`newTagQuestions`、`noiseGuideRecommend`、最大質問数など |
| **config/specialQuestions.json** | 各特別タイプの文言、50音レンジ、POPULARITY 閾値、`TITLE_LENGTH_STYLE` の yesMinLength / noMaxLength など |

---

## 典型的な流れ（例）

```
Q1:  通常（まとめ or タグ）
Q2:  新タグ（有効時はここが最優先）／通常
Q3:  【特別】SERIES or 有名度
Q4:  通常
Q5:  【特別】50音（TITLE_SYLLABLE）
Q6:  通常
Q7:  新タグ／通常
Q8:  通常
Q9:  【特別】SERIES/有名度の残り
Q10: 通常（＋確認帯）
Q11: 通常＋確認。UNKNOWN 補填で【特別】が乗る場合あり
Q12: 【特別】タイトル長 or 先頭文字種
Q13: 【ノイズ】（Q5・Q12 がともに UNKNOWN の直後のみ・最優先）／新タグ3本目／通常
...
Q16・Q20・Q24: 【救済・特別】条件付き
```

---

## 注意事項

- **TITLE_SYLLABLE** は `titleReadingInitial` が未登録の作品では効きにくい。
- **TITLE_SYLLABLE_2** は **Q5 が YES/NO で終わっていること**が前提。
- **新タグ**は DB にタグが未付与でも動作するが、重み更新の効果は限定的になりうる（設計上許容）。
- 動的延長により最大質問数は `flow.maxQuestions` 周りのロジックで伸びる（`getEffectiveMaxQuestions` 等）。

---

## 関連ドキュメント

- `docs/DESIGN-new-tag-special-noise-v1.md`（v1.5 設計の全体）
