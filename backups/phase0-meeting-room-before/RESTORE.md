# Phase 0（会議室ホワイトボード）適用前の復元

## 復元手順

```powershell
cd c:\tool\eronator_mvp0_ws_v1_5_3
Copy-Item "backups\phase0-meeting-room-before\Stage.tsx" -Destination "src\app\components\Stage.tsx" -Force
```
