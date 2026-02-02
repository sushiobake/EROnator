/**
 * シミュレーションページ
 * /admin/simulate
 * 
 * 指定した作品を正解として、自動でゲームをシミュレーション
 * アルゴリズムの精度検証用
 */

'use client';

import { useState, useEffect } from 'react';
import { RANK_BG, RANK_TEXT } from '../constants/rankColors';

interface Work {
  workId: string;
  title: string;
  authorName: string;
  isAi: string;
}

interface SimulationStep {
  qIndex: number;
  question: {
    kind: string;
    displayText: string;
    tagKey?: string;
    hardConfirmType?: string;
    hardConfirmValue?: string;
  };
  answer: string;
  wasNoisy: boolean;
  confidenceBefore: number;
  confidenceAfter: number;
  top1WorkId: string;
  top1Probability: number;
}

interface SimulationResult {
  success: boolean;
  targetWorkId: string;
  targetWorkTitle: string;
  finalWorkId: string | null;
  finalWorkTitle: string | null;
  questionCount: number;
  steps: SimulationStep[];
  outcome: 'SUCCESS' | 'WRONG_REVEAL' | 'FAIL_LIST' | 'MAX_QUESTIONS';
}

interface BatchResult {
  totalTrials: number;
  successCount: number;
  successRate: number;
  avgQuestions: number;
  results: Array<{
    workId: string;
    title: string;
    success: boolean;
    questionCount: number;
    outcome: string;
  }>;
}

