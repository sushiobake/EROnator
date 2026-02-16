# Cloudflare Worker をゼロから作る手順（プログラミング不要）

Cloudflare にログインしたあと、**画面の操作だけ**で Worker を作成し、ERONATOR の「準有名タグ生成」で使えるようにする手順です。  
コードは**コピー＆ペースト**するだけです。

---

## 手順の流れ（5ステップ）

1. Worker を新規作成する  
2. 「Workers AI」をくっつける（バインディング）  
3. コードを貼り替える  
4. デプロイして URL をコピーする  
5. プロジェクトの .env.local に URL を書く  

---

## ステップ1: Worker を新規作成する

1. Cloudflare のダッシュボードで、左メニューから **「Workers & Pages」** をクリックします。  
   - 見つからない場合は、左上の「製品」やメニューから「Workers & Pages」を探してください。

2. **「アプリケーションの作成」**（または **Create application**）をクリックします。

3. 次のような選択肢が並んだ画面になります。  
   - **「Start with Hello World!」** をクリックします。  
   - （「Connect GitHub」「Connect GitLab」「Select a template」「Upload your static files」などは選ばず、**Hello World** だけを選びます。）

4. **名前**を入れます。  
   - 例: `eronator-ai`  
   - 何でもよいですが、後で見分けやすい名前がおすすめです。

5. **「デプロイ」**（または **Deploy**）をクリックして、いったんデプロイします。  
   - これで「中身はまだ Hello World だけの Worker」が 1 つできます。

---

## ステップ2: 「Workers AI」をくっつける（バインディング）

1. 作成した Worker の名前をクリックして、**その Worker の詳細画面**に入ります。

2. 上にある **「設定」**（または **Settings**）をクリックします。

3. **「バインディング」** というタブをクリックします。  
   - 設定のなかで「バインディング」が別タブになっているので、そこを開きます。

4. **「バインディングを追加」** をクリックします。

5. 一覧が表示されます（Analytics engine、D1、KV、**Workers AI**、ワークフロー、など）。  
   - そのなかから **「Workers AI」** を選んでクリックします。

6. Workers AI の説明とコード例が表示されます。  
   - **変数名の入力欄はありません**。Workers AI は自動で **`AI`** という名前で使われるので、そのままで大丈夫です。  
   - 「保存」や「追加」など、画面のボタンを押してバインディングを追加し、完了させます。

これで「この Worker から Workers AI が使える」状態になります。

---

## ステップ3: コードを貼り替える

1. Worker の詳細画面で、**コードを編集できる場所**を探します。  
   - 画面上部や左のタブに **「Quick edit」**「編集」**「Deployments」** などがあれば、そこをクリックしてみてください。  
   - または、Worker 名の右隣や下に **「Edit code」**「コードを編集」**「Quick edit」** のようなボタンがないか探してください。  
   - **コードがそのまま表示されている画面**（`export default {` のような文字が見える）であれば、その画面が編集画面です。  
   - 見つからない場合は、Worker 名をクリックしたあと、**「Overview」** や **「Deployments」** のタブのなかに「編集」や「Edit」のリンクがないか確認してください。

2. **いま表示されているコードをぜんぶ選択**します。  
   - マウスでドラッグして全部選ぶか、  
   - Windows: **Ctrl + A**、Mac: **Cmd + A** で全選択します。

3. **削除**します。  
   - **Delete** キーか **Backspace** で消します。

4. 下の **「ここに貼るコード」** のブロックを開き、**中身をぜんぶコピー**します。  
   - この文書の下にあるコード欄からコピーしてください。

5. 編集画面に **貼り付け**ます。  
   - **Ctrl + V**（Mac は **Cmd + V**）。

6. **「保存してデプロイ」**（Save and deploy）をクリックします。  
   - エラーが出た場合は、コードを 1 文字も変えずにもう一度コピー＆ペーストして試してください。

7. **タグリストを埋め込む**（必須）  
   - ERONATOR のプロジェクトフォルダで、ターミナルを開き **`node scripts/export-worker-tag-lists.js`** を実行します。  
   - 出力された **S_LIST / A_LIST / B_LIST / C_LIST** の定義をコピーします。  
   - Worker の編集画面で、コード先頭の **`const S_LIST = [];`** ～ **`const C_LIST = [];`** の 4 行を、コピーした内容で**置き換え**ます。  
   - 再度 **「保存してデプロイ」** をクリックします。  
   - タグを追加・変更したあとは、同じ手順でエクスポートし直し、Worker のリストを貼り替えて再デプロイすると反映されます。

---

## ステップ4: URL をコピーする

1. デプロイが終わると、Worker の **URL** が表示されます。  
   - 形はだいたい次のどちらかです。  
     - `https://eronator-ai.あなたのサブドメイン.workers.dev`  
     - または「ルート」や「カスタムドメイン」として表示されている URL

2. その URL を **そのままコピー**します。  
   - 末尾に `/` や `/analyze` は**付けない**でください。  
   - 例: `https://eronator-ai.xxx.workers.dev` だけにします。

3. メモ帳などに貼り付けておくと、次のステップで使いやすいです。

---

## ステップ5: プロジェクトの .env.local に URL を書く

1. ERONATOR のプロジェクトを開き、**ルート**（package.json がある場所）にある **`.env.local`** を開きます。  
   - なければ **`.env`** でもかまいません。

2. 次の 1 行を**追加**します（あなたの Worker URL に置き換えてください）。  
   ```  
   CLOUDFLARE_WORKER_AI_URL=https://eronator-ai.あなたのサブドメイン.workers.dev
   ```  
   - 例: `CLOUDFLARE_WORKER_AI_URL=https://eronator-ai.abc123.workers.dev`  
   - ダブルクォート `"` は**付けません**。  
   - 行の前後に余計なスペースを入れないようにします。

3. （任意）Cloudflare を**必ず使う**ようにしたい場合は、次の行も追加します。  
   ```  
   ERONATOR_AI_PROVIDER=cloudflare
   ```

4. ファイルを**保存**します。

5. **開発サーバーを一度止めて、もう一度起動**します。  
   - 例: `npm run dev:clean` なら、Ctrl+C で止めてからもう一度 `npm run dev:clean` を実行します。

