'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';

export type JobType = 'import' | 'phase012' | 'simulate';

export type ImportProgress = {
  current: number;
  total: number;
  phase?: string;
  etaMin?: number;
  startTime?: number;
};

export type Phase012Progress = {
  done: number;
  total: number;
  phase?: string;
  etaMin?: number;
  startTime?: number;
  /** 一括実行時のラウンド表示（例: 3/10） */
  round?: number;
  roundTotal?: number;
};

export type SimulateProgress = {
  current: number;
  total: number;
  phase?: string;
  etaMin?: number;
  startTime?: number;
};

export type ProgressState = {
  import?: ImportProgress | null;
  phase012?: Phase012Progress | null;
  simulate?: SimulateProgress | null;
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
  const startTimeRef = useRef<Record<JobType, number>>({ import: 0, phase012: 0, simulate: 0 });

  const setProgress = useCallback((job: JobType, value: ProgressState[JobType] | null) => {
    setProgressState((prev) => {
      const next = { ...prev };
      if (value === null || value === undefined) {
        delete next[job];
        return next;
      }
      const v = value as { current?: number; done?: number; total: number; startTime?: number };
      const currentVal = ('current' in v ? v.current : 'done' in v ? v.done : 0) ?? 0;
      const totalVal = v.total || 1;
      const startTime = v.startTime ?? (startTimeRef.current[job] || Date.now());
      if (!startTimeRef.current[job]) startTimeRef.current[job] = startTime;

      let etaMin: number | undefined;
      if (totalVal > 0 && currentVal > 0 && currentVal < totalVal) {
        etaMin = calcEtaMin(currentVal, totalVal, startTime);
      }

      next[job] = { ...value, startTime, etaMin } as ProgressState[JobType];
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
