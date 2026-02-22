バックアップ: gameRegistered 同期修正 (2026-02-18)

対象: scripts/apply-cursor-legacy-ai-batch.ts

変更内容:
- pending に移動する際に gameRegistered=true, needsReview=false を設定
- needs_human_check に回す際も gameRegistered=true, needsReview=false を設定
- Postgres/SQLite の両方に対応

合わせて set-manual-tagging-game-and-untagged.ts を実行し、
4フォルダ内の既存作品をゲーム有効に同期済み（1697件更新）。
