# Custom GPTs セットアップガイド

## 概要

ChatGPTのCustom GPTs機能を使って、作品にタグを自動付与するシステム。

## Custom GPT作成手順

### 1. GPT作成画面へ

ChatGPT → 左メニュー「Explore GPTs」→「Create」

### 2. 設定

**Name**: ERONATOR タグ付けアシスタント

**Description**: 同人作品のコメントから適切なタグを抽出します

**Instructions**: 以下をコピー

```
あなたは同人作品のタグ付けアシスタントです。
作品コメントを分析し、適切なタグを1〜3個付与してください。

## ルール

1. 【必須】タグリスト（Knowledge内のtag-list.txt）から選ぶ
2. リストにないタグは使わない（新規タグは禁止）
3. 作品の本質的な特徴を捉えるタグを選ぶ
4. 1作品につき1〜3個（多すぎない）

## 入力形式

JSON配列:
[
  { "workId": "d_123456", "title": "作品タイトル", "commentText": "作品コメント..." },
  ...
]

## 出力形式

JSON配列（これ以外は出力しない）:
[
  { "workId": "d_123456", "tags": ["タグ1", "タグ2"] },
  ...
]

## 注意

- JSON以外の説明や会話は不要
- タグがない場合は空配列: { "workId": "...", "tags": [] }
- タグリストにない言葉は絶対に使わない
```

### 3. Knowledge（知識ベース）

`config/tag-list-for-gpt.txt` をアップロード

### 4. 設定オプション

- Web Browsing: OFF
- DALL·E: OFF
- Code Interpreter: ON（大きいファイル処理用）

---

## 使い方

### Step 1: エクスポート

```bash
npx ts-node scripts/export-for-chatgpt.ts --limit=100
```

出力: `data/chatgpt-export/chatgpt-input-XXXX.json`

### Step 2: ChatGPTに投げる

1. Custom GPTを開く
2. JSONファイルをアップロード（または内容をコピペ）
3. 「お願いします」と送信
4. 結果のJSONをコピー or ダウンロード

### Step 3: インポート

結果を `data/chatgpt-export/chatgpt-output.json` に保存して:

```bash
npx ts-node scripts/import-from-chatgpt.ts chatgpt-output.json
```

---

## 大量処理のコツ

- 1回100〜200件が安定
- 慣れたら300〜500件も可能
- エラーが出たら件数を減らす
- `--offset` で次のバッチを指定

```bash
# 最初の100件
npx ts-node scripts/export-for-chatgpt.ts --limit=100 --offset=0

# 次の100件
npx ts-node scripts/export-for-chatgpt.ts --limit=100 --offset=100
```
