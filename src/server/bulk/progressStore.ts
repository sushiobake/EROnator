/**
 * バックグラウンド一括処理の進捗管理
 * インメモリ保持 + フェーズ別の同時追跡
 */

import * as fs from 'fs';
import * as path from 'path';

export type BulkJobStatus = 'idle' | 'running' | 'done' | 'error';

const CANCEL_FILE = path.join(process.cwd(), 'data', 'bulk-cancel-requested');

export type PhaseProgress = {
  done: number;
  total: number;
  round?: number;
  roundTotal?: number;
  currentWorkId?: string;
  detail?: string;
  startedAt?: string;
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

let _progress: BulkProgress | null = null;

export function readBulkProgress(): BulkProgress | null {
  return _progress;
}

export function writeBulkProgress(data: BulkProgress): void {
  const now = new Date().toISOString();
  _progress = { ...data, updatedAt: now };
}

export function updatePhaseProgress(
  jobId: string,
  phase: 'comment' | 'phase0' | 'phase12',
  phaseData: PhaseProgress
): void {
  if (!_progress || _progress.jobId !== jobId) return;
  if (!_progress.phases) _progress.phases = {};
  _progress.phases[phase] = phaseData;
  _progress.phase = phase;
  _progress.done = phaseData.done;
  _progress.total = phaseData.total;
  _progress.round = phaseData.round;
  _progress.roundTotal = phaseData.roundTotal;
  _progress.currentWorkId = phaseData.currentWorkId;
  _progress.detail = phaseData.detail;
  _progress.updatedAt = new Date().toISOString();
}

export function clearBulkProgress(): void {
  _progress = null;
}

/** キャンセル要求フラグ（安全に停止するため） */
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
}

export function shouldBulkCancel(): boolean {
  if (_cancelRequested) return true;
  if (checkCancelFile()) return true;
  return false;
}

export function clearBulkCancel(): void {
  _cancelRequested = false;
  try {
    if (fs.existsSync(CANCEL_FILE)) fs.unlinkSync(CANCEL_FILE);
  } catch {
    // ignore
  }
}
