# 特別質問の流れ（Special Question Flow）

最終更新: 2026-02-27

## 概要

特別質問は **Q3, Q5, Q9, Q16** の4スロットで出題される。  
特別質問のいずれかで「わからない」と答えた場合、**Q11** が追加され、最大5回まで特別質問が出る。

**救済スロット（Q20, Q24）**: 絞り込めていない場合のみ、TITLE_SYLLABLE_2 または AUTHOR_CHAR_TYPE を出題。条件: `effectiveCandidates > 25` または `confidence < 0.35`。

---

## スロットと候補プール

| スロット | 候補 | 選択方法 |
|----------|------|----------|
| **Q3** | SERIES または POPULARITY | 情報量上位2〜3件からランダム |
| **Q5** | Q3で使わなかった方 + TITLE_CHAR_TYPE | 同上 |
| **Q9** | 残りの未使用タイプ（SERIES, TITLE_CHAR_TYPE, POPULARITY, TITLE_SYLLABLE） | 同上 |
| **Q16** | 残りの未使用タイプ | 同上（2回目の50音スロット） |
| **Q11** | 残りの未使用タイプ | 同上（わからない回答時の補填） |
| **Q20, Q24** | TITLE_SYLLABLE_2（TITLE_SYLLABLE が YES/NO のときのみ）, AUTHOR_CHAR_TYPE | 条件満たす場合のみ、ランダムで1つ |

---

## 特別質問の6タイプ

| タイプ | 質問例 | 判定基準 |
|--------|--------|----------|
| **SERIES** | その作品は、シリーズものや総集編？ | シリーズタグの有無 |
| **TITLE_CHAR_TYPE** | タイトルは【漢字】で始まる？ / タイトルは【ひらがな or カタカナ】で始まる？ | タイトル先頭文字の文字種 |
| **POPULARITY** | その作品は、かなり有名？ | popularityBase + playBonus ≥ 30（config で変更可） |
| **TITLE_SYLLABLE** | タイトルは【さ行～わ行】で始まる？ など | titleReadingInitial が範囲に含まれるか（DB登録が必要） |
| **TITLE_SYLLABLE_2** | タイトルは【な行～わ行】で始まる？ など | TITLE_SYLLABLE の YES/NO に応じた2次範囲（救済のみ） |
| **AUTHOR_CHAR_TYPE** | 作者名は【ひらがな or カタカナ】で始まる？ | 作者名先頭文字の文字種（救済のみ） |

---

## 典型的な質問の流れ（例）

### パターンA: 通常（4回の特別質問）

```
Q1:  まとめ質問（恋愛とか、ラブコメの話、ある？）
Q2:  まとめ or 通常タグ
Q3:  【特別】シリーズもの？ or 有名？
Q4:  通常タグ
Q5:  【特別】Q3で使わなかった方 or 漢字/ひらがなorカタカナ
Q6:  通常タグ
...
Q9:  【特別】残り（例: 50音）
...
Q16: 【特別】残り（例: まだ使っていないタイプ）
```

### パターンB: わからない回答時（5回の特別質問）

```
Q3:  【特別】シリーズもの？ → わからない
...
Q5:  【特別】漢字/ひらがなorカタカナ
...
Q9:  【特別】有名？ or 50音
...
Q11: 【特別】残り（わからない補填スロット）
...
Q16: 【特別】残り
```

---

## 選択ロジックの詳細

1. **候補の構築**: スロットごとの `allowedTypes` に基づき、未使用タイプの候補を生成
2. **情報量計算**: 各候補の pYes（YES と答える確率）から情報量 `min(p, 1-p)` を算出
3. **選択**: 情報量上位2〜3件からランダムに1つ選ぶ（低情報量の質問が選ばれにくい）

---

## 設定ファイル

- **config/specialQuestions.json**: 質問文、popularityThreshold（デフォルト30）、50音の範囲、TITLE_SYLLABLE_2 の branches、AUTHOR_CHAR_TYPE
- **config/mvpConfig.json**: `flow.specialQuestionSlotIndices` = [3, 5, 9, 16]、`flow.rescueSpecialCondition` = { slotIndices: [20, 24], effectiveCandidatesMin: 25, confidenceMax: 0.35 }

---

## 注意事項

- **TITLE_SYLLABLE** は `titleReadingInitial` が DB に登録されている作品でのみ有効。未登録が多いと候補に含まれにくい
- **Q11** は特別質問で「わからない」と答えた場合のみ追加される
- 動的延長（B）により、最大質問数は 30 + わからない数 + (Q30かつ候補<50で+5)、上限40問
