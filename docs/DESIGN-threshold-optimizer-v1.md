# 閾値最適化シミュレーション 設計書 v1

## 0. 本書の目的

既存のバッチシミュレーション基盤を再利用し、**パラメータスイープ → 自動評価 → ランキング → 拡大検証** を一気通貫で行う「閾値最適化シミュレーション」の実装仕様を定める。実装者（別モデル）がこの1文書だけで着手できるレベルの詳細を記載する。

---

## 1. 用語

| 用語 | 意味 |
|------|------|
| **ParamSet** | 1つのパラメータ組み合わせ（Confirm バランス＋早期失敗閾値） |
| **Sweep** | 全 ParamSet × 全サンプル × 全ノイズレベルの実行単位 |
| **Baseline** | 早期失敗 OFF（`earlyExitReview.enabled=false`）で走らせた参照データ |
| **ScoreCard** | 1つの ParamSet の全メトリクスと総合スコア |
| **Phase** | Sweep の段階。Phase 1 = 粗探索、Phase 2 = 精密検証 |

---

## 2. ゴール（3 つの最適化対象）

### 2.1 Confirm バランス

**問題**: 中盤〜後半に HARD_CONFIRM が連打され、ゲーム体験が悪い。  
**目標**: EXPLORE → SOFT_CONFIRM が増え、HARD_CONFIRM は「ここぞ」だけ。断定前にハードを1回挟む自然なリズム。

### 2.2 早期失敗の閾値

**問題**: 閾値が未検証。誤切り（本来なら成功するのに打ち切り）と無駄延長（どうせ失敗するのにダラダラ）のバランスが不明。  
**目標**: Q25 / Q30 / Q35 の3審査点で、minConfidence と maxEffectiveCandidates の最適値を特定。  
**補足**: `reviewIndices` は `[25, 30, 35]` に固定（Q40 は廃止方向。Phase 1 で検証）。

### 2.3 体験スコア

**問題**: 成功率だけでなく「遊んで楽しいか」を数値化したい。  
**目標**: HARD 連打率・質問リズム・SOFT 比率を加味した総合スコアで順位付け。

---

## 3. アーキテクチャ概要

```
[管理画面 UI]
    |
    | POST /api/admin/threshold-optimize  (Sweep 開始)
    | GET  /api/admin/threshold-optimize  (進捗・結果取得)
    v
[route.ts]  ← 閾値最適化専用 API
    |
    | ParamSet ごとに config を上書きして呼ぶ
    v
[thresholdOptimizer.ts]  ← オーケストレーション
    |
    | 既存の runSimulation をそのまま利用
    v
[simulationRunner.ts]  ← 変更なし（config 引数で制御）
    |
    v
[scoreCalculator.ts]  ← 評価指標の計算・ランキング
    |
    v
[結果 JSON]  → data/threshold-optimize-results/
```

---

## 4. ファイル構成

### 4.1 新規ファイル

| ファイル | 役割 |
|----------|------|
| `src/server/simulation/thresholdOptimizer.ts` | パラメータスイープのオーケストレーション。ParamSet 生成、config 上書き、バッチ実行、Baseline 管理 |
| `src/server/simulation/scoreCalculator.ts` | 評価指標の計算。SimulationResult[] → ScoreCard |
| `src/server/simulation/paramSetGenerator.ts` | グリッドサーチ用の ParamSet 一覧生成 |
| `src/app/api/admin/threshold-optimize/route.ts` | API ルート（POST: 実行開始、GET: 進捗と結果） |
| `src/types/thresholdOptimizer.ts` | 全型定義 |
| `data/threshold-optimize-results/` | 結果 JSON の保存ディレクトリ |

### 4.2 既存ファイルの変更

| ファイル | 変更内容 |
|----------|----------|
| `src/app/admin/tags/page.tsx` | TabType に `'optimize'` を追加。タブ内に最小限の UI（開始ボタン・進捗・結果表示） |
| `src/app/admin/context/AdminProgressContext.tsx` | JobType に `'optimize'` を追加 |

### 4.3 変更しないファイル（重要）

| ファイル | 理由 |
|----------|------|
| `src/server/simulation/simulationRunner.ts` | config 引数で制御するため変更不要 |
| `src/server/game/engine.ts` | 同上 |
| `src/server/algo/questionSelection.ts` | 同上 |
| `config/mvpConfig.json` | Sweep 中は上書きしない。最終採用時のみ手動更新 |

---

## 5. 型定義（`src/types/thresholdOptimizer.ts`）

