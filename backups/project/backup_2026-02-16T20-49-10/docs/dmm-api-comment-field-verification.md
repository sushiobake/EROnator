# DMM API commentフィールドの検証結果

## 検証目的

ChatGPTのディープリサーチ情報によると、「作品詳細コメント – 商品紹介文（comment）も取得できます。」と記載されていました。実際のAPIレスポンスに`comment`フィールドが含まれているかを確認します。

## 検証方法

実際のAPIレスポンスを複数のサービス（同人誌、電子書籍、動画）で確認しました。

## 検証結果

### 実際のAPIレスポンスに含まれるフィールド

以下のフィールドが確認できました：

- `service_code`, `service_name`, `floor_code`, `floor_name`, `category_name`
- `content_id`, `product_id`, `title`, `volume`
- `review` (count, average)
- `URL`, `affiliateURL`
- `imageURL` (list, small, large)
- `sampleImageURL` (sample_s, sample_l)
- `prices` (price, list_price, deliveries)
- `date`
- `iteminfo` (genre, series, maker, author, actress, label)
- `number` (一部の作品のみ)
- `campaign` (一部の作品のみ)

### `comment`フィールドについて

**結論: `comment`フィールドは実際のAPIレスポンスに含まれていません。**

確認したすべての作品（同人誌、電子書籍、動画）で、`comment`フィールドは見当たりませんでした。

## ChatGPTの情報との差異

ChatGPTのディープリサーチ情報では「作品詳細コメント – 商品紹介文（comment）も取得できます。」と記載されていましたが、実際のAPIレスポンスには含まれていません。

### 考えられる理由

1. **情報が古い可能性**: DMM APIの仕様が変更された可能性
2. **サービスによって異なる可能性**: 特定のサービスやフロアでのみ提供される可能性（ただし、複数のサービスで確認したが含まれていなかった）
3. **別のフィールド名の可能性**: `comment`以外の名前で提供されている可能性（ただし、レスポンス全体を確認したが該当するフィールドは見当たらなかった）
4. **情報の誤り**: ChatGPTの情報が誤っている可能性

## 結論

**以前の結論は変わらず、`comment`フィールドは取得できません。**

### 準有名タグ取得への影響

- **作品コメントから準有名タグを抽出することはできません**
- **代替手段が必要です**:
  1. タイトルから抽出
  2. シリーズ名・メーカー名から抽出
  3. 既存のOFFICIALタグから派生
  4. 手動分類・学習データの構築

## 次のステップ

準有名タグの取得については、上記の代替手段を検討する必要があります。
