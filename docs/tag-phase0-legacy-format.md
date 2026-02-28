# Phase0 タグ付け：旧形式（レガシー）プロンプト構造

**参照用。本番は compact 形式を使用。**

---

## 概要

2026年2月まで使用していた形式。各作品（works の各要素）に `allTags` を重複して含める。

- **メリット**: 指示書の「入力」と完全一致
- **デメリット**: トークン量が約4倍（allTags を8作品分繰り返す）

---

## 入力形式（旧・各作品に allTags を含む）

```
## 作品データ（タグ付け対象）

{
  "works": [
    {
      "workId": "d_xxxxxx",
      "title": "作品タイトル",
      "commentText": "あらすじ…",
      "officialTags": ["既存Sタグ"],
      "allTags": { "s": [...], "a": [...], "b": [...] }
    },
    ...
  ]
}
```

各作品ごとに `allTags` が含まれる（8件なら allTags が8回繰り返される）。

---

## 呼び出し

`variant=current` を指定するとこの形式で実行される。

```
POST /api/admin/openai-tag-batch?count=8&source=ab_test&variant=current
```

ABテスト用 UI の「現行で試す」ボタンから利用可能。