```typescript
/** スイープ対象のパラメータ1セット */
export interface ParamSet {
  id: string;                       // 例: "ps_001"
  label: string;                    // 人間可読ラベル（自動生成）

  // --- Confirm バランス ---
  confidenceConfirmBandLower: number;    // confirm.confidenceConfirmBand[0]
  confidenceConfirmBandUpper: number;    // confirm.confidenceConfirmBand[1]
  hardConfidenceMin: number;             // confirm.hardConfidenceMin
  hardConfirmInjectionRatio: number;     // flow.hardConfirmInjectionRatio

  // --- 早期失敗 ---
  reviewIndices: number[];               // flow.earlyExitReview.reviewIndices
  earlyExitThresholds: {
    [key: string]: {                     // "q25" | "q30" | "q35"
      minConfidence: number;
      maxEffectiveCandidates: number;
    };
  };
}

/** Sweep 全体のリクエスト */
export interface SweepRequest {
  /** Phase 1 or 2 */
  phase: 1 | 2;
  /** サンプル作品数（0=全件） */
  sampleSize: number;
  /** ノイズレベル一覧 */
  ambiguityLevels: number[];
  /** AI ゲート */
  aiGateChoice: string;
  /** 1作品あたりの試行回数（乱数ぶれ対策） */
  trialsPerWork: number;
  /** 並列 Worker 数 */
  parallelCount: number;
  /** Phase 1: null（自動生成）。Phase 2: 上位N件の ParamSet ID 一覧 */
  paramSetIds?: string[] | null;
  /** Phase 2 の拡大サンプル数（例: 200, 500） */
  expandedSampleSize?: number;
}

/** 1 つの ParamSet × 1 つの ambiguityLevel の集計結果 */
export interface ParamSetLevelResult {
  paramSetId: string;
  ambiguityLevel: number;
  totalTrials: number;
  successCount: number;
  successRate: number;
  avgQuestionsOnSuccess: number;
  avgQuestionsAll: number;

  // Confirm バランス指標
  softConfirmTotal: number;
  hardConfirmTotal: number;
  softHardRatio: number;            // soft / (soft + hard)
  hardBurstRate: number;            // 直近5問中HARDが3問以上のステップ割合

  // 早期失敗指標
  earlyExitCount: number;
  earlyExitFalsePositiveCount: number;  // 誤切り: 早期失敗したがBaselineでは成功
  missedEarlyExitCount: number;         // 見逃し: 早期失敗せず結局FAIL_LIST

  // 質問リズム指標
  rhythmScore: number;                  // 0-1。§7.7 参照

  // 終了理由の内訳
  endedByBreakdown: Record<string, number>;
}

/** ScoreCard: 全ノイズレベルを統合した ParamSet の総合評価 */
export interface ScoreCard {
  paramSetId: string;
  paramSet: ParamSet;
  levelResults: ParamSetLevelResult[];

  // 加重統合メトリクス
  weightedSuccessRate: number;
  weightedAvgQuestions: number;
  weightedSoftHardRatio: number;
  weightedHardBurstRate: number;
  weightedFalsePositiveRate: number;
  weightedMissedEarlyExitRate: number;
  weightedRhythmScore: number;

  /** 総合スコア（高いほど良い）。§7.8 の計算式 */
  totalScore: number;
  /** 順位（1 が最良） */
  rank: number;
}

/** Sweep 全体の結果 */
export interface SweepResult {
  sweepId: string;
  phase: 1 | 2;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  sampleSize: number;
  ambiguityLevels: number[];
  trialsPerWork: number;
  totalSimulations: number;       // ParamSet数 × サンプル数 × ノイズレベル数 × trials
  paramSetCount: number;

  scoreCards: ScoreCard[];        // rank 順
  baselineScoreCard: ScoreCard;   // Baseline（早期失敗OFF、現行Confirmパラメータ）

  /** Phase 2 への推奨 ParamSet ID（Phase 1 の場合のみ） */
  recommendedForPhase2?: string[];
}

/** 進捗（ポーリング用） */
export interface SweepProgress {
  sweepId: string;
  phase: 1 | 2;
  status: 'running' | 'completed' | 'error';
  /** 完了した ParamSet 数 / 全 ParamSet 数 */
  paramSetsDone: number;
  paramSetsTotal: number;
  /** 完了したシミュレーション数 */
  simulationsDone: number;
  simulationsTotal: number;
  /** 現在処理中の ParamSet ID */
  currentParamSetId: string | null;
  elapsedSeconds: number;
  estimatedRemainingSeconds: number | null;
  /** エラーがあれば */
  errorMessage?: string;
  /** 完了済みなら結果へのパス */
  resultPath?: string;
}
```

---

## 6. パラメータセット生成（`src/server/simulation/paramSetGenerator.ts`）

### 6.1 Phase 1: 粗探索グリッド

