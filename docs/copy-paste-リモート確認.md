# リモートお問い合わせAPIの確認（コピペ用）

**404 で HTML ばかりになるとき**は Vercel の **Deployment Protection** が原因のことが多いです。

1. Vercel → Project → **Settings** → **Deployment Protection** → **Protection Bypass for Automation** を有効化し、シークレットをコピー  
2. `.env.local` に **1行追加**（値だけ差し替え）:

```env
ERONATOR_VERCEL_PROTECTION_BYPASS=ここにコピーしたシークレット
```

3. `npm run dev` **再起動** → 管理画面の **接続テスト** を再実行  

（`VERCEL_AUTOMATION_BYPASS_SECRET` という名前でも可。）

---

**まず管理画面の「接続テスト（お問い合わせAPI）」ボタンを押す**（`npm run dev` のローカル管理 → プレイ履歴タブ）。curl は不要。

---

どうしてもターミナルでやる場合（PowerShell）。`トークン` と `ホスト` だけ差し替え。

```powershell
curl.exe --max-time 20 -H "x-eronator-admin-token: トークン" "https://ホスト/api/admin/contact-inquiries?page=1&limit=10"
```

- 応答が `{"success":true` で始まる → OK  
- `{"error":"Forbidden"}` → Vercel のトークン・環境変数  
- `<!DOCTYPE` → URL か デプロイ か 保護設定