ここまでできれば、ERONATOR の「準有名タグ生成」や「5件テスト」が Cloudflare Worker 経由で動くようになります。

---

## Cloudflare Worker のログを確認する（問題の特定に便利）

**何が問題か分からないとき**は、Cloudflare 側と ERONATOR 側の両方でログを確認できます。

### 方法1: Cloudflare ダッシュボードでリアルタイムログを見る

1. Cloudflare ダッシュボードで **Workers & Pages** を開く  
2. 使っている Worker（例: eronator-ai）をクリック  
3. 上または左の **「Logs」** タブをクリック  
4. **「Live」**（リアルタイム）を選ぶ  

ここに、Worker 内の `console.log(...)` の出力やエラーが**リアルタイム**で流れます。  
Worker のコードに `console.log('受信:', JSON.stringify(body))` などを入れておくと、ERONATOR から送った内容や AI の生レスポンスを確認できます。  
※ログは保存されず、その場で流れるだけです。永続保存したい場合は Workers Logs（有料オプション）が必要です。

### 方法2: コマンドでログを流す（wrangler tail）

Worker のソースがあるフォルダで、次のコマンドを実行すると、**ターミナルにログが流れます**。

```bash
npx wrangler tail
```

Cloudflare にログインしていれば、その Worker の `console.log` や例外が JSON 形式で表示されます。  
ERONATOR で「準有名タグを生成」や「再分析」を実行しながら、このターミナルを見ると Worker 側で何が起きているか分かります。

### 方法3: ERONATOR 側で送信・受信をログに出す（Cloudflare を見なくてもよい）

**.env.local** に次の 1 行を追加して開発サーバーを再起動すると、**送信したペイロード**と **Worker から返ってきたレスポンス**がターミナルに出力されます。

```
DEBUG_CLOUDFLARE_AI=1
```

これで「何を送って、何が返ってきたか」を ERONATOR のターミナル（`npm run dev:clean` を実行している画面）だけで確認できます。問題の切り分けに使ってください。

---

## ここからどうするか（設定後の流れ）

### 1. 5件テストで動くか確認する

**開発サーバー**（`npm run dev:clean`）が起動している状態で、**新しいターミナル**を開き、プロジェクトのフォルダに移動してから、次のコマンドを 1 行で実行します。

```bash
node -e "require('dotenv').config({ path: '.env.local' }); require('dotenv').config(); fetch('http://localhost:3000/api/admin/tags/analyze-test', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': process.env.ERONATOR_ADMIN_TOKEN }, body: JSON.stringify({ limit: 5 }) }).then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2))).catch(e=>console.error(e));"
```

- **結果**の `provider` が **`cloudflare`** なら、Cloudflare が使われています。
- **結果**の `results` に、各作品の `derivedTags` や `characterTags` が出ていれば、AI 分析は成功しています。
- **エラー**や `provider: "none"` の場合は、`.env.local` の `CLOUDFLARE_WORKER_AI_URL` と開発サーバーの再起動を確認してください。

### 2. 指示を変えて試す（任意）

「5件テスト」のときに、**指示（プロンプト）を変えて**試せます。  
上のコマンドの `body: JSON.stringify({ limit: 5 })` の部分を、次のようにします。

```text
body: JSON.stringify({ limit: 5, systemPrompt: "ここに試したい指示を書く" })
```

`systemPrompt` を変えて何度か実行し、結果の `derivedTags` の質を比べて、**一番よい指示**を探します。

### 3. 本番で準有名タグを付ける

5件テストで問題なければ、**本当に DB にタグを付ける**処理を実行できます。

- **「準有名タグがない作品のうち、古い順に 100 件」** を一括で分析して DB に保存する場合  
  → 同じようにターミナルで、今度は次の API を呼びます（時間がかかります）。

```bash
node -e "require('dotenv').config({ path: '.env.local' }); require('dotenv').config(); fetch('http://localhost:3000/api/admin/tags/generate-derived-tags-oldest', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': process.env.ERONATOR_ADMIN_TOKEN }, body: JSON.stringify({ limit: 100 }) }).then(r=>r.json()).then(d=>console.log(JSON.stringify(d,null,2))).catch(e=>console.error(e));"
```

- **管理画面**の「作品DB」タブから、作品を選んで「準有名タグを生成」する使い方もできます。

まずは **1. の 5件テスト** を実行して、`provider: "cloudflare"` と `results` にタグが出ているか確認するところから進めてください。

---

## ここに貼るコード（コピー用）

下の枠の中身を**最初の行から最後の行まで**コピーし、ステップ3 の「コードを編集」画面に貼り付けてください。  
（行番号はコピーしないでください。コードだけコピーします。）

**設計**: ERONATOR から **systemPrompt を送った場合はそれを使い**、送っていない場合は Worker 内の埋め込みプロンプト＋S/A/B/Cリストを使う。
- **systemPrompt あり**（タグ分析・再分析）: body に `commentText` と `systemPrompt` を送る。Worker はそのプロンプトをそのまま AI に渡す。タグリストはプロンプト内に含まれるので、**Worker の S_LIST 等を更新しなくてもアプリの config が反映される**。また、**AI が返した additionalSTags / aTags / bTags / cTags は Worker の埋め込みリストではフィルタせず、そのまま採用**（重複除去・合計5個まで）。プロンプトで渡したリストで選ばせているため、二重フィルタをしない。
- **systemPrompt なし**（再分析などで `filterLists` 付き）: body に `title`・`commentText`・`currentSTags` に加え **`filterLists`（s/a/b/c の配列）** を送る。Worker は **プロンプトに使うリストもフィルタに使うリストも `filterLists` に統一**する（以前はプロンプトは埋め込み S_LIST 等のみで、リストがずれて AI がリスト外を出力しやすかった）。これで「AI に渡すリスト」と「後処理で通すリスト」が一致し、リスト外（Hカップ・長乳・Coosplay・息子・社会人・母親 など）を出しにくくなる。
- **systemPrompt なし・filterLists なし**: body に `title`・`commentText`・`currentSTags` だけ送る。Worker は埋め込みプロンプト＋S_LIST/A_LIST/B_LIST/C_LIST を使い、AI の出力は **埋め込みリストと完全一致するものだけ** を通す。
- **リストの更新**: systemPrompt を使う場合は不要。埋め込みだけ使う場合は、プロジェクトで `node scripts/export-worker-tag-lists.js` を実行し、出力を Worker の S_LIST / A_LIST / B_LIST / C_LIST に貼り付けて再デプロイする。
- **出力形式**: アプリのプロンプト（matchedTags/suggestedTags）でも、Worker の埋め込み（additionalSTags/aTags/bTags/cTags）でも、Worker が両方の形式を解釈して返す。
- **モデル**: `@cf/meta/llama-3.1-70b-instruct`（70B）を使用。精度は高いが料金は高め。変更は「ここに貼るコード」内の `env.AI.run('@cf/meta/llama-3.1-70b-instruct', ...)` を編集。
- **confidence**: タグ取得では無視。返却は 1 固定（型・DB 互換用のみ。確度機能は使わない）。

