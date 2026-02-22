# check-input.json 文字化け・JSON 崩れ 事象メモ

**発生日**: 2026年2月頃（100件チェック時）  
**対応**: fetch-works-for-ai.ts に `--out` オプション追加

---

## 何が起きたか

`data/chatgpt-export/check-input.json` が**文字化け**し、**JSON が崩れて**（文字列が途中で切れるなど）全件チェックに使えなくなった。

---

## 原因

### PowerShell の `>` リダイレクトによる文字コード変換

| 段階 | 起こったこと |
|------|--------------|
| 1 | `fetch-works-for-ai.ts` が UTF-8 で JSON を stdout に出力 |
| 2 | ユーザーが `npx tsx scripts/fetch-works-for-ai.ts --check ... > data/chatgpt-export/check-input.json` でリダイレクト |
| 3 | PowerShell が stdout を**システムのデフォルトエンコーディング**（日本語 Windows では Shift-JIS が多い）で解釈しようとする |
| 4 | UTF-8 のマルチバイト文字（日本語など）が Shift-JIS として誤解釈される |
| 5 | ファイルには Shift-JIS として再エンコードされたバイト列が書き込まれる |
| 6 | バイト境界がずれ、**文字化け**や**文字列の途中切れ**が発生。JSON としてパースできなくなる |

### なぜそうなるか

- Node は内部で UTF-8 を使い、stdout にも UTF-8 で出力する
- PowerShell の `>` は「コンソール出力をそのままファイルに流す」のではなく、**文字コード変換を挟む**
- 日本語 Windows のデフォルトは Shift-JIS のため、UTF-8 のバイト列が誤って Shift-JIS として扱われる

---

## 対応内容

1. **fetch-works-for-ai.ts に `--out <path>` オプションを追加**
   - 指定時は stdout ではなく、`fs.writeFileSync(path, json, 'utf8')` で直接ファイルに書き込む
   - シェルのリダイレクトを介さないため、エンコーディング変換が起きない

2. **指示書・ManualTagging の更新**
   - `--out data/chatgpt-export/check-input.json` を必須とする
   - PowerShell の `>` を絶対に使わない旨を明記

---

## 再発防止

### check-input.json（取得時）

- **取得コマンドは必ず `--out` を使う**
  ```
  npx tsx scripts/fetch-works-for-ai.ts --check --out data/chatgpt-export/check-input.json <workIds>
  ```
- `>` によるリダイレクトは使わない
- `chcp 65001` だけでは不十分な場合がある（PowerShell の挙動に依存）

### check-pending.json（チェック結果の保存時）

- **PowerShell の `>` や `Out-File` は文字化けするため使わない**
- **必ず `save-check-pending.ts` を使う**
  ```
  # 1. 返した JSON を check-result-paste.json などに貼り付けて保存
  # 2. 以下を実行
  npx tsx scripts/save-check-pending.ts data/chatgpt-export/check-result-paste.json
  ```
