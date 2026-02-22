# タグチェック指示書（バックアップ 2025-02-14 増分追記方式導入前）

**この指示書だけを読んで実行する。別ファイルは参照しない。**

---

## 実行順序（この順で必ず全部やる。1つでも抜かしたら未完了）

| 順番 | やること | 抜かしたら |
|------|----------|------------|
| 1 | workIds で `npx tsx scripts/fetch-works-for-ai.ts --check --out data/chatgpt-export/check-input.json <workIds>` を実行し、作品データを取得する（allTags と works が含まれる）。**`--out` 必須。PowerShell の `>` リダイレクトは文字化け・JSON 崩れを起こすため絶対に使わない。** | チェックできない |
| 2 | `data/chatgpt-export/check-input.json` の `works` を使って各作品をチェックし、後述の JSON 形式で出力する | 出力がない |
| 3 | **返した JSON 全文を会話に貼り付ける** | 私が確認できない |
| 4 | **返した JSON を `check-pending.json` に保存する**。**PowerShell の `>` や `Out-File` は文字化けするため絶対に使わない。** 必ず `save-check-pending.ts` を使う（後述） | フォルダは動かない |
| 5 | **`npx tsx scripts/apply-check.ts` を実行する** | **フォルダは動かない。= 未完了** |

**完了の定義**: 上記 5 つをすべて終えたときだけ完了。**4 と 5 をやらないとフォルダは一切移動しない。JSON を返すだけでは完了ではない。**

**PowerShell では `&&` が使えない。コマンドは必ず1行ずつ実行すること。**

---

（以下、元の check-instruction.md の残りを省略。必要なら本ファイルを参照）