全組み合わせではなく、**影響が大きい軸を中心に間引いたグリッド**を生成する。

```typescript
export function generatePhase1ParamSets(): ParamSet[] {
  const sets: ParamSet[] = [];
  let id = 1;

  // --- Confirm バランス軸 ---
  const confirmConfigs = [
    // [bandLower, bandUpper, hardConfidenceMin, injectionRatio]
    [0.25, 0.70, 0.45, 0.10],  // 現行
    [0.25, 0.55, 0.50, 0.05],  // SOFT 増: バンド上限を下げ、HARD 閾値を上げ、注入を減らす
    [0.25, 0.55, 0.55, 0.00],  // SOFT 最大: 注入ゼロ
    [0.20, 0.60, 0.50, 0.05],  // バンド下限も下げる
    [0.30, 0.65, 0.50, 0.10],  // バンド下限を上げる（序盤 Confirm を減らす）
    [0.25, 0.50, 0.60, 0.00],  // 極端: HARD は確度 0.6 以上のみ
  ];

  // --- 早期失敗軸 ---
  const earlyExitConfigs = [
    // reviewIndices, { q25, q30, q35 }
    {
      reviewIndices: [25, 30, 35],
      label: 'current',
      thresholds: {
        q25: { minConfidence: 0.22, maxEffectiveCandidates: 15 },
        q30: { minConfidence: 0.18, maxEffectiveCandidates: 20 },
        q35: { minConfidence: 0.15, maxEffectiveCandidates: 25 },
      },
    },
    {
      reviewIndices: [25, 30, 35],
      label: 'strict',
      thresholds: {
        q25: { minConfidence: 0.26, maxEffectiveCandidates: 12 },
        q30: { minConfidence: 0.22, maxEffectiveCandidates: 18 },
        q35: { minConfidence: 0.18, maxEffectiveCandidates: 22 },
      },
    },
    {
      reviewIndices: [25, 30, 35],
      label: 'loose',
      thresholds: {
        q25: { minConfidence: 0.18, maxEffectiveCandidates: 20 },
        q30: { minConfidence: 0.14, maxEffectiveCandidates: 25 },
        q35: { minConfidence: 0.12, maxEffectiveCandidates: 30 },
      },
    },
    {
      reviewIndices: [25, 30, 35],
      label: 'tight-narrow',
      thresholds: {
        q25: { minConfidence: 0.20, maxEffectiveCandidates: 10 },
        q30: { minConfidence: 0.16, maxEffectiveCandidates: 15 },
        q35: { minConfidence: 0.13, maxEffectiveCandidates: 20 },
      },
    },
    {
      reviewIndices: [25, 30, 35],
      label: 'wide-narrow',
      thresholds: {
        q25: { minConfidence: 0.20, maxEffectiveCandidates: 25 },
        q30: { minConfidence: 0.16, maxEffectiveCandidates: 30 },
        q35: { minConfidence: 0.13, maxEffectiveCandidates: 35 },
      },
    },
    {
      reviewIndices: [25, 30, 35],
      label: 'aggressive-q25',
      thresholds: {
        q25: { minConfidence: 0.30, maxEffectiveCandidates: 20 },
        q30: { minConfidence: 0.20, maxEffectiveCandidates: 22 },
        q35: { minConfidence: 0.15, maxEffectiveCandidates: 25 },
      },
    },
  ];

  for (const confirm of confirmConfigs) {
    for (const earlyExit of earlyExitConfigs) {
      sets.push({
        id: `ps_${String(id).padStart(3, '0')}`,
        label: `C[${confirm[0]}-${confirm[1]}]H${confirm[2]}I${confirm[3]}_E-${earlyExit.label}`,
        confidenceConfirmBandLower: confirm[0],
        confidenceConfirmBandUpper: confirm[1],
        hardConfidenceMin: confirm[2],
        hardConfirmInjectionRatio: confirm[3],
        reviewIndices: earlyExit.reviewIndices,
        earlyExitThresholds: earlyExit.thresholds,
      });
      id++;
    }
  }

  return sets;
  // 6 × 6 = 36 パターン
}
```

**36 パターン × 100 作品 × 3 ノイズレベル × 3 trials = 32,400 シミュ実行**（Baseline 含むとさらに増加）。  
並列 Worker 数は環境により **1〜CPU コア数** に制限される（`defaultParallelCount`）。**20 並列を前提にしない**。所要時間は **数時間〜一晩** になることを想定し、進捗は `bulk-job-status` の `optimizeProgress` と右下パネルで確認する。

### 6.2 Baseline（特殊 ParamSet）

