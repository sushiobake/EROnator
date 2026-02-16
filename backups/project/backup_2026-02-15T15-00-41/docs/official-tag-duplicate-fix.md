# OFFICIALタグ重複の修正と再発防止

## 事象

- OFFICIALタグが「ほとんど重複している」状態になっていた
- 同一の displayName に対して、**2種類の tagKey** が存在していた
  - `off_xxxxxxxxxx` … category = 「ジャンル」
  - `fanza_01_xxxxxxxxxx` … category = 「シチュエーション/系統」

## 原因

**tagKey の付け方が2系統あったため。**

1. **現在の標準（DMMインポート・import-dmm-batch）**
   - `tagKey = off_` + SHA1(displayName) の先頭10文字
   - category は固定で「ジャンル」
   - `src/app/api/admin/dmm/import/route.ts` / `scripts/import-dmm-batch.ts` がこの方式

2. **別系統（過去のインポートや別ソース）**
   - `tagKey = fanza_01_` + 何らかのID/ハッシュ
   - category は API 由来の「シチュエーション/系統」など
   - 同じジャンル名でも **tagKey が異なる** ため、別タグとして登録されていた

APIで約200件を追加した際、既存の `fanza_01_` 系タグに加えて、管理画面のDMMインポートで `off_` 系が新規作成され、同一 displayName で2つの Tag が並ぶ状態になったと考えられる。

## 実施した修正（統合）

- **方針**: 削除ではなく「重複の統合」。作品に付いている WorkTag は残し、参照先の Tag を1つにまとめた。
- **正規の tagKey**: `off_` で始まる方を正とする（DMMインポート標準に合わせた）。
- **手順**:
  1. 同一 displayName（正規化済み）の OFFICIAL をグループ化
  2. 各グループで `off_` のタグを正規とし、なければ WorkTag 数が最多のものを正規に採用
  3. 正規でない方の WorkTag をすべて「正規の tagKey」へ付け替え（既に正規が付いている作品は重複 WorkTag のみ削除）
  4. どれにも紐付かなくなった Tag 行を削除

- **実行**: `scripts/merge-official-tag-duplicates.ts`
  - ドライラン: `npx tsx scripts/merge-official-tag-duplicates.ts --dry-run`
  - 本実行: `npx tsx scripts/merge-official-tag-duplicates.ts`

- **結果例**: OFFICIAL 255 組の重複を解消。WorkTag 1168 件を正規側に付け替え、255 件の Tag 行を削除。統合後は「同一 displayName の重複 = 0」。

## 再発防止

1. **OFFICIAL の tagKey は常に同じルールで作る**
   - 必ず **displayName から生成** し、`tagKey = off_` + SHA1(displayName) の先頭10文字 とする。
   - **API の genre.id やその他の ID を tagKey に使わない。**

2. **参照しているコード**
   - `src/app/api/admin/dmm/import/route.ts` の `generateTagKey(genre.name, 'OFFICIAL')` → `off_` + hash
   - `scripts/import-dmm-batch.ts` の同様の処理
   - `src/server/admin/importToDb.ts` の OFFICIAL 作成も `generateTagKey(displayName, 'OFFICIAL')` で `off_` を付与

3. **今後、JSONや別APIから作品・タグを取り込む場合**
   - ジャンル名（displayName）だけを信用し、tagKey は上記 `generateTagKey(displayName, 'OFFICIAL')` で生成する。
   - 既存タグの検索は `tagKey` または `displayName + tagType: 'OFFICIAL'` で行い、**tagKey に外部IDをそのまま使わない。**

4. **重複の確認**
   - `scripts/check-official-tag-duplicates.ts` で、同一 displayName の OFFICIAL が複数ないか定期的に確認できる。

## 関連ファイル

- 重複確認: `scripts/check-official-tag-duplicates.ts`
- 統合実行: `scripts/merge-official-tag-duplicates.ts`
- OFFICIAL 作成（標準）: `src/app/api/admin/dmm/import/route.ts`, `scripts/import-dmm-batch.ts`
