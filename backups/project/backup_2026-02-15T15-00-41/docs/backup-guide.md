# バックアップガイド

## バックアップの種類

### 1. プロジェクト全体のバックアップ
重要なファイルとディレクトリをバックアップします。

**保存場所**: `backups/project/backup_YYYY-MM-DDTHH-MM-SS/`

**バックアップ対象**:
- `src/app/components` - コンポーネント
- `src/app/api` - APIルート
- `src/server` - サーバーサイドロジック
- `config` - 設定ファイル
- `prisma/schema.prisma` - データベーススキーマ
- `package.json`, `tsconfig.json`, `next.config.js` - プロジェクト設定

## 使用方法

### 手動バックアップ（推奨）

```bash
npm run backup:project
```

**推奨タイミング**:
- 大きな変更を行う前
- 実験的な機能を追加する前
- デプロイ前
- 重要な修正を行う前

### 自動バックアップ（オプション）

#### Git pre-commitフックで自動化

コミット前に自動的にバックアップを実行します。

**セットアップ**:
```bash
node scripts/setup-git-hooks.js
```

**無効化**:
```bash
# .git/hooks/pre-commit を削除またはリネーム
```

**注意**:
- コミットごとにバックアップが作成されるため、ディスク使用量が増加します
- バックアップが失敗してもコミットは続行されます（警告のみ）

## バックアップの管理

### 自動クリーンアップ
- 30日以上前のバックアップは自動的に削除されます
- バックアップ実行時に自動的にクリーンアップが実行されます

### バックアップ情報
各バックアップディレクトリには `backup-info.json` が含まれます：
- タイムスタンプ
- バックアップ対象
- 成功/失敗数

## 復元方法

バックアップから復元するには、`backups/project/backup_YYYY-MM-DDTHH-MM-SS/` から必要なファイルをコピーします。

例：
```bash
# コンポーネントを復元
cp -r backups/project/backup_2026-01-25T22-45-18/src/app/components src/app/

# 設定ファイルを復元
cp backups/project/backup_2026-01-25T22-45-18/config/mvpConfig.json config/
```

## 推奨ワークフロー

1. **日常的な開発**: 手動バックアップ（必要に応じて）
2. **重要な変更前**: 必ず手動バックアップ
3. **実験的な機能**: 変更前にバックアップ、失敗時は復元

自動バックアップは便利ですが、ディスク使用量が増えるため、**手動バックアップを推奨**します。
