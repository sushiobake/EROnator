'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';

export type JobType = 'comment' | 'phase0' | 'phase12' | 'simulate';

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
};

export type ProgressState = {
  comment?: JobProgress | null;
  phase0?: JobProgress | null;
  phase12?: JobProgress | null;
  simulate?: JobProgress | null;
};

type ProgressContextValue = {
  progress: ProgressState;
  setProgress: (job: JobType, value: ProgressState[JobType] | null) => void;
};

const AdminProgressContext = createContext<ProgressContextValue | null>(null);

function calcEtaMin(
  current: number,
  total: number,
  startTime: number
): number | undefined {
  if (current <= 0 || total <= 0 || current >= total) return undefined;
  const elapsedMs = Date.now() - startTime;
  const msPerItem = elapsedMs / current;
  const remaining = (total - current) * msPerItem;
  return Math.ceil(remaining / 60000);
}

export function AdminProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgressState] = useState<ProgressState>({});
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
    <AdminProgressContext.Provider value={{ progress, setProgress }}>
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
    };
  }
  return ctx;
}
