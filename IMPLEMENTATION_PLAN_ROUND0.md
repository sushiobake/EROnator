# MVP0 実装計画（ラウンド0）

## A) 作業計画：必要なファイル/モジュール/ルート構成

### 1. プロジェクト構造（想定）

```
eronator_mvp0_ws_v1_5_3/
├── config/
│   └── mvpConfig.json (✅ 作成済み)
├── src/
│   ├── server/
│   │   ├── config/
│   │   │   └── loader.ts (config読み込み・バリデーション)
│   │   ├── db/
│   │   │   ├── schema.ts (Works, Tags, WorkTags, Sessions, Logs)
│   │   │   ├── seed.ts (初期データ投入用、後で実装)
│   │   │   └── client.ts (DB接続)
│   │   ├── algo/
│   │   │   ├── scoring.ts (重み計算・正規化・confidence・effectiveCandidates)
│   │   │   ├── weightUpdate.ts (回答による重み更新)
│   │   │   └── questionSelection.ts (質問選択ロジック)
│   │   ├── session/
│   │   │   └── manager.ts (セッション状態管理)
│   │   ├── api/
│   │   │   ├── route.ts または handlers/
│   │   │   │   ├── start.ts (セッション開始)
│   │   │   │   ├── answer.ts (回答受付)
│   │   │   │   ├── reveal.ts (REVEAL回答)
│   │   │   │   └── failList.ts (FAIL_LIST処理)
│   │   │   └── types.ts (API型定義)
│   │   └── utils/
│   │       ├── normalizeTitle.ts (HardConfirm用タイトル正規化)
│   │       ├── coverage.ts (coverage計算・AUTO判定)
│   │       └── allowedHosts.ts (サムネ許可ホスト判定)
│   ├── client/
│   │   ├── components/
│   │   │   ├── AgeGate.tsx
│   │   │   ├── AiGate.tsx
│   │   │   ├── Quiz.tsx
│   │   │   ├── Reveal.tsx
│   │   │   ├── Success.tsx
│   │   │   ├── FailList.tsx
│   │   │   └── ExternalLink.tsx (PR表記付き外部リンク)
│   │   ├── hooks/
│   │   │   └── useGameSession.ts (ゲーム状態管理)
│   │   └── app/
│   │       └── page.tsx または layout.tsx (ルーティング)
│   └── types/
│       └── index.ts (共通型定義)
├── README.md (起動手順・チェックリスト)
└── .env.example (環境変数テンプレート)
```

### 2. 主要モジュールの責務

#### 2.1 Config管理 (`server/config/loader.ts`)
- `config/mvpConfig.json` を読み込み
- スキーマバリデーション（スキーマ外キーは起動時エラー）
- 型安全なconfigオブジェクトを返す

#### 2.2 データベース (`server/db/`)
- Works: workId, title, authorName, isAi, popularityBase, popularityPlayBonus, productUrl, thumbnailUrl, etc.
- Tags: tagKey, displayName, tagType, category
- WorkTags: workId, tagKey, derivedConfidence (nullable)
- Sessions: セッション状態（weights, questionHistory, revealMissCount, revealRejectedWorkIds, aiGateChoice, etc.）
- Logs: FAIL_LISTの自由入力保存（submittedTitleText, timestamp, aiGateChoice, etc.）

#### 2.3 アルゴリズム (`server/algo/`)
- `scoring.ts`: 
  - basePrior計算 (exp(alpha * popularityTotal))
  - 正規化 (P(w) = W(w) / sum(W))
  - confidence計算 (P(top1))
  - effectiveCandidates計算 (1 / sum(P(w)^2))
- `weightUpdate.ts`:
  - Tag-based質問の重み更新 (exp(±beta * s))
  - DERIVEDタグの二値化判定 (derivedConfidence >= threshold)
  - HardConfirmの重み更新（同じ式を使用）
  - REVEAL miss時のペナルティ適用
- `questionSelection.ts`:
  - EXPLORE_TAG選択（p near 0.5、coverage gate通過）
  - Confirm挿入判定（qIndex強制 / confidence band / effectiveCandidates）
  - SOFT_CONFIRM vs HARD_CONFIRM選択
  - HardConfirm順序管理（TitleInitial → Author）

