# タグ未抽出424件への手動タグ分析レポート

## 概要

- **対象**: コメントあり・DERIVEDタグ0件の作品 424件
- **ルール**: `chatgpt-prompt.txt` に準拠（S禁止・A/B優先・suggestedはリスト外のみ・characterは0〜1人）
- **実施日**: 2026-01-27

## 実施内容

1. **取得**: `scripts/fetch-no-derived-works.ts` で 424件を `no-derived-works-for-analysis.json` に出力
2. **分割**: `scripts/split-no-derived-for-batch.ts` で 50件ずつ `no-derived-part-001.json` … `part-009.json` に分割
3. **分析**: AI分析で `manual-analysis-no-derived-part1.json` … `part3.json` まで作成（150件）
4. **マージ**: `scripts/merge-manual-analysis-no-derived.ts` で part1〜3 をマージ
5. **反映**: `scripts/apply-manual-tags-no-derived.ts` でDBに反映

## 結果（150件まで）

| 項目 | 値 |
|------|-----|
| 反映作品数 | 150件 |
| 新規作成タグ数 | 69件（初回100件で60＋part3で9） |
| 反映所要時間 | 約480ms（150件時） |
| クレジット消費 | 0（手動分析のため） |

## 残り（274件）

- **part4** 〜 **part9** の分析JSON（`manual-analysis-no-derived-part4.json` … `part9.json`）が未作成
- 作成後、同様に `merge-manual-analysis-no-derived.ts` → `apply-manual-tags-no-derived.ts` を実行すると全424件が反映される

## 参照

- ワークフロー: `docs/tag-analysis-workflow-memo.md`
- ルール: `data/chatgpt-export/chatgpt-prompt.txt`
- A/Bランク: `config/tagRanks.json`
