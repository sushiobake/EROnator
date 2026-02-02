/**
 * AI分析プロンプト設定
 * 2層構造: 必須枠（A/Bから1-3個） + 提案枠（新規0-2個）
 */

import fs from 'fs';
import path from 'path';

export interface AiPromptConfig {
  systemPrompt: string;
  derivedTagsMax: number;
  characterTagsMax: number;
  officialTags: string[]; // Sチェック用
}

// A/Bランクのタグリストを取得
export function getABTagList(): string[] {
  try {
    const ranksPath = path.join(process.cwd(), 'config', 'tagRanks.json');
    const content = fs.readFileSync(ranksPath, 'utf-8');
    const data = JSON.parse(content);
    const ranks = data.ranks || {};
    
    return Object.entries(ranks)
      .filter(([_, rank]) => rank === 'A' || rank === 'B')
      .map(([name]) => name)
      .sort((a, b) => a.localeCompare(b, 'ja'));
  } catch {
    return [];
  }
}

/** 指定ランクのタグ名リストを取得（A/B/C 用） */
export function getTagsByRank(rank: 'A' | 'B' | 'C'): string[] {
  try {
    const ranksPath = path.join(process.cwd(), 'config', 'tagRanks.json');
    const content = fs.readFileSync(ranksPath, 'utf-8');
    const data = JSON.parse(content);
    const ranks = data.ranks || {};
    return Object.entries(ranks)
      .filter(([_, r]) => r === rank)
      .map(([name]) => name)
      .sort((a, b) => a.localeCompare(b, 'ja'));
  } catch {
    return [];
  }
}