Baseline は **早期失敗 OFF、現行 Confirm パラメータ** で走らせる。
Sweep 開始時に最初に実行し、結果をキャッシュする。
誤切り率（False Positive）の計算に使う。

```typescript
export function getBaselineParamSet(): ParamSet {
  return {
    id: 'baseline',
    label: 'Baseline (earlyExit OFF, current confirm)',
    confidenceConfirmBandLower: 0.25,
    confidenceConfirmBandUpper: 0.70,
    hardConfidenceMin: 0.45,
    hardConfirmInjectionRatio: 0.10,
    reviewIndices: [],              // 空 → earlyExitReview.enabled=false 相当
    earlyExitThresholds: {},
  };
}
```

---

## 7. 評価指標（`src/server/simulation/scoreCalculator.ts`）

### 7.1 成功率

```
successRate = successCount / totalTrials
```

### 7.2 平均質問数（成功時）

```
avgQuestionsOnSuccess = sum(questionCount for success trials) / successCount
```

成功がゼロの場合は `Infinity`（スコア計算時にペナルティ）。

### 7.3 SOFT/HARD 比率

各シミュの steps から kind をカウント：

```
softTotal = count(step.question.kind === 'SOFT_CONFIRM')
hardTotal = count(step.question.kind === 'HARD_CONFIRM')
softHardRatio = softTotal / max(1, softTotal + hardTotal)
```

### 7.4 HARD 連打率（hardBurstRate）

「直近 5 問中 HARD_CONFIRM が 3 問以上」のステップ数を、全ステップ数で割る。

```typescript
function calcHardBurstRate(steps: SimulationStep[]): number {
  const kinds = steps.map(s => s.question.kind);
  let burstSteps = 0;
  for (let i = 4; i < kinds.length; i++) {
    const window = kinds.slice(i - 4, i + 1);
    const hardCount = window.filter(k => k === 'HARD_CONFIRM').length;
    if (hardCount >= 3) burstSteps++;
  }
  return kinds.length > 4 ? burstSteps / (kinds.length - 4) : 0;
}
```

### 7.5 誤切り率（earlyExitFalsePositiveRate）

**定義**: ParamSet X で早期失敗したが、Baseline（早期失敗 OFF）では成功した件数。

```
falsePositiveRate = falsePositiveCount / totalTrials
```

算出方法:
1. Baseline を先に全サンプル×全ノイズで走らせ、各 (workId, trial, ambiguity) の成否を `Map<string, boolean>` にキャッシュ
2. ParamSet X の結果で `outcome === 'FAIL_LIST' && diagnostic.endedBy === 'EARLY_FAIL_REVIEW'` の場合、同じキーで Baseline を引き、`baseline.success === true` なら False Positive

**乱数の同期について**: `pickAnswerFromAmbiguity` は `Math.random()` を使うため、同一 (workId, ambiguity, trial) でも Baseline と ParamSet で質問順序が変わればノイズの位置も変わる。**厳密な対照実験は難しいが、100作品×3trials の統計で十分に傾向は見える。** 精度を上げたい場合は `trialsPerWork: 5` にする。

### 7.6 見逃し率（missedEarlyExitRate）

**定義**: 早期失敗しなかったが、結局 FAIL_LIST（MAX_QUESTIONS 等）で終わった件数。

```
missedEarlyExitRate = missedCount / totalTrials
```

これは各 ParamSet の結果だけで算出可能（Baseline 不要）。

### 7.7 質問リズムスコア（rhythmScore）

理想フロー: **前半 EXPLORE → 中盤 SOFT_CONFIRM 混在 → 後半 HARD_CONFIRM 要所 → REVEAL**

各シミュの steps を3等分（前半/中盤/後半）し、以下を加算：

```
rhythmScore = (
  0.3 * (中盤のSOFT比率)          // 中盤にSOFTが多いほど良い
+ 0.3 * (1 - 後半のHARD連打率)    // 後半にHARD連打が少ないほど良い
+ 0.2 * (前半のEXPLORE比率)       // 前半はEXPLOREが多いほど良い
+ 0.2 * (REVEAL直前がHARDかSOFT)  // 断定の直前にConfirmがあると良い
)
```

各項は 0-1 にクリップ。

