/**
 * 推薦モード用デバッグパネル（ローカル専用）
 * エロネイター本編の DebugPanel と同じ形
 */

'use client';

import { useMediaQuery } from './useMediaQuery';

export type RecommendDebugPhase = 'q4' | 'results';

export type RecommendDebugDataQ4 = {
  phase: 'q4';
  selectedFamous: Array<{ tagKey: string; displayName: string; weight: number; important: boolean }>;
  unknownTagsWithCount: Array<{ tagKey: string; displayName: string; count: number }>;
};

export type RecommendDebugDataResults = {
  phase: 'results';
  tagsWithWeights: Array<{ tagKey: string; displayName: string; weight: number; source: string }>;
  works: Array<{
    workId: string;
    title: string;
    matchRate: number;
    score: number;
    tags: Array<{ tagKey: string; displayName: string }>;
  }>;
};

export type RecommendDebugData = RecommendDebugDataQ4 | RecommendDebugDataResults;

interface RecommendDebugPanelProps {
  debug: RecommendDebugData | null;
  open: boolean;
  onToggle: () => void;
  /** デバッグ用: 結果表示画面へ強制遷移 */
  onForceNavigateToResults?: () => void;
}

export function RecommendDebugPanel({ debug, open, onToggle, onForceNavigateToResults }: RecommendDebugPanelProps) {
  const isMobile = useMediaQuery(768);

  const topStyle = { top: '20px', left: '20px', width: '510px', maxWidth: 'calc(100vw - 48px)' };

  if (isMobile) return null;

  if (!debug) {
    return (
      <div
        style={{
          position: 'fixed',
          ...topStyle,
          zIndex: 10001,
          backgroundColor: '#fff',
          border: '2px solid #ffc107',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            backgroundColor: '#ffc107',
            color: '#000',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={onToggle}
        >
          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>推薦デバッグ（データなし）</span>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{open ? '−' : '+'}</span>
        </div>
        {open && (
          <div style={{ padding: '12px' }}>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '10px' }}>
              質問4以降でデバッグ情報が表示されます。
            </p>
            {onForceNavigateToResults && (
              <div style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={onForceNavigateToResults}
                  style={{ padding: '6px 12px', fontSize: '12px', fontWeight: 600, backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                >
                  結果表示へ
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const title =
    debug.phase === 'q4'
      ? '推薦デバッグ（質問4）'
      : '推薦デバッグ（結果）';

  return (
    <div
      style={{
        position: 'fixed',
        ...topStyle,
        zIndex: 10001,
        backgroundColor: '#fff',
        border: '2px solid #0070f3',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        maxHeight: '88vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: '10px 12px',
          backgroundColor: '#0070f3',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{title}</span>
        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{open ? '−' : '+'}</span>
      </div>

      {open && (
        <div style={{ padding: '6px 8px', overflow: 'auto', minHeight: 0, flex: 1, fontSize: '10px' }}>
          {/* 強制遷移ボタン */}
          {onForceNavigateToResults && debug.phase !== 'results' && (
            <div style={{ marginBottom: '8px', padding: '6px 8px', backgroundColor: '#e7f3ff', borderRadius: '4px', border: '1px solid #0070f3' }}>
              <button
                type="button"
                onClick={onForceNavigateToResults}
                style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 600, backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                結果表示へ
              </button>
            </div>
          )}
          {debug.phase === 'q4' && (
            <>
              <div style={{ marginBottom: '8px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                  質問3までに選ばれた有名タグと重み
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #ddd', fontSize: '10px' }}>タグ</th>
                      <th style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd', fontSize: '10px' }}>重み</th>
                      <th style={{ padding: '4px', textAlign: 'center', border: '1px solid #ddd', fontSize: '10px' }}>重要</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debug.selectedFamous.map((t, i) => (
                      <tr key={i}>
                        <td style={{ padding: '4px', border: '1px solid #ddd' }}>{t.displayName}</td>
                        <td style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd' }}>{t.weight}</td>
                        <td style={{ padding: '4px', textAlign: 'center', border: '1px solid #ddd' }}>{t.important ? '★' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                  無名タグ候補（関連度＝出現作品数）上位20件×3
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd', fontSize: '10px' }}>#</th>
                      <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #ddd', fontSize: '10px' }}>タグ</th>
                      <th style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd', fontSize: '10px' }}>関連度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debug.unknownTagsWithCount.map((t, i) => (
                      <tr key={i}>
                        <td style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd' }}>{i + 1}</td>
                        <td style={{ padding: '4px', border: '1px solid #ddd' }}>{t.displayName}</td>
                        <td style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd' }}>{t.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {debug.phase === 'results' && (
            <>
              <div style={{ marginBottom: '8px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                  選んだタグと重み（すべて）
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #ddd', fontSize: '10px' }}>タグ</th>
                      <th style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd', fontSize: '10px' }}>重み</th>
                      <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #ddd', fontSize: '10px' }}>種別</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debug.tagsWithWeights.map((t, i) => (
                      <tr key={i}>
                        <td style={{ padding: '4px', border: '1px solid #ddd' }}>{t.displayName}</td>
                        <td style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd' }}>{t.weight}</td>
                        <td style={{ padding: '4px', border: '1px solid #ddd' }}>{t.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                  結果作品（タグ一覧・合致度）
                </h3>
                {debug.works.map((w, wi) => (
                  <div key={wi} style={{ marginBottom: '8px', padding: '6px', backgroundColor: '#f9f9f9', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {wi + 1}. {w.title}
                    </div>
                    <div style={{ marginBottom: '2px', color: '#0070f3' }}>
                      合致度: {w.matchRate}% / スコア: {w.score.toFixed(4)}
                    </div>
                    <div style={{ fontSize: '9px', color: '#666' }}>
                      タグ: {w.tags.map(t => t.displayName).join(', ') || '（なし）'}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
