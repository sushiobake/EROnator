# AI指示の現状まとめ（問題点の洗い出し）

最終更新: 2025-01-27

## 1. 呼び出し経路と「誰がどの指示・タグリストを使うか」

| 機能 | API/経路 | プロバイダ | 送る内容 | 実際に使われる指示 | タグリストの出所 |
|------|----------|------------|----------|---------------------|------------------|
| **タグ分析**（管理画面） | `POST /api/admin/tags/analyze` | Cloudflare | `{ commentText, systemPrompt }` | **Worker内の固定プロンプト**（body.systemPrompt は読まない） | **Worker内の S_LIST / A_LIST / B_LIST / C_LIST**（デプロイ時に埋め込み） |
| 同上 | 同上 | Groq / HuggingFace | `{ commentText, systemPrompt }` | アプリの `buildSystemPrompt()` の内容 | **プロンプト文字列に埋め込み**（config/officialTagsCache.json + tagRanks.json の A/B） |
| **再分析**（reanalyze） | `POST /api/admin/reanalyze` | Cloudflare | `{ title, commentText, currentSTags }` のみ（systemPrompt なし） | **Worker内の固定プロンプト** | **Worker内の S/A/B/C リスト**（同上） |
| 同上 | 同上 | Groq / HuggingFace | 同上だが **内部で** systemPrompt を組み立てて API に渡す | アプリの `buildDynamicSystemPrompt(officialTags, alreadyOnWork)` | **プロンプト文字列に埋め込み**（config の S/A/B/C） |
| 5件テスト・一括準有名タグ | `analyze-test` / `generate-derived-tags*` | 設定に依存 | `analyzeWithConfiguredProvider(comment, systemPrompt)` → Cloudflare のときは `{ commentText, systemPrompt }` | **Cloudflare のときは Worker内の固定プロンプト**（body.systemPrompt は読まない） | **Cloudflare のときは Worker内のリスト**。Groq/HF のときは各APIの DEFAULT_SYSTEM_PROMPT 等（タグリストなしの簡易版） |

要点:

- **Cloudflare に「渡している」のはリクエスト body だけ**で、Worker は **body からは title / commentText / currentSTags しか読んでいない**。`body.systemPrompt` は参照していない。
- そのため **Cloudflare で実際に効いている指示とタグリストは、すべて Worker のコード内に固定で書かれたものだけ**。
- アプリ側の `aiPrompt.ts`（`buildSystemPrompt` / `buildDynamicSystemPrompt`）や `config/officialTagsCache.json`・`tagRanks.json` は、**Groq / HuggingFace を使うときだけ**使われる。

---

## 2. タグリストは「どうやって渡す」か

### 2.1 Groq / HuggingFace の場合（アプリからAPIを直叩き）

- **渡し方**: リクエストごとに、**システムプロンプトの文字列の中にタグリストを埋め込んで**送っている。
- **元データ**:
  - 有名タグ（S）: `config/officialTagsCache.json`（`getOfficialTagList()`）
  - 準有名タグ A/B/C: `config/tagRanks.json`（`getTagsByRank('A'|'B'|'C')`）
- **「別途」の仕組みはない**。プロンプト = 「指示文 + タグリスト」がひとまとまりで毎回送られる。

### 2.2 Cloudflare Worker の場合

- **渡し方**: **リクエストでは渡していない**。タグリストは **Worker のソースコードに定数として埋め込まれている**。
- **手順**（手順書どおり）:
  1. ローカルで `node scripts/export-worker-tag-lists.js` を実行する。
  2. 標準出力に出る `S_LIST` / `A_LIST` / `B_LIST` / `C_LIST` の JavaScript をコピーする。
  3. Cloudflare ダッシュボードの Worker 編集画面で、既存の `const S_LIST = ...` ～ `const C_LIST = ...` をそのコピーで**置き換える**。
  4. Worker を**保存して再デプロイ**する。
- つまり **「別途タグリストを渡す」仕組みは、アプリのAPIとしては存在しない**。  
  **「プロジェクトの config を更新 → 手動でエクスポート → Worker に貼り付けて再デプロイ」** が「渡す」操作に相当する。

まとめ:

- アプリから Cloudflare への**リクエストにタグリストは含まれない**（payload は title / commentText / currentSTags、または commentText + systemPrompt だが、Worker は systemPrompt を読まない）。
- タグリストを更新したければ、**毎回 export スクリプトを実行し、Worker のコードを貼り替えて再デプロイする必要がある**。

---

## 3. 問題点の整理

### 3.1 Cloudflare でアプリの指示が効いていない

- **タグ分析**で `ERONATOR_AI_PROVIDER=cloudflare` のとき、アプリは `getAiPromptConfig().systemPrompt`（`buildSystemPrompt()` または `ERONATOR_AI_PROMPT`）を body の `systemPrompt` に入れて送っている。
- しかし **Worker は `body.systemPrompt` を一切読んでおらず、常に Worker 内で組み立てた固定の `systemPrompt` だけを AI に渡している**。
- 結果:
  - アプリの `aiPrompt.ts` や環境変数で指示を変えても、**Cloudflare 経由では反映されない**。
  - テストで「指示を変えているのに結果が変わらない」場合は、Cloudflare を使っている限り **Worker 側の指示だけが効いている** ため。