// OFFICIALタグリストを取得（Sチェック用・管理画面のプロンプトプレビュー用にexport）
export function getOfficialTagList(): string[] {
  try {
    // DBから直接取得するのは難しいので、キャッシュファイルを使う
    const cachePath = path.join(process.cwd(), 'config', 'officialTagsCache.json');
    if (fs.existsSync(cachePath)) {
      const content = fs.readFileSync(cachePath, 'utf-8');
      const data = JSON.parse(content);
      return data.tags || [];
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * プロンプト生成（丁寧な指示版）
 */
function buildSystemPrompt(): string {
  const abTags = getABTagList();
  const officialTags = getOfficialTagList();
  
  const abTagListStr = abTags.length > 0 
    ? abTags.join('、')
    : '（タグリストなし）';
    
  const officialTagListStr = officialTags.length > 0
    ? officialTags.slice(0, 100).join('、') + (officialTags.length > 100 ? '...他' : '')
    : '（なし）';

  return `あなたは「ERONATOR タグ抽出AI」です。
作品コメントを丁寧に読み、その作品の特徴を的確に捉えるタグを選んでください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【最重要】有名タグ（Sランク）は絶対に使用禁止！
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
以下の「有名タグ」は既に作品に付与済みのため、matchedTagsでもsuggestedTagsでも
【絶対に使用しないでください】。これらを提案すると無効になります。

■ 有名タグ（使用禁止リスト）
${officialTagListStr}

上記のタグは出力に含めないでください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【出力形式】JSON形式で出力（JSON以外は出力禁止）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "matchedTags": [
    {"displayName": "タグ名", "confidence": 0.90, "category": "カテゴリ"}
  ],
  "suggestedTags": [
    {"displayName": "新規タグ名", "confidence": 0.85, "category": "カテゴリ"}
  ],
  "characterName": "キャラクター名" または null
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【matchedTags】必須枠（1〜3個）★最重要★
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

■ 手順（必ずこの順番で考える）
1. まず作品コメントを読んで、作品の特徴を理解する
2. 次に「準有名タグリスト」を上から順に見て、該当するものを探す
3. 該当するタグがあれば、それをそのまま出力する

■ 準有名タグリスト（この中から選ぶ）
${abTagListStr}

■ 超重要ルール
- 【リストにあるタグをそのまま使う】（文字を追加・変更しない！）
- NG例: 「電マ」→「電マ責め」（×）、「催眠」→「催淫」（×）
- OK例: 「電マ」→「電マ」（○）、「催眠」→「催眠」（○）
- リストに完全一致するタグのみ出力すること
- コメントに直接書いてある単語より、リストにあるタグを優先する

■ 絶対禁止パターン
- 「○○プレイ」形式は全面禁止（例: 触手プレイ、レズプレイ等）
- 「○○責め」形式も禁止（例: 電マ責め、乳首責め等）
- コメントから単語を切り出して並べるのは禁止
- 既存タグに接尾辞を追加しない

■ 選び方のコツ
- 作品のメインテーマに合うタグを選ぶ
- コメントに直接書いてなくても、内容から推測できるタグを選ぶ
  例: 「催淫毒」→「催眠」、「シスター」→（リストにあれば選ぶ）
- 「この作品は○○ですか？」と聞かれてYESと答えられるもの

■ 件数厳守: **1〜3個。4個以上は出さない。理想は2個。** 該当がない場合のみ0個でOK。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【suggestedTags】提案枠（0〜2個）オプション
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
リストにない特徴がある場合のみ、新しいタグを提案してください。

■ 提案のルール
- リストで表現しきれない、その作品ならではの特徴がある場合のみ
- 汎用性のあるタグを提案（他の作品にも使えそうなもの）
- 有名タグ（上記禁止リスト）と被るものは絶対に禁止！

■ 造語・合成語は禁止！（超重要）
提案するタグは【世間で広く使われている言葉】のみOKです。
- NG: 「即採用」「田舎移住」「年上お姉さん」「初恋相手」「密室監禁」
  → これらは「文節＋文節」を組み合わせた造語なのでNG
- OK: 「ブラック企業」「ハニートラップ」「セックスレス」
  → これらは一般的に使われる言葉なのでOK

判断基準: その言葉をGoogle検索して、普通に使われているかどうか
「○○ ○○」と2つの単語を並べただけの造語は絶対に禁止！

■ 絶対に提案禁止
- サークル名、作者名、作品タイトル、シリーズ名
- ページ数、形式（フルカラー、PDF等）
- イベント名、価格、販売情報
- 1文字のタグ、数字だけのタグ
- 一般的すぎる語（エロ、セックス、漫画、中出し等）
- 作品固有すぎる語（他の作品に使えないもの）
- 2つの単語を組み合わせた造語（「即採用」「田舎移住」等）

■ カテゴリ（以下から選ぶ）
シチュエーション / 関係性 / 属性 / 場所 / その他

■ 件数厳守: **0〜2個。3個以上は出さない。** 良い提案がなければ空配列でOK。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【characterName】キャラクター名（0〜1人）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
作品に明確な「キャラクター名」がある場合のみ抽出してください。

■ 抽出OK
- 固有名詞としてのキャラクター名（例: 鈴々、早織、美咲）
- コメント内に文字列として存在する名前

■ 抽出NG（これらは禁止）
- 属性語（人妻、ヒロイン、彼女、大学生、ギャル等）
- 一般名詞（女性、男性、主人公等）
- コメントに存在しない名前

■ 件数: 明確な名前があれば1人、なければnull

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【最終チェック】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
□ matchedTagsは1〜3個（4個以上は不正。理想は2個。該当なしのみ0個可）
□ suggestedTagsは0〜2個（3個以上は不正）
□ characterNameは1人またはnull
□ JSON形式のみ出力`;
}

export function getAiPromptConfig(): AiPromptConfig {
  const customPrompt = process.env.ERONATOR_AI_PROMPT;
  
  return {
    systemPrompt: customPrompt || buildSystemPrompt(),
    derivedTagsMax: 5, // matched 3 + suggested 2
    characterTagsMax: 1,
    officialTags: getOfficialTagList(),
  };
}

/**
 * 動的にプロンプトを生成（追加S / A / B / C 形式）
 * reanalyze等で使用。作品ごとに「既に付いているタグ」を渡して使用禁止にする。
 */
export function buildDynamicSystemPrompt(
  officialTags: string[],
  alreadyOnWorkOfficialNames: string[] = []
): string {
  const aTags = getTagsByRank('A');
  const bTags = getTagsByRank('B');
  const cTags = getTagsByRank('C');
  const sListStr =
    officialTags.length > 0
      ? officialTags.slice(0, 150).join('、') + (officialTags.length > 150 ? '...他' : '')
      : '（なし）';
  const forbiddenStr =
    alreadyOnWorkOfficialNames.length > 0
      ? alreadyOnWorkOfficialNames.join('、')
      : '（なし・この作品にはまだ付与タグがない）';
  const aListStr = aTags.length > 0 ? aTags.join('、') : '（なし）';
  const bListStr = bTags.length > 0 ? bTags.join('、') : '（なし）';
  const cListStr = cTags.length > 0 ? cTags.join('、') : '（なし）';

  return `【絶対ルール（3つ）】
(1) 重複禁止。同じタグを複数回入れない。
(2) このメッセージの最後にあるS/A/B/C一覧に載っている語だけを、表記を1文字も変えずに使う。一覧にない語の作成・合成は禁止。
(3) 個数制限（各キーごと）: additionalSTags 0～2個、aTags 0～2個、bTags 0～2個、cTags 0～1個。

【禁止の例】
一覧に「露出」だけある場合、「露出家父娘」「露出href」「露出系」「露出母子」「露出ヤリマ」などは一切禁止。使えるのは一覧に書いてある完全一致の文字列のみ。接頭辞・接尾辞の追加や、2語の結合は禁止。

【正解出力の例（この形だけ返す）】
{"additionalSTags":[],"aTags":["人妻","露出"],"bTags":[],"cTags":[],"characterName":null,"needsReview":false}
※各配列の文字列は、必ず末尾の該当一覧のどれかと完全一致させる。説明・思考・余計な文は書かず、上記形式のJSONオブジェクト1個だけを返す。

【最終確認】
・各キーの個数制限を守っているか。・各文字列は対応する一覧のどれかと完全一致か。・重複なしか。返すのはJSON1個だけ。

--- 以下は参照用リスト（ここから選ぶ。表記は1文字も変えずそのまま使う）---

■ 使用禁止リスト（この作品に既についているタグ。additionalSTagsに含めない）
${forbiddenStr}

■ S一覧（additionalSTags用。この中から、作品にふさわしく使用禁止にないものだけ。完全一致のみ）
${sListStr}

■ A一覧（aTags用。この中から選ぶ。完全一致のみ）
${aListStr}

■ B一覧（bTags用。この中から選ぶ。完全一致のみ）
${bListStr}

■ C一覧（cTags用。この中から選ぶ。完全一致のみ）
${cListStr}`;
}
