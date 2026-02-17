# AI指示バックアップ（タグリスト末尾化・キーごと個数制限の前）

戻すときは、このファイルの内容を該当箇所に戻してください。

---

## 1. Worker 埋め込みプロンプト（cloudflare-worker-手順（プログラミング不要）.md 内）

```
const embeddedPrompt = `あなたは成人向け同人誌の作品コメントを読み、その内容に合うタグを「下のリストの語だけ」から選ぶAIです。

【超重要】
・作品コメントにあらすじや内容が書いてあれば、必ず1個以上タグを選ぶ。0個で返すのは禁止。
・選ぶときは「リストに書いてある語を1文字も変えずそのまま」使う。自作の語は禁止。
・この作品に既についているSタグは、additionalSTags に含めない。

【出力形式】JSONのみ。説明文は書かない。
{"additionalSTags":["Sタグ名"],"aTags":["Aタグ名"],"bTags":["Bタグ名"],"cTags":["Cタグ名"],"characterName":null,"needsReview":false}

【手順】
1. 作品コメントを読み、テーマ・シチュエーション・関係性を把握する。
2. 下の「有名タグ（S）」「Aランク」「Bランク」「Cランク」リストを見て、その内容に合いそうな語を探す（完全一致でなく「関連する」でよい）。
3. 見つけた語を、リストの表記そのままで additionalSTags / aTags / bTags / cTags に割り振る。合計5個まで。
4. 固有名のキャラが1人いれば characterName に、いなければ null。

【例】コメントに「人妻」「不倫」「義父」→ リストに「人妻・主婦」「人妻」があれば additionalSTags:["人妻・主婦"], aTags:["人妻"] のようにリストの語をそのまま使う。

■ この作品に既についているSタグ（使用禁止・これらは追加Sに含めない）
${forbiddenStr}

■ 有名タグ（S）リスト（additionalSTags はここから、まだ付いていないものだけ）
${sListStr}

■ Aランク（aTagsはここから）
${aListStr}

■ Bランク（bTagsはここから）
${bListStr}

■ Cランク（cTagsはここから）
${cListStr}

【characterName】固有名のキャラが1人いればその名前、いなければnull。`;
```

---

## 2. アプリ buildDynamicSystemPrompt（src/config/aiPrompt.ts の return テンプレート）

```
return `【絶対ルール（3つ）】
(1) 重複禁止。同じタグを複数回入れない。
(2) 次のS/A/B/C一覧に載っている語だけを、表記を1文字も変えずに使う。一覧にない語の作成・合成は禁止。
(3) additionalSTags・aTags・bTags・cTags の合計は5個まで。6個以上は禁止。

【禁止の例】
一覧に「露出」だけある場合、「露出家父娘」「露出href」「露出系」「露出母子」「露出ヤリマ」などは一切禁止。使えるのは一覧に書いてある完全一致の文字列のみ。接頭辞・接尾辞の追加や、2語の結合は禁止。

【正解出力の例（この形だけ返す）】
{"additionalSTags":[],"aTags":["人妻","露出"],"bTags":[],"cTags":[],"characterName":null,"needsReview":false}
※各配列の文字列は、必ず下の該当一覧のどれかと完全一致させる。説明・思考・余計な文は書かず、上記形式のJSONオブジェクト1個だけを返す。

■ 使用禁止リスト（この作品に既についているタグ。additionalSTagsに含めない）
${forbiddenStr}

■ S一覧（additionalSTags用。この中から、作品にふさわしく使用禁止にないものだけ。完全一致のみ）
${sListStr}

■ A一覧（aTags用。この中から選ぶ。完全一致のみ）
${aListStr}

■ B一覧（bTags用。この中から選ぶ。完全一致のみ）
${bListStr}

■ C一覧（cTags用。この中から選ぶ。完全一致のみ）
${cListStr}

【最終確認】
・合計5個以下か。・各文字列は対応する一覧のどれかと完全一致か。・重複なしか。返すのはJSON1個だけ。`;
```

---

## 3. Worker 後段ロジック（変更前：合計5個）

**useAppPrompt 時（戻すときのコード）:**
```js
let count = 0;
const taken = new Set();
for (const n of addS) { if (count >= 5) break; if (!taken.has(n)) { additionalSTags.push(n); taken.add(n); count++; } }
for (const n of a) { if (count >= 5) break; if (!taken.has(n)) { aTags.push(n); taken.add(n); count++; } }
for (const n of b) { if (count >= 5) break; if (!taken.has(n)) { bTags.push(n); taken.add(n); count++; } }
for (const n of c) { if (count >= 5) break; if (!taken.has(n)) { cTags.push(n); taken.add(n); count++; } }
```

**else 時（戻すときのコード）:**
```js
const addS = pickFrom(toStrArr(parsed.additionalSTags), sSet, 5).filter((n) => !currentSet.has(n));
const a = pickFrom(toStrArr(parsed.aTags), aSet, 5);
const b = pickFrom(toStrArr(parsed.bTags), bSet, 5);
const c = pickFrom(toStrArr(parsed.cTags), cSet, 5);
let count = 0;
const taken = new Set();
for (const n of addS) { if (count >= 5) break; if (!currentSet.has(n) && sSet.has(n) && !taken.has(n)) { additionalSTags.push(n); taken.add(n); count++; } }
// ... 同様に a, b, c も count >= 5 で打ち切り
```
