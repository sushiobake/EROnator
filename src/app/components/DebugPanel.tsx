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
      workTitle?: string; // 作品名を追加
      before: number;
      after: number;
      delta: number;
    }>;
  };
  lastAnswerMeta?: {
    questionId?: string;
    answerValue: string;
    touchedTagKeys: string[];
    touchedTagNames?: string[]; // タグ名を追加
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

interface RevealAnalysis {
  confidence: number;
  tagAlignment: {
    matchedTags: string[];
    unmatchedTags: string[];
    alignmentScore: number;
  };
  questionSummary: {
    totalQuestions: number;
    exploreTagCount: number;
    confirmCount: number;
    keyTags: Array<{
      tagKey: string;
      displayName: string;
      answered: 'YES' | 'PROBABLY_YES' | 'NO' | 'PROBABLY_NO' | 'UNKNOWN' | 'DONT_CARE';
    }>;
  };
}

interface DebugPanelProps {
  debug: DebugPayload | null;
  revealAnalysis?: RevealAnalysis | null;
  open: boolean;
  onToggle: () => void;
}

export function DebugPanel({ debug, revealAnalysis, open, onToggle }: DebugPanelProps) {
  // 左上に固定。ヘッダー風ではなく常に角に配置。
  const topStyle = { top: '20px', left: '20px', width: '510px', maxWidth: 'calc(100vw - 48px)' };

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
          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
            デバッグパネル（データなし）
          </span>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{open ? '−' : '+'}</span>
        </div>
        {open && (
          <div style={{ padding: '12px' }}>
            <p style={{ color: '#666', fontSize: '14px' }}>
              デバッグデータがまだありません。
              <br />
              ゲームを開始して質問に回答すると、デバッグ情報が表示されます。
            </p>
          </div>
        )}
      </div>
    );
  }

  const topGapAfter = useMemo(() => {
    return debug.after.top1Score - debug.after.top2Score;
  }, [debug.after.top1Score, debug.after.top2Score]);

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
        maxHeight: '65vh',
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
        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
          デバッグパネル（ステップ {debug.step}）
        </span>
        <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{open ? '−' : '+'}</span>
      </div>

      {open && (
        <div style={{ padding: '6px 8px', overflow: 'auto', minHeight: 0, flex: 1, fontSize: '10px' }}>
          {/* 上段まとめ: セッション＋変化＋影響タグを少行数に */}
          <div style={{ marginBottom: '6px', padding: '6px 8px', backgroundColor: '#f5f5f5', borderRadius: '4px', lineHeight: '1.35' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 12px', alignItems: 'baseline' }}>
              <span><strong>Q{debug.session.questionCount}問</strong></span>
              <span>確信 <span style={{ color: '#0070f3', fontWeight: 'bold' }}>{(debug.session.confidence * 100).toFixed(2)}%</span></span>
              <span>候補{debug.session.candidateCount}件</span>
              <span>top1 {debug.session.top1Score.toFixed(4)} / top2 {debug.session.top2Score.toFixed(4)}</span>
              <span>差 <span style={{ color: debug.session.top1Score - debug.session.top2Score >= 0.1 ? '#28a745' : '#ffc107' }}>{(debug.session.top1Score - debug.session.top2Score).toFixed(4)}</span></span>
            </div>
            {debug.before && debug.delta && (
              <div style={{ marginTop: '4px', color: '#856404' }}>
                変化: 確信 {(debug.before.confidence * 100).toFixed(2)}%→{(debug.after.confidence * 100).toFixed(2)}%
                <span style={{ color: debug.delta.confidenceDelta >= 0 ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>({debug.delta.confidenceDelta >= 0 ? '+' : ''}{(debug.delta.confidenceDelta * 100).toFixed(2)}%)</span>
                {' · '}候補{debug.before.candidateCount}→{debug.after.candidateCount}
                {' · '}差 {(debug.before.top1Score - debug.before.top2Score).toFixed(4)}→{topGapAfter.toFixed(4)}
              </div>
            )}
            {debug.lastAnswerMeta && debug.lastAnswerMeta.touchedTagKeys.length > 0 && (
              <div style={{ marginTop: '2px', fontSize: '10px', color: '#0c5460' }}>
                影響タグ: {(debug.lastAnswerMeta.touchedTagNames || debug.lastAnswerMeta.touchedTagKeys).join(', ')}
              </div>
            )}
          </div>

          {/* 重みの変化（Top N） */}
          {debug.delta && debug.delta.weightDeltasTop.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                重みの変化（上位{debug.delta.weightDeltasTop.length}件）
              </h3>
              <div style={{ fontSize: '10px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                      <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #ddd', fontSize: '10px' }}>作品名</th>
                      <th style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd', fontSize: '10px' }}>変更前</th>
                      <th style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd', fontSize: '10px' }}>変更後</th>
                      <th style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd', fontSize: '10px' }}>変化量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {debug.delta.weightDeltasTop.map(w => (
                      <tr key={w.workId} style={{ backgroundColor: w.delta !== 0 ? '#fff3cd' : '#fff' }}>
                        <td style={{ padding: '3px 4px', border: '1px solid #ddd', fontSize: '10px', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={w.workId}>
                          {w.workTitle || w.workId}
                        </td>
                        <td style={{ padding: '3px 4px', border: '1px solid #ddd', textAlign: 'right', fontSize: '10px' }}>
                          {w.before.toFixed(4)}
                        </td>
                        <td style={{ padding: '3px 4px', border: '1px solid #ddd', textAlign: 'right', fontSize: '10px' }}>
                          {w.after.toFixed(4)}
                        </td>
                        <td style={{
                          padding: '3px 4px',
                          border: '1px solid #ddd',
                          textAlign: 'right',
                          fontSize: '10px',
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
          <div style={{ marginBottom: '8px' }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
              トップ候補作品（上位{debug.topCandidates.length}件）
            </h3>
            <div style={{ fontSize: '10px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f0f0f0' }}>
                    <th style={{ padding: '4px', textAlign: 'center', border: '1px solid #ddd', fontSize: '10px' }}>順位</th>
                    <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #ddd', fontSize: '10px' }}>タイトル</th>
                    <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #ddd', fontSize: '10px' }}>作者</th>
                    <th style={{ padding: '4px', textAlign: 'right', border: '1px solid #ddd', fontSize: '10px' }}>スコア</th>
                    <th style={{ padding: '4px', textAlign: 'left', border: '1px solid #ddd', fontSize: '10px' }}>タグ</th>
                  </tr>
                </thead>
                <tbody>
                  {debug.topCandidates.map((candidate, index) => (
                    <tr key={candidate.workId} style={{ backgroundColor: index === 0 ? '#d4edda' : '#fff' }}>
                      <td style={{ padding: '3px 4px', border: '1px solid #ddd', textAlign: 'center', fontSize: '10px', fontWeight: index === 0 ? 'bold' : 'normal' }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '3px 4px', border: '1px solid #ddd', fontSize: '10px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {candidate.title}
                      </td>
                      <td style={{ padding: '3px 4px', border: '1px solid #ddd', fontSize: '10px' }}>
                        {candidate.authorName}
                      </td>
                      <td style={{ padding: '3px 4px', border: '1px solid #ddd', textAlign: 'right', fontSize: '10px', fontFamily: 'monospace' }}>
                        {candidate.score.toFixed(4)}
                      </td>
                      <td style={{ padding: '3px 4px', border: '1px solid #ddd', fontSize: '10px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
            <details style={{ marginTop: '8px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#666', marginBottom: '4px' }}>
                詳細ログ（クリックで展開）
              </summary>
              <pre style={{
                fontSize: '10px',
                fontFamily: 'monospace',
                backgroundColor: '#f5f5f5',
                padding: '8px',
                borderRadius: '4px',
                overflow: 'auto',
                maxHeight: '200px',
                border: '1px solid #ddd'
              }}>
                {JSON.stringify(debug.rationaleRaw, null, 2)}
              </pre>
            </details>
          )}

          {/* REVEAL分析（断定時の確度・タグ整合度） */}
          {revealAnalysis && (
            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#e8f5e9', borderRadius: '4px', border: '1px solid #4caf50' }}>
              <h3 style={{ margin: '0 0 6px 0', fontSize: '11px', fontWeight: 'bold', color: '#333' }}>
                🎯 REVEAL分析（断定結果）
              </h3>
              
              {/* 確度 */}
              <div style={{ marginBottom: '6px' }}>
                <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                  <strong>確度:</strong>
                  <span style={{ 
                    marginLeft: '6px', 
                    fontSize: '12px', 
                    fontWeight: 'bold',
                    color: revealAnalysis.confidence >= 0.7 ? '#4caf50' : revealAnalysis.confidence >= 0.5 ? '#ff9800' : '#f44336'
                  }}>
                    {(revealAnalysis.confidence * 100).toFixed(2)}%
                  </span>
                </div>
              </div>

              {/* タグ整合度 */}
              <div style={{ marginBottom: '6px' }}>
                <div style={{ fontSize: '11px', marginBottom: '4px' }}>
                  <strong>タグ整合度:</strong>
                  <span style={{ 
                    marginLeft: '6px', 
                    fontSize: '12px', 
                    fontWeight: 'bold',
                    color: revealAnalysis.tagAlignment.alignmentScore >= 0.7 ? '#4caf50' : revealAnalysis.tagAlignment.alignmentScore >= 0.5 ? '#ff9800' : '#f44336'
                  }}>
                    {(revealAnalysis.tagAlignment.alignmentScore * 100).toFixed(2)}%
                  </span>
                </div>
                {revealAnalysis.tagAlignment.matchedTags.length > 0 && (
                  <div style={{ fontSize: '10px', marginTop: '2px', color: '#2e7d32' }}>
                    ✅ 一致: {revealAnalysis.tagAlignment.matchedTags.join(', ')}
                  </div>
                )}
                {revealAnalysis.tagAlignment.unmatchedTags.length > 0 && (
                  <div style={{ fontSize: '10px', marginTop: '2px', color: '#c62828' }}>
                    ❌ 不一致: {revealAnalysis.tagAlignment.unmatchedTags.join(', ')}
                  </div>
                )}
              </div>

              {/* 質問要約 */}
              <div style={{ fontSize: '11px' }}>
                <div style={{ marginBottom: '4px' }}>
                  <strong>質問数:</strong> {revealAnalysis.questionSummary.totalQuestions}問
                  <span style={{ marginLeft: '8px' }}>
                    （探索: {revealAnalysis.questionSummary.exploreTagCount}、確認: {revealAnalysis.questionSummary.confirmCount}）
                  </span>
                </div>
                {revealAnalysis.questionSummary.keyTags.length > 0 && (
                  <div style={{ marginTop: '4px' }}>
                    <strong>質問タグ:</strong>
                    <div style={{ marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                      {revealAnalysis.questionSummary.keyTags.map((tag: { tagKey: string; displayName: string }) => (
                        <span
                          key={tag.tagKey}
                          style={{
                            display: 'inline-block',
                            padding: '2px 5px',
                            backgroundColor: '#fff',
                            borderRadius: '3px',
                            border: '1px solid #4caf50',
                            fontSize: '10px'
                          }}
                        >
                          {tag.displayName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