export default function SimulatePage() {
  const [works, setWorks] = useState<Work[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string>('');
  const [noiseRate, setNoiseRate] = useState<number>(0);
  const [aiGateChoice, setAiGateChoice] = useState<string>('BOTH');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [expandedSteps, setExpandedSteps] = useState(false);

  // バッチモード
  const [batchMode, setBatchMode] = useState(false);
  const [trialsPerWork, setTrialsPerWork] = useState(1);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // 作品一覧を取得
  useEffect(() => {
    const loadWorks = async () => {
      try {
        const response = await fetch('/api/admin/tags/load-from-db');
        if (response.ok) {
          const data = await response.json();
          setWorks(data.works || []);
        }
      } catch (error) {
        console.error('Failed to load works:', error);
      }
    };
    loadWorks();
  }, []);

  // 単発シミュレーション実行
  const runSimulation = async () => {
    if (!selectedWorkId) {
      alert('作品を選択してください');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetWorkId: selectedWorkId,
          noiseRate: noiseRate / 100, // パーセントから小数へ
          aiGateChoice,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Simulation failed');
      }

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Simulation error:', error);
      alert(error instanceof Error ? error.message : 'シミュレーションに失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // バッチシミュレーション実行
  const runBatchSimulation = async () => {
    setBatchLoading(true);
    setBatchResult(null);

    try {
      const response = await fetch('/api/admin/simulate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workIds: [], // 空 = 全作品
          noiseRate: noiseRate / 100,
          aiGateChoice,
          trialsPerWork,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Batch simulation failed');
      }

      const data = await response.json();
      setBatchResult(data);
    } catch (error) {
      console.error('Batch simulation error:', error);
      alert(error instanceof Error ? error.message : 'バッチシミュレーションに失敗しました');
    } finally {
      setBatchLoading(false);
    }
  };

  // ランダム作品を選択
  const selectRandomWork = () => {
    if (works.length > 0) {
      const randomIndex = Math.floor(Math.random() * works.length);
      setSelectedWorkId(works[randomIndex].workId);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>シミュレーション</h1>
      
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        指定した作品を「正解」として自動でゲームをプレイし、アルゴリズムの精度を検証します。
      </p>

      {/* ナビゲーション */}
      <div style={{ marginBottom: '2rem' }}>
        <a href="/admin/tags" style={{ color: '#0066cc', marginRight: '1rem' }}>
          ← タグ管理に戻る
        </a>
      </div>

      {/* 設定パネル */}
      <div style={{ 
        background: '#f5f5f5', 
        padding: '1.5rem', 
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>設定</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          {/* 作品選択 */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              正解作品
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                value={selectedWorkId}
                onChange={(e) => setSelectedWorkId(e.target.value)}
                style={{ 
                  flex: 1,
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #ccc'
                }}
              >
                <option value="">-- 選択 --</option>
                {works.map(work => (
                  <option key={work.workId} value={work.workId}>
                    {work.title} ({work.authorName})
                  </option>
                ))}
              </select>
              <button
                onClick={selectRandomWork}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                ランダム
              </button>
            </div>
          </div>

          {/* ノイズ率 */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              ノイズ率: {noiseRate}%
            </label>
            <input
              type="range"
              min="0"
              max="30"
              value={noiseRate}
              onChange={(e) => setNoiseRate(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '0.8rem', color: '#666' }}>
              回答を間違える確率（0% = 完璧に回答）
            </div>
          </div>

          {/* AIゲート選択 */}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              AIゲート
            </label>
            <select
              value={aiGateChoice}
              onChange={(e) => setAiGateChoice(e.target.value)}
              style={{ 
                width: '100%',
                padding: '0.5rem',
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
            >
              <option value="BOTH">両方（AI + 手描き）</option>
              <option value="AI_ONLY">AIのみ</option>
              <option value="HAND_ONLY">手描きのみ</option>
            </select>
          </div>
        </div>

        {/* 実行ボタン */}
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={runSimulation}
            disabled={loading || !selectedWorkId}
            style={{
              padding: '0.75rem 2rem',
              background: loading ? '#ccc' : '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'default' : 'pointer',
              fontSize: '1rem',
            }}
          >
            {loading ? '実行中...' : '単発シミュレーション実行'}
          </button>

          <button
            onClick={() => setBatchMode(!batchMode)}
            style={{
              padding: '0.75rem 2rem',
              background: batchMode ? '#ff6600' : '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            {batchMode ? 'バッチモード ON' : 'バッチモード OFF'}
          </button>
        </div>

        {/* バッチモード設定 */}
        {batchMode && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: RANK_BG.B,
            borderRadius: '4px'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontWeight: 'bold' }}>
                作品あたりの試行回数: {trialsPerWork}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={trialsPerWork}
                onChange={(e) => setTrialsPerWork(Number(e.target.value))}
                style={{ width: '100%', marginTop: '0.5rem' }}
              />
            </div>
            <button
              onClick={runBatchSimulation}
              disabled={batchLoading}
              style={{
                padding: '0.75rem 2rem',
                background: batchLoading ? '#ccc' : '#ff6600',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: batchLoading ? 'default' : 'pointer',
              }}
            >
              {batchLoading ? '実行中...' : `全${works.length}作品でバッチ実行`}
            </button>
          </div>
        )}
      </div>

      {/* 単発結果 */}
      {result && (
        <div style={{ 
          background: result.success ? '#e8f5e9' : '#ffebee',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '2rem'
        }}>
          <h2 style={{ 
            fontSize: '1.5rem', 
            marginBottom: '1rem',
            color: result.success ? '#2e7d32' : '#c62828'
          }}>
            {result.success ? '成功' : '失敗'} - {result.outcome}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <strong>正解作品:</strong><br />
              {result.targetWorkTitle}
            </div>
            <div>
              <strong>最終結果:</strong><br />
              {result.finalWorkTitle || '(なし)'}
            </div>
            <div>
              <strong>質問数:</strong> {result.questionCount}問
            </div>
            <div>
              <strong>結果:</strong> {result.outcome}
            </div>
          </div>

          {/* ステップ詳細 */}
          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={() => setExpandedSteps(!expandedSteps)}
              style={{
                padding: '0.5rem 1rem',
                background: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {expandedSteps ? '過程を閉じる' : '過程を表示'}
            </button>

            {expandedSteps && (
              <div style={{ 
                marginTop: '1rem',
                maxHeight: '400px',
                overflowY: 'auto',
                background: '#fff',
                padding: '1rem',
                borderRadius: '4px',
                fontSize: '0.9rem'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f0f0f0' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Q#</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>質問</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center' }}>回答</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center' }}>ノイズ</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>確度</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.steps.map((step, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.5rem' }}>{step.qIndex}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <span style={{ 
                            display: 'inline-block',
                            padding: '0.2rem 0.5rem',
                            background: step.question.kind === 'EXPLORE_TAG' ? RANK_BG.S 
                              : step.question.kind === 'SOFT_CONFIRM' ? RANK_BG.B
                              : RANK_BG.X,
                            color: step.question.kind === 'EXPLORE_TAG' ? RANK_TEXT.S : step.question.kind === 'SOFT_CONFIRM' ? RANK_TEXT.B : RANK_TEXT.X,
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            marginRight: '0.5rem'
                          }}>
                            {step.question.kind}
                          </span>
                          {step.question.displayText}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          <span style={{
                            color: step.answer === 'YES' ? '#2e7d32' : '#c62828',
                            fontWeight: 'bold'
                          }}>
                            {step.answer}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                          {step.wasNoisy && <span style={{ color: '#ff6600' }}>!</span>}
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                          {(step.confidenceBefore * 100).toFixed(1)}%
                          → {(step.confidenceAfter * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* バッチ結果 */}
      {batchResult && (
        <div style={{ 
          background: '#e3f2fd',
          padding: '1.5rem',
          borderRadius: '8px',
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
            バッチ結果
          </h2>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(4, 1fr)', 
            gap: '1rem',
            marginBottom: '1rem'
          }}>
            <div style={{ 
              background: '#fff', 
              padding: '1rem', 
              borderRadius: '4px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#0066cc' }}>
                {(batchResult.successRate * 100).toFixed(1)}%
              </div>
              <div style={{ color: '#666' }}>成功率</div>
            </div>
            <div style={{ 
              background: '#fff', 
              padding: '1rem', 
              borderRadius: '4px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {batchResult.successCount}/{batchResult.totalTrials}
              </div>
              <div style={{ color: '#666' }}>成功/総数</div>
            </div>
            <div style={{ 
              background: '#fff', 
              padding: '1rem', 
              borderRadius: '4px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                {batchResult.avgQuestions.toFixed(1)}
              </div>
              <div style={{ color: '#666' }}>平均質問数</div>
            </div>
            <div style={{ 
              background: '#fff', 
              padding: '1rem', 
              borderRadius: '4px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#c62828' }}>
                {batchResult.results.filter(r => !r.success).length}
              </div>
              <div style={{ color: '#666' }}>失敗数</div>
            </div>
          </div>

          {/* 失敗した作品一覧 */}
          {batchResult.results.filter(r => !r.success).length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>失敗した作品</h3>
              <div style={{ 
                maxHeight: '200px', 
                overflowY: 'auto',
                background: '#fff',
                padding: '1rem',
                borderRadius: '4px'
              }}>
                {batchResult.results.filter(r => !r.success).map((r, i) => (
                  <div key={i} style={{ 
                    padding: '0.5rem',
                    borderBottom: '1px solid #eee'
                  }}>
                    <strong>{r.title}</strong>
                    <span style={{ marginLeft: '1rem', color: '#666' }}>
                      {r.outcome} ({r.questionCount}問)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
