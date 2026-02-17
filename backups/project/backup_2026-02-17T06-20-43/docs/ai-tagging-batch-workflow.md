# AIタグ付けバッチ作業手順（未タグ→タグ付け→DB反映）

今後も継続して行う作業のため、手順を余すことなく記載する。  
**依頼例**: 「残りの未タグ○○件、この感じでやって」「未タグ100件やって」など。

---

## 目的

- **未タグ作品**（コメントあり・DERIVEDタグが1つも付いていない作品）を、ルールに従って一括タグ付けし、DBに反映する。
- 反映後は「★チェック待ち(作品)」に入り、人間が確認・承認する前提。

---

## 前提

- `scripts/fetch-untagged-works.ts` の **`take`** は **件数に応じて変更する**（10 / 100 / 373 など）。  
  **「毎回10に戻す」は行わない**（作品数が変わるため）。ユーザーが「戻さなくていい」と指示した場合は 373 などのまま残す。
- 入力: 未タグ作品一覧（JSON）  
  出力: タグ付け結果（`data/ai-tagging-batch-10.json`）→ 同じファイルを `apply-ai-tagging-batch.ts` が読む。

---

## 手順（3ステップ）

### ステップ1: 未タグ作品の取得

1. **件数を決める**  
   未タグが N 件ある場合、`scripts/fetch-untagged-works.ts` の `take` を **N** に変更する（例: 373 なら `take: 373`）。
2. **実行**（出力先ファイルを引数で指定）:
   ```bash
   npx tsx scripts/fetch-untagged-works.ts data/untagged-N.json
   ```
   例: 373件なら `data/untagged-373.json`。  
   出力は **UTF-8** で書き出される（PowerShellのリダイレクトは文字化けするため、スクリプトの `fs.writeFileSync(..., 'utf-8')` でファイルに書き出す）。
3. **確認**: `wrote N works to data/untagged-N.json` と出ればOK。

---

### ステップ2: タグ付け（ルール適用）

1. **実行**（入力JSONを引数で指定）:
   ```bash
   npx tsx scripts/tag-untagged-batch.ts data/untagged-N.json
   ```
   入力未指定の場合は `data/untagged-100.json` を読む。
2. **処理内容**:  
   `config/officialTagsCache.json`（公式Sタグ一覧）と `config/tagRanks.json`（A/B/Cランク）を参照し、各作品の title・commentText・officialTags から **additionalSTags / aTags / bTags / cTags / characterTags** をルールで付与。  
   （ルール詳細は `docs/ai-tagging-memo.md` および `docs/ai-tagging-agent-instruction.md` 参照。）
3. **出力**: `data/ai-tagging-batch-10.json` に上書き保存。  
   **確認**: `wrote N items to .../ai-tagging-batch-10.json` と出ればOK。

---

### ステップ3: DBへの反映

1. **実行**:
   ```bash
   npx tsx scripts/apply-ai-tagging-batch.ts
   ```
   `data/ai-tagging-batch-10.json` を読み、各作品に対して DERIVED/STRUCTURAL タグの付与・更新と `aiAnalyzed=true`, `humanChecked=false` の設定を行う。
2. **確認**: 各作品ごとに `ok: workId タイトル...` が出力され、最後に `done.` と出ればOK。

---

## まとめ（コマンドのみ）

```bash
# 1. take を N に変更したうえで
npx tsx scripts/fetch-untagged-works.ts data/untagged-N.json

# 2. タグ付け
npx tsx scripts/tag-untagged-batch.ts data/untagged-N.json

# 3. DB反映
npx tsx scripts/apply-ai-tagging-batch.ts
```

- **take は N のまま戻さない**（ユーザーが「戻さなくていい」と指示した場合）。
- キャラ名などはスクリプトでは付けていないため、必要なら管理画面の「★チェック待ち(作品)」で手動追加する。

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| `scripts/fetch-untagged-works.ts` | 未タグ作品取得。`take` で件数指定。 |
| `scripts/tag-untagged-batch.ts` | ルールでタグ付け。第1引数で入力JSONを指定可。 |
| `scripts/apply-ai-tagging-batch.ts` | タグをDBに反映。入力は常に `data/ai-tagging-batch-10.json`。 |
| `data/untagged-N.json` | 未タグ作品一覧（取得結果）。 |
| `data/ai-tagging-batch-10.json` | タグ付け結果（apply の入力）。 |
| `docs/ai-tagging-memo.md` | タグ付けルール・学び。 |
| `docs/ai-tagging-agent-instruction.md` | エージェント向け指示書。 |
