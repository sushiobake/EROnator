# デプロイ時の安全ルール（ローカルデータ保護）

デプロイ支援時に**絶対に実行してはいけない**コマンド・操作です。
過去の事故（ローカルコンポーネントが古い状態で上書きされた）を二度と起こさないため。

---

## 禁止コマンド

| コマンド | 理由 |
|----------|------|
| `git reset --hard` | 未コミット変更をすべて破棄する。コンポーネント修正が消える |
| `git checkout -- .` | ワーキングツリーの変更をすべて破棄 |
| `git checkout -- src/` | src 以下をすべて破棄 |
| `git clean -fd` | 未追跡ファイルを削除 |
| `Copy-Item` で `backups/` → `src/` へのコピー | 古いバックアップでソースを上書きする |
| `Copy-Item` で `scripts/` → `src/app/components/` へのコピー | スクリプトでコンポーネントを上書きする |

---

## 許可コマンド（慎重に）

| コマンド | 条件 |
|----------|------|
| `git add <特定ファイル>` | 対象を明示。`git add .` は未コミットの内容を把握したうえで |
| `git pull` | 未コミットの重要な変更がある場合は事前に stash するか、ユーザーに確認 |
| `git checkout main` / `git checkout develop` | デプロイフローの一部。未コミット変更があると Git が拒否するのでそのままでよい |

---

## デプロイ用スクリプト

- **プレビュー**: `npm run deploy:preview` … ローカルを変えずに develop へプッシュ
- **本番**: `npm run deploy:prod` … ユーザー自身が実行する想定

`deploy-to-preview.js` は以下を保証します:
- `git reset --hard`, `git checkout -- .`, `git clean` は一切実行しない
- 終了時には必ず `schema.prisma` を SQLite に復元
- 未コミットの重要ファイルがある場合はデプロイを中止
