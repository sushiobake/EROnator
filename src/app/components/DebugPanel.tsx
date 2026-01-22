/**
 * デバッグパネルコンポーネント
 * 内部状態を可視化（ローカル専用）
 */

'use client';

import { useMemo } from 'react';

interface DebugPayload {
  step: number;
  session: {
    sessionId: string;
    questionCount: number;
    confidence: number;
    candidateCount: number;
    top1Score: number;
    top2Score: number;
  };
  before?: {
    questionCount: number;
    confidence: number;
    candidateCount: number;
    top1Score: number;
    top2Score: number;
    weightsTop: Array<{
      workId: string;
      weight: number;
    }>;
  };
  after: {
    questionCount: number;
    confidence: number;
    candidateCount: number;
    top1Score: number;
    top2Score: number;
    weightsTop: Array<{
      workId: string;
      weight: number;
    }>;
  };
  delta?: {
    confidenceDelta: number;
    candidateCountDelta: number;
    topGapDelta: number;
    weightDeltasTop: Array<{
      workId: string;
      before: number;
      after: number;
      delta: number;
    }>;
  };
  lastAnswerMeta?: {
    questionId?: string;
    answerValue: string;
    touchedTagKeys: string[];
  };
  topCandidates: Array<{
    workId: string;
    title: string;
    authorName: string;
    isAi: string;
    score: number;
    popularityBase: number;
    popularityPlayBonus: number;
    tags: string[];
  }>;
  rationaleRaw: Record<string, unknown>;
}

interface DebugPanelProps {
  debug: DebugPayload | null;
  open: boolean;
  onToggle: () => void;
}

