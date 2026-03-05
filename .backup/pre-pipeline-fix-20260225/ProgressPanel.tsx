'use client';

import { useState, useEffect, useRef } from 'react';
import { useAdminProgress } from '../context/AdminProgressContext';
import type { JobType } from '../context/AdminProgressContext';

const BULK_JOB_POLL_INTERVAL_MS = 5000;

function playCompletionBeep() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.2;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // オートプレイ制限等で無視
  }
}

const JOB_LABELS: Record<JobType, string> = {
  comment: 'コメント取得',
  phase0: 'Phase0（タグ付け）',
  phase12: 'Phase1+2（チェック）',
  simulate: 'シミュレーション',
};

function calcEtaMin(current: number, total: number, startTime: number): number | undefined {
  if (current <= 0 || total <= 0 || current >= total) return undefined;
  const elapsedMs = Date.now() - startTime;
  const msPerItem = elapsedMs / current;
  const remaining = (total - current) * msPerItem;
  return Math.ceil(remaining / 60000);
}

function ProgressRow({
  job,
  label,
  data,
  justCompleted,
}: {
  job: JobType;
  label: string;
  data: { current?: number; done?: number; total: number; phase?: string; etaMin?: number; startTime?: number; round?: number; roundTotal?: number; currentWorkId?: string; detail?: string } | null | undefined;
  justCompleted?: boolean;
}) {
  const current = data ? (data.current ?? data.done ?? 0) : 0;
  const total = data?.total ?? 0;
  const startTime = data?.startTime ?? 0;
  const isActive = data && total > 0;

  const [etaMin, setEtaMin] = useState<number | undefined>(undefined);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  useEffect(() => {
    if (!isActive || total <= 0) return;
    const update = () => {
      const elapsed = startTime > 0 ? Math.floor((Date.now() - startTime) / 1000) : 0;
      setElapsedSec(elapsed);
      if (current > 0 && current < total && startTime > 0) {
        setEtaMin(calcEtaMin(current, total, startTime));
      } else {
        setEtaMin(undefined);
      }
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isActive, current, total, startTime]);

  const roundInfo = data && data.round != null && data.roundTotal != null && data.roundTotal > 1
    ? ` (ラウンド ${data.round}/${data.roundTotal})`
    : '';
  const detailInfo = data?.detail ? ` ${data.detail}` : data?.currentWorkId ? ` ${data.currentWorkId}` : '';
  return (
    <div
      style={{
        padding: '0.5rem 0.75rem',
        borderBottom: '1px solid #eee',
        fontSize: '0.85rem',
        minHeight: '2.5rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: justCompleted ? '#e8f5e9' : undefined,
        transition: justCompleted ? 'none' : 'background-color 0.3s',
      }}
    >
      <div style={{ fontWeight: 'bold', color: isActive ? '#333' : '#999', marginBottom: '0.2rem' }}>
        {label}
      </div>
      {isActive ? (
        <>
          <div>
            {current}/{total} 件{roundInfo}
            {etaMin != null && etaMin > 0 && (
              <span style={{ color: '#666', marginLeft: '0.5rem' }}>
                残り約{etaMin}分
              </span>
            )}
          </div>
          {detailInfo && (
            <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {detailInfo}
            </div>
          )}
          {current === 0 && total > 0 && elapsedSec >= 1 && !detailInfo && (
            <div style={{ color: '#666', fontSize: '0.8rem', marginTop: '0.2rem' }}>
              開始から{elapsedSec >= 60 ? `${Math.floor(elapsedSec / 60)}分` : `${elapsedSec}秒`}経過
            </div>
          )}
        </>
      ) : (
        <div style={{ color: '#999', fontSize: '0.8rem' }}>
          {justCompleted ? '✅ 完了' : '待機中'}
        </div>
      )}
    </div>
  );
}

const JOBS: JobType[] = ['comment', 'phase0', 'phase12', 'simulate'];

export default function ProgressPanel() {
  const { progress, setProgress } = useAdminProgress();
  const [expanded, setExpanded] = useState(true);
  const [justCompleted, setJustCompleted] = useState<JobType | null>(null);
  const prevProgressRef = useRef<typeof progress>({});

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('eronator.adminToken') : null;
    if (!token) return;
    const poll = async () => {
      try {
        const res = await fetch('/api/admin/bulk-job-status', {
          headers: { 'x-eronator-admin-token': token },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === 'running' && data.progress) {
          const p = data.progress;
          const job = p.phase === 'comment' ? 'comment' : p.phase === 'phase0' ? 'phase0' : 'phase12';
          setProgress(job, {
            done: p.done,
            total: p.total,
            round: p.round,
            roundTotal: p.roundTotal,
            currentWorkId: p.currentWorkId,
            detail: p.detail,
            startTime: p.startedAt ? new Date(p.startedAt).getTime() : undefined,
          });
        } else if (data.status === 'done' || data.status === 'error') {
          setProgress('comment', null);
          setProgress('phase0', null);
          setProgress('phase12', null);
        }
      } catch {
        // ignore
      }
    };
    const id = setInterval(poll, BULK_JOB_POLL_INTERVAL_MS);
    poll();
    return () => clearInterval(id);
  }, [setProgress]);

  useEffect(() => {
    for (const job of JOBS) {
      const had = prevProgressRef.current[job] && (prevProgressRef.current[job] as { total?: number }).total! > 0;
      const now = progress[job];
      const hasNow = now && now.total > 0;
      if (had && !hasNow) {
        playCompletionBeep();
        setJustCompleted(job);
        break;
      }
    }
    prevProgressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    if (justCompleted) {
      const t = setTimeout(() => setJustCompleted(null), 2000);
      return () => clearTimeout(t);
    }
  }, [justCompleted]);
  const hasAny = !!(
    (progress.comment && progress.comment.total > 0) ||
    (progress.phase0 && progress.phase0.total > 0) ||
    (progress.phase12 && progress.phase12.total > 0) ||
    (progress.simulate && progress.simulate.total > 0)
  );

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        width: expanded ? 300 : 180,
        maxHeight: expanded ? 420 : 48,
        minHeight: 48,
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        borderRight: 'none',
        borderBottom: 'none',
        borderTopLeftRadius: '8px',
        boxShadow: '-2px -2px 8px rgba(0,0,0,0.1)',
        zIndex: 9998,
        overflow: 'hidden',
        transition: 'max-height 0.2s, width 0.2s',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        style={{
          padding: '0.5rem 0.75rem',
          border: 'none',
          background: hasAny ? '#0070f3' : '#f5f5f5',
          color: hasAny ? '#fff' : '#666',
          fontSize: '0.85rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>📋 進行状況</span>
        <span style={{ fontSize: '1rem' }}>{expanded ? '▼' : '▲'}</span>
      </button>
      {expanded && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <ProgressRow job="comment" label={JOB_LABELS.comment} data={progress.comment} justCompleted={justCompleted === 'comment'} />
          <ProgressRow job="phase0" label={JOB_LABELS.phase0} data={progress.phase0} justCompleted={justCompleted === 'phase0'} />
          <ProgressRow job="phase12" label={JOB_LABELS.phase12} data={progress.phase12} justCompleted={justCompleted === 'phase12'} />
          <ProgressRow job="simulate" label={JOB_LABELS.simulate} data={progress.simulate} justCompleted={justCompleted === 'simulate'} />
        </div>
      )}
    </div>
  );
}
