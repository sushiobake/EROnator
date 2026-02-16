# タグ付け指示書とチェック指示書（並べて参照）

2枚を並べて考える用。全文はそれぞれ [legacy-ai-tagging-instruction.md](./legacy-ai-tagging-instruction.md) と [check-instruction.md](./check-instruction.md) を開いて比較すること。

---

## 比較

| 項目 | タグ付け指示書 | チェック指示書 |
|------|----------------|----------------|
| **役割** | タグを付ける。apply まで実行し、対象をチェック待ちの先頭に並べる。 | 既にあるタグをチェックする。タグ付けはしない。修正したら追加・削除を明記する。 |
| **入力** | 作品（title, commentText 等。GPT用コピーで渡す） | 作品（workId, title, commentText, derivedTags, officialTags, characterName。AIにタグチェックさせるためのコピペで渡す） |
| **出力** | JSON配列（matchedTags, additionalSTags, characterName, tagReasoning 等）→ 保存して apply 実行 | 各作品の result（タグ済 / 人間による確認が必要）＋ issues ＋ tagChanges（added / removed） |
| **目的** | 正確で差別化できるタグ（通常タグ＋キャラタグ）を付ける。 | 同じ。適切なタグ付けがされているかを確認する。 |
| **流れ** | チェック待ち → （タグ付け＋apply）→ チェック待ちの先頭に**移動** | チェック待ち → （チェック）→ **タグ済** または **人間による確認が必要** に**移動** |
| **フォルダを移動する** | あなたが返したJSONを保存し、`npx tsx scripts/apply-cursor-legacy-ai-batch.ts ファイル名.json` を実行する。**必ず自分で実行し、終えろ。** | 返したJSONを保存し、`npx tsx scripts/apply-check-result.ts ...` を**自分で実行しろ。** 両方終えるまで完了とするな。**必ず実行してフォルダを移動させろ。** |

---

## 1. タグ付け指示書（要点）

- **ゴール**: 対象作品にタグを付け、**その作品を「チェック待ち」フォルダに移動する**。JSON 保存 → apply 実行でフォルダが移動する。apply を実行しないと移動しない。
- **絶対原則**: 語彙は all-tags の表記そのまま。重複避ける。視点タグは明記時のみ。根拠がなければ0個でよい。
- **毎作品で**: (1) タイトルを必ず読む (2) キャラタグ＝commentText に名前があれば代表1人、なければ null。タイトルはキャラ名ではない (3) シリーズ系（数字・続編・総集編・編）があれば1つ付ける。
- **手順**: 既存S確認 → タイトルを読んでから既存S以外で1〜2個 → コメントを再度確認。
- **出力**: workId, title, matchedTags, suggestedTags, additionalSTags, characterName, tagReasoning。characterName は必ずキーを含める。

**全文**: [legacy-ai-tagging-instruction.md](./legacy-ai-tagging-instruction.md)

---

## 2. チェック指示書（要点）

- **ゴール**: 各作品を**「タグ済」または「人間による確認が必要」のフォルダに移動する**。完了はフォルダが実際に移動した状態。JSONを返すだけでは完了ではない。**保存と反映コマンドを自分で実行しろ。終えることを確実にしろ。** 修正したタグは追加・削除を明記。
- **最優先**: 「タイトル＋コメント」＝「公式タグ＋付け加えたタグ」か。余計なタグ・必要なタグの漏れがないか。
- **タイトル**: タイトルから得られる情報はコメントと同様またはそれ以上に重要。軽く見ない。
- **大事なこと**: キャラタグ（commentText に名前があれば代表1人。タイトルはキャラ名ではない）。毎作品で必ず確認。
- **細かいこと**: 各タグの根拠、特徴を表すタグが付いているか、シリーズ、付けてよい/いけない（背景だけは意味がある場合多く付けてよい）、語彙・表記。
- **出力**: result（タグ済/人間による確認が必要）、issues、tagChanges（added, removed）。修正したタグは必ず書く。

**全文**: [check-instruction.md](./check-instruction.md)

---

## 並べて開くとき

- 左に [legacy-ai-tagging-instruction.md](./legacy-ai-tagging-instruction.md)、右に [check-instruction.md](./check-instruction.md) を開くと、同じ目的・同じルールを「付ける側」と「確認する側」でどう書いているか比較できる。