```javascript
// ========== タグリスト ==========
// 現在のタグリスト（S: 465件、A: 126件、B: 6件、C: 1件）が埋め込まれています。
// 後でタグを追加・削除したときは、node scripts/export-worker-tag-lists.js で再生成してここを貼り替えてください。
const S_LIST = [
  "3P・4P",
  "BL（ボーイズラブ）",
  "BSS",
  "Dom/Subユニバース",
  "OL",
  "SF",
  "SM",
  "TL（ティーンズラブ）",
  "VTuber",
  "おかっぱ",
  "おさわり",
  "おっぱい",
  "おむつ",
  "おもちゃ",
  "おもらし",
  "おやじ",
  "お姫様",
  "お嬢様・令嬢",
  "お尻・ヒップ",
  "がんばろう同人！",
  "きせかえ",
  "くすぐり",
  "くノ一",
  "けもの・獣化",
  "ごっくん",
  "ご奉仕",
  "ささやき",
  "しっぽ",
  "だいしゅきホールド",
  "つるぺた",
  "ふたなり",
  "ふんどし",
  "ぶっかけ",
  "ぷに",
  "ほのぼの",
  "ぽっちゃり",
  "めがね",
  "やんちゃ受け",
  "わからせ",
  "アイドル・芸能人",
  "アクション・格闘",
  "アクセス上位ジャンル",
  "アクメ",
  "アナル",
  "アヘ顔",
  "イラマチオ",
  "インテリ",
  "ウェイトレス",
  "エステ",
  "エルフ・妖精",
  "オカルト",
  "オスケモ",
  "オナサポ",
  "オナニー",
  "オネエ",
  "オフィス・職場",
  "オホ声",
  "オメガバース",
  "オヤジ受け",
  "オールハッピー",
  "カウントダウン",
  "カチューシャ",
  "カントボーイ",
  "ガチムチ",
  "ガテン系",
  "ガーター",
  "ガードル",
  "キス",
  "キャットファイト",
  "ギャグ・コメディ",
  "ギャル",
  "ギャンブル",
  "クリ責め",
  "クンニ",
  "クール受け",
  "クール攻め",
  "ゲイ",
  "ゲップ",
  "コスプレ",
  "ゴスロリ",
  "サキュバス/淫魔",
  "サスペンス",
  "サラリーマン",
  "シスター",
  "シックスナイン",
  "シュリンカー/縮小化",
  "ショタ",
  "ショートカット",
  "シリアス",
  "シリーズもの",
  "スカトロ",
  "スタンガン",
  "ストッキング",
  "スパダリ",
  "スパッツ",
  "スパンキング",
  "スプラッター",
  "スポユニ",
  "スポーツ",
  "スポーツ選手",
  "スレンダー",
  "スワッピング",
  "スーツ",
  "セーラー服",
  "ソフトエッチ",
  "タイツ",
  "タトゥー・刺青",
  "ダウナー",
  "チャイナ",
  "ツインテール",
  "ツンデレ",
  "デブ",
  "ドジっ娘",
  "ドラッグ",
  "ナンパ",
  "ニット",
  "ニプルファック",
  "ニューハーフ",
  "ニーソックス",
  "ネコミミ・ケモミミ",
  "ネコミミ・獣系",
  "ノンケ",
  "ノンフィクション・体験談",
  "ノーマルプレイ",
  "ハードボイルド",
  "ハード系",
  "ハーレム",
  "バイ",
  "バイオレンス",
  "バイブ",
  "バニーガール",
  "パイズリ",
  "パイパン",
  "パラレル",
  "パンチラ",
  "パンツ",
  "ビッチ",
  "ピアス・装飾品",
  "ファンタジー",
  "フィスト",
  "フィストファック",
  "フェラ",
  "ブラチラ",
  "ブレザー",
  "ヘタレ攻め",
  "ベスト・総集編",
  "ホスト",
  "ホラー",
  "ボクっ娘",
  "ボンテージ",
  "ボーイッシュ",
  "ポニーテール",
  "マッサージ",
  "マニアック/変態",
  "ママ",
  "ミステリー",
  "ミニスカ",
  "ミニ系",
  "ミリタリー",
  "ムチムチ",
  "ムチ・縄・蝋燭",
  "メイド",
  "メカクレ",
  "メスイキ",
  "メスケモ",
  "メス堕ち",
  "メス男子",
  "モデル",
  "モブ姦",
  "ヤクザ/裏社会",
  "ヤリチン・プレイボーイ",
  "ヤンデレ",
  "ヨガ",
  "ラバー",
  "ラブコメ",
  "ラブラブ・あまあま",
  "リバ",
  "リフレ",
  "リボン",
  "リョナ",
  "レオタード",
  "レスラー/格闘家",
  "レズビアン",
  "ロボット",
  "ロングヘア",
  "ローション・オイル",
  "ローター",
  "ローレグ",
  "ワイシャツ",
  "ワンコ",
  "三つ編み",
  "上司",
  "下克上",
  "下品",
  "下着",
  "不良・ヤンキー",
  "中出し",
  "丸呑み",
  "主従",
  "主観視点",
  "乙女受け",
  "乱交",
  "乳首・乳輪",
  "乳首責め",
  "亀頭責め",
  "人体改造",
  "人外娘・モンスター娘",
  "人妻・主婦",
  "人格排泄",
  "伝奇",
  "低音",
  "体操着・ブルマ",
  "体格差",
  "体育会系",
  "保健医",
  "俺様攻め",
  "健気受け",
  "兄",
  "先輩",
  "全肯定",
  "処女",
  "出産",
  "初体験",
  "制服",
  "劇画",
  "動画配信・撮影",
  "包帯・注射器",
  "包茎",
  "医者",
  "半ズボン",
  "原作映像化作品",
  "双子",
  "叔父・義父",
  "口内射精",
  "同棲",
  "同級生/同僚",
  "和姦",
  "和服・浴衣",
  "図書委員",
  "地雷",
  "執事",
  "執着攻め",
  "壁尻",
  "売春・援交",
  "変身ヒロイン",
  "外国人",
  "天使・悪魔",
  "天然",
  "女医",
  "女性優位",
  "女性視点",
  "女教師",
  "女王様",
  "女装・男の娘",
  "妊娠・孕ませ",
  "妊婦",
  "妖怪",
  "姉妹",
  "委員長",
  "娘",
  "嫌われ",
  "学園もの",
  "学生",
  "実妹",
  "実姉",
  "実演",
  "家族",
  "密室",
  "密着",
  "寝取らせ",
  "寝取られない",
  "寝取られ・NTR",
  "寝取り・NTR",
  "寝取り・寝取られ・NTR",
  "寝落ち",
  "寸止め",
  "射精管理",
  "小悪魔",
  "少女",
  "少年",
  "尿道",
  "屋外",
  "巨乳",
  "巨大化",
  "巨根",
  "巫女",
  "常識改変",
  "年上",
  "年下攻め",
  "幼なじみ",
  "幽霊・ゾンビ",
  "弟",
  "強●",
  "強気受け",
  "強気攻",
  "後背位／バック",
  "後輩",
  "従姉妹／いとこ",
  "快楽堕ち",
  "性転換・女体化",
  "恋人同士",
  "恋愛",
  "悪堕ち",
  "悪役令嬢",
  "感動",
  "感覚遮断",
  "憑依",
  "成人向け",
  "戦場",
  "戦士",
  "戦闘エロ",
  "手コキ",
  "拘束",
  "拡張",
  "拷問",
  "授乳",
  "授乳手コキ",
  "搾乳",
  "放尿・お漏らし",
  "放置プレイ",
  "敗北",
  "教師",
  "料理",
  "断面図あり",
  "方言",
  "旅行",
  "既婚者",
  "日常・生活",
  "時間停止",
  "未亡人",
  "本番なし",
  "機械姦",
  "正常位",
  "歳の差",
  "歴史",
  "母乳",
  "母親",
  "水着",
  "汁/液大量",
  "洗脳",
  "浣腸",
  "浮気",
  "淡白・あっさり",
  "淫乱",
  "淫語",
  "添い寝",
  "温泉・銭湯・お風呂",
  "潮吹き",
  "無様",
  "無知",
  "無表情",
  "焦らし",
  "熟女",
  "燃え",
  "爺",
  "狂気",
  "猟奇",
  "猿轡／猿ぐつわ／ボールギャグ",
  "獣人",
  "玉舐め",
  "王子様・王子系",
  "生徒会",
  "生意気",
  "産卵",
  "男の潮吹き",
  "男娼",
  "男子寮",
  "男性受け",
  "男装",
  "異世界転生",
  "異物挿入",
  "異種姦",
  "痴女",
  "癒し",
  "白ギャル",
  "白衣",
  "百合",
  "盗撮・のぞき",
  "監禁",
  "目隠し",
  "看護婦・ナース",
  "着衣",
  "睡眠姦",
  "石化",
  "秘書",
  "種付けプレス",
  "童貞",
  "競泳・スクール水着",
  "筋肉",
  "粗チン",
  "純愛",
  "素人",
  "総受",
  "縛り・緊縛",
  "羞恥",
  "義妹",
  "義姉",
  "義母",
  "耳かき",
  "耳ふー",
  "耳舐め",
  "耽美",
  "肉便器",
  "胎内回帰",
  "脚",
  "腹パン",
  "色仕掛け",
  "芸能",
  "茶髪",
  "萌え",
  "落書き",
  "蟲姦",
  "血液/流血",
  "裏垢女子",
  "裸エプロン",
  "複乳/怪乳/超乳",
  "褐色・日焼け",
  "襲い受",
  "触手",
  "言葉責め",
  "評論",
  "誘い受け",
  "警察/刑事",
  "貧乳・微乳",
  "赤ちゃんプレイ",
  "超乳",
  "足コキ",
  "軍服",
  "辱め",
  "近親相姦",
  "退廃・背徳・インモラル",
  "逆NTR",
  "逆アナル",
  "逆ハーレム",
  "逆バニー",
  "逆転無し",
  "連続絶頂",
  "道着",
  "遠距離恋愛",
  "配信者／インフルエンサー",
  "野外・露出",
  "金髪",
  "長身",
  "陰キャ・地味",
  "陰毛・腋毛",
  "雄っぱい",
  "電車",
  "青姦",
  "靴下",
  "顔射",
  "風俗・ソープ",
  "風紀委員",
  "首輪・鎖・拘束具",
  "駅弁",
  "騎乗位",
  "鬱",
  "鬱勃起",
  "鬼畜",
  "魔法",
  "魔法使い/魔女",
  "魔法少女",
  "黒ギャル",
  "黒人（BBC）",
  "黒髪",
  "Ｗフェラ"
];
const A_LIST = [
  "ASMR",
  "P活",
  "SNS",
  "アナウンサー",
  "イチャラブ",
  "インターンシップ",
  "エステ",
  "エッセイ",
  "おじさん",
  "カップル",
  "キメセク",
  "キャンパスライフ",
  "クーデレ",
  "クズ男",
  "コンシェルジュ",
  "コンビニ",
  "サウナ",
  "サキュバス",
  "セックスレス",
  "セフレ",
  "タワーマンション",
  "チート",
  "テニス",
  "デリヘル",
  "トラブル",
  "ナイトプール",
  "ハニートラップ",
  "ハプニング",
  "ハメ撮り",
  "バレー部",
  "バンドマン",
  "ビジネスホテル",
  "ピンサロ",
  "プール",
  "ブラック企業",
  "ホームステイ",
  "ホテル",
  "マイクロビキニ",
  "マスターベーション",
  "マンション",
  "メイド",
  "メンエス",
  "ヤリマン",
  "ラブホテル",
  "リゾート",
  "暗殺者",
  "異世界",
  "一人暮らし",
  "屋敷",
  "温泉",
  "家政婦",
  "家庭教師",
  "会社員",
  "格闘技",
  "学園生活",
  "株式会社",
  "気弱女子",
  "貴族",
  "儀式",
  "義父",
  "逆レイプ",
  "強盗",
  "教会",
  "教室",
  "禁断関係",
  "兄妹",
  "公園",
  "高校",
  "混浴",
  "催眠",
  "採用",
  "搾精",
  "嫉妬",
  "実話",
  "借金",
  "受験生",
  "獣耳",
  "獣人",
  "叔母",
  "初恋",
  "女体化",
  "寝取らせ",
  "寝取られ視点",
  "人妻",
  "人妻幼馴染",
  "水泳",
  "睡眠姦",
  "性欲処理",
  "政治家",
  "整体師",
  "清楚",
  "専業主婦",
  "潜入任務",
  "組織",
  "相席居酒屋",
  "総集編",
  "対人恐怖症",
  "退魔",
  "大学生",
  "短編集",
  "調教",
  "天真爛漫",
  "田舎",
  "電マ",
  "奴隷",
  "透明人間",
  "動画配信",
  "同居",
  "配達員",
  "爆乳",
  "反乱",
  "部下",
  "風俗",
  "別荘",
  "保育士",
  "母子家庭",
  "民泊",
  "無口",
  "迷宮",
  "幼馴染",
  "裏切り",
  "陸上",
  "隣人",
  "連れ子",
  "露出",
  "罠"
];
const B_LIST = [
  "コスチューム",
  "トイレ",
  "快楽",
  "生徒会",
  "友人",
  "誘惑"
];
const C_LIST = [
  "性欲"
];
const ALIAS_ENTRIES = [
  ['cosplay', 'コスプレ'],
  ['coosplay', 'コスプレ'],
  ['cosplayer', 'コスプレ'],
  ['coosplayer', 'コスプレ'],
  ['露', '露出'],
  ['シングルマザー', '母子家庭'],
];
// ==========

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'POST only' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    let body = null;
    let title = '';
    let commentText = '';
    let currentSTags = [];
    try {
      body = await request.json();
      title = body.title != null ? String(body.title) : '';
      commentText = body.commentText != null ? String(body.commentText) : '';
      currentSTags = Array.isArray(body.currentSTags) ? body.currentSTags.filter((x) => typeof x === 'string').map((s) => String(s).trim()).filter(Boolean) : [];
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON', additionalSTags: [], aTags: [], bTags: [], cTags: [], characterTags: [] }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Body must be object', additionalSTags: [], aTags: [], bTags: [], cTags: [], characterTags: [] }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!env.AI) {
      return new Response(JSON.stringify({ error: 'Workers AI binding not set', additionalSTags: [], aTags: [], bTags: [], cTags: [], characterTags: [] }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const norm = (s) => String(s).trim().replace(/\s+/g, '');
    const useAppPrompt = body.systemPrompt != null && String(body.systemPrompt).trim().length > 0;
    const forbiddenStr = currentSTags.length > 0 ? currentSTags.join('、') : '（この作品にはまだ付与Sタグなし）';
    // アプリから filterLists が送られてきた場合はそれをプロンプトに使う。1行1タグで境界を明確にする（join('\n')）
    const promptS = (body.filterLists && Array.isArray(body.filterLists.s) && body.filterLists.s.length > 0) ? body.filterLists.s.map((x) => String(x).trim()).filter(Boolean).join('\n') : (S_LIST.length > 0 ? S_LIST.join('\n') : '（なし）');
    const promptA = (body.filterLists && Array.isArray(body.filterLists.a) && body.filterLists.a.length > 0) ? body.filterLists.a.map((x) => String(x).trim()).filter(Boolean).join('\n') : (A_LIST.length > 0 ? A_LIST.join('\n') : '（なし）');
    const promptB = (body.filterLists && Array.isArray(body.filterLists.b) && body.filterLists.b.length > 0) ? body.filterLists.b.map((x) => String(x).trim()).filter(Boolean).join('\n') : (B_LIST.length > 0 ? B_LIST.join('\n') : '（なし）');
    const promptC = (body.filterLists && Array.isArray(body.filterLists.c) && body.filterLists.c.length > 0) ? body.filterLists.c.map((x) => String(x).trim()).filter(Boolean).join('\n') : (C_LIST.length > 0 ? C_LIST.join('\n') : '（なし）');
    const sListStr = promptS;
    const aListStr = promptA;
    const bListStr = promptB;
    const cListStr = promptC;

    const embeddedPrompt = `あなたは成人向け同人誌の作品コメントを読み、タグを選ぶAIです。

