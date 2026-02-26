■ titleReadingInitial 取得フロー（ChatGPT ブラウザ版使用）

【1】エクスポート（既に実行済み）
  npm run export:title-reading-for-chatgpt
  → title-reading-initial-paste-001.txt ～ 014.txt が生成される

【2】ChatGPT に貼り付け
  1. title-reading-initial-paste-001.txt を開く
  2. 全文をコピーして ChatGPT に貼り付け
  3. ChatGPT の出力をコピーして title-reading-initial-result-001.txt に保存
  4. 002～014 も同様に繰り返す

【3】DB に反映
  npm run import:title-reading-initial
  → title-reading-initial-result-*.txt を読み込み、titleReadingInitial を更新

※ 出力形式: workId（タブ）読みの1文字（例: cid:d_130386	ナ）
※ 読みはカタカナ1文字のみ。? や不正な行はスキップされる。
