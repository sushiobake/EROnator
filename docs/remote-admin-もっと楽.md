# リモート取得を使わずに「問い合わせをローカル管理で見る」楽な方法

さっき Vercel に入れた **`ERONATOR_ADMIN` / トークン**は「APIが動くため」の設定。**Deployment Protection**（プレビューをブラウザ以外から弾くやつ）は**別機能**で、ここがオンだとローカルから `fetch` が HTML になる。だから「また Vercel？」と感じる。

## いちばん楽（追加のシークレット不要）

**Preview の Deployment Protection をオフにする**（または Preview だけ弱くする）。

- Vercel → Project → **Deployment Protection**
- **Preview** 向けの保護を切る、または「例外」で `*.vercel.app` を許可

→ **`.env.local` に `ERONATOR_VERCEL_PROTECTION_BYPASS` を足さなくてよい。**  
コード側のバイパス対応も使わなくてよい。

※ プレビューが「誰でもURLを知れば見える」になるので、秘密URL前提で割り切る。

## Vercel を一切増やしたくない（別ルート）

**HTTP でプレビューを叩かない。**

1. Vercel の **Settings → Environment Variables** に既にある **`DATABASE_URL`（Postgres）** の値をコピーする（新規作成は不要）。
2. ローカルの **`.env.local` だけ**、一時的に  
   `DATABASE_URL=（その Postgres URL）`  
   に差し替えて `npm run dev`。
3. 管理画面の **「本番の履歴を表示する」をオフ**にすると、**その DB をローカルが直接読む**。お問い合わせも同じ DB なら一覧に出る。
4. 終わったら **`DATABASE_URL=file:./prisma/dev.db` に戻す**。

→ **新しい Vercel 機能は不要。** 既にある接続文字列のコピペだけ。

---

**まとめ:**  
- **保護を切る**＝設定1か所・シークレット不要。  
- **保護は切りたくない**＝ Automation バイパス（前メッセージ）か、**DATABASE_URL 一時切替**。