### 3.2 指示の形式が2系統ある

- **アプリのタグ分析用（Groq/HF）**:  
  `matchedTags` / `suggestedTags` / `characterName`、件数は「matched 1〜3・suggested 0〜2」など。
- **Worker（Cloudflare）**:  
  `additionalSTags` / `aTags` / `bTags` / `cTags` / `characterName` / `needsReview`、合計5個まで。
- アプリは Worker の返却を `derivedTags` 等に変換して吸収しているが、**「どの指示で学習させるか」がプロバイダで分かれており、Cloudflare だけ別仕様**になっている。

### 3.3 タグリストの二重管理とずれ

- **アプリ**: `config/officialTagsCache.json` と `config/tagRanks.json` を参照。
- **Cloudflare**: Worker に埋め込んだ `S_LIST` / `A_LIST` / `B_LIST` / `C_LIST` のみ参照。
- アプリ側の config を更新しても、**export → 貼り付け → 再デプロイ**をしない限り Worker のリストは古いまま。
- そのため **「アプリと Cloudflare で参照しているタグリストが違う」状態が発生しやすく、テストがうまくいかない要因**になり得る。

### 3.4 5件テスト・一括系のプロンプトが Cloudflare と Groq/HF で違う

- `analyze-test` や `generate-derived-tags*` は `analyzeWithConfiguredProvider(comment, systemPrompt)` を呼ぶ。  
  Cloudflare のときは `analyzeWithCloudflareAi(commentText, systemPrompt)` → body に `systemPrompt` は入るが、**Worker は使わない**。
- そのため **「5件テスト用に systemPrompt を変えても、Cloudflare のときは無視される」**。

---

## 4. 現状の「正しい理解」のまとめ

| 質問 | 答え |
|------|------|
| Cloudflare に実際に効いている指示は？ | **Worker のコード内で組み立てている systemPrompt のみ**（手順書「ここに貼るコード」内の 873〜906 行付近のテンプレート＋S/A/B/C リスト）。 |
| アプリから送っている systemPrompt は？ | タグ分析では body に含めて送っているが、**Worker は読んでいない**。 |
| タグリストは「別途どう渡す」？ | **アプリのAPIでは渡していない**。Cloudflare の場合は **export スクリプトで出したリストを Worker に貼り付けて再デプロイ**する運用で「渡す」。 |
| テストがうまくいかない要因になり得るのは？ | (1) Worker のリストが config とずれている、(2) 指示を変えても Cloudflare では Worker 側の指示しか効かない、(3) プロバイダごとに指示・出力形式が違う。 |

---

## 5. 実施した修正（Cloudflare でちゃんとしたタグ取得）

- **Worker で body.systemPrompt を使うようにした**  
  - `body.systemPrompt` が存在し非空ならそれを採用し、なければ従来どおり Worker 内の埋め込みプロンプトを使う。  
  - タグ分析・再分析ではアプリが **systemPrompt（＋プロンプト内のタグリスト）** を送るので、**Cloudflare でもアプリの指示と config のタグリストが効く**。
- **再分析（reanalyze）で Cloudflare 時も systemPrompt を送るようにした**  
  - 以前は payload（title / commentText / currentSTags）だけ送っていたが、**commentText と buildDynamicSystemPrompt(...) を送る**ように変更。  
  - これで再分析でも Cloudflare でアプリの指示・タグリストが使われる。
- **Worker のレスポンス解析で matchedTags/suggestedTags に対応**  
  - アプリのプロンプトは matchedTags/suggestedTags/characterName 形式で返すため、Worker がその形式も解釈して derivedTags 等に詰めて返すようにした。

**やること（運用）**  
1. **Worker のコードを差し替える**  
   - 手順ドキュメント「ここに貼るコード」の**最新版**を Cloudflare の Worker 編集画面に貼り付け、保存して再デプロイする。  
2. **タグ分析・再分析はそのまま**  
   - アプリはすでに systemPrompt を送る実装になっているので、Worker を更新するだけで、Cloudflare でもアプリの指示と config のタグリストで動く。  
3. **タグリストの更新**  
   - config（officialTagsCache.json / tagRanks.json）を更新すれば、**Worker の貼り直しは不要**。タグ分析・再分析では毎回プロンプトにタグリストが含まれるため。

---

## 6. 今後の修正の方向性（参考）

- **指示と出力形式の1本化**  
  - アプリの「matchedTags / suggestedTags」と Worker の「additionalSTags / aTags / bTags / cTags」のどちらかに統一するか、変換を明文化して、プロバイダが変わっても同じ挙動にそろえる。

以上が、AI指示についての現状と、タグリストの渡し方・問題点の整理、および実施した修正です。
