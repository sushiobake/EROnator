# WorkTag 行列キャッシュ 実装メモ

**作成日**: 2026-02-21  
**目的**: ゲームの質問間遅延（約3秒）を解消し、1万件規模までスケール可能にする

---

## 1. 何に困っているのか

### 現象
- プレビュー版で質問と質問の間が約3秒かかる
- 1,300件→2,800件に増えで顕在化
- 10,000件規模になるとさらに悪化する見込み

### 直接的原因
`/api/answer` が呼ばれるたびに、`selectNextQuestion` が次の質問を選ぶ。その中で:

```ts
// engine.ts 792行付近（selectUnifiedExploreOrSummary）
const workTagsAll = await prisma.workTag.findMany({
  where: { workId: { in: workIds } },  // workIds = 全候補（約2,800件）
  select: { tagKey: true, workId: true },
});
```

- workIds が 2,800 件 → WorkTag が約 3.5 万行返る
- このクエリが **1問ごと** に複数回（selectUnifiedExploreOrSummary, selectExploreQuestion, tryEmergencyExploreFallback, processAnswer）
- Supabase（ネットワーク越し Postgres）では 1 秒以上かかる

### 根本原因
アキネイターと同様の「作品 × タグ → Yes/No」の行列を、**毎回 DB から取得している**。本来は事前計算してメモリに載せるべき。

---

## 2. だから何をするのか

- WorkTag の内容を **事前にファイルに書き出し**（オフライン生成）
- ランタイムでは **そのファイルをメモリに載せ**、DB の代わりに参照する
- 質問選択・重み更新のたびに DB へ WorkTag クエリを発行しない

---

## 3. 方針

### 3.1 方式
- **方法1（ファイル + モジュールキャッシュ）** を採用
- 行列 JSON をプロジェクトに含め、デプロイ時に同梱
- モジュールスコープの変数でキャッシュ（サーバーレスでもインスタンス存活中は保持される）

### 3.2 設計原則
- **既存ロジックを極力変えない**: DB 取得を「行列から取得」に差し替えるだけ
- **返却形式を揃える**: `{ workId, tagKey }[]` や `{ workId, tagKey, derivedConfidence }[]` を返す関数を用意し、既存コードの `workTags` をそのまま使える形にする
- **フォールバック**: 行列がない・読めない場合は従来の Prisma にフォールバック（ローカル開発・初回デプロイ時）

### 3.3 注意点・陥りやすいバグ
- **derivedConfidence**: processAnswer で DERIVED タグの `hasDerivedFeature` 判定に使用。行列に含める必須。
- **まとめ質問**: `summaryDisplayNames` の複数 tagKey をグループとして扱う。groupTagKeys に含まれる全タグについて workTags が必要。
- **SOFT_CONFIRM**: DERIVED タグで `derivedConfidence >= threshold` の workTags のみ使う。行列から filter して渡す。
- **行列に無い workId**: 生成後に追加された作品。存在しない場合は空配列扱い。
- **AI_GATE**: 行列は gameRegistered 作品のみ。AI_GATE で絞った workIds は行列の部分集合。

---

## 4. 具体的に何をするか

### 4.1 行列ファイルの形式

```json
{
  "version": 1,
  "generatedAt": "2026-02-21T08:00:00.000Z",
  "workTagMap": {
    "workId1": [
      { "tagKey": "tag_a", "derivedConfidence": 0.9 },
      { "tagKey": "tag_b", "derivedConfidence": null }
    ],
    "workId2": []
  }
}
```

- `workTagMap`: workId → `{ tagKey, derivedConfidence }[]`
- derivedConfidence は DERIVED タグで使用。OFFICIAL 等は null でよい。

### 4.2 生成スクリプト `scripts/generate-worktag-matrix.js`

1. SQLite (prisma/dev.db) から gameRegistered=true, needsReview=false の Work の workId 一覧を取得
2. それらの WorkTag を取得（workId, tagKey, derivedConfidence）
3. workTagMap 形式に変換
4. `data/workTagMatrix.json` に書き出し

実行: `npm run generate:worktag-matrix`（sync 後、ローカル SQLite が Supabase と同期済みである前提）

### 4.3 ローダー `src/server/game/workTagMatrixLoader.ts`