```typescript
function calcRhythmScore(steps: SimulationStep[]): number {
  if (steps.length < 6) return 0.5; // 短すぎる場合はニュートラル

  const quizSteps = steps.filter(s => s.question.kind !== 'REVEAL');
  const third = Math.ceil(quizSteps.length / 3);
  const early = quizSteps.slice(0, third);
  const mid = quizSteps.slice(third, third * 2);
  const late = quizSteps.slice(third * 2);

  const earlyExploreRatio = early.filter(s => s.question.kind === 'EXPLORE_TAG').length / Math.max(1, early.length);

  const midSoftRatio = mid.filter(s => s.question.kind === 'SOFT_CONFIRM').length / Math.max(1, mid.length);

  const lateHardBurst = calcHardBurstRateForSlice(late);

  // REVEAL 直前のステップ
  const revealIdx = steps.findIndex(s => s.question.kind === 'REVEAL');
  const preReveal = revealIdx > 0 ? steps[revealIdx - 1] : null;
  const preRevealBonus = preReveal && (preReveal.question.kind === 'HARD_CONFIRM' || preReveal.question.kind === 'SOFT_CONFIRM') ? 1.0 : 0.0;

  return Math.min(1, Math.max(0,
    0.3 * midSoftRatio +
    0.3 * (1 - lateHardBurst) +
    0.2 * earlyExploreRatio +
    0.2 * preRevealBonus
  ));
}
```

### 7.8 総合スコア（totalScore）

ノイズレベルごとの結果を加重平均し、最終スコアを算出。

**ノイズレベルの重み**（実プレイの体感分布を想定）:

| ambiguityLevel | 重み | 理由 |
|---|---|---|
| 1（ノイズなし） | 0.2 | 理想条件。全 ParamSet で差が小さい |
| 3（軽いノイズ） | 0.4 | 最も実プレイに近い |
| 5（中ノイズ） | 0.4 | 曖昧な記憶のユーザーを代表 |

**メトリクス加重**:

```
totalScore =
    0.30 * weightedSuccessRate
  + 0.15 * (1 - normalize(weightedAvgQuestions, 10, 40))    // 少ないほど高スコア
  + 0.10 * weightedSoftHardRatio
  + 0.10 * (1 - weightedHardBurstRate)
  + 0.15 * (1 - weightedFalsePositiveRate)                  // 誤切りペナルティ
  + 0.10 * (1 - weightedMissedEarlyExitRate)                // 見逃しペナルティ
  + 0.10 * weightedRhythmScore
```

`normalize(val, min, max)` = `clamp((val - min) / (max - min), 0, 1)`

**配点の意図**:
- 成功率が最重要（0.30）
- 誤切り防止も高い（0.15）：成功できたはずのゲームを打ち切る損失は大きい
- 平均質問数（0.15）：有名作品を早く当てる目標
- Confirm バランスと体験は合計 0.30：ゲームの楽しさ

---

## 8. オーケストレーション（`src/server/simulation/thresholdOptimizer.ts`）

### 8.1 メイン関数

```typescript
export async function runSweep(
  request: SweepRequest,
  sharedContext: SharedBatchContext,
  workTagMatrixData: ReturnType<typeof getWorkTagMatrix>,
  tagCacheData: CachedTag[],
  simWorkDataEntries: [string, SimWorkData][],
  onProgress: (progress: SweepProgress) => void
): Promise<SweepResult>
```

### 8.2 実行フロー

```
1. サンプル workIds を取得（GET /api/admin/simulate?sampleSize=N と同じロジック）
2. Baseline を実行
   - earlyExitReview.enabled = false にした config で全サンプル×全ノイズ×全trials
   - 結果を baselineMap: Map<string, boolean> にキャッシュ
     キー: `${workId}_${ambiguityLevel}_${trialIndex}`
   - ※乱数のため trial ごとの対応は取れない。
     代わりに baselineSuccessRate を workId × ambiguity 単位で集計し、
     誤切り判定は「Baseline の成功率 > 0.5 なのに ParamSet で早期失敗」で判定
3. 各 ParamSet について:
   a. config を上書き（§8.3 参照）
   b. 全サンプル × 全ノイズ × 全trials を runSimulationBatch で実行
      - 既存の runSimulationInWorker をそのまま使用
      - ただし config は上書き済みのものを渡す
   c. 結果から ParamSetLevelResult を算出（ノイズレベルごと）
   d. Baseline との比較で誤切り率を算出
   e. ScoreCard を生成
   f. onProgress で進捗通知
4. 全 ScoreCard を totalScore 降順でソートし、rank を付与
5. Phase 1 の場合: 上位 5 件を recommendedForPhase2 に設定
6. 結果を JSON ファイルに保存
```

### 8.3 config 上書きロジック

