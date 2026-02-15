# タグの「付いている作品数」表示・背景濃さ

## 概要

管理画面でタグを見るときに「そのタグが何件の作品に付いているか」が分かるようにする機能。  
**まとめ質問タブ**と**タグ管理タブ**にのみ実装（折衷案）。他タブへの移植も可能。

- **表示**: タグ名の横に「（3）」のように件数を表記（まとめ質問タブのタグボタン）
- **背景濃さ**: 作品数が多いタグほど背景を濃く表示。最大値は **100** でキャップ（100以上は同じ濃さ）
- **色の統一**: タグリスト（タグ管理）・DB・作品インポートと同じ `rankColors`（S紫 / A緑 / B黄）をベースに、濃さで workCount を表現

## バックアップ

- 実装前に以下をバックアップ済み:
  - `backups/before-tag-workcount/SummaryQuestionEditor.tsx`
  - `backups/before-tag-workcount/TagManager.tsx`
- 復元する場合は上記を `src/app/admin/components/` に上書き。

## 共通ユーティリティ

- **ファイル**: `src/app/admin/utils/tagWorkCount.ts`
- **色**: `src/app/admin/constants/rankColors.ts` の `RANK_BG` を参照（S/A/B をまとめ質問のセクションと対応）
- **提供**: `getWorkCountIntensity`, `getWorkCountLabel`, `getWorkCountRowAlphaHex`, `getTagButtonBackgroundFromSection`, `WORK_COUNT_MAX_CAP`
- **データ**: workCount は `GET /api/admin/tags/list` の各タグに含まれる。

## 他タブへの移植（メモ）

- **共通コンポーネントを他のタブにも移植できる**（作品DB・シミュレーション・作品インポート・人力タグ付けなど）。
- 移植する場合は時間はかかるが、手順は単純:
  1. 該当タブでタグ一覧または workCount を取得（`tags/list` を1回叩くか、既存APIに workCount を足す）
  2. タグを描画している箇所を、`tagWorkCount.ts` のユーティリティでラベル・背景を付けるように差し替える
- 現状は「まとめ質問」「タグ管理」の2タブのみ適用。