```ts
// モジュールキャッシュ
let cachedMatrix: WorkTagMatrix | null = null;

export function getWorkTagMatrix(): WorkTagMatrix | null {
  if (cachedMatrix) return cachedMatrix;
  try {
    const p = path.join(process.cwd(), 'data', 'workTagMatrix.json');
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8'));
    cachedMatrix = raw;
    return cachedMatrix;
  } catch {
    return null;
  }
}

/** 行列から workId リストに対する WorkTag 配列を取得。形式は prisma.workTag.findMany と同等 */
export function getWorkTagsFromMatrix(
  workIds: string[],
  options?: { tagKeys?: string[] }
): Array<{ workId: string; tagKey: string; derivedConfidence: number | null }> {
  const matrix = getWorkTagMatrix();
  if (!matrix?.workTagMap) return [];
  const results: Array<{ workId: string; tagKey: string; derivedConfidence: number | null }> = [];
  for (const workId of workIds) {
    const list = matrix.workTagMap[workId] ?? [];
    for (const e of list) {
      if (options?.tagKeys && !options.tagKeys.includes(e.tagKey)) continue;
      results.push({
        workId,
        tagKey: e.tagKey,
        derivedConfidence: e.derivedConfidence ?? null,
      });
    }
  }
  return results;
}
```

### 4.4 engine.ts の変更箇所

| 箇所 | 現状 | 変更後 |
|------|------|--------|
| selectUnifiedExploreOrSummary (792) | `prisma.workTag.findMany({ where: { workId: { in: workIds } } })` | `getWorkTagsFromMatrix(workIds)` に差し替え。null なら Prisma にフォールバック |
| selectExploreQuestion (1002) | 同上 | 同上 |
| tryEmergencyExploreFallback (653) | `prisma.workTag.findMany(...)` | `getWorkTagsFromMatrix(workIds)`。tagKey のみ必要だが形式は互換 |
| processAnswer (1249) | `prisma.workTag.findMany` (workIds, groupTagKeys) | `getWorkTagsFromMatrix(workIds, { tagKeys: groupTagKeys })` |
| SOFT_CONFIRM derivedTags (282) | `prisma.tag.findMany` +  nested workTags | Tag はそのまま Prisma。workTags 部分を行列から取得する形に変更（要検討: Tag と WorkTag の結合を手で行う） |

### 4.5 SOFT_CONFIRM の derivedTags について（やや複雑）

現状は Prisma で:
```ts
prisma.tag.findMany({
  where: { tagType: 'DERIVED', tagKey: { notIn: usedTagKeys } },
  select: {
    tagKey, displayName, questionText,
    workTags: {
      where: {
        workId: { in: workIds },
        derivedConfidence: { gte: threshold },
      },
      select: { workId: true },
    },
  },
})
```

行列を使う場合:
1. `prisma.tag.findMany` で DERIVED タグの tagKey, displayName, questionText を取得（WorkTag は使わない）
2. 各タグについて、`getWorkTagsFromMatrix(workIds, { tagKeys: [tagKey] })` で workTags を取得
3. derivedConfidence >= threshold でフィルタ
4. 既存の `derivedTags` 形式 `{ tagKey, displayName, questionText, workTags: [{ workId }] }` に組み立てる

### 4.6 package.json

```json
"generate:worktag-matrix": "node scripts/generate-worktag-matrix.js"
```

### 4.7 運用フロー

1. `npm run sync:supabase` で Supabase にデータ同期
2. `npm run generate:worktag-matrix` で行列生成
3. `data/workTagMatrix.json` をコミット
4. デプロイ（ファイルはビルドに含まれる）

---

## 5. 実装チェックリスト

- [ ] `scripts/generate-worktag-matrix.js` 作成
- [ ] `src/server/game/workTagMatrixLoader.ts` 作成
- [ ] engine.ts: selectUnifiedExploreOrSummary の workTagsAll を差し替え
- [ ] engine.ts: selectExploreQuestion の workTags を差し替え
- [ ] engine.ts: tryEmergencyExploreFallback の workTags を差し替え
- [ ] engine.ts: processAnswer の workTags を差し替え
- [ ] engine.ts: SOFT_CONFIRM derivedTags の workTags を行列から取得する形に変更
- [ ] package.json に generate:worktag-matrix 追加
- [ ] 初回 `npm run generate:worktag-matrix` 実行
- [ ] ローカルでゲーム動作確認（セッション開始→数問回答→REVEAL）
- [ ] 行列が無い状態でフォールバック動作確認
- [ ] デプロイ

---

## 6. ロールバック

行列が原因の不具合時:
1. engine.ts の差し替え部分を元に戻す（Prisma に戻す）
2. workTagMatrixLoader の import を削除
3. デプロイ

バックアップ: `backups/project/backup_2026-02-21T07-57-12`
