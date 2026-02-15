/**
 * タグ管理・インポートページ
 * /admin/tags
 */

'use client';

import { useState, useEffect } from 'react';

interface ParsedWork {
  workId: string;
  cid: string;
  title: string;
  circleName: string;
  productUrl: string;
  thumbnailUrl: string | null;
  reviewAverage: number | null;
  reviewCount: number | null;
  popularityBase: number;
  popularityPlayBonus: number;
  isAi: 'AI' | 'HAND' | 'UNKNOWN';
  scrapedAt: string;
  officialTags: string[];
  metaText: string;
  commentText: string;
  isDuplicate?: boolean;
  existingTitle?: string | null;
}

interface ParseResponse {
  success: boolean;
  mode?: string;
  works?: ParsedWork[];
  stats?: {
    total: number;
    new: number;
    duplicate: number;
  };
  error?: string;
}

type TabType = 'works' | 'tags' | 'config' | 'import';

export default function AdminTagsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('works');
  const [adminToken, setAdminToken] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'full' | 'append'>('full');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [selectedWorks, setSelectedWorks] = useState<Set<string>>(new Set());
  const [analysisResults, setAnalysisResults] = useState<Record<string, {
    derivedTags: Array<{ displayName: string; confidence: number; category: string | null }>;
    characterTags: string[];
  }>>({});

  const [dbLoaded, setDbLoaded] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState<{ workId: string; comment: string } | null>(null);
  
  // コンフィグ用のstate
  const [config, setConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);

  // 初回読み込み時にlocalStorageからークンを取得し、自動でDBを読み込む
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('eronator.adminToken');
      if (stored) {
        setAdminToken(stored);
        // ークンがある場合は自動でDBを読み込む（確認なし）
        handleLoadFromDbAuto(stored);
      }
    }
  }, []);

  // 自動DB読み込み用の関数（確認なし）
  const handleLoadFromDbAuto = async (token: string) => {
    if (dbLoaded) return; // 既に読み込み済みの場合はスキップ

    setLoading(true);
    try {
      const response = await fetch('/api/admin/tags/load-from-db', {
        method: 'POST',
        headers: {
          'x-eronator-admin-token': token,
        },
      });

      if (!response.ok) {
        // エラーは静かに無視（初回起動時はDBが空の可能性がある）
        return;
      }

      const data = await response.json();
      
      if (data.success && Array.isArray(data.works) && data.works.length > 0) {
        setParseResult({
          success: true,
          mode: 'db',
          works: data.works.map((w: any) => ({
            ...w,
            isDuplicate: false,
          })),
          stats: data.stats,
        });
        
        setSelectedWorks(new Set(data.works.map((w: any) => w.workId)));
        
        const existingResults: Record<string, {
          derivedTags: Array<{ displayName: string; confidence: number; category: string | null }>;
          characterTags: string[];
        }> = {};
        
        for (const work of data.works) {
          existingResults[work.workId] = {
            derivedTags: work.derivedTags || [],
            characterTags: work.characterTags || [],
          };
        }
        
        setAnalysisResults(existingResults);
        setDbLoaded(true);
      }
    } catch (error) {
      console.error('DB自動読み込みエラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParseResult(null);
      setSelectedWorks(new Set());
    }
  };

  const handleParse = async () => {
    if (!file) {
      alert('ファイルを選択してください');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);

      if (!adminToken) {
        alert('管理トークンを入力してください');
        return;
      }

      const response = await fetch('/api/admin/tags/parse', {
        method: 'POST',
        headers: {
          'x-eronator-admin-token': adminToken,
        },
        body: formData,
      });

      const data: ParseResponse = await response.json();
      setParseResult(data);

      if (data.success && data.works) {
        // 全作品を選択状態にする
        setSelectedWorks(new Set(data.works.map(w => w.workId)));
      }
    } catch (error) {
      console.error('Error parsing file:', error);
      setParseResult({
        success: false,
        error: 'ファイルのパースに失敗しました',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkSelection = (workId: string) => {
    const newSelected = new Set(selectedWorks);
    if (newSelected.has(workId)) {
      newSelected.delete(workId);
    } else {
      newSelected.add(workId);
    }
    setSelectedWorks(newSelected);
  };

  const toggleAllSelection = () => {
    if (!parseResult?.works) return;

    if (selectedWorks.size === parseResult.works.length) {
      setSelectedWorks(new Set());
    } else {
      setSelectedWorks(new Set(parseResult.works.map(w => w.workId)));
    }
  };

  const handleAnalyze = async () => {
    if (!parseResult?.works || selectedWorks.size === 0 || !adminToken) {
      alert('作品を選択してください');
      return;
    }

    console.log('[UI] Starting AI analysis...');
    console.log('[UI] Selected works:', selectedWorks.size);
    
    setAnalyzing(true);
    setAnalysisResults({});

    try {
      // 選択された作品のデータを準備
      const worksToAnalyze = parseResult.works
        .filter(w => selectedWorks.has(w.workId))
        .map(w => ({
          workId: w.workId,
          title: w.title,
          commentText: w.commentText,
        }));

      console.log('[UI] Sending request to /api/admin/tags/analyze');
      console.log('[UI] Works to analyze:', worksToAnalyze.length);
      console.log('[UI] Sample work:', worksToAnalyze[0]?.workId, worksToAnalyze[0]?.title);

      const response = await fetch('/api/admin/tags/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({ works: worksToAnalyze }),
      });

      console.log('[UI] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[UI] API error:', response.status, errorText);
        alert(`AI分析に失敗しました: ${response.status} ${errorText}`);
        return;
      }

      const data = await response.json();
      console.log('[UI] Response data:', data);

      if (data.success && data.results) {
        console.log('[UI] Analysis results received:', data.results.length);
        
        // 結果をworkIdをキーにしたオブジェクに変換
        const resultsMap: Record<string, typeof data.results[0]> = {};
        for (const result of data.results) {
          resultsMap[result.workId] = {
            derivedTags: result.derivedTags,
            characterTags: result.characterTags,
          };
        }
        
        console.log('[UI] Setting analysis results:', Object.keys(resultsMap).length);
        setAnalysisResults(resultsMap);
        
        const totalTags = data.results.reduce((sum: number, r: any) => sum + r.derivedTags.length + r.characterTags.length, 0);
        console.log('[UI] Total tags extracted:', totalTags);
        
        if (totalTags === 0) {
          console.warn('[UI] No tags extracted from any work');
        }
      } else {
        console.error('[UI] Analysis failed:', data.error);
        alert(`AI分析に失敗しました: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[UI] Error analyzing works:', error);
      alert(`AI分析中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const token = e.target.value;
    setAdminToken(token);
    if (typeof window !== 'undefined') {
      localStorage.setItem('eronator.adminToken', token);
    }
  };

  // Derived Tag 編集関数
  const handleAddDerivedTag = (workId: string) => {
    setAnalysisResults(prev => ({
      ...prev,
      [workId]: {
        ...prev[workId],
        derivedTags: [
          ...prev[workId].derivedTags,
          { displayName: '', confidence: 0.5, category: null },
        ],
      },
    }));
  };

  const handleRemoveDerivedTag = (workId: string, index: number) => {
    setAnalysisResults(prev => ({
      ...prev,
      [workId]: {
        ...prev[workId],
        derivedTags: prev[workId].derivedTags.filter((_, i) => i !== index),
      },
    }));
  };

  const handleUpdateDerivedTag = (
    workId: string,
    index: number,
    field: 'displayName' | 'confidence' | 'category',
    value: string | number | null
  ) => {
    setAnalysisResults(prev => ({
      ...prev,
      [workId]: {
        ...prev[workId],
        derivedTags: prev[workId].derivedTags.map((tag, i) =>
          i === index ? { ...tag, [field]: value } : tag
        ),
      },
    }));
  };

  const handleMoveDerivedTag = (workId: string, index: number, direction: 'up' | 'down') => {
    setAnalysisResults(prev => {
      const tags = [...prev[workId].derivedTags];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= tags.length) return prev;
      
      [tags[index], tags[newIndex]] = [tags[newIndex], tags[index]];
      
      return {
        ...prev,
        [workId]: {
          ...prev[workId],
          derivedTags: tags,
        },
      };
    });
  };

  // Character Tag 編集関数
  const handleAddCharacterTag = (workId: string) => {
    setAnalysisResults(prev => ({
      ...prev,
      [workId]: {
        ...prev[workId],
        characterTags: [...prev[workId].characterTags, ''],
      },
    }));
  };

  const handleRemoveCharacterTag = (workId: string, index: number) => {
    setAnalysisResults(prev => ({
      ...prev,
      [workId]: {
        ...prev[workId],
        characterTags: prev[workId].characterTags.filter((_, i) => i !== index),
      },
    }));
  };

  const handleUpdateCharacterTag = (workId: string, index: number, value: string) => {
    setAnalysisResults(prev => ({
      ...prev,
      [workId]: {
        ...prev[workId],
        characterTags: prev[workId].characterTags.map((tag, i) =>
          i === index ? value : tag
        ),
      },
    }));
  };

  // DBから読み込む関数（手動）
  const handleLoadFromDb = async () => {
    if (!adminToken) {
      alert('管理トークンを入力してください');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/tags/load-from-db', {
        method: 'POST',
        headers: {
          'x-eronator-admin-token': adminToken,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        alert(`DBからの読み込みに失敗しました: ${response.status} ${errorText}`);
        return;
      }

      const data = await response.json();
      console.log('Load from DB response:', data);
      
      if (data.success && Array.isArray(data.works)) {
        console.log(`Loaded ${data.works.length} works from DB`);
        
        if (data.works.length === 0) {
          alert('DBに作品が登録されていません。\nまずファイルから作品をインポートしてください。');
          return;
        }
        
        // ParseResponse形式に変換
        setParseResult({
          success: true,
          mode: 'db',
          works: data.works.map((w: any) => ({
            ...w,
            isDuplicate: false, // DBから読み込んだ場合は重複ェック不要
          })),
          stats: data.stats,
        });
        
        // 全作品を選択状態にする
        setSelectedWorks(new Set(data.works.map((w: any) => w.workId)));
        
        // 既存のタグをanalysisResultsに設定
        const existingResults: Record<string, {
          derivedTags: Array<{ displayName: string; confidence: number; category: string | null }>;
          characterTags: string[];
        }> = {};
        
        for (const work of data.works) {
          existingResults[work.workId] = {
            derivedTags: work.derivedTags || [],
            characterTags: work.characterTags || [],
          };
        }
        
        setAnalysisResults(existingResults);
        setDbLoaded(true);
        
        console.log('Parse result set, analysis results set');
      } else {
        console.error('Invalid response:', data);
        alert(data.error || `DBからの読み込みに失敗しました: success=${data.success}, works=${data.works ? data.works.length : 'undefined'}`);
      }
    } catch (error) {
      console.error('Error loading from DB:', error);
      alert(`DBからの読み込みに失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // DBに直接保存する関数
  const handleImportToDb = async () => {
    if (!parseResult?.works || !adminToken) {
      return;
    }

    // 分析結果がある作品のみをインポート対象にする
    const worksToImport = parseResult.works
      .filter(w => analysisResults[w.workId])
      .map(work => {
        const result = analysisResults[work.workId];
        return {
          workId: work.workId,
          cid: work.cid,
          title: work.title,
          circleName: work.circleName,
          productUrl: work.productUrl,
          thumbnailUrl: work.thumbnailUrl,
          reviewAverage: work.reviewAverage,
          reviewCount: work.reviewCount,
          isAi: work.isAi,
          scrapedAt: work.scrapedAt,
          officialTags: work.officialTags,
          derivedTags: result.derivedTags.filter(t => t.displayName.trim() !== ''),
          characterTags: result.characterTags.filter(t => t.trim() !== ''),
          metaText: work.metaText,
          commentText: work.commentText,
        };
      });

    if (worksToImport.length === 0) {
      alert('インポートする作品がありません');
      return;
    }

    if (!confirm(`${worksToImport.length}件の作品をDBにインポートしますか？`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/tags/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({ works: worksToImport }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`インポート完了\n作成: ${data.stats.worksCreated}件\n更新: ${data.stats.worksUpdated}件\nタグ作成: ${data.stats.tagsCreated}件`);
      } else {
        alert(`インポートに失敗しました: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error importing to DB:', error);
      alert('インポートに失敗しました');
    } finally {
      setLoading(false);
    }
  };


  // コンフィグ読み込み
  const loadConfig = async () => {
    setConfigLoading(true);
    try {
      const response = await fetch('/api/config');
      if (!response.ok) {
        if (response.status === 404) {
          setConfigMessage({ type: 'error', text: 'このページは開発環境でのみ利用できます。' });
        } else {
          const data = await response.json();
          setConfigMessage({ type: 'error', text: data.error || '設定の読み込みに失敗しました。' });
        }
        setConfigLoading(false);
        return;
      }
      const data = await response.json();
      if (data.success) {
        setConfig(data.config);
      } else {
        setConfigMessage({ type: 'error', text: data.error || '設定の読み込みに失敗しました。' });
      }
    } catch (error) {
      setConfigMessage({ type: 'error', text: '設定の読み込みに失敗しました。' });
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'config') {
      void loadConfig();
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('eronator.debugEnabled') === '1';
        setDebugEnabled(stored);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleConfigSave = async () => {
    if (!config) return;

    setConfigSaving(true);
    setConfigMessage(null);

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      const data = await response.json();

      if (data.success) {
        setConfigMessage({ type: 'success', text: '設定を保存存しました。開発サーバーを再起動してください。' });
      } else {
        setConfigMessage({ type: 'error', text: data.details || data.error || '設定の保存に失敗しました。' });
      }
    } catch (error) {
      setConfigMessage({ type: 'error', text: '設定の保存に失敗しました。' });
    } finally {
      setConfigSaving(false);
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
      setConfigMessage({ type: 'success', text: 'デバッグモードの設定を保存存しました。ページをリロードしてください。' });
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>管理画面</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        作品データベース管理、タグ管理、設定変更、作品インポートートを行います。      </p>

      {/* 管理トークンを入力*/}
      <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
        <h2>アクセス認証</h2>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            <strong>管理トークン:</strong>
            <br />
            <input
              type="password"
              value={adminToken}
              onChange={handleTokenChange}
              placeholder="ERONATOR_ADMIN_TOKEN の値を入力"
              style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
            />
          </label>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
            .env.local の <code>ERONATOR_ADMIN_TOKEN</code> の値を入力してください
          </p>
        </div>
      </section>

      {/* タブナビゲーション */}
      <div style={{ borderBottom: '2px solid #ddd', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setActiveTab('works')}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: activeTab === 'works' ? '#0070f3' : 'transparent',
              color: activeTab === 'works' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'works' ? '3px solid #0070f3' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'works' ? 'bold' : 'normal',
            }}
          >
            作品DB
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: activeTab === 'tags' ? '#0070f3' : 'transparent',
              color: activeTab === 'tags' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'tags' ? '3px solid #0070f3' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'tags' ? 'bold' : 'normal',
            }}
          >
            タグ＆質問リスト          </button>
          <button
            onClick={() => setActiveTab('config')}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: activeTab === 'config' ? '#0070f3' : 'transparent',
              color: activeTab === 'config' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'config' ? '3px solid #0070f3' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'config' ? 'bold' : 'normal',
            }}
          >
            コンフィグ
          </button>
          <button
            onClick={() => setActiveTab('import')}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: activeTab === 'import' ? '#0070f3' : 'transparent',
              color: activeTab === 'import' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'import' ? '3px solid #0070f3' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'import' ? 'bold' : 'normal',
            }}
          >
            作品インポートート          </button>
        </div>
      </div>

      {/* タブコンテンツテンツ*/}
      {/* タブコンテンツテンツ 作品DB */}
      {activeTab === 'works' && (
        <>
          {/* メイン: 作品一覧（DB読み込みまたはファイル読み込み）*/}
          {parseResult && parseResult.success && parseResult.works && (
            <section style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2>
                  {parseResult.mode === 'db' ? '既存DBの作品一覧' : 'パース結果（ファイル読み込み）'}
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {parseResult.mode === 'db' && (
                    <button
                      onClick={handleLoadFromDb}
                      disabled={loading}
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.9rem',
                        backgroundColor: loading ? '#ccc' : '#666',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {loading ? '更新中...' : '🔄 再読み込み'}
                    </button>
                  )}
                </div>
              </div>
              
              {parseResult.stats && (
                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                  <p>
                    <strong>総作品数:</strong> {parseResult.stats.total}件
                  </p>
                </div>
              )}

              {/* 全選択/解除（DB読み込みの場合のみ）*/}
              {parseResult.mode === 'db' && (
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={toggleAllSelection}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#666',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    {selectedWorks.size === parseResult.works.length ? '全て解除' : '全て選択'}
                  </button>
                  <span style={{ marginLeft: '1rem' }}>
                    選択中: {selectedWorks.size} / {parseResult.works.length}件
                  </span>
                </div>
              )}

              {/* 作品一覧（テーブル形式）*/}
              <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '30px' }}>
                        <input
                          type="checkbox"
                          checked={selectedWorks.size === parseResult.works.length && parseResult.works.length > 0}
                          onChange={toggleAllSelection}
                        />
                      </th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '200px' }}>タイル</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '150px' }}>サークル名（作者）</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '200px' }}>有名タグ</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '150px' }}>準有名タグ</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '120px' }}>キャラクタータグ</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '50px' }}>isAi</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '100px' }}>有名度</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '80px' }}>操佁</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseResult.works.map((work, index) => {
                      const result = analysisResults[work.workId];
                      return (
                        <tr
                          key={work.workId}
                          style={{
                            borderBottom: '1px solid #eee',
                            backgroundColor: work.isDuplicate ? '#fff3cd' : (index % 2 === 0 ? 'white' : '#fafafa'),
                          }}
                        >
                          <td style={{ padding: '0.5rem' }}>
                            <input
                              type="checkbox"
                              checked={selectedWorks.has(work.workId)}
                              onChange={() => toggleWorkSelection(work.workId)}
                            />
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                              {work.title}
                              {work.isDuplicate && (
                                <span
                                  style={{
                                    marginLeft: '0.5rem',
                                    padding: '0.15rem 0.4rem',
                                    backgroundColor: '#ffc107',
                                    color: '#000',
                                    borderRadius: '3px',
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  重複                                </span>
                              )}
                            </div>
                            {work.productUrl && (
                              <a
                                href={work.productUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: '0.8rem', color: '#0070f3' }}
                              >
                                🔗 リンク
                              </a>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem' }}>{work.circleName}</td>
                          <td style={{ padding: '0.5rem' }}>
                            {work.officialTags.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                {work.officialTags.map((tag, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      padding: '0.1rem 0.3rem',
                                      backgroundColor: '#e3f2fd',
                                      color: '#1976d2',
                                      borderRadius: '3px',
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#999', fontSize: '0.8rem' }}>なし</span>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            {result?.derivedTags.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                {result.derivedTags.slice(0, 5).map((tag, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      padding: '0.1rem 0.3rem',
                                      backgroundColor: '#fff3cd',
                                      color: '#856404',
                                      borderRadius: '3px',
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    {tag.displayName}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#999', fontSize: '0.8rem' }}>なし</span>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            {result?.characterTags.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                                {result.characterTags.map((tag, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      padding: '0.1rem 0.3rem',
                                      backgroundColor: '#d4edda',
                                      color: '#155724',
                                      borderRadius: '3px',
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#999', fontSize: '0.8rem' }}>なし</span>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <span
                              style={{
                                padding: '0.1rem 0.3rem',
                                backgroundColor: work.isAi === 'AI' ? '#fff3cd' : work.isAi === 'HAND' ? '#d4edda' : '#f8d7da',
                                borderRadius: '3px',
                                fontSize: '0.65rem',
                              }}
                            >
                              {work.isAi}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                              {Math.round(work.popularityBase)}+{Math.round(work.popularityPlayBonus)}
                            </div>
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <button
                              onClick={() => setShowCommentModal({ workId: work.workId, comment: work.commentText })}
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                backgroundColor: '#0070f3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                              }}
                            >
                              詳細
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 作品詳細モーダル */}
          {showCommentModal && parseResult && parseResult.works && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
              onClick={() => setShowCommentModal(null)}
            >
              <div
                style={{
                  backgroundColor: 'white',
                  padding: '2rem',
                  borderRadius: '8px',
                  maxWidth: '800px',
                  maxHeight: '80vh',
                  overflowY: 'auto',
                  width: '90%',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {(() => {
                  const work = parseResult.works?.find(w => w.workId === showCommentModal.workId);
                  const result = analysisResults[showCommentModal.workId];
                  if (!work) return null;
                  
                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ margin: 0 }}>{work.title}</h2>
                        <button
                          onClick={() => setShowCommentModal(null)}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          閉じる                        </button>
                      </div>
                      
                      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong>サークル:</strong> {work.circleName}
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong>isAi:</strong> {work.isAi}
                        </div>
                        {work.productUrl && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <strong>URL:</strong>{' '}
                            <a href={work.productUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0070f3' }}>
                              {work.productUrl}
                            </a>
                          </div>
                        )}
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong>有名度:</strong> {Math.round(work.popularityBase)}+{Math.round(work.popularityPlayBonus)}
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong>取得日晁</strong> {new Date(work.scrapedAt).toLocaleString('ja-JP')}
                        </div>
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <strong>有名タグ:</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                          {work.officialTags.length > 0 ? (
                            work.officialTags.map((tag, i) => (
                              <span
                                key={i}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  backgroundColor: '#e3f2fd',
                                  color: '#1976d2',
                                  borderRadius: '4px',
                                  fontSize: '0.9rem',
                                }}
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: '#999' }}>なし</span>
                          )}
                        </div>
                      </div>

                      {result && (
                        <>
                          <div style={{ marginBottom: '1rem' }}>
                            <strong>準有名タグ:</strong>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                              {result.derivedTags.length > 0 ? (
                                result.derivedTags.map((tag, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      padding: '0.25rem 0.5rem',
                                      backgroundColor: '#fff3cd',
                                      color: '#856404',
                                      borderRadius: '4px',
                                      fontSize: '0.9rem',
                                    }}
                                  >
                                    {tag.displayName} ({tag.confidence.toFixed(2)})
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: '#999' }}>なし</span>
                              )}
                            </div>
                          </div>

                          <div style={{ marginBottom: '1rem' }}>
                            <strong>キャラクタータグ:</strong>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.5rem' }}>
                              {result.characterTags.length > 0 ? (
                                result.characterTags.map((tag, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      padding: '0.25rem 0.5rem',
                                      backgroundColor: '#d4edda',
                                      color: '#155724',
                                      borderRadius: '4px',
                                      fontSize: '0.9rem',
                                    }}
                                  >
                                    {tag}
                                  </span>
                                ))
                              ) : (
                                <span style={{ color: '#999' }}>なし</span>
                              )}
                            </div>
                          </div>
                        </>
                      )}

                      {work.commentText && (
                        <div style={{ marginTop: '1rem' }}>
                          <strong>作品コメン</strong>
                          <div
                            style={{
                              marginTop: '0.5rem',
                              padding: '1rem',
                              backgroundColor: '#f9f9f9',
                              borderRadius: '4px',
                              whiteSpace: 'pre-wrap',
                              fontSize: '0.9rem',
                              maxHeight: '300px',
                              overflowY: 'auto',
                            }}
                          >
                            {work.commentText}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </>
      )}

      {/* タブコンテンツテンツ タグ＆質問リスト */}
      {activeTab === 'tags' && (
        <section style={{ marginBottom: '2rem' }}>
          <h2>タグ＆質問リスト</h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            タグごとの作品数や質問との紐付けを管理します。（実装予定：④タグリスト機能）          </p>
          <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
            <p style={{ color: '#999' }}>この機能は今後実装予定です。</p>
          </div>
        </section>
      )}

      {/* タブコンテンツテンツ コンフィグ */}
      {activeTab === 'config' && (
        <section style={{ marginBottom: '2rem' }}>
          <h2>設定変更</h2>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            開発環境でのみ利用可能です。設定変更後は開発サーバーを停止して再起動してください。          </p>

          {configLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <p>読み込み中...</p>
            </div>
          ) : !config ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: 'red' }}>設定を読み込めませんでした。</p>
              <button onClick={loadConfig} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
                再読み込み
              </button>
            </div>
          ) : (
            <>
              {configMessage && (
                <div
                  style={{
                    padding: '1rem',
                    marginBottom: '1rem',
                    backgroundColor: configMessage.type === 'success' ? '#d4edda' : '#f8d7da',
                    color: configMessage.type === 'success' ? '#155724' : '#721c24',
                    border: `1px solid ${configMessage.type === 'success' ? '#c3e6cb' : '#f5c6cb'}`,
                    borderRadius: '4px',
                  }}
                >
                  {configMessage.text}
                </div>
              )}

              {/* デバッグモードセクション */}
              <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
                <h3>デバッグ設定</h3>
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
                    チェックを入れると、ゲーム画面にデバッグパネルが表示されます。                  </p>
                </div>
              </section>

              {/* Confirm セクション */}
              <section style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <h3>Confirm（確認質問）</h3>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <strong>revealThreshold（REVEAL判定の閾値）</strong>
                    <br />
                    <small>0.0〜1.0。confidence がこの値以上でREVEALに遷移します。</small>
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
                    <small>[最小値, 最大値]。confidence がこの範囲内だと Confirm 質問が挿入されます。</small>
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
                      <span style={{ lineHeight: '2.5rem' }}>〜</span>
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
                    <small>カンマ区切りで質問番号を指定（例 6,10</small>
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
                <h3>Algo（アルゴリズム）</h3>
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
                <h3>Flow（フロー制御）</h3>
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
                    <strong>effectiveConfirmThresholdParams（Confirm 挿入の effectiveCandidates 閾値）</strong>
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
                <h3>DataQuality（データ品質）</h3>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <strong>minCoverageMode（Coverage Gate のモード）</strong>
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
                <h3>Popularity（人気度）</h3>
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

              <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                <h3>注意事頁</h3>
                <ul style={{ marginLeft: '1.5rem' }}>
                  <li>設定変更後は、開発サーバー（<code>npm run dev</code>）を停止して再起動してください。</li>
                  <li>バリデーションエラーがある場合は保存されません。</li>
                  <li>保存前に自動的にバックアップが作成されます（<code>config/mvpConfig.json.bak</code>）。</li>
                  <li>このページは開発環境でのみ利用できます。</li>
                </ul>
              </div>

              <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid #ddd' }}>
                <button
                  onClick={handleConfigSave}
                  disabled={configSaving}
                  style={{
                    padding: '0.75rem 2rem',
                    fontSize: '1rem',
                    backgroundColor: configSaving ? '#ccc' : '#0070f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: configSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {configSaving ? '保存中...' : '設定を保存存'}
                </button>
                <button
                  onClick={loadConfig}
                  disabled={configSaving}
                  style={{
                    padding: '0.75rem 2rem',
                    fontSize: '1rem',
                    marginLeft: '1rem',
                    backgroundColor: '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: configSaving ? 'not-allowed' : 'pointer',
                  }}
                >
                  リセット
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* タブコンテンツテンツ 作品インポートート */}
      {activeTab === 'import' && (
        <section style={{ marginBottom: '2rem' }}>
          <h2>作品インポートート</h2>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            ファイルから作品を読み込み、AI分析・DBインポートートを行います。          </p>

          {/* DBから読み込むボタン（手動）*/}
          <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
            <h3 style={{ marginTop: 0 }}>既存DBから読み込む（手動）</h3>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
              DBに保存されている既存の作品とタグを読み込みます。            </p>
            <button
              onClick={handleLoadFromDb}
              disabled={loading}
              style={{
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                backgroundColor: loading ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? '読み込み中...' : 'DBから読み込む'}
            </button>
          </div>

          {/* ファイルアップロード*/}
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
            <h3 style={{ marginTop: 0 }}>ファイルから読み込む</h3>
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="file"
                accept=".txt"
                onChange={handleFileChange}
                style={{ marginBottom: '1rem' }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label>
                <strong>読み込みモード</strong>
                <br />
                <input
                  type="radio"
                  name="mode"
                  value="full"
                  checked={mode === 'full'}
                  onChange={(e) => setMode(e.target.value as 'full' | 'append')}
                  style={{ marginRight: '0.5rem' }}
                />
                全量読み込み（works_A.txt推奨）                <br />
                <input
                  type="radio"
                  name="mode"
                  value="append"
                  checked={mode === 'append'}
                  onChange={(e) => setMode(e.target.value as 'full' | 'append')}
                  style={{ marginRight: '0.5rem', marginTop: '0.5rem' }}
                />
                追加分析のみ（works_C.txt推奨）              </label>
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                ※ 重複作品は自動的にマージされます。              </p>
            </div>
            <button
              onClick={handleParse}
              disabled={!file || loading}
              style={{
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                backgroundColor: (!file || loading) ? '#ccc' : '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (!file || loading) ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'パース中...' : 'ファイルをパース'}
            </button>
          </div>

          {/* エラー表示 */}
          {parseResult && !parseResult.success && (
            <div
              style={{
                padding: '1rem',
                marginTop: '1rem',
                marginBottom: '1rem',
                backgroundColor: '#f8d7da',
                color: '#721c24',
                border: '1px solid #f5c6cb',
                borderRadius: '4px',
              }}
            >
              {parseResult.error || 'エラーが発生しました'}
            </div>
          )}

          {/* パース結果表示（ファイル読み込みの場合）*/}
          {parseResult && parseResult.success && parseResult.works && parseResult.mode !== 'db' && (
            <section style={{ marginTop: '2rem' }}>
              <h3>パース結果（ファイル読み込み）</h3>
              {parseResult.stats && (
                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                  <p>
                    <strong>総作品数:</strong> {parseResult.stats.total}件
                    {' | '}
                    <strong>新規</strong> {parseResult.stats.new}件
                    {' | '}
                    <strong>重複</strong> {parseResult.stats.duplicate}件
                  </p>
                </div>
              )}

              {/* 全選択/解除 */}
              <div style={{ marginBottom: '1rem' }}>
                <button
                  onClick={toggleAllSelection}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {selectedWorks.size === parseResult.works.length ? '全て解除' : '全て選択'}
                </button>
                <span style={{ marginLeft: '1rem' }}>
                  選択中: {selectedWorks.size} / {parseResult.works.length}件
                </span>
              </div>

              {/* AI分析ボタン */}
              {selectedWorks.size > 0 && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#e7f3ff', borderRadius: '4px' }}>
                  <p style={{ marginBottom: '0.5rem' }}>
                    <strong>{selectedWorks.size}件</strong>の作品が選択されています。                  </p>
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing || !adminToken}
                    style={{
                      padding: '0.75rem 2rem',
                      fontSize: '1rem',
                      backgroundColor: (analyzing || !adminToken) ? '#ccc' : '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: (analyzing || !adminToken) ? 'not-allowed' : 'pointer',
                    }}
                  >
{analyzing ? `AI分析中... (${Object.keys(analysisResults).length}/${selectedWorks.size})` : 'AI分析を実行'}
                  </button>
                </div>
              )}

              {/* 分析結果表示・編集*/}
              {Object.keys(analysisResults).length > 0 && (
                <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3>AI分析結果</h3>
                    <button
                      onClick={handleImportToDb}
                      disabled={loading}
                      style={{
                        padding: '0.75rem 2rem',
                        backgroundColor: loading ? '#ccc' : '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        boxShadow: loading ? 'none' : '0 2px 4px rgba(0,0,0,0.2)',
                      }}
                    >
                      {loading ? '保存中...' : '✓ DBに保存'}
                    </button>
                  </div>
                  <p style={{ marginBottom: '1rem', color: '#666' }}>
                    {Object.keys(analysisResults).length}件の作品をAI分析しました
                  </p>

                  {/* 作品ごとの分析結果（コンパクト表示）*/}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {parseResult.works
                      .filter(w => analysisResults[w.workId])
                      .map((work) => {
                        const result = analysisResults[work.workId];
                        return (
                          <div
                            key={work.workId}
                            style={{
                              padding: '1rem',
                              border: '1px solid #ddd',
                              borderRadius: '4px',
                              backgroundColor: '#f9f9f9',
                            }}
                          >
                            <h4 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1rem' }}>{work.title}</h4>
                            <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.75rem' }}>
                              {work.circleName}
                            </p>

                            {/* Derived Tags（コンパクト）*/}
                            <div style={{ marginBottom: '0.75rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                <strong style={{ fontSize: '0.85rem' }}>準有名タグ</strong>
                                <button
                                  onClick={() => handleAddDerivedTag(work.workId)}
                                  style={{
                                    padding: '0.15rem 0.4rem',
                                    backgroundColor: '#0070f3',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  +追加
                                </button>
                              </div>
                              {result.derivedTags.length === 0 ? (
                                <p style={{ color: '#999', fontStyle: 'italic', fontSize: '0.75rem' }}>なし</p>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  {result.derivedTags.map((tag, index) => (
                                    <div
                                      key={index}
                                      style={{
                                        display: 'flex',
                                        gap: '0.25rem',
                                        alignItems: 'center',
                                        padding: '0.25rem',
                                        backgroundColor: 'white',
                                        borderRadius: '3px',
                                        border: '1px solid #ddd',
                                      }}
                                    >
                                      <button
                                        onClick={() => handleMoveDerivedTag(work.workId, index, 'up')}
                                        disabled={index === 0}
                                        style={{
                                          padding: '0.15rem 0.3rem',
                                          backgroundColor: index === 0 ? '#ccc' : '#666',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '2px',
                                          cursor: index === 0 ? 'not-allowed' : 'pointer',
                                          fontSize: '0.7rem',
                                        }}
                                      >
                                        ↁ                                      </button>
                                      <button
                                        onClick={() => handleMoveDerivedTag(work.workId, index, 'down')}
                                        disabled={index === result.derivedTags.length - 1}
                                        style={{
                                          padding: '0.15rem 0.3rem',
                                          backgroundColor: index === result.derivedTags.length - 1 ? '#ccc' : '#666',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '2px',
                                          cursor: index === result.derivedTags.length - 1 ? 'not-allowed' : 'pointer',
                                          fontSize: '0.7rem',
                                        }}
                                      >
                                        ↁ                                      </button>
                                      <input
                                        type="text"
                                        value={tag.displayName}
                                        onChange={(e) => handleUpdateDerivedTag(work.workId, index, 'displayName', e.target.value)}
                                        placeholder="タグ名"
                                        style={{
                                          flex: 1,
                                          padding: '0.15rem 0.3rem',
                                          border: '1px solid #ddd',
                                          borderRadius: '3px',
                                          fontSize: '0.8rem',
                                        }}
                                      />
                                      <input
                                        type="number"
                                        min="0"
                                        max="1"
                                        step="0.01"
                                        value={tag.confidence}
                                        onChange={(e) => handleUpdateDerivedTag(work.workId, index, 'confidence', parseFloat(e.target.value) || 0)}
                                        placeholder="信頼度"
                                        style={{
                                          width: '50px',
                                          padding: '0.15rem 0.3rem',
                                          border: '1px solid #ddd',
                                          borderRadius: '3px',
                                          fontSize: '0.75rem',
                                        }}
                                      />
                                      <button
                                        onClick={() => handleRemoveDerivedTag(work.workId, index)}
                                        style={{
                                          padding: '0.15rem 0.3rem',
                                          backgroundColor: '#dc3545',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '3px',
                                          cursor: 'pointer',
                                          fontSize: '0.7rem',
                                        }}
                                      >
                                                                              </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Character Tags（コンパクト）*/}
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                <strong style={{ fontSize: '0.85rem' }}>キャラ</strong>
                                <button
                                  onClick={() => handleAddCharacterTag(work.workId)}
                                  style={{
                                    padding: '0.15rem 0.4rem',
                                    backgroundColor: '#0070f3',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  +追加
                                </button>
                              </div>
                              {result.characterTags.length === 0 ? (
                                <p style={{ color: '#999', fontStyle: 'italic', fontSize: '0.75rem' }}>なし</p>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  {result.characterTags.map((tag, index) => (
                                    <div
                                      key={index}
                                      style={{
                                        display: 'flex',
                                        gap: '0.25rem',
                                        alignItems: 'center',
                                        padding: '0.25rem',
                                        backgroundColor: 'white',
                                        borderRadius: '3px',
                                        border: '1px solid #ddd',
                                      }}
                                    >
                                      <input
                                        type="text"
                                        value={tag}
                                        onChange={(e) => handleUpdateCharacterTag(work.workId, index, e.target.value)}
                                        placeholder="キャラ名"
                                        style={{
                                          flex: 1,
                                          padding: '0.15rem 0.3rem',
                                          border: '1px solid #ddd',
                                          borderRadius: '3px',
                                          fontSize: '0.8rem',
                                        }}
                                      />
                                      <button
                                        onClick={() => handleRemoveCharacterTag(work.workId, index)}
                                        style={{
                                          padding: '0.15rem 0.3rem',
                                          backgroundColor: '#dc3545',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '3px',
                                          cursor: 'pointer',
                                          fontSize: '0.7rem',
                                        }}
                                      >
                                                                              </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </section>
          )}
        </section>
      )}
    </div>
  );
}