/**
 * タグ管理・インポートページ
 * /admin/tags
 */

'use client';

import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import ImportWorkflow from '../components/ImportWorkflow';
import ManualTagging from '../components/ManualTagging';
import SummaryQuestionEditor from '../components/SummaryQuestionEditor';
import TagManager from '../components/TagManager';
import { RANK_BG, RANK_TEXT } from '../constants/rankColors';

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
  commentText: string | null; // null=未取得
  isDuplicate?: boolean;
  existingTitle?: string | null;
  // 新フィールド
  contentId?: string | null;
  releaseDate?: string | null;
  pageCount?: string | null;
  affiliateUrl?: string | null;
  seriesInfo?: string | null; // JSON string
  gameRegistered?: boolean; // ゲーム・シミュレーションで使用（エロネーター登録）
  tagSource?: 'human' | 'ai' | null; // タグの由来（human=人力タグ付け、ai=AI分析、null=未タグ）
  derivedTags?: Array<{ displayName: string; rank?: string; tagKey?: string; source?: string }>; // DB取得時など
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

type TabType = 'works' | 'tags' | 'summary' | 'config' | 'import' | 'manual' | 'simulate' | 'history';

const EXPLORE_TAG_KIND_LABEL: Record<string, string> = { summary: 'まとめ', erotic: 'エロ', abstract: '抽象', normal: '通常' };

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
  // ページネーション
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(100);
  const [totalPages, setTotalPages] = useState(1);
  // 作品DBタブ: エロネーター登録フィルタ
  const [dbFilter, setDbFilter] = useState<'all' | 'registered' | 'unregistered'>('all');
  
  // コンフィグ用のstate
  const [config, setConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);

  const fieldDesc = (key: string) => (
    <small style={{ display: 'block', color: '#666', marginTop: '0.25rem' }}>設定キー: {key}</small>
  );

  // タグリスト用のstate
  const [tags, setTags] = useState<Array<{
    tagKey: string;
    displayName: string;
    tagType: string;
    category: string | null;
    questionTemplate: string | null;
    workCount: number;
  }>>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsFilter, setTagsFilter] = useState<'ALL' | 'OFFICIAL' | 'DERIVED' | 'STRUCTURAL'>('ALL');
  const [editingTag, setEditingTag] = useState<{ tagKey: string; questionTemplate: string | null } | null>(null);
  const [tagsStats, setTagsStats] = useState<{
    total: number;
    byType: { OFFICIAL: number; DERIVED: number; STRUCTURAL: number };
  } | null>(null);

  // 禁止タグ用state
  const [bannedTags, setBannedTags] = useState<Array<{
    pattern: string;
    type: 'exact' | 'startsWith' | 'contains' | 'regex';
    reason: string;
    addedAt: string;
  }>>([]);
  const [bannedTagsLoading, setBannedTagsLoading] = useState(false);
  const [showBannedTagsSection, setShowBannedTagsSection] = useState(false);
  const [newBannedTag, setNewBannedTag] = useState({ pattern: '', type: 'exact' as const, reason: '' });

  // シミュレーション用state
  const [simSelectedWorkId, setSimSelectedWorkId] = useState<string>('');
  const [simWorksStats, setSimWorksStats] = useState<{ totalWorks: number; gameRegisteredCount: number } | null>(null);
  // ノイズ率を質問タイプ別に設定
  const [simNoiseExplore, setSimNoiseExplore] = useState<number>(0);
  const [simNoiseSoft, setSimNoiseSoft] = useState<number>(0);
  const [simNoiseHard, setSimNoiseHard] = useState<number>(0);
  const [simAiGateChoice, setSimAiGateChoice] = useState<string>('BOTH');
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<{
    success: boolean;
    targetWorkId: string;
    targetWorkTitle: string;
    finalWorkId: string | null;
    finalWorkTitle: string | null;
    questionCount: number;
    outcome: string;
    errorMessage?: string;
    steps: Array<{
      qIndex: number;
      question: { kind: string; displayText: string; exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' };
      answer: string;
      wasNoisy: boolean;
      confidenceBefore: number;
      confidenceAfter: number;
    }>;
    workDetails?: {
      workId: string;
      title: string;
      authorName: string | null;
      isAi: string | null;
      popularityBase: number | null;
      reviewCount: number | null;
      reviewAverage: number | null;
      commentText: string | null;
      tags: Array<{
        tagKey: string;
        displayName: string;
        tagType: string;
        derivedConfidence: number | null;
      }>;
    };
  } | null>(null);
  const [simShowWorkDetails, setSimShowWorkDetails] = useState(false);
  const [simExpandedSteps, setSimExpandedSteps] = useState(false);
  const [simBatchMode, setSimBatchMode] = useState(true); // デフォルトON
  const [simTrialsPerWork, setSimTrialsPerWork] = useState(1);
  const [simBatchResult, setSimBatchResult] = useState<{
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
      steps?: Array<{
        qIndex: number;
        question: { kind: string; displayText: string; exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' };
        answer: string;
        wasNoisy: boolean;
        confidenceBefore: number;
        confidenceAfter: number;
        revealResult?: string;
      }>;
      workDetails?: {
        workId: string;
        title: string;
        authorName: string | null;
        isAi: string | null;
        popularityBase: number | null;
        reviewCount: number | null;
        reviewAverage: number | null;
        commentText: string | null;
        tags: Array<{
          tagKey: string;
          displayName: string;
          tagType: string;
          derivedConfidence: number | null;
        }>;
      };
    }>;
    metadata?: {
      timestamp: string;
      totalWorksInDb: number;
      sampleSize: number;
      noiseRates: {
        explore: number;
        soft: number;
        hard: number;
      };
      aiGateChoice: string;
      trialsPerWork: number;
    };
  } | null>(null);
  const [simBatchLoading, setSimBatchLoading] = useState(false);
  const [simSampleSize, setSimSampleSize] = useState<number>(0); // 0=全件
  const [simSaving, setSimSaving] = useState(false);

  // サービスプレイ履歴タブ用
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<Array<{
    id: string;
    sessionId: string;
    outcome: string;
    questionCount: number;
    questionHistory: unknown;
    aiGateChoice: string | null;
    resultWorkId: string | null;
    submittedTitleText: string | null;
    createdAt: string;
  }>>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit] = useState(50);
  const [historyOutcome, setHistoryOutcome] = useState<string>('');

  // 初回読み込み時にlocalStorageからトークンを取得し、自動でDBを読み込む
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('eronator.adminToken');
      if (stored) {
        setAdminToken(stored);
        // トークンがある場合は自動でDBを読み込む（確認なし）
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
      
      if (data.success && Array.isArray(data.works)) {
        setParseResult({
          success: true,
          mode: 'db',
          works: data.works.map((w: any) => ({
            ...w,
            isDuplicate: false,
          })),
          stats: data.stats,
        });
        
        // ページネーション情報を更新
        if (data.stats) {
          setTotalPages(data.stats.totalPages || 1);
          setCurrentPage(data.stats.page || 1);
        }
        
        // 最新100件を初期選択
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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
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

  // クイック選択ヘルパー関数
  const selectLatestN = (n: number) => {
    if (!parseResult?.works) return;
    // 最新N件を選択（リストの先頭がN件）
    const latestWorks = parseResult.works.slice(0, n);
    setSelectedWorks(new Set(latestWorks.map(w => w.workId)));
  };

  const selectNoComment = () => {
    if (!parseResult?.works) return;
    // コメント未取得の作品を選択
    const noCommentWorks = parseResult.works.filter(w => !w.commentText);
    setSelectedWorks(new Set(noCommentWorks.map(w => w.workId)));
  };

  const selectNoDerivedTags = () => {
    if (!parseResult?.works) return;
    // 準有名タグ未生成の作品を選択（コメントがある作品のみ対象）
    const noDerivedTagsWorks = parseResult.works.filter(w => 
      w.commentText && (!w.derivedTags || w.derivedTags.length === 0)
    );
    setSelectedWorks(new Set(noDerivedTagsWorks.map(w => w.workId)));
  };

  const selectHasCommentNoDerivedTags = () => {
    if (!parseResult?.works) return;
    // コメントあり＆準有名タグ未生成の作品を選択
    const targetWorks = parseResult.works.filter(w => 
      w.commentText && (!w.derivedTags || w.derivedTags.length === 0)
    );
    setSelectedWorks(new Set(targetWorks.map(w => w.workId)));
  };

  // 人力タグ付け済みの作品を選択
  const selectHumanTagged = () => {
    if (!parseResult?.works) return;
    const humanTaggedWorks = parseResult.works.filter(w => w.tagSource === 'human');
    setSelectedWorks(new Set(humanTaggedWorks.map(w => w.workId)));
  };

  // 準有名タグありの作品を選択（人力 or AI）
  const selectWithDerivedTags = () => {
    if (!parseResult?.works) return;
    const withDerivedWorks = parseResult.works.filter(w => 
      (w.derivedTags && w.derivedTags.length > 0)
    );
    setSelectedWorks(new Set(withDerivedWorks.map(w => w.workId)));
  };

  const handleAnalyze = async () => {
    if (!parseResult?.works || selectedWorks.size === 0) {
      alert('作品を選択してください');
      return;
    }
    if (!adminToken) {
      alert('管理トークンを入力してください');
      return;
    }

    if (debugEnabled) {
      console.log('[UI] Starting AI analysis...');
      console.log('[UI] Selected works:', selectedWorks.size);
    }
    
    setAnalyzing(true);
    
    // 進捗表示のため、選択された作品のIDをキーにした空のオブジェクトを作成
    const initialResults: Record<string, { derivedTags: Array<{ displayName: string; confidence: number; category: string | null }>; characterTags: string[] }> = {};
    for (const workId of selectedWorks) {
      initialResults[workId] = { derivedTags: [], characterTags: [] };
    }
    setAnalysisResults(initialResults);

    try {
      // 選択された作品のデータを準備
      const worksToAnalyze = parseResult.works
        .filter(w => selectedWorks.has(w.workId))
        .map(w => ({
          workId: w.workId,
          title: w.title,
          commentText: w.commentText,
        }));

      if (debugEnabled) {
        console.log('[UI] Sending request to /api/admin/tags/analyze');
        console.log('[UI] Works to analyze:', worksToAnalyze.length);
        console.log('[UI] Sample work:', worksToAnalyze[0]?.workId, worksToAnalyze[0]?.title);
      }

      const response = await fetch('/api/admin/tags/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({ works: worksToAnalyze }),
      });

      if (debugEnabled) {
        console.log('[UI] Response status:', response.status);
      }

      if (!response.ok) {
        const errorText = await response.text();
        if (debugEnabled) {
          console.error('[UI] API error:', response.status, errorText);
        }
        alert(`AI分析に失敗しました: ${response.status} ${errorText}`);
        return;
      }

      const data = await response.json();
      if (debugEnabled) {
        console.log('[UI] Response data:', data);
      }

      if (data.success && data.results) {
        if (debugEnabled) {
          console.log('[UI] Analysis results received:', data.results.length);
        }
        
        // 結果をworkIdをキーにしたオブジェクトに変換
        const resultsMap: Record<string, typeof data.results[0]> = {};
        for (const result of data.results) {
          resultsMap[result.workId] = {
            derivedTags: result.derivedTags,
            characterTags: result.characterTags,
          };
        }
        
        if (debugEnabled) {
          console.log('[UI] Setting analysis results:', Object.keys(resultsMap).length);
        }
        setAnalysisResults(resultsMap);
        
        const totalTags = data.results.reduce((sum: number, r: any) => sum + r.derivedTags.length + r.characterTags.length, 0);
        if (debugEnabled) {
          console.log('[UI] Total tags extracted:', totalTags);
          if (totalTags === 0) {
            console.warn('[UI] No tags extracted from any work');
          }
        }
      } else {
        if (debugEnabled) {
          console.error('[UI] Analysis failed:', data.error);
        }
        alert(`AI分析に失敗しました: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      if (debugEnabled) {
        console.error('[UI] Error analyzing works:', error);
      }
      alert(`AI分析中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleTokenChange = (e: ChangeEvent<HTMLInputElement>) => {
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
        ...(prev[workId] || { derivedTags: [], characterTags: [] }),
        derivedTags: [
          ...(prev[workId]?.derivedTags || []),
          { displayName: '', confidence: 0.5, category: null },
        ],
      },
    }));
  };

  const handleRemoveDerivedTag = (workId: string, index: number) => {
    setAnalysisResults(prev => {
      const current = prev[workId];
      if (!current) return prev;
      return {
        ...prev,
        [workId]: {
          ...current,
          derivedTags: current.derivedTags.filter((_, i) => i !== index),
        },
      };
    });
  };

  const handleUpdateDerivedTag = (
    workId: string,
    index: number,
    field: 'displayName' | 'confidence' | 'category',
    value: string | number | null
  ) => {
    setAnalysisResults(prev => {
      const current = prev[workId];
      if (!current) return prev;
      return {
        ...prev,
        [workId]: {
          ...current,
          derivedTags: current.derivedTags.map((tag, i) =>
            i === index ? { ...tag, [field]: value } : tag
          ),
        },
      };
    });
  };

  const handleMoveDerivedTag = (workId: string, index: number, direction: 'up' | 'down') => {
    setAnalysisResults(prev => {
      const current = prev[workId];
      if (!current) return prev;
      const tags = [...current.derivedTags];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= tags.length) return prev;
      
      [tags[index], tags[newIndex]] = [tags[newIndex], tags[index]];
      
      return {
        ...prev,
        [workId]: {
          ...current,
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
        ...(prev[workId] || { derivedTags: [], characterTags: [] }),
        characterTags: [...(prev[workId]?.characterTags || []), ''],
      },
    }));
  };

  const handleRemoveCharacterTag = (workId: string, index: number) => {
    setAnalysisResults(prev => {
      const current = prev[workId];
      if (!current) return prev;
      return {
        ...prev,
        [workId]: {
          ...current,
          characterTags: current.characterTags.filter((_, i) => i !== index),
        },
      };
    });
  };

  const handleUpdateCharacterTag = (workId: string, index: number, value: string) => {
    setAnalysisResults(prev => {
      const current = prev[workId];
      if (!current) return prev;
      return {
        ...prev,
        [workId]: {
          ...current,
          characterTags: current.characterTags.map((tag, i) =>
            i === index ? value : tag
          ),
        },
      };
    });
  };

  // DMMからインポートする関数
  const [dmmImportTarget, setDmmImportTarget] = useState(10);
  const [dmmImporting, setDmmImporting] = useState(false);
  const [dmmImportResult, setDmmImportResult] = useState<{
    success: boolean;
    stats?: { saved: number; skipped: number; apiTotal: number };
    savedWorks?: Array<{ workId: string; title: string }>;
    error?: string;
  } | null>(null);

  const handleDmmImport = async () => {
    if (!adminToken) {
      alert('管理トークンを入力してください');
      return;
    }

    if (!confirm(`DMM APIから最新${dmmImportTarget}件の作品をインポートしますか？\n（既存の作品はスキップされます）`)) {
      return;
    }

    setDmmImporting(true);
    setDmmImportResult(null);

    try {
      const response = await fetch('/api/admin/dmm/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({
          target: dmmImportTarget,
          sort: 'rank',
        }),
      });

      const data = await response.json();
      setDmmImportResult(data);

      if (data.success) {
        alert(`DMMインポート完了\n新規保存: ${data.stats.saved}件\nスキップ: ${data.stats.skipped}件（既存）`);
        // DBを再読み込み
        await handleLoadFromDb(1, dbFilter);
      } else {
        alert(`インポートに失敗しました: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error importing from DMM:', error);
      setDmmImportResult({ success: false, error: 'ネットワークエラー' });
      alert('DMMからのインポートに失敗しました');
    } finally {
      setDmmImporting(false);
    }
  };

  // DBから読み込む関数（手動、ページネーション・フィルタ対応）
  const handleLoadFromDb = async (pageNum: number = 1, filter?: 'all' | 'registered' | 'unregistered') => {
    if (!adminToken) {
      alert('管理トークンを入力してください');
      return;
    }

    const effectiveFilter = filter ?? dbFilter;
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tags/load-from-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({
          page: pageNum,
          pageSize,
          filter: effectiveFilter,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        alert(`DBからの読み込みに失敗しました: ${response.status} ${errorText}`);
        return;
      }

      const data = await response.json();
      if (debugEnabled) {
        console.log('Load from DB response:', data);
      }
      
      if (data.success && Array.isArray(data.works)) {
        if (debugEnabled) {
          console.log(`Loaded ${data.works.length} works from DB`);
        }
        
        if (data.works.length === 0 && pageNum === 1) {
          alert(
            effectiveFilter === 'all'
              ? 'DBに作品が登録されていません。\nまずファイルから作品をインポートしてください。'
              : `該当する作品がありません。（フィルタ: ${effectiveFilter === 'registered' ? '登録済み' : '未登録'}）`
          );
        }
        
        // ParseResponse形式に変換（gameRegistered を含む）。stats は load-from-db の形に合わせて安全に
        const stats = data.stats ?? {};
        const safeStats = {
          total: stats.total ?? data.works?.length ?? 0,
          new: stats.new ?? 0,
          duplicate: stats.duplicate ?? 0,
          ...(typeof stats.page === 'number' && { page: stats.page }),
          ...(typeof stats.totalPages === 'number' && { totalPages: stats.totalPages }),
          ...(typeof stats.pageSize === 'number' && { pageSize: stats.pageSize }),
        };
        setParseResult({
          success: true,
          mode: 'db',
          works: data.works.map((w: { gameRegistered?: boolean; derivedTags?: unknown[]; [key: string]: unknown }) => ({
            ...w,
            isDuplicate: false,
            gameRegistered: w.gameRegistered ?? false,
          })),
          stats: safeStats,
        });
        
        // ページネーション情報を更新（load-from-db は totalPages / page を返す）
        const totalPagesVal = (safeStats as { totalPages?: number }).totalPages ?? ((safeStats.total as number) > 0 ? Math.ceil((safeStats.total as number) / ((safeStats as { pageSize?: number }).pageSize ?? 100)) : 1);
        setTotalPages(totalPagesVal);
        setCurrentPage((safeStats as { page?: number }).page ?? 1);
        
        // 選択をクリア（新しいページなので）
        setSelectedWorks(new Set());
        
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
        
        if (debugEnabled) {
          console.log('Parse result set, analysis results set');
        }
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

  // 作品DBタブ: エロネーター登録をトグル
  const handleSetGameRegistered = async (workId: string, gameRegistered: boolean) => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/works/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({ action: 'setGameRegistered', workId, gameRegistered }),
      });
      if (res.ok && parseResult?.mode === 'db' && parseResult.works) {
        setParseResult({
          ...parseResult,
          works: parseResult.works.map(w => w.workId === workId ? { ...w, gameRegistered } : w),
        });
      }
    } catch (e) {
      console.error('setGameRegistered failed:', e);
    }
  };

  // 作品DBタブ: 選択作品のエロネーター登録を一括更新（全作品でオン・オフ可能）
  const handleBulkSetGameRegistered = async (gameRegistered: boolean) => {
    if (!adminToken || selectedWorks.size === 0) return;
    const workIdsToUpdate = Array.from(selectedWorks);
    try {
      const res = await fetch('/api/admin/works/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({ action: 'setGameRegistered', workIds: workIdsToUpdate, gameRegistered }),
      });
      const data = await res.json();
      if (data.success && parseResult?.mode === 'db' && parseResult.works) {
        const idSet = new Set(workIdsToUpdate);
        setParseResult({
          ...parseResult,
          works: parseResult.works.map(w => idSet.has(w.workId) ? { ...w, gameRegistered } : w),
        });
        setSelectedWorks(new Set());
      } else {
        alert(data.error || '更新に失敗しました');
      }
    } catch (e) {
      console.error('Bulk setGameRegistered failed:', e);
      alert('更新に失敗しました');
    }
  };

  // 作品DBタブ: このページの準有名タグがない作品を一括で未登録にする（実験用）
  const handleUnregisterWorksWithoutDerivedTags = async () => {
    if (!adminToken || parseResult?.mode !== 'db' || !parseResult.works?.length) return;
    const workIdsNoDerived = parseResult.works
      .filter(w => (analysisResults[w.workId]?.derivedTags?.length ?? 0) === 0)
      .map(w => w.workId);
    if (workIdsNoDerived.length === 0) {
      alert('このページには準有名タグがない作品はありません。');
      return;
    }
    if (!confirm(`このページの準有名タグがない作品 ${workIdsNoDerived.length} 件を未登録にします。よろしいですか？`)) return;
    try {
      const res = await fetch('/api/admin/works/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({ action: 'setGameRegistered', workIds: workIdsNoDerived, gameRegistered: false }),
      });
      const data = await res.json();
      if (data.success && parseResult?.mode === 'db' && parseResult.works) {
        const idSet = new Set(workIdsNoDerived);
        setParseResult({
          ...parseResult,
          works: parseResult.works.map(w => idSet.has(w.workId) ? { ...w, gameRegistered: false } : w),
        });
      } else {
        alert(data.error || '更新に失敗しました');
      }
    } catch (e) {
      console.error('Unregister works without derived tags failed:', e);
      alert('更新に失敗しました');
    }
  };

  // 作品DBタブ: DB全体で準有名タグがない作品を一括で未登録にする（全件・数万件対応）
  const handleUnregisterAllWorksWithoutDerivedTags = async () => {
    if (!adminToken || parseResult?.mode !== 'db') return;
    if (!confirm('DB全体で「準有名タグがない作品」を一括で未登録にします。よろしいですか？\n（件数は実行後に表示します）')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/works/bulk-unregister-no-derived', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
      });
      const data = await res.json();
      if (data.success) {
        alert(`${data.updated ?? 0} 件を未登録にしました。`);
        await handleLoadFromDb(currentPage, dbFilter);
      } else {
        alert(data.error || '更新に失敗しました');
      }
    } catch (e) {
      console.error('Bulk unregister (all) failed:', e);
      alert('更新に失敗しました');
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
    } else if (activeTab === 'tags') {
      void handleLoadBannedTags(); // 禁止タグは認証不要で常に取得
      if (adminToken) void handleLoadTags();
    } else if (activeTab === 'simulate' && adminToken) {
      fetch('/api/admin/works/stats', {
        headers: { 'x-eronator-admin-token': adminToken },
      })
        .then(res => res.ok ? res.json() : Promise.reject(new Error('Failed to fetch stats')))
        .then((data: { success?: boolean; totalWorks?: number; gameRegisteredCount?: number }) => {
          if (data.success && typeof data.totalWorks === 'number') {
            setSimWorksStats({
              totalWorks: data.totalWorks,
              gameRegisteredCount: typeof data.gameRegisteredCount === 'number' ? data.gameRegisteredCount : 0,
            });
          } else {
            setSimWorksStats(null);
          }
        })
        .catch(() => setSimWorksStats(null));
    } else if (activeTab !== 'simulate') {
      setSimWorksStats(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, adminToken]);

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
        setConfigMessage({ type: 'success', text: '設定を保存しました。開発サーバーを再起動してください。' });
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

  // 禁止タグ読み込み
  const handleLoadBannedTags = async () => {
    setBannedTagsLoading(true);
    try {
      const response = await fetch('/api/admin/banned-tags');
      if (!response.ok) throw new Error('Failed to load banned tags');
      const data = await response.json();
      setBannedTags(data.bannedTags || []);
    } catch (error) {
      console.error('Failed to load banned tags:', error);
    } finally {
      setBannedTagsLoading(false);
    }
  };

  // 禁止タグ追加
  const handleAddBannedTag = async () => {
    if (!newBannedTag.pattern.trim()) return;
    try {
      const response = await fetch('/api/admin/banned-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBannedTag),
      });
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || 'Failed to add banned tag');
        return;
      }
      setNewBannedTag({ pattern: '', type: 'exact', reason: '' });
      await handleLoadBannedTags();
    } catch (error) {
      console.error('Failed to add banned tag:', error);
      alert('禁止タグの追加に失敗しました');
    }
  };

  // 禁止タグ削除
  const handleDeleteBannedTag = async (pattern: string, type: string) => {
    if (!confirm(`「${pattern}」を禁止タグリストから削除しますか？`)) return;
    try {
      const response = await fetch(`/api/admin/banned-tags?pattern=${encodeURIComponent(pattern)}&type=${encodeURIComponent(type)}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete banned tag');
      await handleLoadBannedTags();
    } catch (error) {
      console.error('Failed to delete banned tag:', error);
      alert('禁止タグの削除に失敗しました');
    }
  };

  // タグリスト読み込み
  const handleLoadTags = async () => {
    if (!adminToken) {
      setTags([]);
      setTagsStats(null);
      return;
    }

    setTagsLoading(true);
    try {
      const response = await fetch('/api/admin/tags/list', {
        method: 'GET',
        headers: {
          'x-eronator-admin-token': adminToken,
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('アクセスが拒否されました。管理トークンを確認してください。');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `タグリストの取得に失敗しました (${response.status})`);
      }

      const data = await response.json();
      
      if (debugEnabled) {
        console.log('[UI] Tag list response:', data);
        console.log('[UI] Tags count:', data.tags?.length || 0);
      }
      
      if (data.success && Array.isArray(data.tags)) {
        setTags(data.tags);
        setTagsStats(data.stats || null);
        
        if (debugEnabled) {
          console.log('[UI] Tags set:', data.tags.length);
        }
      } else {
        throw new Error(data.error || 'タグリストの取得に失敗しました');
      }
    } catch (error) {
      console.error('タグリスト読み込みエラー:', error);
      setTags([]);
      setTagsStats(null);
      // エラーは静かに処理（ユーザーが手動でリロードできる）
      if (debugEnabled) {
        alert(error instanceof Error ? error.message : 'タグリストの読み込みに失敗しました');
      }
    } finally {
      setTagsLoading(false);
    }
  };

  // 質問テンプレート保存
  const handleSaveQuestionTemplate = async (tagKey: string) => {
    if (!adminToken) {
      alert('管理トークンを入力してください');
      return;
    }

    if (!editingTag || editingTag.tagKey !== tagKey) {
      return;
    }

    try {
      const response = await fetch('/api/admin/tags/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({
          tagKey,
          questionTemplate: editingTag.questionTemplate || null,
        }),
      });

      if (!response.ok) {
        throw new Error('質問テンプレートの保存に失敗しました');
      }

      const data = await response.json();
      if (data.success) {
        // タグリストを更新
        setTags(prevTags =>
          prevTags.map(tag =>
            tag.tagKey === tagKey
              ? { ...tag, questionTemplate: editingTag.questionTemplate }
              : tag
          )
        );
        setEditingTag(null);
        alert('質問テンプレートを保存しました');
      } else {
        throw new Error(data.error || '質問テンプレートの保存に失敗しました');
      }
    } catch (error) {
      console.error('質問テンプレート保存エラー:', error);
      alert(error instanceof Error ? error.message : '質問テンプレートの保存に失敗しました');
    }
  };

  const handleDebugToggle = (enabled: boolean) => {
    setDebugEnabled(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('eronator.debugEnabled', enabled ? '1' : '0');
      setConfigMessage({ type: 'success', text: 'デバッグモードの設定を保存しました。ページをリロードしてください。' });
    }
  };

  const fetchPlayHistory = async (page: number = 1) => {
    if (!adminToken) return;
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(historyLimit));
      if (historyOutcome) params.set('outcome', historyOutcome);
      const response = await fetch(`/api/admin/play-history?${params.toString()}`, {
        headers: { 'x-eronator-admin-token': adminToken },
      });
      if (!response.ok) {
        if (response.status === 403) throw new Error('アクセスが拒否されました');
        throw new Error(`取得に失敗しました (${response.status})`);
      }
      const data = await response.json();
      if (data.success && Array.isArray(data.items)) {
        setHistoryItems(data.items);
        setHistoryTotal(data.total ?? 0);
        setHistoryPage(page);
      }
    } catch (e) {
      console.error('[play-history]', e);
      setHistoryItems([]);
      setHistoryTotal(0);
      if (adminToken) alert(e instanceof Error ? e.message : '履歴の取得に失敗しました');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history' && adminToken) {
      fetchPlayHistory(1);
    }
  }, [activeTab, adminToken, historyOutcome]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>管理画面</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        作品データベース管理、タグ管理、設定変更、作品インポートを行います。
      </p>

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
            タグ＆質問リスト
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: activeTab === 'summary' ? '#0070f3' : 'transparent',
              color: activeTab === 'summary' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'summary' ? '3px solid #0070f3' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'summary' ? 'bold' : 'normal',
            }}
          >
            まとめ質問
          </button>
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
            作品インポート
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: activeTab === 'manual' ? '#28a745' : 'transparent',
              color: activeTab === 'manual' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'manual' ? '3px solid #28a745' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'manual' ? 'bold' : 'normal',
            }}
          >
            人力タグ付け
          </button>
          <button
            onClick={() => setActiveTab('simulate')}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: activeTab === 'simulate' ? '#ff6600' : 'transparent',
              color: activeTab === 'simulate' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'simulate' ? '3px solid #ff6600' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'simulate' ? 'bold' : 'normal',
            }}
          >
            シミュレーション
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              backgroundColor: activeTab === 'history' ? '#6b21a8' : 'transparent',
              color: activeTab === 'history' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'history' ? '3px solid #6b21a8' : '3px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'history' ? 'bold' : 'normal',
            }}
          >
            サービスプレイ履歴
          </button>
        </div>
      </div>

      {/* タブコンテンツ */}
      {/* タブコンテンツ 作品DB */}
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
                    <>
                      <button
                        onClick={() => handleLoadFromDb(currentPage, dbFilter)}
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
                      {parseResult.stats && (
                        <span style={{ marginLeft: '1rem', fontSize: '0.9rem' }}>
                          ページ {currentPage} / {totalPages} (全{parseResult.stats?.total ?? 0}件)
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              
              {parseResult.stats && (
                <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
                  <p>
                    <strong>総作品数:</strong> {parseResult.stats?.total ?? 0}件
                  </p>
                </div>
              )}

              {/* ページネーション（DB読み込みの場合のみ）*/}
              {parseResult.mode === 'db' && parseResult.stats && totalPages > 1 && (
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    onClick={() => {
                      if (currentPage > 1) {
                        setCurrentPage(currentPage - 1);
                        handleLoadFromDb(currentPage - 1, dbFilter);
                      }
                    }}
                    disabled={currentPage === 1 || loading}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: currentPage === 1 || loading ? '#ccc' : '#666',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: currentPage === 1 || loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    前へ
                  </button>
                  <span style={{ fontSize: '0.9rem' }}>
                    ページ {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => {
                      if (currentPage < totalPages) {
                        setCurrentPage(currentPage + 1);
                        handleLoadFromDb(currentPage + 1, dbFilter);
                      }
                    }}
                    disabled={currentPage === totalPages || loading}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: currentPage === totalPages || loading ? '#ccc' : '#666',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: currentPage === totalPages || loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    次へ
                  </button>
                  <button
                    onClick={() => {
                      setCurrentPage(1);
                      handleLoadFromDb(1, dbFilter);
                    }}
                    disabled={currentPage === 1 || loading}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem',
                      backgroundColor: currentPage === 1 || loading ? '#ccc' : '#0070f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: currentPage === 1 || loading ? 'not-allowed' : 'pointer',
                      marginLeft: '1rem',
                    }}
                  >
                    最新100件へ
                  </button>
                </div>
              )}

              {/* 全選択/解除・エロネーター登録（DB読み込みの場合のみ）*/}
              {parseResult.mode === 'db' && (
                <div style={{ marginBottom: '1rem' }}>
                  {/* エロネーター登録フィルタ */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                    <span style={{ color: '#666', fontSize: '0.85rem' }}>🎮 表示:</span>
                    {(['all', 'registered', 'unregistered'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => {
                          setDbFilter(f);
                          handleLoadFromDb(1, f);
                        }}
                        style={{
                          padding: '0.35rem 0.75rem',
                          fontSize: '0.85rem',
                          backgroundColor: dbFilter === f ? '#28a745' : '#e9ecef',
                          color: dbFilter === f ? 'white' : '#333',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        {f === 'all' ? '全て' : f === 'registered' ? '登録済み' : '未登録'}
                      </button>
                    ))}
                  </div>
                  {/* 選択コントロール */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                    <span style={{ marginLeft: '0.5rem' }}>
                      選択中: <strong>{selectedWorks.size}</strong> / {parseResult.works.length}件
                    </span>
                    <button
                      onClick={() => handleBulkSetGameRegistered(true)}
                      disabled={selectedWorks.size === 0}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.85rem',
                        backgroundColor: selectedWorks.size === 0 ? '#ccc' : '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: selectedWorks.size === 0 ? 'not-allowed' : 'pointer',
                        marginLeft: '0.5rem',
                      }}
                      title="選択作品をゲーム登録（エロネーター登録）にします"
                    >
                      選択を登録
                    </button>
                    <button
                      onClick={() => handleBulkSetGameRegistered(false)}
                      disabled={selectedWorks.size === 0}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.85rem',
                        backgroundColor: selectedWorks.size === 0 ? '#ccc' : '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: selectedWorks.size === 0 ? 'not-allowed' : 'pointer',
                      }}
                      title="選択作品のゲーム登録を解除します"
                    >
                      選択を未登録
                    </button>
                    <button
                      onClick={handleUnregisterWorksWithoutDerivedTags}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.85rem',
                        backgroundColor: '#ffc107',
                        color: '#333',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                      title="このページに表示中の、準有名タグがない作品を一括で未登録にします（実験用）"
                    >
                      準有名タグがない作品をオフにする
                    </button>
                    <button
                      onClick={handleUnregisterAllWorksWithoutDerivedTags}
                      style={{
                        padding: '0.35rem 0.75rem',
                        fontSize: '0.85rem',
                        backgroundColor: '#fd7e14',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                      title="DB全体で準有名タグがない作品を一括で未登録にします（数万件対応）"
                    >
                      全件でオフにする
                    </button>
                  </div>
                  
                  {/* クイック選択ボタン */}
                  <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ color: '#666', fontSize: '0.85rem', alignSelf: 'center' }}>クイック選択:</span>
                    <button
                      onClick={() => selectLatestN(10)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#e0e0e0',
                        color: '#333',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      最新10件
                    </button>
                    <button
                      onClick={() => selectLatestN(20)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#e0e0e0',
                        color: '#333',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      最新20件
                    </button>
                    <button
                      onClick={() => selectLatestN(50)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#e0e0e0',
                        color: '#333',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      最新50件
                    </button>
                    <span style={{ color: '#999', margin: '0 0.25rem' }}>|</span>
                    <button
                      onClick={selectNoComment}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#fff3cd',
                        color: '#856404',
                        border: '1px solid #ffc107',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      コメント未取得
                    </button>
                    <button
                      onClick={selectNoDerivedTags}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#d4edda',
                        color: '#155724',
                        border: '1px solid #28a745',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      タグ未生成
                    </button>
                    <span style={{ color: '#999', margin: '0 0.25rem' }}>|</span>
                    <button
                      onClick={selectHumanTagged}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: RANK_BG.S,
                        color: RANK_TEXT.S,
                        border: `1px solid ${RANK_TEXT.S}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                      title="人力タグ付け済みの作品を選択"
                    >
                      人力タグ済み
                    </button>
                    <button
                      onClick={selectWithDerivedTags}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: RANK_BG.A,
                        color: RANK_TEXT.A,
                        border: `1px solid ${RANK_TEXT.A}`,
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                      title="準有名タグがある作品を選択（人力 or AI）"
                    >
                      タグあり
                    </button>
                    <button
                      onClick={() => setSelectedWorks(new Set())}
                      style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: '#f8d7da',
                        color: '#721c24',
                        border: '1px solid #dc3545',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                      }}
                    >
                      選択解除
                    </button>
                  </div>

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
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '200px' }}>タイトル</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '150px' }}>サークル名（作者）</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '200px' }}>有名タグ</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '150px' }}>準有名タグ</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '120px' }}>キャラクタータグ</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '50px' }}>isAi</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '100px' }}>有名度</th>
                      {parseResult.mode === 'db' && (
                        <th style={{ padding: '0.5rem', textAlign: 'center', width: '50px' }} title="ゲーム・シミュレーションで使用">🎮</th>
                      )}
                      <th style={{ padding: '0.5rem', textAlign: 'left', width: '80px' }}>操作</th>
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
                                  重複
                                </span>
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
                              <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                                gap: '0.15rem',
                                maxWidth: '200px',
                              }}>
                                {work.officialTags.map((tag, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      padding: '0.1rem 0.3rem',
                                      backgroundColor: RANK_BG.S,
                                      color: RANK_TEXT.S,
                                      borderRadius: '3px',
                                      fontSize: '0.7rem',
                                      textAlign: 'center',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                    title={tag}
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
                              <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                                gap: '0.15rem',
                                maxWidth: '200px',
                              }}>
                                {result.derivedTags.slice(0, 5).map((tag, i) => (
                                  <span
                                    key={i}
                                    style={{
                                      padding: '0.1rem 0.3rem',
                                      backgroundColor: RANK_BG.B,
                                      color: RANK_TEXT.B,
                                      borderRadius: '3px',
                                      fontSize: '0.7rem',
                                      textAlign: 'center',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                    title={tag.displayName}
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
                                      backgroundColor: RANK_BG.X,
                                      color: RANK_TEXT.X,
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
                          {parseResult.mode === 'db' && (() => {
                            const isChecked = work.gameRegistered ?? false;
                            return (
                              <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleSetGameRegistered(work.workId, !isChecked)}
                                  title="エロネーター登録（ゲーム・シミュレーションで使用）"
                                  style={{ width: '18px', height: '18px', accentColor: '#28a745' }}
                                />
                              </td>
                            );
                          })()}
                          <td style={{ padding: '0.5rem' }}>
                            <button
                              onClick={() => setShowCommentModal({ workId: work.workId, comment: work.commentText ?? '' })}
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
                          閉じる
                        </button>
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
                          <strong>取得日時:</strong> {new Date(work.scrapedAt).toLocaleString('ja-JP')}
                        </div>
                        {/* 新フィールド */}
                        {work.contentId && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <strong>content_id:</strong> {work.contentId}
                          </div>
                        )}
                        {work.releaseDate && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <strong>発売日:</strong> {work.releaseDate}
                          </div>
                        )}
                        {work.pageCount && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <strong>ページ数:</strong> {work.pageCount}
                          </div>
                        )}
                        {work.affiliateUrl && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <strong>アフィリエイトURL:</strong>{' '}
                            <a href={work.affiliateUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0070f3' }}>
                              {work.affiliateUrl}
                            </a>
                          </div>
                        )}
                        {work.seriesInfo && (() => {
                          try {
                            const series = JSON.parse(work.seriesInfo);
                            return (
                              <div style={{ marginBottom: '0.5rem' }}>
                                <strong>シリーズ:</strong> {series.name} (ID: {series.id})
                              </div>
                            );
                          } catch {
                            return null;
                          }
                        })()}
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong>作品コメント:</strong> {work.commentText ? `✅ ${work.commentText.length}文字` : '❌ 未取得'}
                        </div>
                        <div style={{ marginBottom: '0.5rem' }}>
                          <strong>準有名タグ:</strong> {result?.derivedTags.length ? `✅ ${result.derivedTags.length}件` : '❌ 未生成'}
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
                                  backgroundColor: RANK_BG.S,
                                  color: RANK_TEXT.S,
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
                                      backgroundColor: RANK_BG.B,
                                      color: RANK_TEXT.B,
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
                                      backgroundColor: RANK_BG.X,
                                      color: RANK_TEXT.X,
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

                      <div style={{ marginTop: '1rem' }}>
                        <strong>作品コメント</strong>
                        {work.commentText ? (
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
                        ) : (
                          <div style={{ marginTop: '0.5rem', color: '#999', fontStyle: 'italic' }}>
                            未取得
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </>
      )}

      {/* タブコンテンツ タグ管理 */}
      {activeTab === 'tags' && (
        <section style={{ marginBottom: '2rem' }}>
          <TagManager adminToken={adminToken} />
        </section>
      )}

      {/* タブコンテンツ まとめ質問 */}
      {activeTab === 'summary' && (
        <section style={{ marginBottom: '2rem' }}>
          <SummaryQuestionEditor adminToken={adminToken} />
        </section>
      )}

      {/* タブコンテンツ コンフィグ */}
      {activeTab === 'config' && (
        <section style={{ marginBottom: '2rem' }}>
          <h2>設定変更</h2>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            開発環境でのみ利用可能です。設定変更後は開発サーバーを停止して再起動してください。
          </p>

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

              {/* 目次 */}
              <nav style={{ marginBottom: '2rem', padding: '1rem 1.25rem', border: '1px solid #ccc', borderRadius: '6px', backgroundColor: '#fafafa' }} aria-label="設定セクション一覧">
                <h3 style={{ marginTop: 0, marginBottom: '0.75rem', fontSize: '1rem' }}>設定のどこを変えたい？</h3>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', columns: 2, columnGap: '2rem', listStyle: 'disc' }}>
                  <li><a href="#config-debug" style={{ color: '#0066cc' }}>デバッグ表示</a></li>
                  <li><a href="#config-reveal" style={{ color: '#0066cc' }}>答え合わせ・確認質問のタイミング</a></li>
                  <li><a href="#config-algo" style={{ color: '#0066cc' }}>アルゴリズム（重み・タグ選択・スケール）</a></li>
                  <li><a href="#config-flow" style={{ color: '#0066cc' }}>ゲームの流れ（質問数・頭文字など）</a></li>
                  <li><a href="#config-data" style={{ color: '#0066cc' }}>データ品質（タグの出題条件）</a></li>
                  <li><a href="#config-popularity" style={{ color: '#0066cc' }}>人気度</a></li>
                </ul>
              </nav>

              {/* デバッグ設定 */}
              <section id="config-debug" style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
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
                    チェックを入れると、ゲーム画面にデバッグパネルが表示されます。
                    <br />
                    デバッグパネルには、内部状態（確信度、候補数、重みの変化など）が表示されます。
                  </p>
                </div>
              </section>

              {/* 答え合わせ・確認質問 */}
              <section id="config-reveal" style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <h3>答え合わせ・確認質問のタイミング</h3>
                <p style={{ color: '#666', marginBottom: '1rem' }}>「この作品で合ってる？」をいつ出すか、その前に「〇〇あるかしら？」や頭文字・作者をいつ挟むかを決めます。</p>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <strong>答え合わせを出す確信度のしきい値</strong>
                    {fieldDesc('revealThreshold')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>「この作品で合ってる？」と答え合わせするタイミング。候補の確信度がこの値以上になると答え合わせに進みます。0～1（例: 0.7＝70%）</span>
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
                    <strong>タグで直接聞く質問を挟む確信度の範囲</strong>
                    {fieldDesc('confidenceConfirmBand')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>「〇〇あるかしら？」のような確認質問を、確信度がこの範囲（最小～最大）のときに出します。範囲外だと通常のタグ質問だけになります。</span>
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
                    <strong>必ず確認質問を出す質問番号</strong>
                    {fieldDesc('qForcedIndices')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>指定した質問番号では、確信度に関係なく「確認質問」を1問挟みます。カンマ区切り（例: 6,10,17）</span>
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
                    <strong>タグで直接聞く質問（やわらかめ）の下限確信度</strong>
                    {fieldDesc('softConfidenceMin')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>確信度がこの値以上のとき、「〇〇あるかしら？」のようなタグ確認質問を出します。0～1。</span>
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
                    <strong>頭文字・作者で聞く質問（きっぱり）の下限確信度</strong>
                    {fieldDesc('hardConfidenceMin')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>確信度がこの値以上のとき、「タイトルの頭文字は〇かしら？」「作者は〇〇かしら？」のような直接質問を出します。0～1。</span>
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

              {/* アルゴリズム（スコア・重み・タグ選択・スケール） */}
              <section id="config-algo" style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <h3>アルゴリズム（重みの更新・質問の選び方・効かせ方）</h3>
                <p style={{ color: '#666', marginBottom: '1rem' }}>回答でスコアをどう更新するか、次にどのタグを出すか、1問の効きをどれくらいにするかを決めます。失敗が多いときは「質問の選び方」の useIG を OFF にしたり、ベイズの bayesianEpsilon を大きくすると改善しやすいです。</p>

                <h4 style={{ marginTop: '1.5rem', marginBottom: '0.5rem', fontSize: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.25rem' }}>重みの更新（回答でスコアをどう変えるか）</h4>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <strong>回答によるスコアの動き方（強さ）</strong>
                    {fieldDesc('beta')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>YES/NOに応じて候補の重みをどれくらい強く変えるか。大きいほど1問の影響が強く、収束が早くなりがちです。</span>
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
                    <strong>人気度をスコアに混ぜる割合</strong>
                    {fieldDesc('alpha')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>再生数など「人気」をスコアにどれだけ反映するか。0～1。0だと人気はほぼ無視されます。</span>
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
                    <strong>タグの「ある/ない」を決めるしきい値</strong>
                    {fieldDesc('derivedConfidenceThreshold')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>作品ごとのタグの確信度がこの値以上なら「そのタグあり」として扱います。0～1。</span>
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
                    <strong>答え合わせで外れたときのスコアの下げ幅</strong>
                    {fieldDesc('revealPenalty')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>「この作品で合ってる？」でNOだった候補のスコアを、どれくらい割り引くか。0～1。大きいほど外れ候補が早く沈みます。</span>
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

                <h4 style={{ marginTop: '1.5rem', marginBottom: '0.5rem', fontSize: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.25rem' }}>次の質問の選び方（どのタグを出すか・IG／p値）</h4>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <strong>タグを出題する「p値」の範囲</strong>
                    {fieldDesc('explorePValueMin / explorePValueMax')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>この範囲外のp値のタグは出題しません。未設定時はフィルタなし。例: 0.1～0.9</span>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        placeholder="0.1"
                        value={config.algo.explorePValueMin ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateConfig(['algo', 'explorePValueMin'], v === '' ? undefined : parseFloat(v));
                        }}
                        style={{ width: '80px', padding: '0.5rem' }}
                      />
                      <span>～</span>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        placeholder="0.9"
                        value={config.algo.explorePValueMax ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          updateConfig(['algo', 'explorePValueMax'], v === '' ? undefined : parseFloat(v));
                        }}
                        style={{ width: '80px', padding: '0.5rem' }}
                      />
                    </div>
                  </label>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={config.algo.explorePValueFallbackEnabled !== false}
                      onChange={(e) => updateConfig(['algo', 'explorePValueFallbackEnabled'], e.target.checked)}
                    />
                    <strong>p値範囲内のタグが無いとき、頭文字・作者質問に切り替える</strong>
                    {fieldDesc('explorePValueFallbackEnabled')}
                  </label>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={config.algo.useIGForExploreSelection !== false}
                      onChange={(e) => updateConfig(['algo', 'useIGForExploreSelection'], e.target.checked)}
                    />
                    <strong>タグ質問を「情報利得(IG)」で選ぶ</strong>
                    {fieldDesc('useIGForExploreSelection')}
                  </label>
                  <p style={{ marginTop: '0.35rem', marginLeft: '1.5rem', fontSize: '0.9rem', color: '#555', lineHeight: '1.5' }}>
                    ON（推奨）：1問で候補が一番分かれるタグを選びます。正答が多いと早く絞れますが、ノイズで1問間違えると確度が大きく崩れやすいです。
                    <br />
                    OFF：p値が0.5に近い（どちらとも言いにくい）タグを選びます。1問の効きは穏やかで、ノイズに強くなりやすい代わりに収束はやや遅れます。失敗が多いときはOFFを試してください。
                  </p>
                </div>

                <h4 style={{ marginTop: '1.5rem', marginBottom: '0.5rem', fontSize: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.25rem' }}>回答の効かせ方（1問あたりのスケール）</h4>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <strong>まとめ質問の回答強度スケール</strong>
                    {fieldDesc('summaryQuestionStrengthScale')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>まとめ質問（「学校が舞台？」など）のYES/NOが確度に与える影響の倍率。1＝通常タグと同程度、0.6＝控えめ。未設定時0.6。</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="0.6"
                      value={config.algo.summaryQuestionStrengthScale ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateConfig(['algo', 'summaryQuestionStrengthScale'], v === '' ? undefined : parseFloat(v));
                      }}
                      style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                    />
                  </label>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <strong>通常タグ質問の回答強度スケール</strong>
                    {fieldDesc('exploreTagStrengthScale')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>まとめ以外のタグ質問（通常・エロ・抽象）のYES/NOが確度に与える影響の倍率。1＝変更なし。未設定時1。</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="1"
                      value={config.algo.exploreTagStrengthScale ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateConfig(['algo', 'exploreTagStrengthScale'], v === '' ? undefined : parseFloat(v));
                      }}
                      style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                    />
                  </label>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <strong>SOFT確認の回答強度スケール</strong>
                    {fieldDesc('softConfirmStrengthScale')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>「〇〇あるかしら？」のようなSOFT確認質問のYES/NOが確度に与える影響の倍率。1＝変更なし。未設定時1。</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      placeholder="1"
                      value={config.algo.softConfirmStrengthScale ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateConfig(['algo', 'softConfirmStrengthScale'], v === '' ? undefined : parseFloat(v));
                      }}
                      style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                    />
                  </label>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={config.algo.useBayesianUpdate !== false}
                      onChange={(e) => updateConfig(['algo', 'useBayesianUpdate'], e.target.checked)}
                    />
                    <strong>タグ・確認質問の重み更新をベイズ（事後確率）で行う</strong>
                    {fieldDesc('useBayesianUpdate')}
                  </label>
                  <span style={{ display: 'block', marginTop: '0.35rem', marginLeft: '1.5rem', fontSize: '0.9rem', color: '#666' }}>OFFにすると従来の強度×betaで更新。未設定時はON（ベイズ使用）。</span>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <strong>ベイズ更新時の尤度の下限（bayesianEpsilon）</strong>
                    {fieldDesc('bayesianEpsilon')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>確率0で重みを殺さないための下限。尤度は [epsilon, 1-epsilon] にクランプされます。0～0.5。未設定時0.02。</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="0.5"
                      placeholder="0.02"
                      value={config.algo.bayesianEpsilon ?? ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateConfig(['algo', 'bayesianEpsilon'], v === '' ? undefined : parseFloat(v));
                      }}
                      style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                    />
                  </label>
                </div>
              </section>

              {/* ゲームの流れ */}
              <section id="config-flow" style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <h3>ゲームの流れ（質問数・失敗時・頭文字の範囲など）</h3>
                <p style={{ color: '#666', marginBottom: '1rem' }}>1ゲームの最大質問数、答え合わせを連続で外してよい回数、失敗時に表示する候補数、まとめ質問の優先度、頭文字・作者を何位までから選ぶかなどを決めます。</p>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <strong>1ゲームの最大質問数</strong>
                    {fieldDesc('maxQuestions')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>この回数まで質問したらゲーム終了（正解が出なくても終了）します。</span>
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
                    <strong>答え合わせを連続で外してよい回数</strong>
                    {fieldDesc('maxRevealMisses')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>「この作品で合ってる？」をこの回数だけ連続で外すと、答え合わせは打ち切られて質問に戻ります。</span>
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
                    <strong>失敗時に表示する候補の数</strong>
                    {fieldDesc('failListN')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>質問数オーバーなどでゲーム失敗のとき、上位何件の候補を「惜しかった作品」として表示するか。</span>
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
                    <strong>確認質問を挟む「候補数しきい値」の計算用</strong>
                    {fieldDesc('effectiveConfirmThresholdParams')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>候補数に応じて確認質問を出すかどうかを決める式のパラメータ。通常はそのままで問題ありません。min・max・divisor の3つ。</span>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <label>
                          最小:
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
                          最大:
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
                          割る数:
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
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <strong>連続でNOが続いたとき「当たり狙い」にする回数</strong>
                    {fieldDesc('consecutiveNoForAtari')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>直近の回答がこの回数だけ連続NOのとき、次の1問は当たりやすいタグを選びます。単調さを和らげます。未設定時は3。</span>
                    <input
                      type="number"
                      min="1"
                      value={config.flow.consecutiveNoForAtari ?? 3}
                      onChange={(e) => {
                        const v = e.target.value;
                        updateConfig(['flow', 'consecutiveNoForAtari'], v === '' ? undefined : parseInt(v) || 3);
                      }}
                      placeholder="3"
                      style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                    />
                  </label>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <strong>まとめ質問を優先して選ぶ確率</strong>
                    {fieldDesc('summaryPreferRatio')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>0～1。この確率で「まとめ質問だけ」に絞ってから1問選びます。0なら優先なし。0.3なら30%の確率でまとめが多く出ます。まとめがなかなか出ないときは0.3～0.5程度に上げて試してください。</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={config.flow.summaryPreferRatio ?? 0}
                      onChange={(e) => updateConfig(['flow', 'summaryPreferRatio'], e.target.value === '' ? undefined : parseFloat(e.target.value))}
                      placeholder="0"
                      style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                    />
                  </label>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <strong>頭文字・作者を聞くとき、候補の上位何件から選ぶか</strong>
                    {fieldDesc('titleInitialTopN')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>「タイトルの頭文字は〇かしら？」「作者は〇〇かしら？」を、確度の高い順に何件目の作品までから選ぶか。1＝1位だけ（従来どおり）。2や3にすると頭文字のバリエーションが増えますが、正解がその範囲に入っていないと正解の頭文字を一度も聞けず終わるリスクがあります。推奨は2か3。</span>
                    <input
                      type="number"
                      min="1"
                      value={config.flow.titleInitialTopN ?? 1}
                      onChange={(e) => updateConfig(['flow', 'titleInitialTopN'], e.target.value === '' ? undefined : parseInt(e.target.value) || 1)}
                      placeholder="1"
                      style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                    />
                  </label>
                </div>
              </section>

              {/* データ品質（タグの出題条件） */}
              <section id="config-data" style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <h3>データ品質（タグの出題条件）</h3>
                <p style={{ color: '#666', marginBottom: '1rem' }}>タグを「出題候補」にするときの条件です。極端に少ない作品にしかないタグや、ほぼ全員が持つタグを出題から外すために使います。</p>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <strong>「何人持ってるタグを出すか」の決め方</strong>
                    {fieldDesc('minCoverageMode')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>RATIO＝割合でしきい値、WORKS＝作品数でしきい値、AUTO＝自動。通常は WORKS のままで問題ありません。</span>
                    <select
                      value={config.dataQuality.minCoverageMode}
                      onChange={(e) => updateConfig(['dataQuality', 'minCoverageMode'], e.target.value)}
                      style={{ width: '100%', padding: '0.5rem', marginTop: '0.5rem' }}
                    >
                      <option value="RATIO">割合でしきい値（RATIO）</option>
                      <option value="WORKS">作品数でしきい値（WORKS）</option>
                      <option value="AUTO">自動（AUTO）</option>
                    </select>
                  </label>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <strong>タグを出題する「最小の割合」</strong>
                    {fieldDesc('minCoverageRatio')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>候補作品中、この割合以上の作品が持っているタグだけ出題します。RATIOモードのとき使います。0～1。空なら無効。</span>
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
                    <strong>タグを出題する「最小の作品数」</strong>
                    {fieldDesc('minCoverageWorks')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>候補作品中、この件数以上の作品が持っているタグだけ出題します。WORKSモードのとき使います。空なら無効。</span>
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

              {/* 人気度 */}
              <section id="config-popularity" style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '4px' }}>
                <h3>人気度</h3>
                <p style={{ color: '#666', marginBottom: '1rem' }}>正解したときの「人気」の扱いです。現状はボーナス0で、スコアにはアルゴリズムの alpha で混ぜる形です。</p>
                <div style={{ marginBottom: '1rem' }}>
                  <label>
                    <strong>正解したときに人気スコアへ加えるボーナス</strong>
                    {fieldDesc('playBonusOnSuccess')}
                    <span style={{ display: 'block', marginTop: '0.35rem', fontSize: '0.9rem' }}>答え合わせで正解した作品に、人気スコアをどれだけ足すか。0なら加算なし。</span>
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
                <h3>注意事項</h3>
                <ul style={{ marginLeft: '1.5rem' }}>
                  <li>設定変更後は開発サーバーを再起動してください（<code>npm run dev</code>を停止して再起動）</li>
                  <li>バリデーションエラーがある場合は保存されません</li>
                  <li>保存前に自動的にバックアップが作成されます（<code>config/mvpConfig.json.bak</code>）</li>
                  <li>このページは開発環境でのみ利用できます</li>
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
                  {configSaving ? '保存中...' : '設定を保存'}
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

      {/* タブコンテンツ 作品インポート */}
      {activeTab === 'import' && (
        <section style={{ marginBottom: '2rem' }}>
          <ImportWorkflow />

          {/* 旧機能（折りたたみ） */}
          <details style={{ marginTop: '30px' }}>
            <summary style={{ cursor: 'pointer', color: '#666', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              ▶ 旧インポート機能（非推奨）
            </summary>
            <div style={{ marginTop: '10px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '4px', opacity: 0.7 }}>
          <h2 style={{ color: '#856404' }}>⚠️ 旧機能</h2>
          <p style={{ color: '#856404', marginBottom: '2rem' }}>
            以下は旧機能です。上の新しいワークフローを使用してください。
          </p>

          {/* DMM APIからインポート */}
          <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffc107' }}>
            <h3 style={{ marginTop: 0, color: '#856404' }}>🆕 DMM APIから新規作品をインポート</h3>
            <p style={{ fontSize: '0.9rem', color: '#856404', marginBottom: '1rem' }}>
              DMM APIから最新の同人誌作品を取得してDBに保存します。既存の作品はスキップされます。
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label htmlFor="dmmImportTarget" style={{ fontSize: '0.9rem' }}>取得件数:</label>
                <select
                  id="dmmImportTarget"
                  value={dmmImportTarget}
                  onChange={(e) => setDmmImportTarget(Number(e.target.value))}
                  disabled={dmmImporting}
                  style={{
                    padding: '0.5rem',
                    fontSize: '0.9rem',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                  }}
                >
                  <option value={5}>5件</option>
                  <option value={10}>10件</option>
                  <option value={20}>20件</option>
                  <option value={50}>50件</option>
                  <option value={100}>100件</option>
                </select>
              </div>
              <button
                onClick={handleDmmImport}
                disabled={dmmImporting || !adminToken}
                style={{
                  padding: '0.75rem 2rem',
                  fontSize: '1rem',
                  backgroundColor: dmmImporting || !adminToken ? '#ccc' : '#ff6600',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: dmmImporting || !adminToken ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {dmmImporting ? 'インポート中...' : 'DMM APIからインポート'}
              </button>
            </div>
            {dmmImportResult && (
              <div style={{ 
                marginTop: '1rem', 
                padding: '0.75rem', 
                backgroundColor: dmmImportResult.success ? '#d4edda' : '#f8d7da',
                borderRadius: '4px',
                fontSize: '0.9rem',
              }}>
                {dmmImportResult.success ? (
                  <>
                    <strong>✅ インポート完了</strong>
                    <br />
                    新規保存: {dmmImportResult.stats?.saved}件 / スキップ: {dmmImportResult.stats?.skipped}件（既存）
                    {dmmImportResult.savedWorks && dmmImportResult.savedWorks.length > 0 && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                        保存した作品: {dmmImportResult.savedWorks.slice(0, 5).map(w => w.title.substring(0, 20) + '...').join(', ')}
                        {dmmImportResult.savedWorks.length > 5 && ` 他${dmmImportResult.savedWorks.length - 5}件`}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <strong>❌ エラー</strong>: {dmmImportResult.error}
                  </>
                )}
              </div>
            )}
          </div>

          {/* DBから読み込むボタン（手動）*/}
          <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
            <h3 style={{ marginTop: 0 }}>📂 既存DBから読み込む</h3>
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
              DBに保存されている既存の作品とタグを読み込みます。（100件ずつページ表示）
            </p>
            <button
              onClick={() => handleLoadFromDb(1, dbFilter)}
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
                全量読み込み（works_A.txt推奨）
                <br />
                <input
                  type="radio"
                  name="mode"
                  value="append"
                  checked={mode === 'append'}
                  onChange={(e) => setMode(e.target.value as 'full' | 'append')}
                  style={{ marginRight: '0.5rem', marginTop: '0.5rem' }}
                />
                追加分析のみ（works_C.txt推奨）
              </label>
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                ※ 重複作品は自動的にマージされます。
              </p>
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
                    <strong>{selectedWorks.size}件</strong>の作品が選択されています。
                  </p>
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
                                        ↑
                                      </button>
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
                                        ↓
                                      </button>
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
                                        ×
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
                                        ×
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
            </div>
          </details>
        </section>
      )}

      {/* タブコンテンツ 人力タグ付け */}
      {activeTab === 'manual' && (
        <section style={{ marginBottom: '2rem' }}>
          <ManualTagging />
        </section>
      )}

      {/* タブコンテンツ シミュレーション */}
      {activeTab === 'simulate' && (
        <section style={{ marginBottom: '2rem' }}>
          <h2>シミュレーション</h2>
          <p style={{ color: '#666', marginBottom: '0.5rem' }}>
            指定した作品を「正解」として自動でゲームをプレイし、アルゴリズムの精度を検証します。
          </p>
          {simWorksStats !== null && (
            <p style={{ marginBottom: '2rem', fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>
              ゲーム有効: <span style={{ color: '#28a745' }}>{simWorksStats.gameRegisteredCount.toLocaleString()}</span>
              {' / '}
              全作品: <span style={{ color: '#666' }}>{simWorksStats.totalWorks.toLocaleString()}</span>
              {' 作品'}
            </p>
          )}

          {/* 設定パネル */}
          <div style={{ 
            background: '#f5f5f5', 
            padding: '1.5rem', 
            borderRadius: '8px',
            marginBottom: '2rem'
          }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>設定</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              {/* 作品選択 */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  正解作品
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    value={simSelectedWorkId}
                    onChange={(e) => setSimSelectedWorkId(e.target.value)}
                    style={{ 
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '4px',
                      border: '1px solid #ccc'
                    }}
                  >
                    <option value="">-- 選択 --</option>
                    {parseResult?.works?.map(work => (
                      <option key={work.workId} value={work.workId}>
                        {work.title} ({work.circleName})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (parseResult?.works && parseResult.works.length > 0) {
                        const randomIndex = Math.floor(Math.random() * parseResult.works.length);
                        setSimSelectedWorkId(parseResult.works[randomIndex].workId);
                      }
                    }}
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

              {/* ノイズ率（質問タイプ別） */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  ノイズ率（質問タイプ別）
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      <span style={{ background: RANK_BG.S, color: RANK_TEXT.S, padding: '0.1rem 0.3rem', borderRadius: '2px' }}>EXPLORE</span>
                      : {simNoiseExplore}%
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={simNoiseExplore}
                      onChange={(e) => setSimNoiseExplore(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      <span style={{ background: RANK_BG.B, color: RANK_TEXT.B, padding: '0.1rem 0.3rem', borderRadius: '2px' }}>SOFT</span>
                      : {simNoiseSoft}%
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={simNoiseSoft}
                      onChange={(e) => setSimNoiseSoft(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      <span style={{ background: RANK_BG.X, color: RANK_TEXT.X, padding: '0.1rem 0.3rem', borderRadius: '2px' }}>HARD</span>
                      : {simNoiseHard}%
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={simNoiseHard}
                      onChange={(e) => setSimNoiseHard(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem' }}>
                  各質問タイプで回答を間違える確率（0% = 完璧に回答）
                </div>
              </div>

              {/* AIゲート選択 */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  AIゲート
                </label>
                <select
                  value={simAiGateChoice}
                  onChange={(e) => setSimAiGateChoice(e.target.value)}
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
                onClick={async () => {
                  if (!simSelectedWorkId) {
                    alert('作品を選択してください');
                    return;
                  }
                  setSimLoading(true);
                  setSimResult(null);
                  try {
                    const response = await fetch('/api/admin/simulate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        targetWorkId: simSelectedWorkId,
                        noiseRates: {
                          explore: simNoiseExplore / 100,
                          soft: simNoiseSoft / 100,
                          hard: simNoiseHard / 100,
                        },
                        aiGateChoice: simAiGateChoice,
                      }),
                    });
                    if (!response.ok) {
                      const error = await response.json();
                      throw new Error(error.error || 'Simulation failed');
                    }
                    const data = await response.json();
                    setSimResult(data);
                  } catch (error) {
                    console.error('Simulation error:', error);
                    alert(error instanceof Error ? error.message : 'シミュレーションに失敗しました');
                  } finally {
                    setSimLoading(false);
                  }
                }}
                disabled={simLoading || !simSelectedWorkId}
                style={{
                  padding: '0.75rem 2rem',
                  background: simLoading ? '#ccc' : '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: simLoading ? 'default' : 'pointer',
                  fontSize: '1rem',
                }}
              >
                {simLoading ? '実行中...' : '単発シミュレーション実行'}
              </button>

              <button
                onClick={() => setSimBatchMode(!simBatchMode)}
                style={{
                  padding: '0.75rem 2rem',
                  background: simBatchMode ? '#ff6600' : '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                {simBatchMode ? 'バッチモード ON' : 'バッチモード OFF'}
              </button>
            </div>

            {/* バッチモード設定 */}
            {simBatchMode && (
              <div style={{ 
                marginTop: '1rem', 
                padding: '1rem', 
                background: RANK_BG.B,
                borderRadius: '4px'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                      サンプル数（0=全件）
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={simSampleSize}
                      onChange={(e) => setSimSampleSize(Math.max(0, Number(e.target.value)))}
                      style={{ 
                        width: '100%', 
                        padding: '0.5rem',
                        border: '1px solid #ccc',
                        borderRadius: '4px'
                      }}
                      placeholder="0でDB全件"
                    />
                    <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                      DB作品数: {parseResult?.stats?.total || parseResult?.works?.length || 0}件
                    </div>
                  </div>
                  <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                      作品あたりの試行回数: {simTrialsPerWork}
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={simTrialsPerWork}
                      onChange={(e) => setSimTrialsPerWork(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setSimBatchLoading(true);
                    setSimBatchResult(null);
                    try {
                      const response = await fetch('/api/admin/simulate', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          workIds: [],
                          noiseRates: {
                            explore: simNoiseExplore / 100,
                            soft: simNoiseSoft / 100,
                            hard: simNoiseHard / 100,
                          },
                          aiGateChoice: simAiGateChoice,
                          trialsPerWork: simTrialsPerWork,
                          sampleSize: simSampleSize,
                        }),
                      });
                      if (!response.ok) {
                        const error = await response.json();
                        throw new Error(error.error || 'Batch simulation failed');
                      }
                      const data = await response.json();
                      setSimBatchResult(data);
                    } catch (error) {
                      console.error('Batch simulation error:', error);
                      alert(error instanceof Error ? error.message : 'バッチシミュレーションに失敗しました');
                    } finally {
                      setSimBatchLoading(false);
                    }
                  }}
                  disabled={simBatchLoading}
                  style={{
                    padding: '0.75rem 2rem',
                    background: simBatchLoading ? '#ccc' : '#ff6600',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: simBatchLoading ? 'default' : 'pointer',
                  }}
                >
                  {simBatchLoading ? '実行中...' : simSampleSize > 0 ? `ランダム${simSampleSize}件でバッチ実行` : `全件でバッチ実行`}
                </button>
              </div>
            )}
          </div>

          {/* 単発結果 */}
          {simResult && (
            <div style={{ 
              background: simResult.success ? '#e8f5e9' : '#ffebee',
              padding: '1.5rem',
              borderRadius: '8px',
              marginBottom: '2rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ 
                  fontSize: '1.5rem', 
                  margin: 0,
                  color: simResult.success ? '#2e7d32' : '#c62828'
                }}>
                  {simResult.success ? '成功' : '失敗'} - {simResult.outcome}
                </h3>
                <button
                  onClick={async () => {
                    if (!simResult?.targetWorkId) {
                      alert('正解作品が不明なため再試行できません');
                      return;
                    }
                    setSimLoading(true);
                    try {
                      const response = await fetch('/api/admin/simulate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          targetWorkId: simResult.targetWorkId,
                          noiseRates: {
                            explore: simNoiseExplore / 100,
                            soft: simNoiseSoft / 100,
                            hard: simNoiseHard / 100,
                          },
                          aiGateChoice: simAiGateChoice,
                        }),
                      });
                      const data = await response.json().catch(() => ({}));
                      if (!response.ok) {
                        throw new Error((data as { error?: string }).error ?? (data as { message?: string }).message ?? '再試行に失敗しました');
                      }
                      setSimResult(data as typeof simResult);
                    } catch (error) {
                      console.error('Retry error:', error);
                      alert(error instanceof Error ? error.message : '再試行に失敗しました');
                    } finally {
                      setSimLoading(false);
                    }
                  }}
                  disabled={simLoading}
                  style={{
                    padding: '0.5rem 1rem',
                    background: simLoading ? '#ccc' : '#9c27b0',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: simLoading ? 'default' : 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  {simLoading ? '実行中...' : '🔄 もう1度試行'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <strong>正解作品:</strong><br />
                  {simResult.targetWorkTitle}
                </div>
                <div>
                  <strong>最終結果:</strong><br />
                  {simResult.finalWorkTitle || '(なし)'}
                </div>
                <div>
                  <strong>質問数:</strong> {simResult.questionCount}問
                </div>
                <div>
                  <strong>結果:</strong> {simResult.outcome}
                </div>
                {simResult.errorMessage && (
                  <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#ffebee', borderRadius: '4px', fontSize: '0.9rem' }}>
                    <strong>エラー:</strong> {simResult.errorMessage}
                  </div>
                )}
              </div>

              {/* ステップ詳細 & 作品詳細 */}
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSimExpandedSteps(!simExpandedSteps)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: simExpandedSteps ? '#333' : '#666',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {simExpandedSteps ? '過程を閉じる' : '過程を表示'}
                </button>
                <button
                  onClick={() => setSimShowWorkDetails(!simShowWorkDetails)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: simShowWorkDetails ? '#1976d2' : '#2196f3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {simShowWorkDetails ? '作品詳細を閉じる' : '作品詳細を表示'}
                </button>
              </div>

              {/* 作品詳細表示 */}
              {simShowWorkDetails && simResult.workDetails && (
                <div style={{ 
                  marginTop: '1rem',
                  background: '#fff',
                  padding: '1rem',
                  borderRadius: '4px',
                  border: '2px solid #2196f3'
                }}>
                  <h4 style={{ marginBottom: '1rem', color: '#1976d2' }}>作品DB詳細</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    <div><strong>workId:</strong> {simResult.workDetails.workId}</div>
                    <div><strong>作者:</strong> {simResult.workDetails.authorName || '(なし)'}</div>
                    <div><strong>AI判定:</strong> {simResult.workDetails.isAi || '(なし)'}</div>
                    <div><strong>有名度:</strong> {simResult.workDetails.popularityBase ?? '(なし)'}</div>
                    <div><strong>レビュー数:</strong> {simResult.workDetails.reviewCount ?? '(なし)'}</div>
                    <div><strong>レビュー平均:</strong> {simResult.workDetails.reviewAverage ?? '(なし)'}</div>
                  </div>

                  {simResult.workDetails.commentText && (
                    <div style={{ marginBottom: '1rem' }}>
                      <strong>コメント:</strong>
                      <div style={{ 
                        background: '#f5f5f5', 
                        padding: '0.5rem', 
                        borderRadius: '4px',
                        maxHeight: '100px',
                        overflowY: 'auto',
                        fontSize: '0.85rem',
                        marginTop: '0.25rem'
                      }}>
                        {simResult.workDetails.commentText}
                      </div>
                    </div>
                  )}

                  <div>
                    <strong>タグ ({simResult.workDetails.tags.length}件):</strong>
                    <div style={{ 
                      display: 'flex', 
                      flexWrap: 'wrap', 
                      gap: '0.5rem', 
                      marginTop: '0.5rem',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      padding: '0.5rem',
                      background: '#f9f9f9',
                      borderRadius: '4px'
                    }}>
                      {simResult.workDetails.tags
                        .sort((a, b) => {
                          // OFFICIAL → DERIVED → その他の順
                          const order = { OFFICIAL: 0, DERIVED: 1, STRUCTURAL: 2 };
                          return (order[a.tagType as keyof typeof order] ?? 3) - (order[b.tagType as keyof typeof order] ?? 3);
                        })
                        .map((tag, i) => {
                          // 質問されたタグをハイライト
                          const wasAsked = simResult.steps.some(s => 
                            s.question.displayText.includes(tag.displayName)
                          );
                          return (
                            <span
                              key={i}
                              style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.8rem',
                                background: tag.tagType === 'OFFICIAL' ? RANK_BG.S : 
                                           tag.tagType === 'DERIVED' ? RANK_BG.B : RANK_BG.X,
                                color: tag.tagType === 'OFFICIAL' ? RANK_TEXT.S : tag.tagType === 'DERIVED' ? RANK_TEXT.B : RANK_TEXT.X,
                                border: wasAsked ? '2px solid #4caf50' : '1px solid #ccc',
                                fontWeight: wasAsked ? 'bold' : 'normal',
                              }}
                              title={`${tag.tagType}${tag.derivedConfidence !== null ? ` (conf: ${tag.derivedConfidence})` : ''}`}
                            >
                              {tag.displayName}
                              {wasAsked && ' ✓'}
                            </span>
                          );
                        })}
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#666' }}>
                      <span style={{ background: RANK_BG.S, color: RANK_TEXT.S, padding: '0.1rem 0.3rem', borderRadius: '2px', marginRight: '0.5rem' }}>紫: S(OFFICIAL)</span>
                      <span style={{ background: RANK_BG.B, color: RANK_TEXT.B, padding: '0.1rem 0.3rem', borderRadius: '2px', marginRight: '0.5rem' }}>黄: DERIVED</span>
                      <span style={{ background: RANK_BG.X, color: RANK_TEXT.X, padding: '0.1rem 0.3rem', borderRadius: '2px', marginRight: '0.5rem' }}>青: X(STRUCTURAL)</span>
                      <span style={{ border: '2px solid #4caf50', padding: '0.1rem 0.3rem', borderRadius: '2px' }}>緑枠: 質問された</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 過程詳細 */}
              <div style={{ marginTop: '1rem' }}>

                {simExpandedSteps && (
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
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>p値</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right' }}>確度</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simResult.steps.map((step, i) => {
                          const isReveal = step.question.kind === 'REVEAL';
                          const revealSuccess = (step as any).revealResult === 'SUCCESS';
                          const revealMiss = (step as any).revealResult === 'MISS';
                          return (
                            <tr 
                              key={i} 
                              style={{ 
                                borderBottom: '1px solid #eee',
                                background: isReveal 
                                  ? (revealSuccess ? '#c8e6c9' : '#ffcdd2')
                                  : 'transparent',
                              }}
                            >
                              <td style={{ padding: '0.5rem' }}>{step.qIndex}</td>
                              <td style={{ padding: '0.5rem' }}>
                                <span style={{ 
                                  display: 'inline-block',
                                  padding: '0.2rem 0.5rem',
                                  background: step.question.kind === 'EXPLORE_TAG' ? RANK_BG.S 
                                    : step.question.kind === 'SOFT_CONFIRM' ? RANK_BG.B
                                    : step.question.kind === 'HARD_CONFIRM' ? RANK_BG.X
                                    : step.question.kind === 'REVEAL' ? '#ffeb3b'
                                    : '#e0e0e0',
                                  color: step.question.kind === 'EXPLORE_TAG' ? RANK_TEXT.S : step.question.kind === 'SOFT_CONFIRM' ? RANK_TEXT.B : step.question.kind === 'HARD_CONFIRM' ? RANK_TEXT.X : undefined,
                                  borderRadius: '4px',
                                  fontSize: '0.8rem',
                                  marginRight: '0.5rem',
                                  fontWeight: isReveal ? 'bold' : 'normal',
                                }}>
                                  {step.question.kind}
                                  {step.question.exploreTagKind && (
                                    <span style={{ marginLeft: '0.25rem', opacity: 0.9 }}>
                                      {EXPLORE_TAG_KIND_LABEL[step.question.exploreTagKind]}
                                    </span>
                                  )}
                                </span>
                                {step.question.displayText}
                                {revealMiss && (
                                  <span style={{ 
                                    marginLeft: '0.5rem', 
                                    color: '#c62828', 
                                    fontWeight: 'bold' 
                                  }}>
                                    ← 不正解！
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                <span style={{
                                  color: step.answer === 'YES' || step.answer === 'CORRECT' ? '#2e7d32' 
                                    : step.answer === 'NO' || step.answer === 'WRONG' ? '#c62828'
                                    : '#666',
                                  fontWeight: 'bold'
                                }}>
                                  {step.answer}
                                </span>
                              </td>
                              <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                {step.wasNoisy && <span style={{ color: '#ff6600' }}>!</span>}
                              </td>
                              <td style={{ 
                                padding: '0.5rem', 
                                textAlign: 'right',
                                color: (step as any).tagCoverage !== undefined 
                                  ? (Math.abs((step as any).tagCoverage - 0.5) < 0.1 ? '#2e7d32' 
                                    : Math.abs((step as any).tagCoverage - 0.5) > 0.4 ? '#c62828' 
                                    : '#666')
                                  : '#999',
                                fontWeight: (step as any).tagCoverage !== undefined && Math.abs((step as any).tagCoverage - 0.5) > 0.4 ? 'bold' : 'normal',
                              }}>
                                {(step as any).tagCoverage !== undefined 
                                  ? `${((step as any).tagCoverage * 100).toFixed(0)}%`
                                  : '-'}
                              </td>
                              <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                                {(step.confidenceBefore * 100).toFixed(1)}%
                                {!isReveal && ` → ${(step.confidenceAfter * 100).toFixed(1)}%`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* バッチ結果 */}
          {simBatchResult && (
            <div style={{ 
              background: '#e3f2fd',
              padding: '1.5rem',
              borderRadius: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.5rem', margin: 0 }}>
                  バッチ結果
                  {simBatchResult.metadata && (
                    <span style={{ fontSize: '0.9rem', color: '#666', marginLeft: '1rem' }}>
                      ({simBatchResult.metadata.sampleSize}件 / DB全{simBatchResult.metadata.totalWorksInDb}件)
                    </span>
                  )}
                </h3>
                <button
                  onClick={async () => {
                    setSimSaving(true);
                    try {
                      const response = await fetch('/api/admin/simulate', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ result: simBatchResult }),
                      });
                      if (!response.ok) throw new Error('Failed to save');
                      const data = await response.json();
                      alert(`結果を保存しました: ${data.filePath}`);
                    } catch (error) {
                      alert('保存に失敗しました');
                    } finally {
                      setSimSaving(false);
                    }
                  }}
                  disabled={simSaving}
                  style={{
                    padding: '0.5rem 1rem',
                    background: simSaving ? '#ccc' : '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: simSaving ? 'default' : 'pointer',
                  }}
                >
                  {simSaving ? '保存中...' : '結果を保存'}
                </button>
              </div>

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
                    {(simBatchResult.successRate * 100).toFixed(1)}%
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
                    {simBatchResult.successCount}/{simBatchResult.totalTrials}
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
                    {simBatchResult.avgQuestions.toFixed(1)}
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
                    {simBatchResult.results.filter(r => !r.success).length}
                  </div>
                  <div style={{ color: '#666' }}>失敗数</div>
                </div>
              </div>

              {/* 全作品一覧 */}
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>
                  全結果一覧（クリックで詳細表示）
                </h4>
                <div style={{ 
                  maxHeight: '400px', 
                  overflowY: 'auto',
                  background: '#fff',
                  padding: '0.5rem',
                  borderRadius: '4px'
                }}>
                  {simBatchResult.results.map((r, i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        // 保存済みの結果を表示（再実行しない）
                        setSimResult({
                          success: r.success,
                          targetWorkId: r.workId,
                          targetWorkTitle: r.title,
                          finalWorkId: null,
                          finalWorkTitle: null,
                          questionCount: r.questionCount,
                          outcome: r.outcome,
                          steps: r.steps || [],
                          workDetails: r.workDetails,
                          errorMessage: (r as { errorMessage?: string }).errorMessage,
                        });
                        setSimExpandedSteps(true);
                        setSimShowWorkDetails(false);
                      }}
                      style={{ 
                        padding: '0.5rem 0.75rem',
                        borderBottom: '1px solid #eee',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: r.success ? 'transparent' : '#ffebee',
                      }}
                    >
                      <span style={{ 
                        display: 'inline-block',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: r.success ? '#4caf50' : '#f44336',
                        color: 'white',
                        textAlign: 'center',
                        lineHeight: '20px',
                        fontSize: '0.75rem',
                        flexShrink: 0,
                      }}>
                        {r.success ? '✓' : '✗'}
                      </span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.title}
                      </span>
                      <span style={{ color: '#666', fontSize: '0.85rem', flexShrink: 0 }}>
                        {r.outcome} ({r.questionCount}問)
                        {(r as { errorMessage?: string }).errorMessage && (
                          <span style={{ display: 'block', color: '#c62828', fontSize: '0.75rem', marginTop: '2px' }} title={(r as { errorMessage?: string }).errorMessage}>
                            {(r as { errorMessage?: string }).errorMessage}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* サービスプレイ履歴タブ */}
      {activeTab === 'history' && (
        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>サービスプレイ履歴</h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            1プレイ＝1レコード。質問列・回答・結果・時刻は本番で保存されています。離脱・失敗分析やタグ修正の参照用です。
          </p>
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label>
              結果で絞る:
              <select
                value={historyOutcome}
                onChange={(e) => setHistoryOutcome(e.target.value)}
                style={{ marginLeft: '0.5rem', padding: '0.35rem 0.5rem' }}
              >
                <option value="">すべて</option>
                <option value="SUCCESS">SUCCESS（正解）</option>
                <option value="FAIL_LIST">FAIL_LIST（候補から未選択）</option>
                <option value="ALMOST_SUCCESS">ALMOST_SUCCESS（候補から選択）</option>
                <option value="NOT_IN_LIST">NOT_IN_LIST（リスト外入力）</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => fetchPlayHistory(1)}
              disabled={historyLoading}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: historyLoading ? '#ccc' : '#6b21a8',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: historyLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {historyLoading ? '読込中...' : '再読み込み'}
            </button>
            <span style={{ color: '#666', fontSize: '0.9rem' }}>
              全 {historyTotal} 件 {historyPage > 1 && `（ページ ${historyPage}）`}
            </span>
          </div>
          {historyLoading && historyItems.length === 0 ? (
            <p>読み込み中...</p>
          ) : historyItems.length === 0 ? (
            <p style={{ color: '#666' }}>履歴がありません。</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', background: '#f5f5f5' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>日時</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>結果</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right' }}>質問数</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>正解/作品ID</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>リスト外入力</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>sessionId</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                        {row.createdAt ? new Date(row.createdAt).toLocaleString('ja-JP') : '-'}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <span style={{
                          color: row.outcome === 'SUCCESS' ? '#2e7d32' : row.outcome === 'FAIL_LIST' ? '#c62828' : '#666',
                          fontWeight: 'bold',
                        }}>
                          {row.outcome}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>{row.questionCount}</td>
                      <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {row.resultWorkId ?? '-'}
                      </td>
                      <td style={{ padding: '0.5rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.submittedTitleText ?? '-'}
                      </td>
                      <td style={{ padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.8rem' }} title={row.sessionId}>
                        {row.sessionId.slice(0, 12)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {historyTotal > historyLimit && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => fetchPlayHistory(historyPage - 1)}
                disabled={historyLoading || historyPage <= 1}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: historyPage <= 1 ? '#ccc' : '#6b21a8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: historyPage <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                前へ
              </button>
              <span style={{ fontSize: '0.9rem' }}>
                ページ {historyPage} / {Math.ceil(historyTotal / historyLimit) || 1}
              </span>
              <button
                type="button"
                onClick={() => fetchPlayHistory(historyPage + 1)}
                disabled={historyLoading || historyPage >= Math.ceil(historyTotal / historyLimit)}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: historyPage >= Math.ceil(historyTotal / historyLimit) ? '#ccc' : '#6b21a8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: historyPage >= Math.ceil(historyTotal / historyLimit) ? 'not-allowed' : 'pointer',
                }}
              >
                次へ
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}