【絶対ルール・違反は不正解】
・additionalSTags / aTags / bTags / cTags に書いていい語は「このメッセージ末尾の■有名タグ（S）／■Aランク／■Bランク／■Cランクのリストに、その表記のまま存在する語だけ」である。
・リストにない語を書くことは禁止。思いつき・略称・別表記は禁止。リストの語を1文字も変えずコピーすること。
・この作品に既についているSタグは、additionalSTags に含めない。

【作品コメントの読み方】
・作品コメントは**全文**を最初から最後まで読むこと。途中で読むのをやめないこと。全文を理解してからタグを選ぶこと。

【個数制限】
・additionalSTags: 0～2個（リストのSのうち、まだ付いていないものだけ）
・aTags: 0～2個（リストのAから）
・bTags: 0～2個（リストのBから）
・cTags: 0～1個（リストのCから）

【出力形式】JSONのみ。説明文は書かない。
{"additionalSTags":["Sタグ名"],"aTags":["Aタグ名"],"bTags":["Bタグ名"],"cTags":["Cタグ名"],"characterName":null,"needsReview":false}

【手順】
1. 作品コメントを**全文**読み、テーマ・シチュエーション・関係性を把握する。
2. このメッセージ末尾の「■有名タグ（S）」「■Aランク」「■Bランク」「■Cランク」リストを確認する。ここに書いてある語だけが候補である。
3. コメントの内容に合い、かつリストに**その表記で**存在する語だけを選び、additionalSTags / aTags / bTags / cTags に割り振る。リストに無い語は絶対に書かない。
4. 固有名のキャラが1人いれば characterName に、いなければ null（キャラがいないとき "none" と書くのも誤り。null と書く）。

