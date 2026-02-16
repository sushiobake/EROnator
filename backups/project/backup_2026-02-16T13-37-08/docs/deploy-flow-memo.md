# デプロイの流れメモ（自分用・次回用）

同じようなデプロイをまたやるとき用のチェックリスト。詳細は `deploy-preview-share.md` 参照。

---

## ★ 今回（DBも含めてプレビュー→本番）でやること

**こちらで済ませたこと**: Postgres の Work スキーマを SQLite と揃えた・変更をコミット・prepare:push 済み・手元は `restore:sqlite` 済み。

**あなたがやることは次のだけです。**

1. **本番 Supabase にカラム追加（同期の前に必ず 1 回）**  
   **同期で「Work.aiChecked does not exist」と出たら、Supabase にまだカラムが無い状態です。**  
   下の「Work テーブル追加カラム」の SQL を、Supabase の SQL エディタで **1 回だけ** 実行してから、もう一度 `npm run sync:supabase` する。

2. **（DB の中身を最新にしたいときだけ）**  
   `npm run dev:clean` を止めてから `npm run sync:supabase` を実行。終わったらまた `npm run dev:clean` でよい。

3. **プレビューへ push**  
   ターミナルで: `git push origin develop`

4. **プレビュー URL で確認**  
   Vercel の develop 用 URL を開き、「セッション開始」や管理画面が問題ないか確認する。

5. **問題なければ本番へ**  
   ターミナルで: `npm run deploy:prod`  
   表示されたら `yes` と入力する。

---

## 前提

- **ローカル**: SQLite（`prisma/dev.db`）で開発。`npm run dev` で動かす。
- **デプロイ先**: Vercel + Supabase（PostgreSQL）。ブラウザで開く URL はこっち。
- **初回だけ**「ローカルの作品データを Supabase にコピー」が必要。2回目以降の「push してテスト」ではやらなくてよい。

---

## 初回（Supabase が空のとき）だけやること

1. **バックアップ**（任意だが推奨）
   - `npm run backup:project`
   - 必要なら `prisma/dev.db` を `backups/dev_before_supabase_sync_日付.db` などにコピー

2. **`.env.supabase` を1回だけ用意**
   - `.env.supabase.example` をコピーして `.env.supabase` を作る
   - Supabase の **Pooler** の URL を `DATABASE_URL` に（Vercel の DATABASE_URL をそのままコピペでOK。`?pgbouncer=true&connection_limit=1` も含めてよい）
   - **直接接続** の URL を `DIRECT_URL` に
   - 括弧 `[YOUR-PASSWORD]` などは消して、実際の値だけ書く。`.env` は触らない

3. **同期実行**
   - `npm run sync:supabase`
   - 終わったら手元は SQLite のまま（スキーマも自動で戻る）

**同期の仕方**: 現状は **一括のみ**（ゲーム登録済みの全 Work を upsert）。Work は 1 件ずつ、WorkTag は 500 件ずつバッチで送っている。件数制限や「差分だけ」のオプションはない。必要ならスクリプトに `--limit` などを追加する対応は可能。

---

## 毎回デプロイするときの流れ

| 順 | やること | コマンドなど |
|----|----------|--------------|
| 1 | 変更をコミット | `git add .` → `git commit -m "メッセージ"` |
| 2 | ビルドが通るか確認 | `npm run build`（失敗したら push しない） |
| 3 | サーバー用に切り替え＋コミット | `npm run prepare:push`（develop ブランチで実行） |
| 4 | GitHub に送る | `git push origin develop` |
| 5 | デプロイ後、URL で「セッション開始」まで試す | ブラウザで確認 |
| 6 | 手元をローカル用に戻す | `npm run restore:sqlite` |

---

## ローカルとブラウザ（デプロイ先）の関係

- **データ**: 初回に `npm run sync:supabase` をやった時点で、ローカル SQLite の「ゲーム登録済み」作品＋タグが Supabase にコピーされる。
- **挙動**: その時点では「ローカルで動かすエロネーター」と「ブラウザで開く（Vercel の）エロネーター」は**同じ作品・同じタグ**を見ているので、**同じ挙動**になる。
- **その後**: ローカルでだけ作品を追加・タグを変えても、ブラウザ側には反映されない。反映したいときはもう一度 `npm run sync:supabase` を実行する。

