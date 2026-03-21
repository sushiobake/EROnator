# 配信者（伏せ字）モード 設計メモ

配信時にエロワードを伏せ字表示するモード。同人誌は18禁のため「全年齢」ではなく「配信（伏せ字）モード」と呼ぶ。

---

## 方針

### 1. 部分的伏字（１文字おき）

FANZAの「強●」のように、**部分的に伏字**を入れる方式。

- **ルール**: 奇数位置（1, 3, 5…）の文字を「〇」に置換
- **例**: おっぱい → お〇ぱ〇、アナル → ア〇ル、中出し → 中〇し
- **数字**: 伏字にしない（頭3文字が「123」などの場合に必要）

### 2. エロワードの対象

「エロ質問」のタグ（`exploreTagKind === 'erotic'`）の `displayName` が該当。

- 現状の `sanitizeQuestionText` の `eroticWords` リストと同等
- 将来的にコンフィグで管理可能にする

### 3. 伏字部分のスタイル

文中で不自然にならないよう、伏字部分を視覚的に区別する。

- **フォント**: 丸ゴシック系（M PLUS Rounded 1c、Zen Maru Gothic など）
- **サイズ**: 少し小さめ（0.9em 程度）
- 伏字であることが分かりやすくなる

### 4. 適用箇所

| 箇所 | 内容 |
|------|------|
| 質問文 | `displayText` 内のエロワード部分のみ部分的伏字＋スタイル |
| タイトル頭3文字 | 「この作品のタイトルは「あ〇る」から始まりますか？」など |
| 断定 | 作品タイトル全体を部分的伏字 |
| おすすめタイトル | テキスト表示部分（モザイクは別途） |

### 5. スマホ

- 配信者モードは**PC向け**（配信はPCで行う想定）
- スマホではトグルを非表示、または従来の簡易表示とする（要検討）

---

## 実装フェーズ

### Phase 1: 中身の実装（先にやる）

1. **部分的伏字関数**
   ```ts
   function partialCensor(text: string, skipNumbers?: boolean): string
   ```
   - 奇数位置を〇に。数字は `skipNumbers` でスキップ

2. **エロワード検出＋置換**
   - エロワードリストにマッチした部分だけ `partialCensor` 適用
   - 該当部分を `<span className="streamer-censored">` でラップ（Reactノード返却）

3. **スタイル**
   - `.streamer-censored` にフォント・サイズを指定

4. **適用**
   - 質問文（page.tsx の characterSpeech）
   - タイトル頭3文字の質問
   - 断定時の作品タイトル
   - おすすめのタイトル表示

### Phase 2: コンフィグ化（後でやる）

- エロワードリストを mvpConfig または専用JSONで管理
- 伏字スタイル（フォント、サイズ）をコンフィグで変更可能に

---

## 実装済み（Phase 1）

- **`src/app/utils/streamerCensor.ts`**: `partialCensor`, `streamerCensorWords`, `DEFAULT_EROTIC_WORDS`
- **`src/app/components/StreamerCensoredText.tsx`**: エロワード部分を部分的伏字＋`.streamer-censored` スタイル
- **適用箇所**:
  - 質問文（`displayText`）
  - 断定時の作品タイトル（Reveal）
  - 成功・惜しかった時の作品タイトル（Success）
  - おすすめカードのタイトル（Success, SuccessRecommendationsVertical）
  - 失敗リストのタイトル（FailList, FailListVerticalList）
- **`globals.css`**: `.streamer-mode .streamer-censored` で丸ゴシック・0.9em
- **`layout.tsx`**: M PLUS Rounded 1c フォント読み込み
- **TopScreen**: 「※配信（伏せ字）モード」のトグル

---

## 参考

- FANZAの「強●」タグ：1文字伏字でも伝わる
- 配信プラットフォーム（Twitch等）は言葉の直接表現以外は寛容との実感
