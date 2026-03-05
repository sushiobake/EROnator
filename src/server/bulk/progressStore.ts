/**
 * バックグラウンド一括処理の進捗管理
 * インメモリ保持 + フェーズ別の同時追跡 + 完了結果保持 + 予約キュー
 */

import * as fs from 'fs';
import * as path from 'path';

export type BulkJobStatus = 'idle' | 'running' | 'done' | 'error';

const CANCEL_FILE = path.join(process.cwd(), 'data', 'bulk-cancel-requested');

export type RoundTiming = { round: number; elapsedSec: number };

export type PhaseProgress = {
  done: number;
  total: number;
  round?: number;
  roundTotal?: number;
  currentWorkId?: string;
  detail?: string;
  startedAt?: string;
  roundTimings?: RoundTiming[];
};

export type BulkProgress = {
  jobId: string;
  status: BulkJobStatus;
  phase: 'comment' | 'phase0' | 'phase12';
  done: number;
  total: number;
  round?: number;
  roundTotal?: number;
  currentWorkId?: string;
  detail?: string;
  errorCount?: number;
  errors?: string[];
  startedAt: string;
  updatedAt: string;
  error?: string;
  phases?: {
    comment?: PhaseProgress;
    phase0?: PhaseProgress;
    phase12?: PhaseProgress;
  };
};

export type QueuedJob = {
  count: number;
  queuedAt: string;
};

export type CancelState = 'none' | 'requesting' | 'cancelled';

export type SimProgress = {
  done: number;
  total: number;
  startedAt: string;
};

let _progress: BulkProgress | null = null;
let _simProgress: SimProgress | null = null;
let _lastCompleted: (BulkProgress & { completedAt: string }) | null = null;
let _lastCompletedAt = 0;
let _queuedJob: QueuedJob | null = null;
let _cancelState: CancelState = 'none';

const COMPLETED_RETENTION_MS = 30 * 60 * 1000; // 30分保持

// 完了直後も progress を返し続ける（クライアントが確実に受け取るまで）
let _completedProgressHoldUntil = 0;
let _completedProgress: BulkProgress | null = null;

export function readBulkProgress(): BulkProgress | null {
  if (_progress) return _progress;
  if (_completedProgress && Date.now() < _completedProgressHoldUntil) {
    return _completedProgress;
  }
  _completedProgress = null;
  return null;
}

export function readLastCompleted(): (BulkProgress & { completedAt: string }) | null {
  if (!_lastCompleted) return null;
  if (Date.now() - _lastCompletedAt > COMPLETED_RETENTION_MS) {
    _lastCompleted = null;
    return null;
  }
  return _lastCompleted;
}

export function writeBulkProgress(data: BulkProgress): void {
  const now = new Date().toISOString();
  _progress = { ...data, updatedAt: now };
}

export function completeBulkProgress(data: BulkProgress): void {
  const now = new Date().toISOString();
  const completed = { ...data, status: 'done' as BulkJobStatus, updatedAt: now, completedAt: now };
  _lastCompleted = completed;
  _lastCompletedAt = Date.now();
  // 完了後 30 秒間は progress として返し続ける（ポーリングが確実に受信するまで）
  _completedProgress = { ...completed };
  _completedProgressHoldUntil = Date.now() + 30_000;
  _progress = null;
  _cancelState = data.status === 'error' && data.error?.includes('停止') ? 'cancelled' : 'none';
}

export function updatePhaseProgress(
  jobId: string,
  phase: 'comment' | 'phase0' | 'phase12',
  phaseData: PhaseProgress
): void {
  if (!_progress || _progress.jobId !== jobId) return;
  if (!_progress.phases) _progress.phases = {};
  const prev = _progress.phases[phase];
  _progress.phases[phase] = { ...prev, ...phaseData, roundTimings: phaseData.roundTimings ?? prev?.roundTimings };
  _progress.phase = phase;
  _progress.done = phaseData.done;
  _progress.total = phaseData.total;
  _progress.round = phaseData.round;
  _progress.roundTotal = phaseData.roundTotal;
  _progress.currentWorkId = phaseData.currentWorkId;
  _progress.detail = phaseData.detail;
  _progress.updatedAt = new Date().toISOString();
}

export function appendPhaseRoundTiming(
  jobId: string,
  phase: 'comment' | 'phase0' | 'phase12',
  round: number,
  elapsedSec: number
): void {
  if (!_progress || _progress.jobId !== jobId) return;
  if (!_progress.phases) _progress.phases = {};
  const prev = _progress.phases[phase];
  const existingTimings = prev?.roundTimings ?? [];
  const timings = [...existingTimings, { round, elapsedSec }];
  if (prev) {
    prev.roundTimings = timings;
  } else {
    _progress.phases[phase] = { done: 0, total: 0, roundTimings: timings };
  }
  _progress.updatedAt = new Date().toISOString();
}

export function clearBulkProgress(): void {
  _progress = null;
}

// --- シミュレーション進捗（ローカル専用・メモリ保持） ---

export function setSimProgress(done: number, total: number, startedAt?: string): void {
  _simProgress = {
    done,
    total,
    startedAt: startedAt ?? new Date().toISOString(),
  };
}

export function getSimProgress(): SimProgress | null {
  return _simProgress;
}

export function clearSimProgress(): void {
  _simProgress = null;
}

// --- 予約キュー ---

export function queueNextJob(count: number): { success: boolean; message: string } {
  if (_queuedJob) {
    return { success: false, message: `既に${_queuedJob.count}件の予約があります` };
  }
  _queuedJob = { count, queuedAt: new Date().toISOString() };
  return { success: true, message: `${count}件を予約しました` };
}

export function getQueuedJob(): QueuedJob | null {
  return _queuedJob;
}

export function consumeQueuedJob(): QueuedJob | null {
  const job = _queuedJob;
  _queuedJob = null;
  return job;
}

export function clearQueue(): void {
  _queuedJob = null;
}

// --- キャンセル状態 ---

export function getCancelState(): CancelState {
  return _cancelState;
}

export function setCancelState(state: CancelState): void {
  _cancelState = state;
}

// --- キャンセル要求フラグ ---
let _cancelRequested = false;

function checkCancelFile(): boolean {
  try {
    return fs.existsSync(CANCEL_FILE);
  } catch {
    return false;
  }
}

export function requestBulkCancel(): void {
  _cancelRequested = true;
  _cancelState = 'requesting';
}

export function shouldBulkCancel(): boolean {
  if (_cancelRequested) return true;
  if (checkCancelFile()) return true;
  return false;
}

export function clearBulkCancel(): void {
  _cancelRequested = false;
  _cancelState = 'none';
  try {
    if (fs.existsSync(CANCEL_FILE)) fs.unlinkSync(CANCEL_FILE);
  } catch {
    // ignore
  }
}
