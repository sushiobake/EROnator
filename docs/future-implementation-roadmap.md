# 将来実装ロードマップ（相談メモ）

2026-02-26 時点の相談内容をまとめたドキュメント。

---

## ① 質問「順」設計

### 概要
質問の流れをコンフィグで設計できるようにする。まとめ質問・特別質問・ランダムなど、細かく指定したい。

### 現状
- `engine.ts` の `selectNextQuestion` に質問順がほぼ固定で記述
- Q1: 非エロまとめのみ
- Q2以降: `shouldInsertConfirm` で SOFT/HARD_CONFIRM vs EXPLORE
- Q3, Q5, Q9, Q10: Special Question スロット（`flow.specialQuestionSlotIndices` で変更可）
- それ以外: まとめ＋通常タグの統一選択

### 難易度・工数
**中〜大**。300行超の条件分岐が絡む。完全コンフィグ駆動には `questionFlow: [{ indices: [1], type: "summary_only" }, ...]` のようなスキーマと engine のリファクタが必要。

### 方針
**優先度低。当面は質問順をコードで固定。** 必要になったタイミングでコンフィグ化を検討。

---

## ② 特別質問設計 ✅ 実装済み（2026-02-26）

### 概要
- 「タグ＆質問リスト」の上に「特別質問」を同様の形で配置（開きたいときに開く）
- 特別質問の文言を管理画面で編集可能に
- Type 2: 有名度（「かなり有名？」）を実装
- Type 1: 50音分類（「あ行～た行で始まる？」）を実装
- 「有名度をプレイに応じて増やす」仕組みは未実装（コンフィグでいじれるようにしておく）

### 実装内容
- `config/specialQuestions.json` で文言・パラメータを管理
- `/api/admin/special-questions` で GET/POST
- 管理画面「タグ＆質問リスト」タブ内に「特別質問」セクション（畳み込み式）
- `specialQuestionSelection.ts` で POPULARITY, TITLE_SYLLABLE を追加
- `engine.ts` の `processAnswer` で POPULARITY, TITLE_SYLLABLE の重み更新を実装

---

## ③ 頭文字チェック＆編集 ✅ 実装済み（2026-02-26）

### 概要
約6,000作品の `titleReadingInitial` に漢字由来のミスがある。ミスがあるとゲーム精度に影響するため、チェック・編集用のタブを用意したい。

### 実装内容
- 管理画面「作品頭文字」タブ
- 対象: コメント取得済み OR ゲーム使用 OR タグ済み（phase0通過）の作品
- 漢字始まりの作品のみ表示、50音順、1000件/ページ
- 頭文字のインライン編集（ひらがな入力可、保存時にカタカナに変換）。未設定も編集可能
- 確認済みフラグ（`titleReadingInitialConfirmed`）。確認済みはデフォルト非表示
- オプションで「確認済みも表示」可能
- 「この1000件をまとめて確認済み」ボタン

---

## ④ 管理画面・全体のやばいところ（Opus 評価）

### 評価サマリー
- `admin/tags/page.tsx`: 約5,200行の巨大ファイル
- API ルートにビジネスロジック混在
- ~~セッションのレースコンディション（並行リクエストで Lost Update の可能性）~~ → ✅ 実装済み
- weightsHistory の肥大化
- ~~セッションクリーンアップなし~~ → ✅ 実装済み

### 優先度別の対応

| 優先度 | 項目 | 対応 | 状態 |
|--------|------|------|------|
| **P0** | セッションのレースコンディション | `version` による楽観的ロックを導入 | ✅ 実装済み（manager.ts, SessionConflictError, 409） |
| **P1** | 管理画面の巨大化 | タブ単位でコンポーネント分割（WorksTab, ConfigTab 等） | 一部対応（ChangelogTab, ConfigTab 抽出済み） |
| **P1** | API のビジネスロジック混在 | answer/reveal のロジックを engine に集約 | ✅ 完了（handleAnswerResponse, handleRevealResponse） |
| **P2** | セッションクリーンアップ | Cron で N 日以上未更新のセッションを削除 | ✅ 実装済み（/api/cron/cleanup） |
| **P2** | 数値オーバーフロー | scoring/weightUpdate の `Math.exp` にガード追加 | ✅ 実装済み |

### 今すぐ直すべきもの
1. **P0: レースコンディション** … データ破壊リスク
2. **P1: 管理画面の分割** … 5,000行超は保守限界
3. **P2: 数値ガード** … 工数小、将来の破綻防止

---

## 参考: プロジェクト構造（Opus 評価より）

```
eronator_mvp0_ws_v1_5_3/
├── config/mvpConfig.json
├── data/workTagMatrix.json
├── prisma/schema.prisma
├── src/app/          # Next.js App Router
├── src/server/       # ゲームエンジン・アルゴリズム
└── scripts/          # 150+ ユーティリティ
```

主要テーブル: Work, Tag, WorkTag, Session, PlayHistory, Log
