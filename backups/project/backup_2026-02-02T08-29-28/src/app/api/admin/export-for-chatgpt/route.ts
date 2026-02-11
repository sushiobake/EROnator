/**
 * ChatGPT用エクスポートAPI
 * 選択した作品をプロンプト+作品データ+有名タグリストを1ファイルに統合してエクスポート
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import * as fs from 'fs';
import * as path from 'path';
import { buildDynamicSystemPrompt } from '@/config/aiPrompt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workIds } = body;
    
    if (!Array.isArray(workIds) || workIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'workIdsは配列で1件以上必要です' },
        { status: 400 }
      );
    }
    
    // 作品を取得
    const works = await prisma.work.findMany({
      where: {
        workId: { in: workIds },
        commentText: { not: null }
      },
      select: {
        workId: true,
        title: true,
        commentText: true,
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    if (works.length === 0) {
      return NextResponse.json(
        { success: false, error: 'コメントがある作品が見つかりません' },
        { status: 404 }
      );
    }
    
    // OFFICIALタグを取得（有名タグリスト）
    const officialTags = await prisma.tag.findMany({
      where: {
        tagType: 'OFFICIAL'
      },
      select: {
        displayName: true,
      },
      orderBy: {
        displayName: 'asc'
      }
    });
    
    const officialTagNames = officialTags.map(t => t.displayName);
    
    // プロンプトを読み込み
    const promptPath = path.join(process.cwd(), 'data', 'chatgpt-export', 'chatgpt-prompt.txt');
    let promptText = '';
    if (fs.existsSync(promptPath)) {
      promptText = fs.readFileSync(promptPath, 'utf-8');
      // プロンプト内の有名タグリストを最新のものに置き換え
      // 「■ 有名タグ（使用禁止リスト）」から次の「━━━━」までの範囲を置換
      const tagListRegex = /(■ 有名タグ（使用禁止リスト）\n)([\s\S]*?)(\n\n※完全なリストは|上記のタグは)/;
      const replacement = `$1${officialTagNames.join('、')}$3`;
      promptText = promptText.replace(tagListRegex, replacement);
    } else {
      // フォールバック: 動的にプロンプトを生成
      promptText = buildDynamicSystemPrompt(officialTagNames);
    }
    
    // ChatGPTへの明確な指示を作成（ファイルを渡すだけで即実行されるよう冒頭で明示）
    const instructions = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【受信時すぐ実行・追加メッセージ不要】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

このファイルがアップロードされた時点で、あなたのタスクは開始されています。
ユーザーがチャットに何かメッセージを送る必要はありません。このファイルを渡すだけで成立します。
追加の質問や確認は不要です。以下を直ちに実行してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【あなたのタスク】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

このJSONファイルには、${works.length}件の作品データが含まれています。
あなたのタスクは、各作品の「commentText」を読み、適切なタグを抽出することです。

【このファイルの構造】
- "instructions": このセクション（あなたへの指示）
- "metadata": ファイルのメタデータ。中にある「expectedOutputFileName」が、あなたが保存するときの【厳守すべきファイル名】です（括弧や(2)は禁止）
- "prompt": タグ抽出の詳細ルール（必ず読んでください）
- "officialTags": 使用禁止の有名タグリスト（絶対に使用しないでください）
- "works": 処理対象の作品データ配列（${works.length}件）

【作業手順（必ずこの順番で実行）】
1. まず「prompt」セクションを読んで、タグ抽出のルールを完全に理解してください
   - matchedTagsの選び方（最大3個、2個を目標に、A/Bランクタグリストから選ぶ）
     ※0個は避ける。該当するタグがあれば、2個を目標に選ぶ
   - suggestedTagsの選び方（0〜2個、新規提案）
   - characterNameの抽出方法
   - 有名タグ（officialTags）の使用禁止
   - 造語・合成語の禁止
   - その他の重要なルール

2. 「officialTags」配列を確認して、使用禁止の有名タグリストを把握してください
   - これらのタグは絶対にmatchedTagsでもsuggestedTagsでも使用しないでください

3. 「works」配列の各作品について、以下の処理を行ってください：
   - 「workId」を記録（出力時に使用）
   - 「title」を記録（出力時に使用、変更しない）
   - 「commentText」の「あらすじ」や「内容解説」を探す
     ※あらすじ・内容解説がない場合は、タグをつけずに返す（matchedTags: [], suggestedTags: []）
   - あらすじ・内容解説があれば、作品の特徴を理解する
   - 「prompt」のルールに従って、matchedTags（最大3個、2個を目標に）を抽出
     ※あらすじ・内容解説がある場合は、0個は避ける。該当するタグがあれば、2個を目標に選ぶ
   - 「prompt」のルールに従って、suggestedTags（0〜2個）を抽出（ぴったりのタグがない場合）
   - キャラクター名があれば、characterNameに抽出

4. すべての作品を処理したら、以下の形式でJSONファイルとして出力してください

【出力形式（最重要）】
以下のJSON配列形式で出力してください。テキストでの説明や補足は一切不要です。
JSONのみを出力し、ファイルとしてダウンロードできる形式にしてください。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【超重要】ファイルとして出力すること（絶対に守ってください）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
■ 最重要：必ずファイルとして出力してください
- ChatGPTの「ダウンロード」ボタンまたは「コードブロックをコピー」機能を使用して、JSONファイルとして保存してください
- ファイル名は metadata の「expectedOutputFileName」の値を【そのまま】コピーして使ってください（括弧や(2)などの番号は禁止）
- テキスト形式での返答は絶対に禁止です
- チャット内にJSONを貼り付けるだけでは不十分です
- 必ずファイルとしてダウンロードしてください
- ファイルとして出力しないと、データが正しく処理できません

■ 出力手順（必ずこの通りに実行）
1. JSON配列を生成する
2. ChatGPTの「ダウンロード」ボタンをクリックする
3. ファイル名を、metadataの「expectedOutputFileName」に書かれた名前と【完全に同じ】に設定する
   - 例: eronator-tags-output-10works-1769628425596.json
   - 「eronator-tags-output (2).json」や「(3)」のような括弧・番号付きの名前は【禁止】です
4. ファイルを保存する
5. そのファイルを送信する

テキストでの返答やチャット内への貼り付けは絶対にしないでください。

[
  {
    "workId": "d_607719",
    "title": "極貧ちゃんがパパ活して、ラブラブ夫婦になる話",
    "matchedTags": [
      {"displayName": "借金", "category": "シチュエーション"},
      {"displayName": "清楚", "category": "属性"}
    ],
    "suggestedTags": [],
    "characterName": "万福いつか"
  },
  {
    "workId": "d_645601",
    "title": "銭湯のおねえさんと交わる、4日間の夏",
    "matchedTags": [],
    "suggestedTags": [
      {"displayName": "銭湯", "category": "場所"}
    ],
    "characterName": null
  },
  ...
]

【最重要 - 整合性チェック】
以下の条件を必ず満たしてください。これらが守られないと、データが正しく処理できません：

1. 作品数の一致
   - 送られた作品数: ${works.length}件
   - 返す作品数: 必ず${works.length}件（1件も欠落させないこと）

2. workIdの順番維持
   - works配列の順番通りに返すこと
   - 順番を変更しないこと

3. workIdの完全性
   - 送られたすべてのworkIdを含めること
   - 余分なworkIdを追加しないこと

4. タイトルの一致
   - works配列の「title」をそのまま使用すること
   - タイトルを変更しないこと

5. 出力形式
   - JSONファイルとして出力すること
   - テキストでの説明や補足は一切不要
   - JSONのみを出力すること

【確認事項】
処理を開始する前に、以下を確認してください：
□ promptセクションを読んだか
□ officialTagsリストを確認したか
□ works配列に${works.length}件の作品があることを確認したか
□ 出力形式を理解したか
□ 整合性チェックの条件を理解したか
□ matchedTagsは最大3個、2個を目標に選ぶことを理解したか
□ ファイルとしてダウンロードすることを理解したか

【matchedTagsの選び方（重要）】
- 0個は避ける。該当するタグが1つもない場合のみ0個OK
- 該当するタグがあれば、2個を目標に選ぶ
- 複数の観点からタグを選ぶ（場所、属性、シチュエーション、関係性など）
  例: 「学園生活」だけでなく、「高校」「教室」なども検討する
  例: 「催眠」だけでなく、「調教」「禁断関係」なども検討する

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
それでは、works配列の各作品を処理して、JSONファイルとして出力してください。

【最重要】ファイルとして出力すること（絶対に守ってください）
- 必ずファイルとしてダウンロードしてください（チャット内に貼り付けるだけでは不十分です）
- ファイル名は metadata の「expectedOutputFileName」の値を【そのまま】使ってください（変更・括弧・(2)等の追加は禁止）
- ChatGPTの「ダウンロード」ボタンを使用してファイルとして保存してください
- ファイルとして出力しないと、データが正しく処理できません

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    // ファイル名を先に決めてmetadataに含める（ChatGPTがこの名前で保存するよう指示する）
    const timestamp = Date.now();
    const expectedFilename = `eronator-tags-output-${works.length}works-${timestamp}.json`;

    // ファイル先頭に「受け取ったら即実行」を置く（キー順で先頭になるよう最初に代入）
    const immediateAction = [
      '【このファイルを渡すだけで成立します。追加のメッセージは不要です】',
      `このファイルがアップロードされたら、ユーザーが何か入力するのを待たずに、直ちに以下を実行してください。`,
      `1. このJSONの「instructions」と「prompt」を読む。`,
      `2. 「works」配列の全${works.length}件について、commentText からタグを抽出する。`,
      `3. 結果を指定のJSON配列形式で出力し、ファイルとしてダウンロードできるようにする。ファイル名は「metadata」の「expectedOutputFileName」の値を使う。`,
      `質問や確認は不要です。このファイルを受け取った時点で処理を開始してください。`,
    ].join(' ');

    const exportData: Record<string, unknown> = {
      immediateAction,
      instructions,
      metadata: {
        exportedAt: new Date().toISOString(),
        workCount: works.length,
        officialTagCount: officialTagNames.length,
        expectedOutputFileName: expectedFilename,
        note: 'このファイルをアップロードするだけで処理が開始されます。追加のメッセージは不要です。（送信ボタンを押すために入力が必要な場合は「実行」とだけ送信してください）',
      },
      prompt: promptText,
      officialTags: officialTagNames,
      works: works.map(w => ({
        workId: w.workId,
        title: w.title,
        commentText: w.commentText || '',
      })),
    };
    
    // JSONファイルとして返す（ダウンロード時のファイル名はmetadataと一致）
    const jsonContent = JSON.stringify(exportData, null, 2);

    return new NextResponse(jsonContent, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${expectedFilename}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
