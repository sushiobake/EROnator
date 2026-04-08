'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';

export type JobType = 'comment' | 'phase0' | 'phase12' | 'simulate';

export type RoundTiming = { round: number; elapsedSec: number };

export type JobProgress = {
  done?: number;
  current?: number;
  total: number;
  phase?: string;
  etaMin?: number;
  startTime?: number;
  round?: number;
  roundTotal?: number;
  currentWorkId?: string;
  detail?: string;
  errorCount?: number;
  roundTimings?: RoundTiming[];
};

export type ProgressState = {
  comment?: JobProgress | null;
  phase0?: JobProgress | null;
  phase12?: JobProgress | null;
  simulate?: JobProgress | null;
};

export type ServerLastCompleted = {
  status: 'done' | 'error';
  done: number;
  total: number;
  error?: string;
  startedAt: string;
  completedAt: string;
  phases?: Record<string, { done: number; total: number; roundTimings?: RoundTiming[] }>;
};

export type ServerQueue = {
  count: number;
  queuedAt: string;
} | null;

export type CancelState = 'none' | 'requesting' | 'cancelled';

type ProgressContextValue = {
  progress: ProgressState;
  setProgress: (job: JobType, value: ProgressState[JobType] | null) => void;
  serverLastCompleted: ServerLastCompleted | null;
  setServerLastCompleted: (v: ServerLastCompleted | null) => void;
  serverQueue: ServerQueue;
  setServerQueue: (v: ServerQueue) => void;
  cancelState: CancelState;
  setCancelState: (v: CancelState) => void;
};

const AdminProgressContext = createContext<ProgressContextValue | null>(null);

function calcEtaMin(current: number, total: number, startTime: number): number | undefined {
  if (current <= 0 || total <= 0 || current >= total) return undefined;
  const elapsedMs = Date.now() - startTime;
  const msPerItem = elapsedMs / current;
  const remaining = (total - current) * msPerItem;
  return Math.ceil(remaining / 60000);
}

export function AdminProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgressState] = useState<ProgressState>({});
  const [serverLastCompleted, setServerLastCompleted] = useState<ServerLastCompleted | null>(null);
  const [serverQueue, setServerQueue] = useState<ServerQueue>(null);
  const [cancelState, setCancelState] = useState<CancelState>('none');
  const startTimeRef = useRef<Record<JobType, number>>({ comment: 0, phase0: 0, phase12: 0, simulate: 0 });

  const setProgress = useCallback((job: JobType, value: ProgressState[JobType] | null) => {
    setProgressState((prev) => {
      const next = { ...prev };
      if (value === null || value === undefined) {
        delete next[job];
        return next;
      }
      const v = value as JobProgress;
      const currentVal = (v.current ?? v.done ?? 0) ?? 0;
      const totalVal = v.total || 1;
      const startTime = v.startTime ?? (startTimeRef.current[job] || Date.now());
      if (!startTimeRef.current[job]) startTimeRef.current[job] = startTime;

      let etaMin: number | undefined;
      if (totalVal > 0 && currentVal > 0 && currentVal < totalVal) {
        etaMin = calcEtaMin(currentVal, totalVal, startTime);
      }

      (next as Record<JobType, JobProgress | null>)[job] = { ...value, startTime, etaMin };
      return next;
    });
    if (value === null || value === undefined) {
      startTimeRef.current[job] = 0;
    }
  }, []);

  return (
    <AdminProgressContext.Provider value={{
      progress, setProgress,
      serverLastCompleted, setServerLastCompleted,
      serverQueue, setServerQueue,
      cancelState, setCancelState,
    }}>
      {children}
    </AdminProgressContext.Provider>
  );
}

export function useAdminProgress() {
  const ctx = useContext(AdminProgressContext);
  if (!ctx) {
    return {
      progress: {} as ProgressState,
      setProgress: () => {},
      serverLastCompleted: null as ServerLastCompleted | null,
      setServerLastCompleted: () => {},
      serverQueue: null as ServerQueue,
      setServerQueue: () => {},
      cancelState: 'none' as CancelState,
      setCancelState: () => {},
    };
  }
  return ctx;
}
