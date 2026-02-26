/**
 * シミュレーション計測用ユーティリティ
 *
 * 有効化: リクエストで includePerf: true を指定（推奨）
 * または環境変数 SIMULATION_PERF=1
 *
 * 計測結果は API レスポンスの perfSummary に含まれる
 */

import { AsyncLocalStorage } from 'async_hooks';

const accumulatorStorage = new AsyncLocalStorage<PerfAccumulator>();

/** 計測するか（AsyncLocalStorage に acc があるか、または env 有効） */
function shouldCollect(): boolean {
  return !!accumulatorStorage.getStore() || process.env.SIMULATION_PERF === '1';
}

export function perfStart(_label: string): number | null {
  return shouldCollect() ? Date.now() : null;
}

export function perfEnd(label: string, start: number | null): void {
  const currentAccumulator = accumulatorStorage.getStore();
  if (start !== null && currentAccumulator) {
    const ms = Date.now() - start;
    if (label === 'runSimulation') {
      currentAccumulator.runSimulation = ms;
    } else {
      const key = label as keyof PerfAccumulator;
      if (key in currentAccumulator) {
        currentAccumulator[key] += ms;
      }
    }
  }
}

/** 1シミュレーション分の集計用 */
export interface PerfAccumulator {
  runSimulation: number;
  fetchWorkTags: number;
  selectNextQuestion: number;
  processAnswer: number;
  tagCoverage: number;
  other: number;
  // selectNextQuestion 内訳
  buildUsedTagKeysFromHistory: number;
  selectUnifiedExploreOrSummary: number;
  selectExploreQuestion: number;
  selectNextQuestion_confirm: number;
  tryGetHardConfirmQuestion: number;
  tryEmergencyExploreFallback: number;
}

/** includePerf が true のときは env に依存せず作成 */
export function createPerfAccumulator(includePerf?: boolean): PerfAccumulator | null {
  if (includePerf || process.env.SIMULATION_PERF === '1') {
    return {
      runSimulation: 0,
      fetchWorkTags: 0,
      selectNextQuestion: 0,
      processAnswer: 0,
      tagCoverage: 0,
      other: 0,
      buildUsedTagKeysFromHistory: 0,
      selectUnifiedExploreOrSummary: 0,
      selectExploreQuestion: 0,
      selectNextQuestion_confirm: 0,
      tryGetHardConfirmQuestion: 0,
      tryEmergencyExploreFallback: 0,
    };
  }
  return null;
}

/** レスポンス用に整形 */
export function toPerfSummary(acc: PerfAccumulator | null): Record<string, number> | undefined {
  if (!acc) return undefined;
  return {
    runSimulation: acc.runSimulation,
    selectNextQuestion: acc.selectNextQuestion,
    processAnswer: acc.processAnswer,
    fetchWorkTags: acc.fetchWorkTags,
    tagCoverage: acc.tagCoverage,
    other: acc.other,
    buildUsedTagKeysFromHistory: acc.buildUsedTagKeysFromHistory,
    selectUnifiedExploreOrSummary: acc.selectUnifiedExploreOrSummary,
    selectExploreQuestion: acc.selectExploreQuestion,
    selectNextQuestion_confirm: acc.selectNextQuestion_confirm,
    tryGetHardConfirmQuestion: acc.tryGetHardConfirmQuestion,
    tryEmergencyExploreFallback: acc.tryEmergencyExploreFallback,
  };
}

/**
 * シミュレーションを実行する。acc を AsyncLocalStorage に設定して fn を実行し、
 * 終了時にクリアする。バッチ並列時も各コンテキストで正しく分離される。
 */
export function runWithPerfAccumulator<T>(
  acc: PerfAccumulator | null,
  fn: () => T | Promise<T>
): T | Promise<T> {
  if (acc) {
    return accumulatorStorage.run(acc, fn) as T | Promise<T>;
  }
  return fn();
}

export function logPerfSummary(_acc: PerfAccumulator | null, _targetWorkId: string): void {
  // ターミナルへの詳細出力は無効化（パフォーマンス・ノイズ削減）
}