export function DebugPanel({ debug, open, onToggle }: DebugPanelProps) {
  if (!debug) {
    return null;
  }

  const topGapAfter = useMemo(() => {
    return debug.after.top1Score - debug.after.top2Score;
  }, [debug.after.top1Score, debug.after.top2Score]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1000,
        backgroundColor: '#fff',
        border: '2px solid #0070f3',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        maxWidth: '800px',
        maxHeight: '85vh',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#0070f3',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
          デバッグパネル（ステップ {debug.step}）
        </span>
        <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{open ? '−' : '+'}</span>
      </div>

      {open && (
        <div style={{ padding: '16px' }}>
          {/* セッション情報 */}
          <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '6px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
              セッション情報
            </h3>
            <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
              <div><strong>質問数:</strong> {debug.session.questionCount}問</div>
              <div><strong>確信度:</strong> <span style={{ color: '#0070f3', fontWeight: 'bold' }}>{(debug.session.confidence * 100).toFixed(2)}%</span></div>
              <div><strong>候補作品数:</strong> {debug.session.candidateCount}件</div>
              <div><strong>トップ1スコア:</strong> {debug.session.top1Score.toFixed(4)}</div>
              <div><strong>トップ2スコア:</strong> {debug.session.top2Score.toFixed(4)}</div>
              <div><strong>スコア差:</strong> <span style={{ color: debug.session.top1Score - debug.session.top2Score >= 0.1 ? '#28a745' : '#ffc107' }}>{(debug.session.top1Score - debug.session.top2Score).toFixed(4)}</span></div>
            </div>
          </div>

          {/* 変化量（before/after/delta） */}
          {debug.before && debug.delta && (
            <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#fff3cd', borderRadius: '6px', border: '1px solid #ffc107' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                今回の回答による変化
              </h3>
              <div style={{ fontSize: '13px', lineHeight: '2' }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>確信度:</strong> 
                  <span style={{ marginLeft: '8px' }}>
                    {(debug.before.confidence * 100).toFixed(2)}% → <span style={{ fontWeight: 'bold', color: '#0070f3' }}>{(debug.after.confidence * 100).toFixed(2)}%</span>
                    {' '}
                    <span style={{ 
                      color: debug.delta.confidenceDelta >= 0 ? '#28a745' : '#dc3545',
                      fontWeight: 'bold'
                    }}>
                      ({debug.delta.confidenceDelta >= 0 ? '+' : ''}{(debug.delta.confidenceDelta * 100).toFixed(2)}%)
                    </span>
                  </span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>候補作品数:</strong> 
                  <span style={{ marginLeft: '8px' }}>
                    {debug.before.candidateCount}件 → <span style={{ fontWeight: 'bold' }}>{debug.after.candidateCount}件</span>
                    {' '}
                    <span style={{ 
                      color: debug.delta.candidateCountDelta >= 0 ? '#28a745' : '#dc3545',
                      fontWeight: 'bold'
                    }}>
                      ({debug.delta.candidateCountDelta >= 0 ? '+' : ''}{debug.delta.candidateCountDelta})
                    </span>
                  </span>
                </div>
                <div>
                  <strong>トップ1-2の差:</strong> 
                  <span style={{ marginLeft: '8px' }}>
                    {(debug.before.top1Score - debug.before.top2Score).toFixed(4)} → <span style={{ fontWeight: 'bold' }}>{topGapAfter.toFixed(4)}</span>
                    {' '}
                    <span style={{ 
                      color: debug.delta.topGapDelta >= 0 ? '#28a745' : '#dc3545',
                      fontWeight: 'bold'
                    }}>
                      ({debug.delta.topGapDelta >= 0 ? '+' : ''}{debug.delta.topGapDelta.toFixed(4)})
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 影響を受けたタグ */}
          {debug.lastAnswerMeta && debug.lastAnswerMeta.touchedTagKeys.length > 0 && (
            <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#d1ecf1', borderRadius: '6px', border: '1px solid #bee5eb' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                影響を受けたタグ
              </h3>
              <div style={{ fontSize: '13px' }}>
                {debug.lastAnswerMeta.touchedTagKeys.map((tagKey, idx) => (
                  <span key={tagKey} style={{ 
                    display: 'inline-block',
                    margin: '2px 4px',
                    padding: '4px 8px',
                    backgroundColor: '#fff',
                    borderRadius: '4px',
                    border: '1px solid #bee5eb'
                  }}>
                    {tagKey}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 重みの変化（Top N） */}
          {debug.delta && debug.delta.weightDeltasTop.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
                重みの変化（上位{debug.delta.weightDeltasTop.length}件）
              </h3>
              <div style={{ fontSize: '12px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd', fontSize: '12px' }}>作品ID</th>
                      <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd', fontSize: '12px' }}>変更前</th>
                      <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd', fontSize: '12px' }}>変更後</th>
                      <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd', fontSize: '12px' }}>変化量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debug.delta.weightDeltasTop.map(w => (
                      <tr key={w.workId} style={{ backgroundColor: w.delta !== 0 ? '#fff3cd' : '#fff' }}>
                        <td style={{ padding: '6px', border: '1px solid #ddd', fontSize: '11px' }}>{w.workId}</td>
                        <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'right', fontSize: '11px' }}>
                          {w.before.toFixed(4)}
                        </td>
                        <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'right', fontSize: '11px' }}>
                          {w.after.toFixed(4)}
                        </td>
                        <td style={{
                          padding: '6px',
                          border: '1px solid #ddd',
                          textAlign: 'right',
                          fontSize: '11px',
                          color: w.delta >= 0 ? '#28a745' : '#dc3545',
                          fontWeight: 'bold'
                        }}>
                          {w.delta >= 0 ? '+' : ''}{w.delta.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* トップ候補 */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: 'bold', color: '#333' }}>
              トップ候補作品（上位{debug.topCandidates.length}件）
            </h3>
            <div style={{ fontSize: '12px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f0f0' }}>
                    <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #ddd', fontSize: '12px' }}>順位</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd', fontSize: '12px' }}>タイトル</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd', fontSize: '12px' }}>作者</th>
                    <th style={{ padding: '8px', textAlign: 'right', border: '1px solid #ddd', fontSize: '12px' }}>スコア</th>
                    <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #ddd', fontSize: '12px' }}>タグ</th>
                  </tr>
                </thead>
                <tbody>
                  {debug.topCandidates.map((candidate, index) => (
                    <tr key={candidate.workId} style={{ backgroundColor: index === 0 ? '#d4edda' : '#fff' }}>
                      <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'center', fontSize: '11px', fontWeight: index === 0 ? 'bold' : 'normal' }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '6px', border: '1px solid #ddd', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {candidate.title}
                      </td>
                      <td style={{ padding: '6px', border: '1px solid #ddd', fontSize: '11px' }}>
                        {candidate.authorName}
                      </td>
                      <td style={{ padding: '6px', border: '1px solid #ddd', textAlign: 'right', fontSize: '11px', fontFamily: 'monospace' }}>
                        {candidate.score.toFixed(4)}
                      </td>
                      <td style={{ padding: '6px', border: '1px solid #ddd', fontSize: '11px', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {candidate.tags.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rationale Raw（折りたたみ可能） */}
          {Object.keys(debug.rationaleRaw).length > 0 && (
            <details style={{ marginTop: '20px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '14px', fontWeight: 'bold', color: '#666', marginBottom: '8px' }}>
                詳細ログ（クリックで展開）
              </summary>
              <pre style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                backgroundColor: '#f5f5f5',
                padding: '12px',
                borderRadius: '6px',
                overflow: 'auto',
                maxHeight: '300px',
                border: '1px solid #ddd'
              }}>
                {JSON.stringify(debug.rationaleRaw, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