#### 2.4 セッション管理 (`server/session/manager.ts`)
- セッション作成・取得
- 状態更新（weights, questionCount, revealMissCount, revealRejectedWorkIds, etc.）
- AI_GATEフィルタ適用（候補Work集合の固定）

#### 2.5 API Routes (`server/api/`)
- `/api/start`: セッション開始、AI_GATE後の初期化
- `/api/answer`: QUIZ/Confirm回答受付、重み更新、次質問選択
- `/api/reveal`: REVEAL回答（Yes/No）、SUCCESS or ペナルティ適用
- `/api/failList`: FAIL_LIST表示（上位10件）、リスト外入力保存

#### 2.6 フロントエンド (`client/`)
- 状態遷移管理（AGE_GATE → AI_GATE → QUIZ → REVEAL → SUCCESS/FAIL_LIST）
- 6択回答UI（QUIZ/Confirm）
- Yes/No回答UI（REVEAL）
- 外部リンク表示（PR表記必須）
- サムネ表示（許可ホスト判定、非許可なら非表示）

### 3. 実装順序（推奨）

1. **基盤構築**
   - プロジェクト初期化（技術スタック決定が必要）
   - Config読み込み・バリデーション
   - DBスキーマ定義
   - 環境変数設定

2. **アルゴリズム実装**
   - scoring.ts（重み計算・正規化）
   - weightUpdate.ts（回答による更新）
   - questionSelection.ts（質問選択）

3. **バックエンドAPI**
   - セッション管理
   - API routes（start, answer, reveal, failList）

4. **フロントエンド**
   - 各状態コンポーネント
   - 状態遷移ロジック
   - UI（最小限）

5. **Compliance/NFR**
   - PR表記実装
   - サムネ許可ホスト判定（初期値空）
   - AFFILIATE_ID環境変数
   - README作成

---

## B) 不明点・確認が必要な点

### 技術スタック
1. **フレームワーク**: Next.js / React + Vite / その他？
2. **バックエンド**: Next.js API Routes / Express / その他？
3. **データベース**: PostgreSQL / SQLite / Prisma / Drizzle / その他？
4. **言語**: TypeScript想定で問題ないか？

### データベース
5. **初期データ**: Works/Tagsの初期データはどのように用意するか？（seed.tsで手動投入？外部ファイル？）
6. **セッション保存**: セッション状態をDBに保存するか、メモリ（Redis等）か？

### 実装詳細
7. **AGE_GATE**: 実装方式は任意とあるが、具体的な要件（Cookie？LocalStorage？単純な確認画面？）
8. **AI_GATE**: 3択の内部enum値（"YES" | "NO" | "DONT_CARE" 等）の命名規則
9. **質問テンプレート**: EXPLORE_TAGの質問文生成ルール（例：「この作品は[tag.displayName]ですか？」）
10. **SOFT_CONFIRM**: 「ちょっとズルい質問」の具体例と、どのタグをSOFT_CONFIRM対象とするか
11. **HardConfirmタイトル正規化**: `normalizeTitleForInitial()` の実装詳細（Spec §12.3に記載あり、実装可能）
12. **決定論の保証**: 同一入力で同一遷移を保証するための乱数シードや固定順序の実装方法

### Compliance/NFR
13. **PR表記**: 具体的な表示文言・デザイン（「PR」テキストのみ？リンク横に表示？）
14. **外部リンク文言**: 「FANZAで見る」等の固定テンプレートをどこに定義するか（config？コード？）
15. **サムネ許可ホスト**: `ALLOWED_THUMB_HOSTS` をserver側の定数として定義する場所
16. **AFFILIATE_ID**: 本番ドメイン判定の方法（環境変数で分岐？）

### 運用
17. **README**: 審査用チェックリストの具体的な項目（Spec §11の17項目をそのまま？）
18. **起動手順**: 開発環境のセットアップ手順（DB初期化、環境変数設定等）

---

## C) 次のステップ

1. 技術スタックの決定（ユーザー確認 or 推奨案提示）
2. プロジェクト初期化
3. Config読み込み・バリデーション実装
4. DBスキーマ定義
5. アルゴリズム実装（段階的に）