```typescript
function applyParamSetToConfig(
  baseConfig: MvpConfig,
  paramSet: ParamSet
): MvpConfig {
  // deep clone
  const config = JSON.parse(JSON.stringify(baseConfig));

  // Confirm バランス
  config.confirm.confidenceConfirmBand = [
    paramSet.confidenceConfirmBandLower,
    paramSet.confidenceConfirmBandUpper,
  ];
  config.confirm.hardConfidenceMin = paramSet.hardConfidenceMin;
  config.flow.hardConfirmInjectionRatio = paramSet.hardConfirmInjectionRatio;

  // 早期失敗
  if (paramSet.reviewIndices.length === 0) {
    config.flow.earlyExitReview.enabled = false;
  } else {
    config.flow.earlyExitReview.enabled = true;
    config.flow.earlyExitReview.reviewIndices = paramSet.reviewIndices;
    // thresholds を上書き（q40 は残すが reviewIndices に無ければ参照されない）
    for (const [key, value] of Object.entries(paramSet.earlyExitThresholds)) {
      config.flow.earlyExitReview.thresholds[key] = {
        ...config.flow.earlyExitReview.thresholds[key],
        ...value,
      };
    }
  }

  return config;
}
```

**重要**: `runSimulation` は第4引数で config を受け取るため、上書きした config をそのまま渡せる。`getMvpConfig()` をグローバルに変更する必要はない。

### 8.4 バッチ実行の詳細

既存の `runSimulationInWorker` を利用するが、**config を Worker に渡す方法**に注意。

現行の `simulationWorker.ts` は `getMvpConfig()` を内部で呼んでいる。これを上書きするため、**Worker に config JSON を SharedArrayBuffer 経由で渡し、Worker 側で `setOverrideConfig` するか、あるいは `runSimulation` の config 引数をそのまま使う形にする必要がある。**

**推奨アプローチ**: `WorkerInput` に `configOverrideJson` を追加し、Worker 側で parse する。

**simulationWorker.ts の変更（3箇所）**:

```typescript
// 1. WorkerInput に追加（L16-23）
interface WorkerInput {
  tasks: Array<{ targetWorkId: string; trial: number }>;
  level: number;
  aiGateChoice: string;
  includePerf: boolean;
  sharedBuffer: SharedArrayBuffer;
  taskIndexBuffer: SharedArrayBuffer;
  configOverrideJson?: string;       // ← 追加
}

// 2. main() 内の config 取得を変更（L68）
// Before: const config = getMvpConfig();
// After:
const config = input.configOverrideJson
  ? JSON.parse(input.configOverrideJson)
  : getMvpConfig();

// 3. 変更なし: L93 の runSimulation(targetWorkId, level, aiGateChoice, config, ...) はそのまま
```

**simulate/route.ts の runSimulationInWorker 変更（1箇所）**:

```typescript
// 引数に configOverride を追加
async function runSimulationInWorker(opts: {
  // ... 既存フィールド
  configOverride?: MvpConfig;       // ← 追加
}): Promise<...> {
  // Worker 起動時の workerData に含める
  const worker = new Worker(workerPath, {
    workerData: {
      tasks,
      level,
      aiGateChoice,
      includePerf,
      sharedBuffer,
      taskIndexBuffer,
      configOverrideJson: opts.configOverride
        ? JSON.stringify(opts.configOverride)
        : undefined,
    } satisfies WorkerInput,
    // ...
  });
}
```

既存のバッチシミュでは `configOverride` を渡さないため、`configOverrideJson` は `undefined` → Worker は従来どおり `getMvpConfig()` を使う。**後方互換性は完全に維持される。**

### 8.5 Baseline との誤切り判定（詳細）

乱数同期が取れないため、以下の統計的アプローチを採用：

```typescript
// Baseline 集計: workId × ambiguityLevel → 成功率
type BaselineStats = Map<string, { successCount: number; totalTrials: number }>;

function buildBaselineStats(
  baselineResults: SimulationResult[],
  ambiguityLevels: number[],
  trialsPerWork: number
): BaselineStats {
  const stats: BaselineStats = new Map();
  for (const r of baselineResults) {
    // キーは workId_ambiguity（trial は統計で吸収）
    const key = `${r.targetWorkId}_${/* ambiguityLevel は結果に含まれないため、
       実行時に ambiguity 単位でバッチを分けてキーを付与する */}`;
    const entry = stats.get(key) ?? { successCount: 0, totalTrials: 0 };
    entry.totalTrials++;
    if (r.success) entry.successCount++;
    stats.set(key, entry);
  }
  return stats;
}

// 誤切り判定
function isFalsePositive(
  result: SimulationResult,
  ambiguityLevel: number,
  baselineStats: BaselineStats
): boolean {
  if (result.outcome !== 'FAIL_LIST') return false;
  if (result.diagnostic?.endedBy !== 'EARLY_FAIL_REVIEW') return false;
  const key = `${result.targetWorkId}_${ambiguityLevel}`;
  const baseline = baselineStats.get(key);
  if (!baseline) return false;
  // Baseline で 50% 以上成功している作品なら「本来は成功できた」と見なす
  return baseline.successCount / baseline.totalTrials >= 0.5;
}
```