【characterName】固有名のキャラが1人いればその名前、いなければ null。"none" は禁止。

--- 以下がリストである。この中に存在する語だけを、表記を1文字も変えず使うこと ---

■ この作品に既についているSタグ（使用禁止・これらは追加Sに含めない）
${forbiddenStr}

■ 有名タグ（S）リスト（additionalSTags はここから、まだ付いていないものだけ）
${sListStr}

■ Aランク（aTagsはここから）
${aListStr}

■ Bランク（bTagsはここから）
${bListStr}

■ Cランク（cTagsはここから）
${cListStr}`;
    const systemPrompt = useAppPrompt ? String(body.systemPrompt).trim() : embeddedPrompt;

    const userContent = (title ? '作品タイトル: ' + title + '\n\n' : '') + '作品コメント（以下が全文。最後まで読んでからタグを選ぶこと）:\n' + commentText + '\n\n--- 作品コメントここまで ---\n\n上記の指示に従い、リストに存在する語だけを表記どおり使って、JSON形式のみで出力してください。';

    // response_format を付けない: json_schema だと 5024 (JSON Model couldn't be met) になりやすいため、
    // 生テキストで受け取り、下のパース処理で JSON を抽出・検証する。
    let raw;
    try {
      raw = await env.AI.run('@cf/meta/llama-3.1-70b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        max_tokens: 256,
        temperature: 0.1,
        repetition_penalty: 1.12,
        frequency_penalty: 0.2,
        presence_penalty: 0.0,
      });
    } catch (e) {
      const errMsg = String(e && e.message ? e.message : e);
      const errPayload = {
        additionalSTags: [], aTags: [], bTags: [], cTags: [], characterTags: [], needsReview: true,
        debugAiRaw: errMsg,
      };
      if (body.workId != null) errPayload.workId = body.workId;
      if (body.runId != null) errPayload.runId = body.runId;
      if (body.commentHash != null) errPayload.commentHash = body.commentHash;
      return new Response(JSON.stringify(errPayload), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    const responseObj = raw && typeof raw === 'object' && raw.response != null && typeof raw.response === 'object' && !Array.isArray(raw.response);
    const text = (raw && (
      (responseObj ? null : (typeof raw.response === 'string' ? raw.response : null)) ||
      (typeof raw.result === 'string' ? raw.result : null) ||
      (raw.result && typeof raw.result.response === 'string' ? raw.result.response : null) ||
      (raw.response && typeof raw.response === 'object' && typeof raw.response.result === 'string' ? raw.response.result : null)
    )) || (typeof raw === 'string' ? raw : '') || '';
    const toStrArr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((s) => norm(s)).filter(Boolean) : []);
    let additionalSTags = [];
    let aTags = [];
    let bTags = [];
    let cTags = [];
    let characterTags = [];
    let needsReview = false;
    let derivedTagsFromApp = null;

    const sListRaw = (body.filterLists && Array.isArray(body.filterLists.s) && body.filterLists.s.length > 0)
      ? body.filterLists.s.map((x) => String(x).trim())
      : S_LIST;
    const aListRaw = (body.filterLists && Array.isArray(body.filterLists.a) && body.filterLists.a.length > 0)
      ? body.filterLists.a.map((x) => String(x).trim())
      : A_LIST;
    const bListRaw = (body.filterLists && Array.isArray(body.filterLists.b) && body.filterLists.b.length > 0)
      ? body.filterLists.b.map((x) => String(x).trim())
      : B_LIST;
    const cListRaw = (body.filterLists && Array.isArray(body.filterLists.c) && body.filterLists.c.length > 0)
      ? body.filterLists.c.map((x) => String(x).trim())
      : C_LIST;
    const sSet = new Set(sListRaw.map(norm));
    const aSet = new Set(aListRaw.map(norm));
    const bSet = new Set(bListRaw.map(norm));
    const cSet = new Set(cListRaw.map(norm));
    const normToDisplayS = new Map();
    sListRaw.forEach((x) => normToDisplayS.set(norm(x), x));
    const normToDisplayA = new Map();
    aListRaw.forEach((x) => normToDisplayA.set(norm(x), x));
    const normToDisplayB = new Map();
    bListRaw.forEach((x) => normToDisplayB.set(norm(x), x));
    const normToDisplayC = new Map();
    cListRaw.forEach((x) => normToDisplayC.set(norm(x), x));
    const currentSet = new Set(currentSTags.map(norm));

    const rankMap = new Map();
    sSet.forEach((k) => rankMap.set(k, 'S'));
    aSet.forEach((k) => rankMap.set(k, 'A'));
    bSet.forEach((k) => rankMap.set(k, 'B'));
    cSet.forEach((k) => rankMap.set(k, 'C'));

    const aliasMap = new Map();
    ALIAS_ENTRIES.forEach(([a, c]) => {
      const key = norm(a);
      const val = norm(c);
      aliasMap.set(key, val);
      if (key.toLowerCase && key.toLowerCase() !== key) aliasMap.set(key.toLowerCase(), val);
    });

    const pickFrom = (arr, allowedSet, max) => {
      const out = [];
      const seen = new Set();
      for (const x of arr) {
        const n = norm(x);
        if (!n || seen.has(n) || out.length >= max) continue;
        if (!allowedSet.has(n)) continue;
        seen.add(n);
        out.push(n);
      }
      return out;
    };

    try {
      let parsed = null;
      if (responseObj && raw && typeof raw.response === 'object' && (raw.response.additionalSTags != null || raw.response.aTags != null)) {
        parsed = raw.response;
      } else if (text) {
        let jsonStr = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        const first = jsonStr.indexOf('{');
        const last = jsonStr.lastIndexOf('}');
        if (first !== -1 && last !== -1 && last > first) {
          try {
            parsed = JSON.parse(jsonStr.slice(first, last + 1));
          } catch (e) {
            parsed = null;
          }
        }
      }
      if (parsed) {
        if (parsed.characterName != null && typeof parsed.characterName === 'string') {
          const name = norm(parsed.characterName);
          if (name && name.toLowerCase() !== 'null' && name.toLowerCase() !== 'none') characterTags = [name];
        } else if (Array.isArray(parsed.characterTags)) characterTags = parsed.characterTags.filter((x) => typeof x === 'string').slice(0, 1).map((s) => norm(s)).filter((s) => s && s.toLowerCase() !== 'null');
        if (parsed.needsReview === true || parsed.needsReview === 'true') needsReview = true;

        if (Array.isArray(parsed.matchedTags) || Array.isArray(parsed.suggestedTags)) {
          const toDisplayName = (t) => (typeof t === 'string' ? t : (t && t.displayName) ? t.displayName : null);
          const fromMatched = (parsed.matchedTags || []).map(toDisplayName).filter(Boolean).map((s) => norm(s));
          const fromSuggested = (parsed.suggestedTags || []).map(toDisplayName).filter(Boolean).map((s) => norm(s));
          derivedTagsFromApp = [
            ...fromMatched.map((displayName) => ({ displayName, confidence: 1, category: null, source: 'matched', rank: '' })),
            ...fromSuggested.map((displayName) => ({ displayName, confidence: 1, category: null, source: 'suggested', rank: '' })),
          ];
        } else {
          const addS = toStrArr(parsed.additionalSTags);
          const addA = toStrArr(parsed.aTags);
          const addB = toStrArr(parsed.bTags);
          const addC = toStrArr(parsed.cTags);
          const allTags = [...addS, ...addA, ...addB, ...addC];
          const seenS = new Set();
          const seenA = new Set();
          const seenB = new Set();
          const seenC = new Set();
          let listViolation = false;
          for (const n of allTags) {
            const canonical = aliasMap.get(n) || aliasMap.get((n || '').toLowerCase()) || n;
            const rank = rankMap.get(canonical);
            if (rank === undefined) listViolation = true;
            const displayS = normToDisplayS.get(canonical) || canonical;
            const displayA = normToDisplayA.get(canonical) || canonical;
            const displayB = normToDisplayB.get(canonical) || canonical;
            const displayC = normToDisplayC.get(canonical) || canonical;
            if (rank === 'S' && sSet.has(canonical) && !currentSet.has(canonical) && additionalSTags.length < 2 && !seenS.has(canonical)) {
              additionalSTags.push(displayS);
              seenS.add(canonical);
            } else if (rank === 'A' && aSet.has(canonical) && aTags.length < 2 && !seenA.has(canonical)) {
              aTags.push(displayA);
              seenA.add(canonical);
            } else if (rank === 'B' && bSet.has(canonical) && bTags.length < 2 && !seenB.has(canonical)) {
              bTags.push(displayB);
              seenB.add(canonical);
            } else if (rank === 'C' && cSet.has(canonical) && cTags.length < 1 && !seenC.has(canonical)) {
              cTags.push(displayC);
              seenC.add(canonical);
            }
          }
          if (listViolation) needsReview = true;
        }
      }
    } catch (e) {
      // ignore parse error
    }

    if (additionalSTags.length === 0 && aTags.length === 0 && bTags.length === 0 && cTags.length === 0) needsReview = true;
    if (additionalSTags.length === 0 && aTags.length === 0 && bTags.length === 0 && cTags.length > 0) needsReview = true;

    const derivedTags = derivedTagsFromApp !== null ? derivedTagsFromApp : [
      ...additionalSTags.map((displayName) => ({ displayName, confidence: 1, category: null, source: 'matched', rank: '' })),
      ...aTags.map((displayName) => ({ displayName, confidence: 1, category: null, source: 'matched', rank: 'A' })),
      ...bTags.map((displayName) => ({ displayName, confidence: 1, category: null, source: 'matched', rank: 'B' })),
      ...cTags.map((displayName) => ({ displayName, confidence: 1, category: null, source: 'matched', rank: 'C' })),
    ];

    const out = {
      matchedTags: derivedTags,
      suggestedTags: [],
      derivedTags,
      additionalSTags,
      aTags,
      bTags,
      cTags,
      characterTags,
      needsReview,
    };
    try {
      out.debugAiRaw = responseObj && raw && raw.response
        ? JSON.stringify(raw.response).substring(0, 4000)
        : (text ? String(text).substring(0, 4000) : ('(empty). raw keys: ' + (raw ? Object.keys(raw).join(',') : 'none')));
    } catch (e) {
      out.debugAiRaw = '(debug serialize failed)';
    }
    if (!text && raw && typeof raw === 'object') {
      try {
        const rawPreview = JSON.stringify(raw).substring(0, 1500);
        out.debugAiRaw += ' rawPreview: ' + rawPreview;
      } catch (e) { /* ignore */ }
    }
    out.debugUseAppPrompt = useAppPrompt;
    // 紐付け検証用: リクエストの workId/runId/commentHash をそのまま返す（サーバが一致をチェック）
    if (body.workId != null) out.workId = body.workId;
    if (body.runId != null) out.runId = body.runId;
    if (body.commentHash != null) out.commentHash = body.commentHash;
    // 入力プレビュー: 送った内容が正しいかサーバ側ログで確認できる
    out.debugInput = {
      inputTitleHead: (title || '').slice(0, 30),
      inputCommentHead: (commentText || '').slice(0, 60),
      inputCommentLen: (commentText || '').length,
      inputWorkId: body.workId ?? null,
    };

    return new Response(JSON.stringify(out), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  },
};
```

