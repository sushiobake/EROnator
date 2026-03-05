/**
 * バックグラウンド一括処理の進捗永続化
 * data/bulk-progress.json に書き出し
 */

import * as fs from 'fs';
import * as path from 'path';

export type BulkJobStatus = 'idle' | 'running' | 'done' | 'error';

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
};

const PROGRESS_FILE = path.join(process.cwd(), 'data', 'bulk-progress.json');

function ensureDir(): void {
  const dir = path.dirname(PROGRESS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function readBulkProgress(): BulkProgress | null {
  try {
    if (!fs.existsSync(PROGRESS_FILE)) return null;
    const raw = fs.readFileSync(PROGRESS_FILE, 'utf-8');
    return JSON.parse(raw) as BulkProgress;
  } catch {
    return null;
  }
}

export function writeBulkProgress(data: BulkProgress): void {
  ensureDir();
  const now = new Date().toISOString();
  const toWrite: BulkProgress = { ...data, updatedAt: now };
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(toWrite, null, 2), 'utf-8');
}

export function clearBulkProgress(): void {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
    }
  } catch {
    // ignore
  }
}
