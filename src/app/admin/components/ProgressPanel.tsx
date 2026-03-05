'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAdminProgress } from '../context/AdminProgressContext';
import type { JobType, RoundTiming, CancelState } from '../context/AdminProgressContext';

const POLL_RUNNING_MS = 2000;
const POLL_IDLE_MS = 60_000;
const HISTORY_KEY = 'eronator.bulkHistory.v2';
const HISTORY_MAX = 20;

type HistoryItem = {
  id: string;
  completedAt: string;
  status: 'done' | 'error';
  processed: number;
  total: number;
  error?: string;
  startedAt?: string;
  elapsedSec?: number;
  roundTimings?: Record<string, RoundTiming[]>;
};

const JOB_LABELS: Record<JobType, string> = {
  comment: 'コメント取得',
  phase0: 'Phase0（タグ付け）',
  phase12: 'Phase1+2（チェック）',
  simulate: 'シミュレーション',
};
const JOB_SHORT: Record<JobType, string> = {
  comment: 'コメント',
  phase0: 'P0（タグ付け）',
  phase12: 'P1+2（チェック）',
  simulate: 'シミュ',
};

function fmt(sec: number): string {
  if (sec < 0) return '--';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}秒`;
  return s > 0 ? `${m}分${s}秒` : `${m}分`;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch { return iso; }
}

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function loadHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}
function saveHistory(items: HistoryItem[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_MAX))); } catch { /* */ }
}

function saveHistoryIfNew(lc: { done: number; total: number; status: string; error?: string; startedAt?: string; completedAt?: string; phases?: Record<string, unknown> }) {
  const existing = loadHistory();
  if (lc.completedAt && existing.some((h) => h.completedAt === lc.completedAt)) return;
  const elSec = lc.startedAt && lc.completedAt
    ? Math.round((new Date(lc.completedAt).getTime() - new Date(lc.startedAt).getTime()) / 1000)
    : undefined;
  const rt: Record<string, RoundTiming[]> = {};
  if (lc.phases) {
    for (const [k, v] of Object.entries(lc.phases)) {
      const timings = (v as { roundTimings?: RoundTiming[] }).roundTimings;
      if (timings?.length) rt[k] = timings;
    }
  }
  const item: HistoryItem = {
    id: `bulk-${Date.now()}`,
    completedAt: lc.completedAt || new Date().toISOString(),
    status: lc.status as 'done' | 'error',
    processed: lc.done,
    total: lc.total,
    error: lc.error,
    startedAt: lc.startedAt,
    elapsedSec: elSec,
    roundTimings: Object.keys(rt).length > 0 ? rt : undefined,
  };
  saveHistory([item, ...existing]);
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = 800; gain.gain.value = 0.2;
    osc.start(); osc.stop(ctx.currentTime + 0.15);
  } catch { /* */ }
}

function calcEta(done: number, total: number, startMs: number): string | null {
  if (done <= 0 || total <= 0 || done >= total || startMs <= 0) return null;
  const elapsed = Date.now() - startMs;
  const remaining = (total - done) * (elapsed / done);
  const finishAt = new Date(Date.now() + remaining);
  const mins = Math.ceil(remaining / 60000);
  return `残り約${mins}分（${finishAt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}頃）`;
}

// --- Subcomponents ---

function ProgressBar({ value, max, color = '#1976d2' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ height: 5, background: '#e0e0e0', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, transition: 'width 0.3s' }} />
    </div>
  );
}

function PhaseRow({ job, data }: {
  job: JobType;
  data: { done?: number; total: number; round?: number; roundTotal?: number; detail?: string; currentWorkId?: string; roundTimings?: RoundTiming[] } | null | undefined;
}) {
  const done = data ? (data.done ?? 0) : 0;
  const total = data?.total ?? 0;
  const isActive = data && total > 0;
  const round = data?.round ?? 0;
  const roundTotal = data?.roundTotal ?? 0;
  const detail = data?.detail || data?.currentWorkId || '';

  if (!isActive) {
    return (
      <div style={{ padding: '4px 0', fontSize: 11, color: '#bbb' }}>
        {JOB_SHORT[job]}: 待機中
      </div>
    );
  }

  return (
    <div style={{ padding: '5px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, fontWeight: 600, color: '#333', marginBottom: 1 }}>
        <span>{JOB_SHORT[job]}</span>
        <span style={{ color: '#1565c0' }}>
          {done}/{total}
          {roundTotal > 0 && <span style={{ color: '#888', marginLeft: 4, fontWeight: 400 }}>R{round}/{roundTotal}</span>}
        </span>
      </div>
      <ProgressBar value={done} max={total} />
      {detail && (
        <div style={{ fontSize: 10, color: '#666', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {detail}
        </div>
      )}
    </div>
  );
}

function RoundTimingTable({ timings, label }: { timings: RoundTiming[]; label: string }) {
  if (!timings || timings.length === 0) return null;
  const avg = Math.round(timings.reduce((s, t) => s + t.elapsedSec, 0) / timings.length);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#333', marginBottom: 3 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', fontSize: 10, color: '#1565c0' }}>
        {timings.map((t) => (
          <span key={t.round}>R{t.round}: {fmt(t.elapsedSec)}</span>
        ))}
      </div>
      <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>平均: {fmt(avg)}</div>
    </div>
  );
}

// --- History Modal ---

type SimHistoryItemType = {
  timestamp: string;
  sampleSize: number;
  trialsPerWork: number;
  totalTrials: number;
  successCount: number;
  successRate: number;
  durationSeconds: number;
  avgSecPerItem: number;
  chunkTimings?: Array<{ chunk: number; doneCount: number; elapsedMs: number }>;
};

function HistoryModal({ history, simHistory, onClose, detailView }: {
  history: HistoryItem[];
  simHistory: SimHistoryItemType[];
  onClose: () => void;
  detailView: boolean;
}) {
  const [tab, setTab] = useState<'bulk' | 'sim'>('sim');
  const tabBtn = (t: 'bulk' | 'sim', label: string) => (
    <button type="button" onClick={() => setTab(t)} style={{
      padding: '5px 14px', fontSize: 12, fontWeight: tab === t ? 700 : 400,
      background: tab === t ? '#1976d2' : '#eee', color: tab === t ? '#fff' : '#333',
      border: 'none', borderRadius: 4, cursor: 'pointer',
    }}>{label}</button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 8, maxWidth: 600, width: '92%', maxHeight: '85vh', overflow: 'auto', padding: '16px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📋 履歴</h3>
          <button type="button" onClick={onClose} style={{ padding: '4px 10px', cursor: 'pointer', fontSize: 12, border: '1px solid #ccc', borderRadius: 4 }}>閉じる</button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {tabBtn('sim', `🎮 シミュ (${simHistory.length})`)}
          {tabBtn('bulk', `⚙️ 一括 (${history.length})`)}
        </div>

        {tab === 'sim' && (
          simHistory.length === 0 ? (
            <div style={{ color: '#999', fontSize: 12, textAlign: 'center', padding: 24 }}>シミュ履歴はまだありません</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {simHistory.map((item, idx) => (
                <div key={idx} style={{ padding: 12, border: '1px solid #e0e0e0', borderRadius: 6, background: '#fff8e1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>
                      🎮 {item.sampleSize}件×{item.trialsPerWork}回 = {item.totalTrials}試行
                    </span>
                    <span style={{ fontSize: 10, color: '#666' }}>{fmtDateTime(item.timestamp)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#333', fontWeight: 600, marginBottom: 2 }}>
                    所要時間: {fmt(item.durationSeconds)} ({item.avgSecPerItem}秒/件)
                  </div>
                  <div style={{ fontSize: 11, color: '#555', marginBottom: 2 }}>
                    成功率: {Math.round(item.successRate * 100)}% ({item.successCount}/{item.totalTrials})
                  </div>
                  {item.chunkTimings && item.chunkTimings.length > 0 && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 3 }}>チャンク所要時間</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 8px', fontSize: 10, color: '#e65100' }}>
                        {item.chunkTimings.map((ct) => (
                          <span key={ct.chunk}>C{ct.chunk}: {(ct.elapsedMs / 1000).toFixed(1)}s</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                        平均: {(item.chunkTimings.reduce((s, t) => s + t.elapsedMs, 0) / item.chunkTimings.length / 1000).toFixed(1)}s/チャンク
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'bulk' && (
          history.length === 0 ? (
            <div style={{ color: '#999', fontSize: 12, textAlign: 'center', padding: 24 }}>一括処理の履歴はまだありません</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map((item) => (
                <div key={item.id} style={{
                  padding: 12, border: '1px solid #e0e0e0', borderRadius: 6,
                  background: item.status === 'done' ? '#f1f8e9' : '#ffebee',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>
                      {item.status === 'done' ? '✅' : '❌'} {item.processed}/{item.total}件
                    </span>
                    <span style={{ fontSize: 10, color: '#666' }}>{fmtDateTime(item.completedAt)}</span>
                  </div>
                  {item.elapsedSec != null && (
                    <div style={{ fontSize: 11, color: '#333', fontWeight: 600, marginBottom: 2 }}>
                      所要時間: {fmt(item.elapsedSec)}
                    </div>
                  )}
                  {item.startedAt && (
                    <div style={{ fontSize: 10, color: '#666' }}>
                      {fmtTime(item.startedAt)} → {fmtTime(item.completedAt)}
                    </div>
                  )}
                  {item.error && <div style={{ fontSize: 10, color: '#c62828', marginTop: 3, wordBreak: 'break-all' }}>{item.error}</div>}
                  {item.roundTimings && Object.keys(item.roundTimings).length > 0 && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 3 }}>ラウンド所要時間</div>
                      {Object.entries(item.roundTimings).map(([job, timings]) =>
                        timings.length > 0 ? (
                          <div key={job} style={{ fontSize: 10, color: '#1565c0', marginBottom: 3 }}>
                            <span style={{ fontWeight: 600 }}>{JOB_LABELS[job as JobType] ?? job}: </span>
                            {timings.map((t) => `R${t.round}=${fmt(t.elapsedSec)}`).join('  ')}
                            <span style={{ color: '#888', marginLeft: 6 }}>
                              (avg {fmt(Math.round(timings.reduce((s, t) => s + t.elapsedSec, 0) / timings.length))})
                            </span>
                          </div>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// --- Main Panel ---

export default function ProgressPanel() {
  const {
    progress, setProgress,
    serverLastCompleted, setServerLastCompleted,
    serverQueue, setServerQueue,
    cancelState, setCancelState,
  } = useAdminProgress();

  const [expanded, setExpanded] = useState(true);
  const [detailView, setDetailView] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedCompletedRef = useRef<string | null>(null);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // サーバーから最後にデータを受信した時刻（ポーリングでのクリア判定用）
  const lastServerDataRef = useRef<number>(0);

  const isBulkRunning =
    (progress.comment?.total ?? 0) > 0 ||
    (progress.phase0?.total ?? 0) > 0 ||
    (progress.phase12?.total ?? 0) > 0;

  const isSimRunning = (progress.simulate?.total ?? 0) > 0;
  const isRunning = isBulkRunning || isSimRunning;

  const hasAny = isRunning || !!serverLastCompleted;

  // Elapsed timer
  useEffect(() => {
    if (!isRunning) { setElapsedSec(0); return; }
    const st = progress.comment?.startTime || progress.phase0?.startTime || progress.phase12?.startTime || progress.simulate?.startTime || Date.now();
    const tick = () => setElapsedSec(Math.floor((Date.now() - st) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isRunning, progress.comment?.startTime, progress.phase0?.startTime, progress.phase12?.startTime, progress.simulate?.startTime]);

  // Polling
  // 重要: ポーリングは「サーバーにデータがある時のみ」Context を更新する。
  // idle でも Context をクリアしない（ImportWorkflow のストリーム書き込みとの競合を防ぐ）。
  // クリアは「サーバーが done を返した後」のみ、タイマーで行う。
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('eronator.adminToken') : null;
    if (!token) return;
    let mounted = true;

    const schedulePoll = (ms: number) => {
      if (intervalRef.current) clearTimeout(intervalRef.current);
      intervalRef.current = setTimeout(() => { if (mounted) poll(); }, ms);
    };

    const applyServerProgress = (p: Record<string, unknown>, phases: Record<string, unknown> | null) => {
      if (clearTimerRef.current) { clearTimeout(clearTimerRef.current); clearTimerRef.current = null; }
      lastServerDataRef.current = Date.now();
      const startTime = p.startedAt ? new Date(p.startedAt as string).getTime() : undefined;
      if (phases) {
        for (const phase of ['comment', 'phase0', 'phase12'] as const) {
          const pd = phases[phase] as Record<string, unknown> | undefined;
          if (pd) {
            setProgress(phase, {
              done: (pd.done as number) ?? 0,
              total: (pd.total as number) ?? (p.total as number) ?? 0,
              round: (pd.round as number) ?? (p.round as number),
              roundTotal: (pd.roundTotal as number) ?? (p.roundTotal as number),
              currentWorkId: pd.currentWorkId as string | undefined,
              detail: pd.detail as string | undefined,
              startTime: pd.startedAt ? new Date(pd.startedAt as string).getTime() : startTime,
              roundTimings: pd.roundTimings as RoundTiming[] | undefined,
            });
          }
        }
      } else {
        const job = p.phase === 'comment' ? 'comment' : p.phase === 'phase0' ? 'phase0' : 'phase12';
        setProgress(job as JobType, {
          done: (p.done as number) ?? 0,
          total: (p.total as number) ?? 0,
          round: p.round as number | undefined,
          roundTotal: p.roundTotal as number | undefined,
          currentWorkId: p.currentWorkId as string | undefined,
          detail: p.detail as string | undefined,
          startTime,
        });
      }
    };

    const clearAllProgress = () => {
      setProgress('comment', null);
      setProgress('phase0', null);
      setProgress('phase12', null);
    };

    const handleLastCompleted = (lc: Record<string, unknown>) => {
      setServerLastCompleted(lc as unknown as Parameters<typeof setServerLastCompleted>[0]);
      const lcKey = lc.completedAt as string | undefined;
      if (lcKey && lcKey !== savedCompletedRef.current) {
        savedCompletedRef.current = lcKey;
        saveHistoryIfNew(lc as Parameters<typeof saveHistoryIfNew>[0]);
        playBeep();
      }
    };

    const poll = async () => {
      if (!mounted) return;
      try {
        const res = await fetch('/api/admin/bulk-job-status', { headers: { 'x-eronator-admin-token': token } });
        if (!res.ok || !mounted) { schedulePoll(POLL_IDLE_MS); return; }
        const data = await res.json();

        setCancelState(data.cancelState ?? 'none');
        setServerQueue(data.queue ?? null);
        if (data.lastCompleted) handleLastCompleted(data.lastCompleted);

        const status = data.status as string;
        const simProgress = data.simProgress as { done: number; total: number; startedAt: string } | null;

        if (status === 'running' && data.progress) {
          applyServerProgress(data.progress, data.phases ?? data.progress.phases);
          schedulePoll(POLL_RUNNING_MS);
        } else if (status === 'done' && data.progress) {
          applyServerProgress(data.progress, data.phases ?? data.progress.phases);
          // 完了表示を 8 秒維持してからクリア
          if (!clearTimerRef.current) {
            clearTimerRef.current = setTimeout(() => {
              if (mounted) clearAllProgress();
              clearTimerRef.current = null;
            }, 8000);
          }
          schedulePoll(POLL_IDLE_MS);
        } else if (simProgress && simProgress.total > 0) {
          // シミュレーション実行中（全件1回送信モード・サーバー側進捗）
          lastServerDataRef.current = Date.now();
          setProgress('simulate', {
            done: simProgress.done,
            total: simProgress.total,
            phase: '実行中',
            startTime: new Date(simProgress.startedAt).getTime(),
          });
          schedulePoll(POLL_RUNNING_MS);
        } else {
          // idle: サーバーにデータなし
          // 重要: ここで setProgress(null) を呼ばない。
          // ImportWorkflow がストリームで書き込んだ進捗を消さないため。
          // ただし、最後のサーバーデータから 30 秒以上経過していれば
          // （＝ストリームも終了している可能性が高い）クリアする。
          if (lastServerDataRef.current > 0 && Date.now() - lastServerDataRef.current > 30_000) {
            clearAllProgress();
            lastServerDataRef.current = 0;
          }
          schedulePoll(POLL_IDLE_MS);
        }
      } catch {
        schedulePoll(POLL_IDLE_MS);
      }
    };

    poll();
    return () => {
      mounted = false;
      if (intervalRef.current) clearTimeout(intervalRef.current);
      if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    };
  }, [setProgress, setServerLastCompleted, setServerQueue, setCancelState]);

  type SimHistoryItem = {
    timestamp: string;
    sampleSize: number;
    trialsPerWork: number;
    totalTrials: number;
    successCount: number;
    successRate: number;
    durationSeconds: number;
    avgSecPerItem: number;
    chunkTimings?: Array<{ chunk: number; doneCount: number; elapsedMs: number }>;
  };
  const [simHistory, setSimHistory] = useState<SimHistoryItem[]>([]);

  // History
  useEffect(() => {
    if (showHistory) {
      setHistory(loadHistory());
      try {
        setSimHistory(JSON.parse(localStorage.getItem('sim-history') || '[]'));
      } catch { setSimHistory([]); }
    }
  }, [showHistory]);

  // Cancel handler
  const handleCancel = useCallback(async () => {
    if (!cancelConfirm) { setCancelConfirm(true); return; }
    setCancelConfirm(false);
    const token = localStorage.getItem('eronator.adminToken');
    if (!token) return;
    try {
      await fetch('/api/admin/bulk-job-cancel', { method: 'POST', headers: { 'x-eronator-admin-token': token } });
      setCancelState('requesting');
    } catch { /* */ }
  }, [cancelConfirm, setCancelState]);

  const handleCancelQueue = useCallback(async () => {
    const token = localStorage.getItem('eronator.adminToken');
    if (!token) return;
    try {
      await fetch('/api/admin/bulk-job-queue', { method: 'DELETE', headers: { 'x-eronator-admin-token': token } });
      setServerQueue(null);
    } catch { /* */ }
  }, [setServerQueue]);

  useEffect(() => { if (cancelState !== 'none') setCancelConfirm(false); }, [cancelState]);

  const baseW = 200;
  const detailW = 440;
  const panelW = detailView ? detailW : baseW;

  const overallStartMs = progress.comment?.startTime || progress.phase0?.startTime || 0;
  const overallDone = Math.max(progress.comment?.done ?? 0, progress.phase0?.done ?? 0, progress.phase12?.done ?? 0);
  const overallTotal = progress.comment?.total || progress.phase0?.total || progress.phase12?.total || 0;
  const etaStr = isRunning ? calcEta(overallDone, overallTotal, overallStartMs) : null;

  const cancelLabels: Record<CancelState, string> = {
    none: '', requesting: '⏳ 停止要求中…', cancelled: '⛔ 停止済み',
  };

  return (
    <>
      {/* Main Panel */}
      <div style={{
        position: 'fixed', bottom: 8, right: 20,
        width: expanded ? panelW : 120,
        maxHeight: expanded ? 'calc(100vh - 50px)' : 44,
        minHeight: expanded ? 340 : 44,
        backgroundColor: '#fff',
        border: '1px solid #ddd', borderRight: 'none', borderBottom: 'none',
        borderTopLeftRadius: 8,
        boxShadow: '-2px -2px 8px rgba(0,0,0,0.12)',
        zIndex: 9998,
        overflow: 'hidden',
        transition: 'max-height 0.2s, width 0.25s',
        display: 'flex', flexDirection: 'column',
        fontSize: 12,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'stretch', flexShrink: 0 }}>
          <button type="button" onClick={() => setExpanded((e) => !e)} style={{
            flex: 1, padding: '7px 8px', border: 'none',
            background: isRunning ? '#1976d2' : hasAny ? '#388e3c' : '#f5f5f5',
            color: isRunning || hasAny ? '#fff' : '#666',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{isRunning ? '⚙️ 実行中' : hasAny ? '📋 結果あり' : '📋 進行状況'}</span>
            <span style={{ fontSize: 10 }}>{expanded ? '▼' : '▲'}</span>
          </button>
          {expanded && (
            <button type="button" onClick={() => setDetailView((d) => !d)} style={{
              padding: '7px 8px', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.2)',
              background: detailView ? '#0d47a1' : (isRunning || hasAny ? '#1565c0' : '#e0e0e0'),
              color: detailView || isRunning || hasAny ? '#fff' : '#666',
              fontSize: 10, cursor: 'pointer', fontWeight: 600,
            }} title="詳細表示切替">
              {detailView ? '◀ 縮小' : '詳細 ▶'}
            </button>
          )}
          <button type="button" onClick={() => setShowHistory(true)} style={{
            padding: '7px 6px', border: 'none', borderLeft: '1px solid rgba(0,0,0,0.1)',
            background: isRunning || hasAny ? '#1565c0' : '#e8e8e8',
            color: isRunning || hasAny ? '#fff' : '#666',
            fontSize: 10, cursor: 'pointer',
          }} title="履歴">
            履歴
          </button>
        </div>

        {/* Body */}
        {expanded && (
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {/* Cancel state banner */}
            {cancelState !== 'none' && (
              <div style={{ padding: '5px 8px', background: cancelState === 'requesting' ? '#fff3e0' : '#ffebee', fontSize: 11, fontWeight: 600, color: cancelState === 'requesting' ? '#e65100' : '#c62828', borderBottom: '1px solid #eee' }}>
                {cancelLabels[cancelState]}
              </div>
            )}

            {/* Simulate section */}
            {isSimRunning && progress.simulate && (
              <div style={{ padding: '8px 8px 10px', borderBottom: '1px solid #eee', background: '#fff8e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#e65100' }}>
                    🎮 シミュ実行中 {fmt(elapsedSec)}
                  </span>
                  <span style={{ fontSize: 11, color: '#555', fontWeight: 600 }}>
                    {progress.simulate.done ?? 0}/{progress.simulate.total}
                  </span>
                </div>
                <ProgressBar value={progress.simulate.done ?? 0} max={progress.simulate.total} color="#ff6600" />
                {progress.simulate.phase && (
                  <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{progress.simulate.phase}</div>
                )}
                {(() => {
                  const simEta = calcEta(progress.simulate.done ?? 0, progress.simulate.total, progress.simulate.startTime ?? 0);
                  return simEta ? <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{simEta}</div> : null;
                })()}
              </div>
            )}

            {/* Running section (bulk) */}
            {isBulkRunning && (
              <div style={{ padding: '8px 8px 10px', borderBottom: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1976d2' }}>
                    実行中 {fmt(elapsedSec)}
                  </span>
                  <span style={{ fontSize: 11, color: '#555', fontWeight: 600 }}>
                    {overallDone}/{overallTotal}
                  </span>
                </div>
                {etaStr && <div style={{ fontSize: 10, color: '#666', marginBottom: 6 }}>{etaStr}</div>}

                <PhaseRow job="comment" data={progress.comment} />
                <PhaseRow job="phase0" data={progress.phase0} />
                <PhaseRow job="phase12" data={progress.phase12} />

                {/* Round timings (always visible when available) */}
                {(() => {
                  const hasTimings = (['comment', 'phase0', 'phase12'] as const).some((j) => (progress[j]?.roundTimings?.length ?? 0) > 0);
                  if (!hasTimings) return null;
                  return (
                    <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px dashed #ddd' }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 4 }}>ラウンド所要時間</div>
                      {(['comment', 'phase0', 'phase12'] as const).map((j) => {
                        const rt = progress[j]?.roundTimings;
                        if (!rt || rt.length === 0) return null;
                        if (!detailView && rt.length > 3) {
                          const last = rt[rt.length - 1];
                          const avg = Math.round(rt.reduce((s, t) => s + t.elapsedSec, 0) / rt.length);
                          return (
                            <div key={j} style={{ fontSize: 10, color: '#1565c0', marginBottom: 2 }}>
                              {JOB_SHORT[j]}: 最新R{last.round}={fmt(last.elapsedSec)} (avg {fmt(avg)}, {rt.length}件)
                            </div>
                          );
                        }
                        return <RoundTimingTable key={j} timings={rt} label={JOB_LABELS[j]} />;
                      })}
                    </div>
                  );
                })()}

                {/* Controls */}
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  {cancelState === 'none' && (
                    <button type="button" onClick={handleCancel} style={{
                      padding: '4px 10px', fontSize: 10, fontWeight: 600,
                      background: cancelConfirm ? '#c62828' : '#ef5350', color: '#fff',
                      border: 'none', borderRadius: 3, cursor: 'pointer',
                    }}>
                      {cancelConfirm ? '本当に停止？' : '停止'}
                    </button>
                  )}
                  {cancelState === 'requesting' && (
                    <span style={{ fontSize: 10, color: '#e65100', fontWeight: 600, padding: '4px 0' }}>停止処理中…</span>
                  )}
                </div>
              </div>
            )}

            {/* Last completed */}
            {serverLastCompleted && !isRunning && (
              <div style={{ padding: '8px 8px 10px', borderBottom: '1px solid #eee', background: serverLastCompleted.status === 'done' ? '#e8f5e9' : '#ffebee' }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                  {serverLastCompleted.status === 'done' ? '✅ 完了' : '❌ エラー'}
                </div>
                <div style={{ fontSize: 12, color: '#333', marginBottom: 2, fontWeight: 600 }}>
                  {serverLastCompleted.done}件 / {serverLastCompleted.total}件
                </div>
                {serverLastCompleted.startedAt && serverLastCompleted.completedAt && (
                  <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>
                    {fmtTime(serverLastCompleted.startedAt)} → {fmtTime(serverLastCompleted.completedAt)}
                    {' '}({fmt(Math.round((new Date(serverLastCompleted.completedAt).getTime() - new Date(serverLastCompleted.startedAt).getTime()) / 1000))})
                  </div>
                )}
                {serverLastCompleted.error && (
                  <div style={{ fontSize: 10, color: '#c62828', marginTop: 3, wordBreak: 'break-all', fontWeight: 500 }}>{serverLastCompleted.error}</div>
                )}
                {serverLastCompleted.phases && (
                  <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #ddd' }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#888', marginBottom: 4 }}>ラウンド所要時間</div>
                    {Object.entries(serverLastCompleted.phases).map(([k, v]) => {
                      const rt = (v as { roundTimings?: RoundTiming[] }).roundTimings;
                      if (!rt || rt.length === 0) return null;
                      if (!detailView && rt.length > 3) {
                        const last = rt[rt.length - 1];
                        const avg = Math.round(rt.reduce((s, t) => s + t.elapsedSec, 0) / rt.length);
                        return (
                          <div key={k} style={{ fontSize: 10, color: '#1565c0', marginBottom: 2 }}>
                            {JOB_SHORT[k as JobType] ?? k}: 最新R{last.round}={fmt(last.elapsedSec)} (avg {fmt(avg)}, {rt.length}件)
                          </div>
                        );
                      }
                      return <RoundTimingTable key={k} timings={rt} label={JOB_LABELS[k as JobType] ?? k} />;
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Queue info (display only, no input) */}
            {serverQueue && (
              <div style={{ padding: '6px 8px', borderBottom: '1px solid #eee', background: '#e3f2fd' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  <span style={{ color: '#1565c0', fontWeight: 600 }}>
                    📌 予約: {serverQueue.count}件
                  </span>
                  <span style={{ fontSize: 9, color: '#999' }}>({fmtTime(serverQueue.queuedAt)})</span>
                  <button type="button" onClick={handleCancelQueue} style={{
                    padding: '1px 6px', fontSize: 9, background: '#fff', border: '1px solid #ccc',
                    borderRadius: 3, cursor: 'pointer', marginLeft: 'auto',
                  }}>取消</button>
                </div>
              </div>
            )}

            {/* Idle state */}
            {!isRunning && !serverLastCompleted && !serverQueue && (
              <div style={{ padding: '16px 8px', textAlign: 'center', color: '#bbb', fontSize: 11 }}>
                ジョブなし
              </div>
            )}
          </div>
        )}
      </div>

      {/* History Modal */}
      {showHistory && (
        <HistoryModal
          history={history}
          simHistory={simHistory}
          onClose={() => setShowHistory(false)}
          detailView={detailView}
        />
      )}
    </>
  );
}
