# 質問文のデフォルト（汎用・キャラ・新タグ）設計

## 概要

- **汎用パターン**: テンプレート未設定のタグには一律で次の質問文を使う。BCタグ・新規タグもこれ。
  - 「○○が特徴的だったりするのかしら？」（○○はタグの表示名）
- **キャラタグ（Xタグ）**: `tagType === 'STRUCTURAL'` のタグは、テンプレートの有無にかかわらず次の形に統一する。
  - 「○○というキャラクターが登場する？」（○○はキャラ名。Sタグの「キャラクター」は別で、こちらはキャラ名のXタグ用）
- **今後あたらしいタグがついたとき**: すべて上記の「汎用」または「キャラ」になる。個別に `config/questionTemplates.json` に追加しない限り、自動で汎用／キャラのどちらかが使われる。

## 優先順位（ゲーム本番）

1. `config/questionTemplates.json` の `templates[displayName]` に存在する → その文字列を使用
2. 上になく、かつ `tagType === 'STRUCTURAL'`（キャラタグ） → 「○○というキャラクターが登場する？」
3. それ以外 → 「○○が特徴的だったりするのかしら？」（汎用）

## 実装箇所

| 箇所 | 内容 |
|------|------|
| `src/server/game/engine.ts` | `getTagQuestionText(displayName, tagType)`。テンプレート未設定時は STRUCTURAL → キャラ用、それ以外 → 汎用。 |
| `config/questionTemplates.json` | 個別テンプレート。`defaultPattern` は説明用。 |
| 管理画面タグリスト | 表示時: テンプレート未設定かつ `displayCategory === 'キャラタグ'` → キャラ用、それ以外 → 汎用。 |
| `src/app/api/admin/tags/include-unify-view/route.ts` | 代表タグの質問文フォールバックに汎用を使用。 |
| 新規タグ作成（manual-tagging 等） | DB の `questionTemplate` に汎用またはキャラ用をセットすることを推奨（ゲームは `questionTemplates.json` と tagType を参照するため、DB は管理用）。 |

## 新タグ作成時の推奨

- **通常タグ（DERIVED 等）**: `questionTemplate = "${displayName}が特徴的だったりするのかしら？"`
- **キャラタグ（STRUCTURAL）**: `questionTemplate = "${displayName}というキャラクターが登場する？"`

ゲーム側は `questionTemplates.json` と `tagType` のみ参照するため、DB に未設定でも本番では上記優先順位で汎用／キャラが使われる。DB の `questionTemplate` は管理画面の他機能で参照する場合に一貫性のため設定しておくとよい。