---

## 500 Internal Server Error / 「Worker threw exception」のとき

- **原因**: Worker 内で `body` を try ブロック内でしか宣言していなかったため、その外で `body.systemPrompt` を参照すると **ReferenceError: body is not defined** になり、Cloudflare が「Worker threw exception」の HTML を返していました。
- **修正**: `body` を fetch の先頭で `let body = null` として宣言し、try 内で `body = await request.json()` で代入するように変更済みです。**「ここに貼るコード」を再度コピーして Worker を置き換え、保存してデプロイ**してください。

---

## タグがまったく取得できない・結果が空のとき

1. **Worker のコードを最新版にしたか確認**  
   - このドキュメントの「ここに貼るコード」を**最初から最後まで**コピーし、Cloudflare の Worker 編集画面で**全体を置き換え**てから、**保存してデプロイ**してください。  
   - 古いコードのままでは `body.systemPrompt` を読まないため、アプリの指示が効きません。

2. **デバッグ出力で何が返っているか確認**  
   - プロジェクトの **.env.local** に次の1行を追加し、開発サーバーを**再起動**します。  
     `DEBUG_CLOUDFLARE_AI=1`  
   - タグ分析や再分析を1件実行し、**ターミナル（npm run dev:clean の画面）** を確認します。  
   - 次のように出ます。  
     - `[Cloudflare AI Debug] Request (legacy): commentLength=... promptLength=...`  
       → **promptLength が 0 なら**、アプリが systemPrompt を送っていないか、Worker が古い可能性があります。  
     - `[Cloudflare AI Debug] Raw AI Response from Worker: ...`  
       → ここに **debugAiRaw**（AI の生の返答）と **debugUseAppPrompt**（アプリのプロンプトを使ったか）が出ます。  
     - **debugInput**（Worker が返す入力プレビュー）  
       → `inputTitleHead` / `inputCommentHead` / `inputCommentLen` / `inputWorkId` で「いま解析している作品」と一致しているか確認できます。一致していない場合は、アプリ側の reanalyze の取得 or ペイロード生成の不具合の可能性があります。  
     - **紐付け検証**  
       → 再分析ではアプリが `workId` / `runId` / `commentHash` を送り、Worker がそのまま返します。サーバが一致をチェックし、不一致なら結果を破棄して `needsReview` のみ付けます（別作品のタグが混ざるのを防ぎます）。  
   - **debugAiRaw が "(empty)"** のとき  
     → Worker 側で AI の返答テキストを取れていません。Cloudflare の Workers AI の戻り値の形式が変わっている可能性があります。  
   - **debugAiRaw に JSON らしい文字列があるのにタグが空**のとき  
     → その文字列の形式（matchedTags / suggestedTags や additionalSTags / aTags など）が想定と違うか、パースに失敗している可能性があります。

