進行パネル実装前のバックアップ
作成日: 2026-02-20

【目的】
管理画面に「進行パネル」（右下固定・タブ跨ぎで進捗表示）を実装する前に、
変更対象ファイルを退避したもの。

【含まれるファイル】
- page.tsx … 管理画面メイン（tags/page.tsx）
- ManualTagging.tsx … 人力タグ付け
- ImportWorkflow.tsx … 作品インポート

【設計メモ】
docs/admin-progress-panel-design-memo.md を参照

【復元する場合】
上記3ファイルを元のパスに上書きコピーする。
