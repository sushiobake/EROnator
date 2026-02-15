# デプロイの流れメモ（自分用・次回用）

同じようなデプロイをまたやるとき用のチェックリスト。詳細は `deploy-preview-share.md` 参照。

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

## トラブル時

- 「DATABASE_URL が Postgres を指していません」→ `.env.supabase` の中身（BOM・改行はスクリプト側で吸収済み）。`DATABASE_URL` の値が `postgresql://` または `postgres://` で始まっているか確認。
- デプロイ先で「作品がありません」→ Supabase に作品が入っていない。初回なら `npm run sync:supabase` を実行。
- 手元で `npm run dev` が動かない→ `npm run restore:sqlite` を実行して SQLite に戻す。
- 本番で人力タグ付けのフォルダがすべて 0 件→ `manual-tagging-folder-deploy.md` のとおりカラム追加とスクリプト実行を行う。
