# 同一タイトル・作者の作品重複の防止と解消

## 1. 今後の重複を防ぐ（インポート時）

### workId の統一（cid:d_xxx ⇔ d_xxx）

DMM content_id が `cid:d_xxx`（ingest）と `d_xxx`（DMM import）で混在して重複していたため、以下で統一しています。

- **toCanonicalWorkId**: DMM 形式はすべて `d_xxx` に正規化
- **getWorkIdLookupVariants**: 既存チェックで `d_xxx` と `cid:d_xxx` の両方を検索
- 適用先: `import-dmm-batch.ts`, `import-from-json.ts`, DMM API route, `importToDb`

### タイトル＋作者の重複防止

**import-dmm-batch.ts** と **import-from-json.ts** で、新規 Work を作る前に **タイトル＋作者が同じ既存作品** を検索します。

- 既に同じ `(title, authorName)` の Work がある場合: 新規作成はせず、**その workId に今回のジャンルタグだけ付与**して `saved: true` で返します。
- これにより、同じ作品が別 content_id で取り込まれても 1 本にまとまります。

### 定期確認（任意）

```bash
node scripts/investigate-duplicates.js   # 重複・表記揺れの調査
```

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
- **Prisma** (`deduplicate-works-by-title.ts`) は `DATABASE_URL` で指定した DB を使用。Postgres や未マイグレーション環境では「テーブルが存在しない」エラーになる場合があります。
- **SQLite 直接** (`deduplicate-works-sqlite.js`) は `prisma/dev.db` を直接操作するため、Prisma の接続に依存しません。

```bash
# SQLite 直接（Prisma エラー時に推奨）
node scripts/deduplicate-works-sqlite.js        # ドライラン
node scripts/deduplicate-works-sqlite.js --run   # 実行
```
