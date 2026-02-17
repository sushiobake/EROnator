# 設定バックアップ 2026-02-17

タグ統合・包括とBタグ変更の実施前バックアップ。

## 復元方法

```powershell
Copy-Item "config_backup_2026-02-17\tagIncludeUnify.json" -Destination "..\..\config\" -Force
Copy-Item "config_backup_2026-02-17\tagRanks.json" -Destination "..\..\config\" -Force
```

プロジェクトルートから:

```powershell
Copy-Item "backups\config_backup_2026-02-17\tagIncludeUnify.json" -Destination "config\" -Force
Copy-Item "backups\config_backup_2026-02-17\tagRanks.json" -Destination "config\" -Force
```