**実装上のポイント**: ambiguityLevel 単位でバッチを分けて実行し、結果に ambiguityLevel を紐付ける。`SimulationResult` 型には ambiguityLevel が入っていないため、呼び出し側でラップする。

```typescript
interface TaggedSimulationResult extends SimulationResult {
  ambiguityLevel: number;
  trialIndex: number;
}
```

---

## 9. API ルート（`src/app/api/admin/threshold-optimize/route.ts`）

### 9.1 POST: Sweep 開始

```typescript
export async function POST(request: Request) {
  // 1. 認証（x-eronator-admin-token）
  // 2. リクエストボディを SweepRequest として parse
  // 3. 既存の sharedContext 構築ロジックを simulate/route.ts から抽出して共用
  //    （allWorks, workTitleMap, workDetailMap, workTagMap, matrix, tagCache, simWorkData）
  // 4. runSweep を呼ぶ（非同期。進捗は progressStore に格納）
  // 5. sweepId を即座に返す
  return NextResponse.json({ sweepId, status: 'started' });
}
```

**長時間リクエストの扱い**: `runSweep` を `Promise` で非同期実行し、進捗を `progressStore`（既存の `src/server/bulk/progressStore.ts` を拡張）に書き込む。クライアントは GET でポーリング。

### 9.2 GET: 進捗・結果取得

```typescript
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sweepId = searchParams.get('sweepId');

  if (sweepId) {
    // 特定の Sweep の進捗 or 完了結果を返す
    // 進捗は progressStore から
    // 完了済みなら data/threshold-optimize-results/{sweepId}.json を読む
  } else {
    // 過去の Sweep 一覧を返す（ディレクトリスキャン）
  }
}
```

---

## 10. UI（`src/app/admin/tags/page.tsx` への追加）

### 10.1 タブ追加

`TabType` に `'optimize'` を追加。ボタンラベル: `閾値最適化`

### 10.2 UI 要素（最小限）

```
┌─────────────────────────────────────────────┐
│ 閾値最適化シミュレーション                      │
├─────────────────────────────────────────────┤
│ Phase: [1: 粗探索 ▼]                         │
│ サンプル数: [100]  ノイズ: [1,3,5]  試行: [3] │
│ [▶ Sweep 開始]                               │
├─────────────────────────────────────────────┤
│ 進捗: ParamSet 12/36 | シミュ 3,600/32,400   │
│ ████████░░░░░░░░░░░░ 33%  残り約 8分          │
├─────────────────────────────────────────────┤
│ 結果ランキング（完了後表示）                    │
│ #1 ps_015 Score:0.82 成功率:87% 平均Q:22 ...  │
│ #2 ps_008 Score:0.79 成功率:85% 平均Q:21 ...  │
│ #3 ps_022 Score:0.78 成功率:86% 平均Q:24 ...  │
│ ...                                          │
│ Baseline: Score:0.71 成功率:83% 平均Q:28 ...  │
├─────────────────────────────────────────────┤
│ [Phase 2: 上位5件で拡大検証 (200件)]           │
│ [結果JSONダウンロード]                         │
└─────────────────────────────────────────────┘
```

### 10.3 Phase 2 の自動遷移

Phase 1 完了後、「Phase 2 実行」ボタンを表示。クリックすると:
- `recommendedForPhase2` の ParamSet ID を使用
- `expandedSampleSize: 200`（または 500）
- `trialsPerWork: 5`（精度向上）

**完全自動化オプション**: SweepRequest に `autoPhase2: true` フラグを用意。Phase 1 完了後に自動で Phase 2 に移行する。サンプル数は `autoPhase2SampleSize: 200` で指定。

```typescript
export interface SweepRequest {
  // ... 既存フィールド
  /** Phase 1 完了後に自動で Phase 2 を開始 */
  autoPhase2?: boolean;
  /** Phase 2 の拡大サンプル数 */
  autoPhase2SampleSize?: number;
  /** Phase 2 の上位何件を採用するか */
  autoPhase2TopN?: number;
}
```

---

## 11. 結果ファイル

### 11.1 保存先

`data/threshold-optimize-results/sweep-{sweepId}.json`

### 11.2 フォーマット

`SweepResult` 型をそのまま JSON 化。ただし個別の SimulationResult（steps 含む）は巨大になるため、**ScoreCard レベルの集計のみ保存**。個別ステップが必要な場合はドリルダウン用に別ファイルに保存する（オプション）。

---

## 12. 実装順序

