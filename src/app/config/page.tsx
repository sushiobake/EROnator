/**
 * 設定変更ページ
 * 開発環境のみアクセス可能
 */

'use client';

import { useState, useEffect } from 'react';

interface MvpConfig {
  version: string;
  confirm: {
    revealThreshold: number;
    confidenceConfirmBand: [number, number];
    qForcedIndices: number[];
    softConfidenceMin: number;
    hardConfidenceMin: number;
  };
  algo: {
    beta: number;
    alpha: number;
    derivedConfidenceThreshold: number;
    revealPenalty: number;
  };
  flow: {
    maxQuestions: number;
    maxRevealMisses: number;
    failListN: number;
    effectiveConfirmThresholdFormula: string;
    effectiveConfirmThresholdParams: {
      min: number;
      max: number;
      divisor: number;
    };
  };
  dataQuality: {
    minCoverageMode: string;
    minCoverageRatio: number | null;
    minCoverageWorks: number | null;
  };
  popularity: {
    playBonusOnSuccess: number;
  };
}

export default function ConfigPage() {
  const [config, setConfig] = useState<MvpConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);

  useEffect(() => {
    loadConfig();
    // localStorageからデバッグモードの状態を読み込む
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('eronator.debugEnabled') === '1';
      setDebugEnabled(stored);
    }
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        if (response.status === 404) {
          setMessage({ type: 'error', text: 'このページは開発環境でのみ利用できます。' });
        } else {
          const data = await response.json();
          setMessage({ type: 'error', text: data.error || '設定の読み込みに失敗しました。' });
        }
        setLoading(false);
        return;
      }
      const data = await response.json();
      if (data.success) {
        setConfig(data.config);
      } else {
        setMessage({ type: 'error', text: data.error || '設定の読み込みに失敗しました。' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '設定の読み込みに失敗しました。' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: '設定を保存しました。開発サーバーを再起動してください。' });
      } else {
        setMessage({ type: 'error', text: data.details || data.error || '設定の保存に失敗しました。' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '設定の保存に失敗しました。' });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (path: string[], value: any) => {
    if (!config) return;
    const newConfig = JSON.parse(JSON.stringify(config));
    let current: any = newConfig;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    setConfig(newConfig);
  };

  const handleDebugToggle = (enabled: boolean) => {
    setDebugEnabled(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('eronator.debugEnabled', enabled ? '1' : '0');
      setMessage({ type: 'success', text: 'デバッグモードの設定を保存しました。ページをリロードしてください。' });
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>読み込み中...</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'red' }}>設定を読み込めませんでした。</p>
        <button onClick={loadConfig} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>設定変更</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        開発環境でのみ利用可能です。設定変更後は開発サーバーを再起動してください。
      </p>

      {message && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            backgroundColor: message.type === 'success' ? '#d4edda' : '#f8d7da',
            color: message.type === 'success' ? '#155724' : '#721c24',
            border: `1px solid ${message.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
            borderRadius: '4px',
          }}
        >
          {message.text}
        </div>
      )}

      {/* デバッグモードセクション（最上部に追加） */}
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
        <h2>デバッグ設定</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={debugEnabled}
              onChange={(e) => handleDebugToggle(e.target.checked)}
              style={{ marginRight: '0.5rem', width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <strong>デバッグパネルを表示する</strong>
          </label>
          <p style={{ marginTop: '0.5rem', marginLeft: '1.75rem', fontSize: '0.9rem', color: '#666' }}>
            チェックを入れると、ゲーム画面にデバッグパネルが表示されます。
            <br />
            デバッグパネルには、内部状態（確信度、候補数、重みの変化など）が表示されます。
          </p>
        </div>
      </section>

      {/* Confirm セクション */}
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h2>Confirm（確認質問）</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>revealThreshold（REVEAL判定の閾値）</strong>
            <br />
            <small>0.0 ～ 1.0。confidence がこの値以上でREVEALに遷移します。</small>
            <br />
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={config.confirm.revealThreshold}
              onChange={(e) => updateConfig(['confirm', 'revealThreshold'], parseFloat(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>confidenceConfirmBand（Confirm挿入のconfidence範囲）</strong>
            <br />
            <small>[最小値, 最大値]。この範囲内でConfirm質問が挿入されます。</small>
            <br />
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={config.confirm.confidenceConfirmBand[0]}
                onChange={(e) => {
                  const newBand: [number, number] = [parseFloat(e.target.value), config.confirm.confidenceConfirmBand[1]];
                  updateConfig(['confirm', 'confidenceConfirmBand'], newBand);
                }}
                style={{ flex: 1, padding: '0.5rem' }}
              />
              <span style={{ lineHeight: '2.5rem' }}>～</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={config.confirm.confidenceConfirmBand[1]}
                onChange={(e) => {
                  const newBand: [number, number] = [config.confirm.confidenceConfirmBand[0], parseFloat(e.target.value)];
                  updateConfig(['confirm', 'confidenceConfirmBand'], newBand);
                }}
                style={{ flex: 1, padding: '0.5rem' }}
              />
            </div>
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>qForcedIndices（強制Confirm位置）</strong>
            <br />
            <small>カンマ区切りで質問番号を指定（例: 6,10）</small>
            <br />
            <input
              type="text"
              value={config.confirm.qForcedIndices.join(',')}
              onChange={(e) => {
                const values = e.target.value.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
                updateConfig(['confirm', 'qForcedIndices'], values);
              }}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>softConfidenceMin（SOFT_CONFIRMの最小confidence）</strong>
            <br />
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={config.confirm.softConfidenceMin}
              onChange={(e) => updateConfig(['confirm', 'softConfidenceMin'], parseFloat(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>hardConfidenceMin（HARD_CONFIRMの最小confidence）</strong>
            <br />
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={config.confirm.hardConfidenceMin}
              onChange={(e) => updateConfig(['confirm', 'hardConfidenceMin'], parseFloat(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
          </label>
        </div>
      </section>

      {/* Algo セクション */}
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h2>Algo（アルゴリズム）</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>beta（重み更新の強度）</strong>
            <br />
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={config.algo.beta}
              onChange={(e) => updateConfig(['algo', 'beta'], parseFloat(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>alpha（人気度の重み）</strong>
            <br />
            <input
              type="number"
              step="0.001"
              min="0"
              max="1"
              value={config.algo.alpha}
              onChange={(e) => updateConfig(['algo', 'alpha'], parseFloat(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>derivedConfidenceThreshold（DERIVEDタグの二値化閾値）</strong>
            <br />
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={config.algo.derivedConfidenceThreshold}
              onChange={(e) => updateConfig(['algo', 'derivedConfidenceThreshold'], parseFloat(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>revealPenalty（REVEAL失敗時のペナルティ）</strong>
            <br />
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={config.algo.revealPenalty}
              onChange={(e) => updateConfig(['algo', 'revealPenalty'], parseFloat(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
          </label>
        </div>
      </section>

      {/* Flow セクション */}
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h2>Flow（フロー制御）</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>maxQuestions（最大質問数）</strong>
            <br />
            <input
              type="number"
              min="1"
              value={config.flow.maxQuestions}
              onChange={(e) => updateConfig(['flow', 'maxQuestions'], parseInt(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>maxRevealMisses（最大REVEAL失敗回数）</strong>
            <br />
            <input
              type="number"
              min="1"
              value={config.flow.maxRevealMisses}
              onChange={(e) => updateConfig(['flow', 'maxRevealMisses'], parseInt(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>failListN（FAIL_LIST表示件数）</strong>
            <br />
            <input
              type="number"
              min="1"
              value={config.flow.failListN}
              onChange={(e) => updateConfig(['flow', 'failListN'], parseInt(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>effectiveConfirmThresholdParams（Confirm挿入のeffectiveCandidates閾値）</strong>
            <br />
            <small>min: 最小値, max: 最大値, divisor: 作品数/divisorで計算</small>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label>
                  min:
                  <input
                    type="number"
                    min="1"
                    value={config.flow.effectiveConfirmThresholdParams.min}
                    onChange={(e) => updateConfig(['flow', 'effectiveConfirmThresholdParams', 'min'], parseInt(e.target.value))}
                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                  />
                </label>
              </div>
              <div style={{ flex: 1 }}>
                <label>
                  max:
                  <input
                    type="number"
                    min="1"
                    value={config.flow.effectiveConfirmThresholdParams.max}
                    onChange={(e) => updateConfig(['flow', 'effectiveConfirmThresholdParams', 'max'], parseInt(e.target.value))}
                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                  />
                </label>
              </div>
              <div style={{ flex: 1 }}>
                <label>
                  divisor:
                  <input
                    type="number"
                    min="1"
                    value={config.flow.effectiveConfirmThresholdParams.divisor}
                    onChange={(e) => updateConfig(['flow', 'effectiveConfirmThresholdParams', 'divisor'], parseInt(e.target.value))}
                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                  />
                </label>
              </div>
            </div>
          </label>
        </div>
      </section>

      {/* DataQuality セクション */}
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h2>DataQuality（データ品質）</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>minCoverageMode（Coverage Gateのモード）</strong>
            <br />
            <select
              value={config.dataQuality.minCoverageMode}
              onChange={(e) => updateConfig(['dataQuality', 'minCoverageMode'], e.target.value)}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            >
              <option value="RATIO">RATIO</option>
              <option value="WORKS">WORKS</option>
              <option value="AUTO">AUTO</option>
            </select>
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>minCoverageRatio（最小カバレッジ比率）</strong>
            <br />
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={config.dataQuality.minCoverageRatio ?? ''}
              onChange={(e) => updateConfig(['dataQuality', 'minCoverageRatio'], e.target.value === '' ? null : parseFloat(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>minCoverageWorks（最小カバレッジ作品数）</strong>
            <br />
            <input
              type="number"
              min="0"
              value={config.dataQuality.minCoverageWorks ?? ''}
              onChange={(e) => updateConfig(['dataQuality', 'minCoverageWorks'], e.target.value === '' ? null : parseInt(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
          </label>
        </div>
      </section>

      {/* Popularity セクション */}
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
        <h2>Popularity（人気度）</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>playBonusOnSuccess（REVEAL成功時のボーナス）</strong>
            <br />
            <input
              type="number"
              step="0.01"
              min="0"
              value={config.popularity.playBonusOnSuccess}
              onChange={(e) => updateConfig(['popularity', 'playBonusOnSuccess'], parseFloat(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
          </label>
        </div>
      </section>

      <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #ddd' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            backgroundColor: saving ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? '保存中...' : '設定を保存'}
        </button>
        <button
          onClick={loadConfig}
          disabled={saving}
          style={{
            padding: '0.75rem 2rem',
            fontSize: '1rem',
            marginLeft: '1rem',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          リセット
        </button>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h3>注意事項</h3>
        <ul style={{ marginLeft: '1.5rem' }}>
          <li>設定変更後は開発サーバーを再起動してください（<code>npm run dev</code>を停止して再起動）</li>
          <li>バリデーションエラーがある場合は保存されません</li>
          <li>保存前に自動的にバックアップが作成されます（<code>config/mvpConfig.json.bak</code>）</li>
          <li>このページは開発環境でのみ利用できます</li>
        </ul>
      </div>
    </div>
  );
}
