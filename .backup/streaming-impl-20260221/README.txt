ストリーミング実装前のバックアップ
作成日: 2026-02-21

【目的】
fetch-comments API のストリーミング + ImportWorkflow でのストリーム読み実装

【含まれるファイル】
- ImportWorkflow.tsx
- fetch-comments route.ts (route.ts として保存)

【変更内容】
- ImportWorkflow: handleFetchSelectedComments, handleApiThenCommentBulk, handleBatchRun で
  stream: true を指定し、NDJSON ストリームを読みながら setProgress で進捗を更新