---

## 人力タグ付け「フォルダ」を本番に入れたあと

- 本番DBに `manualTaggingFolder` カラムを追加し、既存データをフォルダに振り分ける必要がある。
- 手順は **`docs/manual-tagging-folder-deploy.md`** を参照。

---

## Work テーブル追加カラム（管理・チェック用）

### 1. Work がどこにあるか（場所の確認だけ。ここでは編集しない）

- ブラウザで **Supabase** のプロジェクトを開く（本番で使っているプロジェクト）。
- 左メニューで **「Table Editor」** をクリックする。
- 左側にテーブル一覧が出る。その中の **「Work」** が作品データのテーブル（Tag, WorkTag, Session, Log, PlayHistory などと並んでいる）。
- 今は「Work がどこか」の確認だけ。**Table Editor の Work では編集しない。**

---

### 2. 何をするか

- **Work テーブルに、列（カラム）を 6 本だけ追加する。**
- 既存の行のデータは一切変えない。新しい列が 6 本増えるだけ。追加した列ははじめは全部 NULL。
- 追加する列の名前と型は下の表のとおり。

| カラム名 | 型 | 用途 |
|----------|-----|------|
| aiChecked | BOOLEAN | AIチェック済みフラグ |
| needsHumanCheck | BOOLEAN | 要・人間チェック |
| checkQueueAt | TIMESTAMP(3) | チェック待ち並び用 |
| manualTaggingFolder | TEXT | 人力タグ付けのフォルダ名 |
| taggedAt | TIMESTAMP(3) | タグ済み日時（一覧並び） |
| lastCheckTagChanges | TEXT | チェック時の追加・削除推奨 JSON |

---

### 3. どうやって・どのように編集するか（手順）

**編集は Table Editor ではなく、SQL Editor で行う。** 6 本の列を一気に追加する SQL を 1 回実行するだけ。

1. Supabase の左メニューで **「SQL Editor」** をクリックする。
2. **「New query」**（または「新しいクエリ」）をクリックして、空のクエリを開く。
3. 下の **「コピペ用」** の枠の中の SQL を **6 行とも全部** 選択してコピーする。
4. SQL Editor の入力欄に貼り付ける（中身が空でも、既存の文字があっても上書きしてよい）。
5. 右下（または上部）の **「Run」** ボタンを押す。
6. 成功すると「Success」などと出る。これで Work テーブルに 6 列が追加された。
7. **確認したい場合**: 左メニューで **Table Editor** を開き、左の一覧で **Work** をクリックする。表の右端に、今追加した 6 列（aiChecked, needsHumanCheck など）が並んでいれば OK。既存の行はそのままで、新しい列は NULL になっている。

**このあと**: ローカルで `npm run sync:supabase` を再度実行すると、同期が通るようになる。

---

### コピペ用（上から 6 行をそのまま SQL Editor に貼る）

```sql
ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "aiChecked" BOOLEAN;
ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "needsHumanCheck" BOOLEAN;
ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "checkQueueAt" TIMESTAMP(3);
ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "manualTaggingFolder" TEXT;
ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "taggedAt" TIMESTAMP(3);
ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "lastCheckTagChanges" TEXT;
```

---

## トラブル時

- 「DATABASE_URL が Postgres を指していません」→ `.env.supabase` の中身（BOM・改行はスクリプト側で吸収済み）。`DATABASE_URL` の値が `postgresql://` または `postgres://` で始まっているか確認。
- デプロイ先で「作品がありません」→ Supabase に作品が入っていない。初回なら `npm run sync:supabase` を実行。
- 手元で `npm run dev` が動かない→ `npm run restore:sqlite` を実行して SQLite に戻す。
- 本番で人力タグ付けのフォルダがすべて 0 件→ `manual-tagging-folder-deploy.md` のとおりカラム追加とスクリプト実行を行う。
