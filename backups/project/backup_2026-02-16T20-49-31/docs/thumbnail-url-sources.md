# 作品サムネイル（thumbnailUrl）の取得元

## DMM API でインポートした場合
- **大半はこちらで問題なし。**  
  `src/app/api/admin/dmm/import/route.ts` で `item.imageURL.large` を `thumbnailUrl` に保存しているため、DB にサムネが入る。

## FANZA スクレイピングで取り込んだ場合
- スクレイパー側では **取得している**。  
  `src/server/scraping/fanzaScraper.ts` で商品ページの `<meta property="og:image">` を取得し、`thumbnailUrl` にセットしている。
- **それでもサムネが null になり得るケース**
  - 昔取り込んだ作品で、当時のスクレイパーにサムネ取得がなかった
  - 対象ページに `og:image` が無い／取得に失敗した
- **対応の選択肢**
  1. **再スクレイピング**  
     サムネが欲しい作品の `productUrl` に対して、現在の FANZA スクレイパーを再度実行する。  
     `extractWorkData` が `og:image` を取るので、取得できれば DB の `thumbnailUrl` を更新できる。
  2. **そのまま運用**  
     サムネが null の作品は、UI で画像を出さず「作品名・作者」だけ表示する（現状の実装で対応済み）。

再スクレイピングで DB を更新する場合は、既存のスクレイピング用 API／スクリプトで「作品詳細取得 → Work の thumbnailUrl だけ更新」のような処理を用意するとよい。
