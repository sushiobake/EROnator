# 同一タイトル・作者の作品重複の防止と解消

## 1. 今後の重複を防ぐ（インポート時）

**import-dmm-batch.ts** と **import-from-json.ts** で、新規 Work を作る前に **タイトル＋作者が同じ既存作品** を検索するようにしました。

- 既に同じ `(title, authorName)` の Work がある場合: 新規作成はせず、**その workId に今回のジャンルタグだけ付与**して `saved: true` で返します。
- これにより、同じ作品が別 content_id で取り込まれても 1 本にまとまります。

## 2. 既存の重複を解消するスクリプト

**scripts/deduplicate-works-by-title.ts**

- 全 Work を「タイトル＋作者」でグループ化し、2件以上いるグループを「重複」とみなします。
- 各グループで **代表 1 件** を決めます（`gameRegistered === true` があればそれを代表、なければ workId 昇順の先頭）。
- 重複側の WorkTag を代表の workId に移し（upsert）、その後重複 Work を削除します。

### 使い方

```bash
# ドライラン（何がまとめられるかだけ表示、削除しない）
npm run deduplicate:works

# 実行（実際に重複を削除）
npm run deduplicate:works:run
```

または:

```bash
npx tsx scripts/deduplicate-works-by-title.ts        # ドライラン
npx tsx scripts/deduplicate-works-by-title.ts --run  # 実行
```

### 注意

- 実行前に **DB のバックアップ** を推奨します。
- 現在の環境で `Work` テーブルが存在しない（別 DB や未マイグレーション）場合はエラーになります。利用する DB を `DATABASE_URL` で指した状態で実行してください。
