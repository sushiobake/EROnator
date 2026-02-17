# DBマイグレーションとは - 説明

## マイグレーションとは？

**マイグレーション（Migration）**とは、データベースの構造（スキーマ）を変更する作業のことです。

### 具体例

今回のケースでは：

**変更前のWorkテーブル:**
```
- workId
- title
- authorName
- productUrl
- ...
```

**変更後のWorkテーブル:**
```
- workId
- title
- authorName
- productUrl
- affiliateUrl  ← 新規追加
- contentId     ← 新規追加
- releaseDate   ← 新規追加
- pageCount     ← 新規追加
- seriesInfo    ← 新規追加
- commentText   ← 新規追加
- ...
```

この「新規追加」をデータベースに反映する作業が**マイグレーション**です。

## Prismaでのマイグレーション方法

Prismaでは2つの方法があります：

### 方法1: `prisma db push`（開発環境向け、推奨）

```bash
npx prisma db push
```

**特徴:**
- スキーマファイル（`prisma/schema.prisma`）の変更を直接DBに反映
- マイグレーション履歴を残さない（開発環境向け）
- 既存データは保持される
- 新フィールドは`null`で追加される

**今回のケースでは、この方法が適しています。**

### 方法2: `prisma migrate dev`（本番環境向け）

```bash
npx prisma migrate dev --name add_new_fields
```

**特徴:**
- マイグレーション履歴を残す（本番環境向け）
- マイグレーションファイルが生成される
- より厳密な管理が可能

## 今回のマイグレーションで何が起こるか？

### 1. 新フィールドの追加

既存の`Work`テーブルに以下のカラムが追加されます：

- `affiliateUrl` (TEXT, NULL許可)
- `contentId` (TEXT, NULL許可)
- `releaseDate` (TEXT, NULL許可)
- `pageCount` (TEXT, NULL許可)
- `seriesInfo` (TEXT, NULL許可)
- `commentText` (TEXT, NULL許可)

### 2. 既存データへの影響

**既存の作品データ:**
- すべての既存レコードに新フィールドが追加される
- 値は`null`（未設定）になる
- 既存データは**一切削除されない**

**例:**
```
変更前:
workId: "d_719191"
title: "双子の兄妹..."
productUrl: "https://..."

変更後:
workId: "d_719191"
title: "双子の兄妹..."
productUrl: "https://..."
affiliateUrl: null        ← 追加（値はnull）
contentId: null           ← 追加（値はnull）
releaseDate: null         ← 追加（値はnull）
pageCount: null           ← 追加（値はnull）
seriesInfo: null          ← 追加（値はnull）
commentText: null         ← 追加（値はnull）
```

### 3. 今後のデータ取得

`import-dmm-batch.ts`で新規取得する作品は、新フィールドに値が入ります：

```
workId: "d_704027"
title: "またやってしまった稲荷さん4..."
productUrl: "https://www.dmm.co.jp/..."
affiliateUrl: "https://al.fanza.co.jp/..."  ← APIから取得
contentId: "d_704027"                        ← APIから取得
releaseDate: "2025-11-25 16:00:00"           ← APIから取得
pageCount: "34"                               ← APIから取得
seriesInfo: '{"id":...,"name":"..."}'         ← APIから取得
commentText: null                             ← 未取得（後でスクレイピング）
```

## 実行手順

### 1. バックアップ（推奨）

```bash
# 既存のDBをバックアップ
cp prisma/dev.db prisma/dev.db.backup
```

### 2. マイグレーション実行

```bash
npx prisma db push
```

**出力例:**
```
Prisma schema loaded from prisma\schema.prisma
Datasource "db": SQLite database "dev.db" at "file:./dev.db"

The following fields were added to the Work model:
  - affiliateUrl
  - contentId
  - releaseDate
  - pageCount
  - seriesInfo
  - commentText

✔ Generated Prisma Client (3.2s)

Your database is now in sync with your Prisma schema.
```

### 3. 確認

```bash
# Prisma Studioで確認（オプション）
npx prisma studio
```

## 注意事項

### ✅ 安全な操作

- 既存データは削除されない
- 新フィールドは`null`許可なので、既存データに影響なし
- ロールバック可能（バックアップから復元）

### ⚠️ 注意点

1. **バックアップ推奨**: 念のため、実行前にDBをバックアップしてください
2. **開発環境**: `prisma db push`は開発環境向けです。本番環境では`prisma migrate`を使用してください
3. **Prisma Client再生成**: マイグレーション後、Prisma Clientが自動的に再生成されます

## よくある質問

### Q: 既存データは消えますか？
A: いいえ、消えません。新フィールドが追加されるだけです。

### Q: マイグレーションを元に戻せますか？
A: はい、バックアップから復元できます。または、スキーマを元に戻して再度`prisma db push`を実行することもできます。

### Q: エラーが出たらどうすればいいですか？
A: バックアップから復元して、エラーメッセージを確認してください。通常はスキーマの構文エラーや型の不一致が原因です。

## まとめ

**マイグレーション = データベースの構造を変更する作業**

今回のケース：
- `prisma/schema.prisma`に新フィールドを追加
- `npx prisma db push`でDBに反映
- 既存データは保持、新フィールドは`null`で追加

**実行コマンド:**
```bash
npx prisma db push
```

これで、既存の作品にも新フィールドが追加され、新しい作品取得時に値が入るようになります。