### Step 1: 型定義とパラメータ生成（所要: 小）
1. `src/types/thresholdOptimizer.ts` を作成
2. `src/server/simulation/paramSetGenerator.ts` を作成

### Step 2: scoreCalculator（所要: 中）
1. `src/server/simulation/scoreCalculator.ts` を作成
2. 各メトリクスの計算関数を実装
3. 総合スコアの計算を実装

### Step 3: Worker への config 注入（所要: 小）
1. `src/server/simulation/simulationWorker.ts` に `configOverride` 対応を追加
2. `src/app/api/admin/simulate/route.ts` の `runSimulationInWorker` に `configOverride` 引数を追加
3. **既存バッチシミュが壊れていないことを確認**（`configOverride` 未指定で従来動作）

### Step 4: thresholdOptimizer（所要: 中〜大）
1. `src/server/simulation/thresholdOptimizer.ts` を作成
2. Baseline 実行、ParamSet ループ、ScoreCard 生成
3. Phase 1→2 自動遷移

### Step 5: API ルート（所要: 中）
1. `src/app/api/admin/threshold-optimize/route.ts` を作成
2. 進捗管理（progressStore 拡張）
3. 結果ファイル保存

### Step 6: UI（所要: 中）
1. `page.tsx` にタブ追加
2. 開始ボタン、進捗表示、結果テーブル
3. Phase 2 ボタン

### Step 7: 動作確認と調整
1. Phase 1 を 100 作品で実行
2. 結果のランキングを確認
3. Phase 2 を 200→500 作品で実行
4. 最終的な最適 ParamSet を特定

---

## 13. sharedContext 構築の共通化

現在 `simulate/route.ts` の PUT ハンドラ内にある sharedContext 構築ロジック（allWorks 取得、workDetailMap 構築、workTagMap 構築、行列ロード、タグキャッシュ等）は、`threshold-optimize/route.ts` でも同じものが必要。

**推奨**: `src/server/simulation/sharedContextBuilder.ts` に抽出する。

```typescript
export async function buildSharedBatchContext(): Promise<{
  sharedContext: SharedBatchContext;
  workTagMatrixData: ReturnType<typeof getWorkTagMatrix>;
  tagCacheData: CachedTag[];
  simWorkDataEntries: [string, SimWorkData][];
}> {
  // simulate/route.ts の PUT 内にある構築ロジックをそのまま移動
}
```

既存の `simulate/route.ts` もこの関数を呼ぶようにリファクタする（任意。影響範囲を最小にしたければ、`threshold-optimize/route.ts` 側でのみ使ってもよい）。

---

## 14. 注意事項

### 14.1 日本語ファイル編集

`page.tsx` は日本語を含む。`.cursor/rules/safe-file-operations.mdc` に従い、**StrReplace ではなく Python スクリプト経由で編集**すること。ただし、タブ追加は page.tsx の英語部分（TabType 定義等）と新しい JSX ブロックの追加が主なので、日本語リテラルを含む行を `old_string` にしなければ StrReplace でも安全。**日本語を含む行を old_string に含めない** ことを厳守。

### 14.2 Worker バンドルの再ビルド

`simulationWorker.ts` を変更した場合、`dist/simulationWorker.js` の再ビルドが必要。`ensureWorkerBundle()` がソースの mtime を見て自動再ビルドするため、通常は意識不要。ただし `configOverride` 対応を入れた後は **一度手動で `npx esbuild` を走らせるか、dev サーバーを再起動** してバンドルを更新すること。

### 14.3 Zod スキーマ

`config/schema.ts` の `FlowSchema` は `earlyExitReview.thresholds` に `q25`, `q30`, `q35`, `q40` を strict で要求する。`reviewIndices` を `[25,30,35]` にしても `q40` キーは thresholds に残す必要がある（使われないだけ）。`applyParamSetToConfig` で `q40` を消さないこと。

### 14.4 進捗のポーリング

既存の `GET /api/admin/bulk-job-status` と `progressStore` の仕組みを確認し、`optimize` ジョブ用のキーを追加するのが最も安全。新しいポーリングエンドポイントを作る必要はない。

---

## 15. 将来拡張（本 Sweep の範囲外）

- **「DB にない作品」シミュ**: ダミーワーク（既存作品のタグを部分コピー＋タイトル変更）を SharedBatchContext に注入して走らせる。ParamSet には含めず、別の Sweep タイプとして実装。
- **自動パラメータ探索**: グリッドサーチではなくベイズ最適化（Optuna 的）。Phase 1 の結果から有望領域を推定し、次の ParamSet を動的生成。
- **A/B テスト連携**: 最適 ParamSet を `mvpConfig.json` に書き出す CLI コマンド。

---

## 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026-04-06 | 初版 |
