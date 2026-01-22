# データインポート手順

`importBatch.json` を読み取り、Prisma(SQLite)のDBへ反映する手順です。

## 前提条件

- `.env` ファイルに `DATABASE_URL` が設定されていること
- Prisma が初期化済み（`npm run db:push` が完了していること）

## 手順

### 1. importBatch.json を準備

`importBatch.json` ファイルを `data/import/` ディレクトリに保存します。

**注意**: ファイルは `data/schemas/importBatch.schema.json` のスキーマに準拠している必要があります。

### 2. インポート実行

PowerShell または cmd で以下のコマンドを実行します：

```powershell
npm run import:batch -- data/import/your-file.json
```

**例**:
```powershell
npm run import:batch -- data/import/batch_20240101.json
```

### 3. 実行結果の確認

実行が成功すると、以下の情報が表示されます：

- ✓ JSON Schema validation passed
- ✓ Database backed up to: `backups/dev_YYYYMMDD_HHMMSS.db`
- ✓ Import completed successfully
  - Works processed: X
  - Works created: Y
  - Works updated: Z
  - Tags created: A
  - Tags skipped (existing): B
  - WorkTags created: C
  - WorkTags skipped (existing): D
- ✓ Report saved to: `data/import/reports/report_YYYYMMDD_HHMMSS.json`

## 動作仕様

### 既存優先マージ

- **DELETE禁止**: 既存の Work/Tag/WorkTag は削除されません
- **既存優先**: 既存の値がある場合は保持され、空の値のみ補完されます
- **Work.authorName**: `circleName` が使用されます（既存があれば保持）
- **Work.isAi**: `"AI" | "HAND" | "UNKNOWN"` のいずれか

### タグの処理

- **OFFICIAL タグ**: `derivedConfidence = null` として保存（**除外フィルタ適用あり**、後述）
- **DERIVED タグ**: `derivedConfidence = confidence` として保存（1作品あたり最大10件、高confidence順）
- **CHARACTER タグ**: `tagType = "STRUCTURAL"`, `category = "CHARACTER"` として保存

### OFFICIALタグ除外ルール

OFFICIALタグは、DBへ反映する直前に以下のルールでフィルタリングされます。除外されたタグはレポートに記録されます。

#### A) 完全一致で除外

以下のタグは完全一致で除外されます（前後スペースは無視）：
- "新作"
- "準新作"
- "旧作"
- "イチオシ"

#### B) 正規表現で除外

以下の正規表現パターンに一致するタグは除外されます：

- `/^コミケ\d+/` - 例: コミケ107（2025冬）, コミケ92（2017夏）など全部
- `/^コミックマーケット/` - 表記揺れ対策
- `/^J\.?GARDEN\d*/i` - J.GARDEN58, JGARDEN57 など（大文字小文字区別なし）
- `/^YOU\d+/` - YOU5月イベント など
- `/赤ブー/` - 赤ブー5月イベント
- `/博麗神社例大祭/` - 博麗神社例大祭
- `/^コミティア/i` - コミティア132extra など（大文字小文字区別なし）
- `/^エアコミケ/i` - エアコミケ2 など（大文字小文字区別なし）

**注意**: 
- "男性向け", "BL", "乙女向け" などは除外されません（上記ルールに該当しないため）
- 文字列比較は前後スペースを trim してから判定されます

#### 除外タグの記録

除外されたタグは、レポートJSON（`data/import/reports/report_*.json`）の `works[i]` に以下の形式で記録されます：

```json
{
  "workId": "...",
  "droppedOfficialTags": ["新作", "コミケ107"],
  "keptOfficialTags": ["男性向け", "BL", "恋愛"]
}
```

### tagKey の生成

- **DERIVED**: `tag_<sha1(displayName)先頭10桁>`
- **CHARACTER**: `char_<sha1(displayName)先頭10桁>`
- **OFFICIAL**: 既存に `displayName` 一致があればその `tagKey` を使用、無ければ `off_<sha1(displayName)先頭10桁>` で新規作成

### 自動バックアップ

- `DATABASE_URL` が `file:` で始まる場合のみ、実行前に自動バックアップが作成されます
- バックアップ先: `backups/dev_YYYYMMDD_HHMMSS.db`

### JSON Schema検証

- インポート前に `data/schemas/importBatch.schema.json` で検証されます
- 検証に失敗した場合は、DBは変更されずに処理が終了します

### レポート出力

- 実行後に `data/import/reports/report_YYYYMMDD_HHMMSS.json` にレポートが出力されます
- レポートには統計情報（作成/更新/スキップ数）と、DERIVEDタグの超過分（10件を超えた場合）が記録されます

## エラー時の対処

### JSON Schema検証エラー

```
✗ JSON Schema validation failed:
```

→ `importBatch.json` の形式を確認し、`data/schemas/importBatch.schema.json` に準拠しているか確認してください。

### ファイルが見つからない

```
✗ File not found: <path>
```

→ ファイルパスが正しいか確認してください。相対パスはプロジェクトルートからの相対パスです。

### その他のエラー

→ エラーメッセージを確認し、必要に応じてバックアップから復元してください。

## バックアップからの復元

バックアップから復元する場合：

```powershell
# バックアップファイルを確認
dir backups

# バックアップを復元（例）
Copy-Item backups/dev_20240101_120000.db prisma/dev.db
```

**注意**: 復元前に現在のDBを別名で保存することを推奨します。
