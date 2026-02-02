# 1ページ目・47作品 手動タグ分析レポート（テスト）

実施日: 2026-01-27  
対象: 作品リスト1ページ目（createdAt desc）の「眠泊3〜掌で踊る傲慢な女帝…」から「サキュバステードライフ総集編II」まで

---

## 対象範囲

- **リスト**: 管理画面「インポートワークフロー」の作品リスト1ページ目（先頭100件のうち）
- **開始**: タイトルに「眠泊3」を含む作品
- **終了**: タイトルに「サキュバステードライフ総集編II」を含む作品
- **件数**: **47作品**（すべてコメントあり）

---

## 作業フロー（4作品テストと同一）

1. **取得**: `scripts/fetch-page1-range-works.ts` で1ページ目を取得し、「眠泊3」〜「サキュバステードライフ総集編II」の範囲をスライス → `data/chatgpt-export/page1-range-works-for-analysis.json`
2. **分析**: AI指示（chatgpt-prompt.txt）に従い、各作品のコメントから  
   - S（有名タグ）使用禁止  
   - A/Bランクから **matchedTags**  
   - リストにない特徴のみ **suggestedTags**  
   - 固有名の **characterName**（0〜1人）  
   を手動で付与。
3. **反映**: `scripts/apply-manual-tags-page1.ts` で既存DERIVEDを削除し、分析結果を一括でDBに反映。

---

## 結果サマリ

| 項目 | 値 |
|------|-----|
| 対象作品数 | 47 |
| 新規作成タグ数 | 55（DERIVED＋STRUCTURALの新規分） |
| DB反映所要時間 | **185ms** |
| 外部API（Groq/Cloudflare/HuggingFace等） | 未使用 |
| **クレジット消費** | **0** |

---

## 精度について

- **ルール**: S禁止・A/B優先・順番（S→A/B→suggested）・造語禁止・characterは固有名のみに準拠。
- **一貫性**: 同じルールで47作品を一括して分析・付与。
- 正解ラベルはないため数値的な正解率は未計測。同一作品を ChatGPT や reanalyze API で分析した結果との突き合わせを推奨。

---

## 所要時間

| 項目 | 時間 |
|------|------|
| 範囲取得（DB検索・JSON出力） | 約3秒 |
| 分析（47作品のコメント解釈＋タグ決定） | 手動・十数分程度 |
| **DB反映（タグ書き込み）** | **185ms** |

※ 外部LLMは未使用のため、API待ち時間はゼロ。

---

## クレジット消費

| 項目 | 消費 |
|------|------|
| Groq / Cloudflare / HuggingFace 等 | **0**（未使用） |

---

## 使用ファイル

- 範囲取得スクリプト: `scripts/fetch-page1-range-works.ts`
- 分析結果JSON: `data/chatgpt-export/manual-analysis-page1-47works.json`
- 反映スクリプト: `scripts/apply-manual-tags-page1.ts`
- 付与したDERIVEDの `derivedSource`: `manual-matched` / `manual-suggested`

管理画面の「インポートワークフロー」やタグ一覧で、47作品に付与されたタグを確認できます。
