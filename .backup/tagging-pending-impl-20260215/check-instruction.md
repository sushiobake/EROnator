# タグチェック指示書

**この指示書だけを読んで実行する。別ファイルは参照しない。**

---

## 実行順序（この順で必ず全部やる。1つでも抜かしたら未完了）

| 順番 | やること | 抜かしたら |
|------|----------|------------|
| 1 | workIds で `npx tsx scripts/fetch-works-for-ai.ts --check <workIds>` を実行し、作品データを取得する | チェックできない |
| 2 | 取得した JSON を使って各作品をチェックし、後述の JSON 形式で出力する | 出力がない |
| 3 | **返した JSON 全文を会話に貼り付ける** | 私が確認できない |
| 4 | **返した JSON を `data/chatgpt-export/check-result.json` に保存する** | フォルダは動かない |
| 5 | **`npx tsx scripts/apply-check-result.ts data/chatgpt-export/check-result.json` を実行する** | **フォルダは動かない。= 未完了** |

**完了の定義**: 上記 5 つをすべて終えたときだけ完了。**4 と 5 をやらないとフォルダは一切移動しない。JSON を返すだけでは完了ではない。**