3. **config のタグリストが入っているか確認**  
   - タグ分析では **config/officialTagsCache.json** と **config/tagRanks.json** の内容がプロンプトに埋め込まれます。  
   - **officialTagsCache.json** に `"tags": [...]` がたくさんあるか、**tagRanks.json** に `"ranks": { "タグ名": "A" など }` が入っているか確認してください。  
   - どちらも空や未作成だと、プロンプトに「（タグリストなし）」となり、AI が選べず結果が空になりやすいです。

4. **一度 Groq や Hugging Face で試す**  
   - .env.local で **ERONATOR_AI_PROVIDER=groq** や **ERONATOR_AI_PROVIDER=huggingface** にし、同じ作品でタグ分析を実行してみてください。  
   - そちらではタグが取れるのに Cloudflare だけ空なら、Worker のコードか AI の返答形式の違いが原因です。

---

## うまくいかないとき

- **「env.AI がない」**  
  → ステップ2 のバインディングで、変数名を **`AI`**（大文字2文字）にしたか確認してください。

- **「405 Method Not Allowed」**  
  → ERONATOR 側は **POST** で呼びます。GET で開いている場合は POST で送るようにしてください。

- **「Worker の URL がわからない」**  
  → Worker の詳細画面の「プレビュー」や「ルート」のところに表示されている URL を、末尾スラッシュなしでコピーします。

