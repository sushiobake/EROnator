# タグのカテゴリ分け・包括・統合

## 概要

- **カテゴリ分け**: タグを「シチュエーション/系統」「関係性」「属性」「場所」「プレイ・行為」「キャラ・職業」「キャラクター」「その他」「キャラタグ」で分類。表示順は `config/tagCategories.json` の `categoryOrder`（その他→キャラタグが最後）。`categoryMerge` で シチュエーション→シチュエーション/系統、未分類→その他 に統合表示。
- **包括・統合**: 取得時はタグを消さず別々のまま。扱い（質問・スコア）では「同じグループ」としてまとめる。設定は `config/tagIncludeUnify.json`。管理画面タグ管理では、タグリスト（テーブル）内で代表タグの直下に「－－A 3P」のようにサブ行で表示する（＝そのタグは元の位置ではなく代表の下に「移動」して表示）。

## バックアップ

- 実施日時: プロジェクト `backups/project/backup_*`、DB `backups/dev_before_tag_category_*`
- 戻すとき: `backups/project/backup_*` から必要なファイルをコピー。DB は `backups/dev_before_tag_category_*.db` を `prisma/dev.db` にコピー。

## 設定ファイル

| ファイル | 内容 |
|----------|------|
| `config/tagCategories.json` | `categoryOrder`（表示順）、`tagsByCategory`（カテゴリごとのタグ一覧）。未掲載タグは「その他」扱い。 |
| `config/tagIncludeUnify.json` | `include`: 代表タグ → 包括されるタグのリスト。`unify`: 同義タグのグループ（配列の配列）。 |

## 包括・統合のルール（反映済み）

- **オナニー配信** は「動画配信・撮影」にのみ包括（オナニーには含めない）。
- **種付け** は「種付けプレス」とは別扱い（包括しない）。
- **体拭き** は包括しない（Bタグのため別のまま）。

## コードでの利用

- **カテゴリ**: `GET /api/admin/tags/list` のレスポンスに `displayCategory`（表示用統合カテゴリ）と `categoryOrder` を追加。管理画面タグ管理では、タグテーブルを `categoryOrder` 順で表示し、「全カテゴリ」選択時はテーブル内にカテゴリ見出し行（〇 カテゴリ名）を挿入。
- **包括・統合**: ゲームエンジン（`src/server/game/engine.ts`）でタグ質問の重み更新時に、`getGroupDisplayNames(displayName)` で同一グループのタグを取得し、そのいずれかを持つ作品を「あり」としてスコア更新。管理画面では `GET /api/admin/tags/include-unify-view` で包括・統合を取得し、タグテーブル内で代表タグ行の直下にサブ行「－－A タグ名」として表示（そのタグは元の位置には出さず代表の下に移動して表示）。

## 質問文のデフォルト（汎用・新タグ）

- テンプレート未設定のタグは**汎用**「○○が特徴的だったりするのかしら？」を使用。キャラタグ（Xタグ）は「○○というキャラクターが登場する？」に統一。詳細は [question-default-pattern.md](./question-default-pattern.md)。

## 見直し・追加

- 包括・統合の追加・変更は `config/tagIncludeUnify.json` を編集。`include` / `unify` の形式を崩さないこと。
- カテゴリの追加・並び替えは `config/tagCategories.json` の `categoryOrder` と `tagsByCategory` を編集。「その他」は最後に配置すること。
