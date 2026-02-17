# タグ質問 DB 移行バックアップ 2026-02-17

質問を questionTemplates.json から Tag.questionTemplate（DB）に移行する前のバックアップ。

## 含まれるファイル
- config/*.json（全設定）
- prisma/dev.db（SQLite DB）

## 復元例
```powershell
Copy-Item "config\*" -Destination "..\..\config\" -Force
Copy-Item "dev.db" -Destination "..\..\prisma\" -Force
```