- **ERONATOR で Cloudflare が使われない**  
  → .env.local に `CLOUDFLARE_WORKER_AI_URL` を書いたか、保存したか、開発サーバーを**再起動**したかを確認してください。

---

以上で、プログラミングせずに Cloudflare Worker を用意し、ERONATOR から使うまでの手順です。

---

## 料金の答え（参考: Llama 3.2-3b-instruct。現在のコードは 8B 使用）

Cloudflare の公式料金（[Pricing - Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/)）に基づく**目安**です。

- **課金単位**: 「Neurons」（リクエストあたりの入力・出力トークンで決まる）
- **無料枠**: **1日あたり 10,000 Neurons**（毎日 00:00 UTC でリセット）
- **有料**: 10,000 Neurons を超えた分が **$0.011 / 1,000 Neurons**

**Llama 3.2-3b-instruct** の単価（公式表より）:

- 入力: 4,625 Neurons / 100万トークン  
- 出力: 30,475 Neurons / 100万トークン  

1リクエストあたりの目安（システムプロンプト＋作品コメント＋短いJSON出力）:

- 入力 約 600 トークン → 約 **2.8 Neurons**
- 出力 約 200 トークン → 約 **6.1 Neurons**
- **1件あたり 約 9 Neurons**（余裕を見て 10〜15 Neurons と考えると安全）

### 結論（目安）

| 内容 | 答え |
|------|------|
| **5件でいくらか** | 約 45 Neurons → **無料枠内**（0円） |
| **無料枠で何件できるか** | 10,000 ÷ 9 ≈ **約 1,100 件/日**（1日あたり） |
| **10,000 件やるとしたらいくらか** | 約 90,000 Neurons。無料 10,000 を引くと 80,000 Neurons 有料 → **約 $0.88（約 130 円前後）** |

※ コメント長さや出力長で変動します。実際は **Cloudflare ダッシュボード**で確認するのが確実です。

---

## 答えの知り方（自分で確認する）

1. **Cloudflare ダッシュボードで見る**  
   - [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン  
   - **Workers & Pages** → **Workers AI**（または AI の利用状況）  
   - その日の Neurons 使用量が表示されます。  
   - 5件テストの前後で数値を比べれば「5件で何 Neurons 使ったか」が分かります。

2. **無料枠で何件できるか**  
   - 上記で「1件あたり何 Neurons か」を実測（例: 5件で 50 Neurons → 1件 10 Neurons）  
   - 10,000 ÷ 1件あたり Neurons ＝ 無料で回せる件数/日  

3. **10,000 件の料金**  
   - 1件あたり Neurons × 10,000 ＝ 総 Neurons  
   - 総 Neurons − 10,000（無料）＝ 有料 Neurons  
   - 有料 Neurons ÷ 1,000 × $0.011 ＝ およその金額（ドル）
