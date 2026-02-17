# 設定バックアップ 2026-02-18（質問文言修正前）

質問テンプレート・まとめ質問の日本語修正実施前バックアップ。

## 含まれるファイル

- questionTemplates.json
- summaryQuestions.json

## 復元方法

プロジェクトルートから:

```powershell
Copy-Item "backups\config_backup_question-2026-02-18\questionTemplates.json" -Destination "config\" -Force
Copy-Item "backups\config_backup_question-2026-02-18\summaryQuestions.json" -Destination "config\" -Force
```
