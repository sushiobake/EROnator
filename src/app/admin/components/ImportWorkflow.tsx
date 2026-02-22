'use client';

import { useState, useEffect } from 'react';
import { useAdminProgress } from '../context/AdminProgressContext';
import { RANK_CHIP } from '../constants/rankColors';

interface WorkItem {
  workId: string;
  title: string;
  authorName: string;
  hasComment: boolean;
  hasDerivedTags: boolean;
  derivedTagCount: number;
}

interface ImportStats {
  totalWorks: number;
  withComment: number;
  withoutComment: number;
  withDerivedTags: number;
  withoutDerivedTags: number;
}

interface WorkListItem {
  workId: string;
  title: string;
  authorName: string;
  commentText: string | null;
  needsReview: boolean;
  officialTags: Array<{
    displayName: string;
    category: string | null;
  }>;
  additionalSTags?: Array<{
    displayName: string;
    category: string | null;
  }>;
  derivedTags: Array<{ 
    tagKey: string;
    displayName: string; 
    category: string | null;
    source?: 'matched' | 'suggested' | 'manual';
    confidence?: number;
    rank?: 'A' | 'B' | 'C' | ''; // タグリストのランク
  }>;
  structuralTags?: Array<{
    displayName: string;
    category: string | null;
  }>;
}

type Step = 'api' | 'comment' | 'analyze';

export default function ImportWorkflow() {
  const { setProgress } = useAdminProgress();
  // 管理トークン
  const [adminToken, setAdminToken] = useState<string>('');
  
  // ステップ管理
  const [activeStep, setActiveStep] = useState<Step>('api');
  
  // API インポート
  const [apiOffset, setApiOffset] = useState(1); // 開始オフセット（1=1位から）
  const [apiRounds, setApiRounds] = useState(1); // 連続ラウンド数（2以上で自動的に次のオフセットを連続取得）
  const [apiSort, setApiSort] = useState<'rank' | 'review' | 'date'>('rank'); // ソート: rank=人気順, review=レビュー順, date=発売日順
  const [apiYearFilter, setApiYearFilter] = useState(''); // 発売年で絞り込み。''=全期間, '2024'=2024年のみ
  const [apiLoading, setApiLoading] = useState(false);
  const [apiResult, setApiResult] = useState<{ imported: number; skipped: number; nextSuggestedOffset?: number; roundsDone?: number } | null>(null);
  
  // コメント取得
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentProgress, setCommentProgress] = useState({ current: 0, total: 0 });
  const [commentResult, setCommentResult] = useState<{ success: number; failed: number } | null>(null);
  
  // AI分析
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ current: 0, total: 0 });
  const [analyzeResult, setAnalyzeResult] = useState<Array<{
    workId: string;
    title: string;
    tags: Array<{ name: string; source: 'matched' | 'suggested'; rank?: 'A' | 'B' | 'C' | '' }>;
    elapsed: number;
  }>>([]);
  /** AI分析プレビュー（保存せず表示のみ。承認後に保存）workId -> { derivedTags, characterTags, needsReview } */
  const [analysisPreview, setAnalysisPreview] = useState<Record<string, {
    derivedTags: Array<{ displayName: string; source?: string; rank?: string }>;
    characterTags?: string[];
    needsReview?: boolean;
  }>>({});
  const [analyzeApproveLoading, setAnalyzeApproveLoading] = useState(false);
  /** AI指示プレビュー（確認用） */
  const [aiPromptModal, setAiPromptModal] = useState<{
    open: boolean;
    loading: boolean;
    data: null | { prompt: string; meta: { officialTagCount: number; aTagCount: number; bTagCount: number; cTagCount: number } };
  }>({ open: false, loading: false, data: null });
  
  // 統計
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  
  // 作品リスト
  const [workList, setWorkList] = useState<WorkListItem[]>([]);
  const [workListLoading, setWorkListLoading] = useState(false);
  const [workListFilter, setWorkListFilter] = useState<'all' | 'noComment' | 'noTags' | 'needsReview'>('all');
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalWorks, setTotalWorks] = useState(0);
  const PAGE_SIZE = 100;
  
  // 一括・ChatGPT 折りたたみ
  const [bulkSectionOpen, setBulkSectionOpen] = useState(false);
  const [chatgptSectionOpen, setChatgptSectionOpen] = useState(false);
  // AIプロバイダ表示用（Cloudflare / Groq / HuggingFace）
  const [aiProvider, setAiProvider] = useState<string | null>(null);

  // 一括: API → コメント取得
  const [apiBulkRounds, setApiBulkRounds] = useState(3);
  const [commentBulkLimit, setCommentBulkLimit] = useState(100);
  const [apiCommentBulkRunning, setApiCommentBulkRunning] = useState(false);
  const [apiCommentBulkLog, setApiCommentBulkLog] = useState<string[]>([]);
  // 一括: コメント取得 → AI分析（別枠）
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchCount, setBatchCount] = useState(10);
  const [batchLog, setBatchLog] = useState<string[]>([]);
  // 一括: コメント取得 + Phase0+1+2（100〜1000件、100刻み）
  const [bulkCommentPhase012Running, setBulkCommentPhase012Running] = useState(false);
  const [bulkCommentPhase012Count, setBulkCommentPhase012Count] = useState(100);
  
  // ファイルインポート（折りたたみ）
  const [showFileImport, setShowFileImport] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  
  // ChatGPTエクスポート/インポート
  const [exportLoading, setExportLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    works: Array<{
      workId: string;
      dbTitle: string;
      chatgptTitle: string | null;
      titleMatch: boolean;
      matchedTags: Array<{ displayName: string; category: string | null; isNew: boolean; existingTagKey?: string }>;
      suggestedTags: Array<{ displayName: string; category: string | null; isNew: boolean; existingTagKey?: string }>;
      characterName: string | null;
      hasChanges: boolean;
    }>;
    stats: {
      total: number;
      titleMismatches: number;
      newMatchedTags: number;
      newSuggestedTags: number;
      worksWithChanges: number;
    };
  } | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  /** プレビューで「ナシ」にしたタグ（承認時に取り込まない）key: workId_matched_displayName / workId_suggested_displayName / workId_character */
  const [rejectedPreviewKeys, setRejectedPreviewKeys] = useState<Set<string>>(new Set());

  // タグ追加モーダル
  const [addTagModal, setAddTagModal] = useState<{ workId: string; title: string } | null>(null);
  const [addTagInput, setAddTagInput] = useState('');
  const [addTagSuggestions, setAddTagSuggestions] = useState<Array<{ displayName: string; tagKey: string }>>([]);
  const [addTagLoading, setAddTagLoading] = useState(false);

  // 統計を取得
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/admin/import/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  // 作品リストを取得
  const fetchWorkList = async (filter: 'all' | 'noComment' | 'noTags' | 'needsReview' = 'all', page: number = 1) => {
    setWorkListLoading(true);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const res = await fetch(`/api/admin/import/works?filter=${filter}&limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();
      if (data.success) {
        setWorkList(data.works);
        setTotalWorks(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch work list:', error);
    } finally {
      setWorkListLoading(false);
    }
  };

  // 管理トークンを読み込み
  useEffect(() => {
    const stored = localStorage.getItem('eronator.adminToken');
    if (stored) {
      setAdminToken(stored);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchWorkList('all', 1);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    fetchWorkList(workListFilter, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workListFilter]);

  useEffect(() => {
    fetchWorkList(workListFilter, currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // AIプロバイダ表示用（管理トークン設定時のみ取得）
  useEffect(() => {
    if (!adminToken) return;
    fetch('/api/admin/tags/analyze-test', {
      headers: { 'x-eronator-admin-token': adminToken },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.provider) setAiProvider(d.provider);
      })
      .catch(() => {});
  }, [adminToken]);

  // APIインポート実行（有名順）
  const handleApiImport = async () => {
    if (!adminToken) {
      alert('管理トークンを入力してください');
      return;
    }
    setApiLoading(true);
    setApiResult(null);
    try {
      const res = await fetch('/api/admin/dmm/import', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({
          target: 100,
          sort: apiSort,
          offset: apiOffset,
          rounds: Math.max(1, Math.min(20, apiRounds)),
          ...(apiYearFilter && {
            gte_date: `${apiYearFilter}-01-01`,
            lte_date: `${apiYearFilter}-12-31`,
          }),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setApiResult({
          imported: data.stats?.saved ?? 0,
          skipped: data.stats?.skipped ?? 0,
          nextSuggestedOffset: data.stats?.nextSuggestedOffset,
          roundsDone: data.stats?.roundsDone,
        });
        // 次回のオフセットを提案値に自動更新（ユーザーが変更可能）
        if (data.stats?.nextSuggestedOffset != null) {
          setApiOffset(data.stats.nextSuggestedOffset);
        }
        fetchStats();
        fetchWorkList(workListFilter);
      } else {
        const errorMsg = data.error || 'インポート失敗';
        console.error('[ImportWorkflow] API error:', errorMsg, data);
        alert(`インポート失敗: ${errorMsg}`);
      }
    } catch (error) {
      console.error('[ImportWorkflow] API import failed:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(`インポート中にエラーが発生しました: ${errorMsg}`);
    } finally {
      setApiLoading(false);
    }
  };

  // 選択した作品のコメント取得
  const handleFetchSelectedComments = async () => {
    if (!adminToken) {
      alert('管理トークンを入力してください');
      return;
    }
    if (selectedWorkIds.size === 0) {
      alert('作品を選択してください');
      return;
    }
    
    // 既にコメントがある作品をチェック
    const selectedWorks = workList.filter(w => selectedWorkIds.has(w.workId));
    const withComment = selectedWorks.filter(w => w.commentText);
    if (withComment.length > 0) {
      if (!confirm(`${withComment.length}件の作品は既にコメントがあります。上書きしますか？`)) {
        return;
      }
    }
    
    setCommentLoading(true);
    setCommentResult(null);
    try {
      const res = await fetch('/api/admin/tags/fetch-comments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({ workIds: Array.from(selectedWorkIds) }),
      });
      const data = await res.json();
      if (data.success) {
        setCommentResult({ success: data.fetched, failed: data.failed });
        fetchStats();
        fetchWorkList(workListFilter);
        setSelectedWorkIds(new Set());
      } else {
        alert(data.error || 'コメント取得失敗');
      }
    } catch (error) {
      console.error('Comment fetch failed:', error);
      alert('コメント取得中にエラーが発生しました');
    } finally {
      setCommentLoading(false);
    }
  };

  // 選択した作品のAI分析（プレビューのみ・保存しない）
  const handleAnalyzeSelected = async () => {
    if (selectedWorkIds.size === 0) {
      alert('作品を選択してください');
      return;
    }
    const selectedWorks = workList.filter(w => selectedWorkIds.has(w.workId));
    const withoutComment = selectedWorks.filter(w => !w.commentText);
    if (withoutComment.length > 0) {
      alert(`${withoutComment.length}件の作品はコメントがありません。先にコメントを取得してください。`);
      return;
    }
    setAnalyzeLoading(true);
    setAnalyzeResult([]);
    try {
      const res = await fetch('/api/admin/reanalyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workIds: Array.from(selectedWorkIds), save: false }),
      });
      const data = await res.json();
      if (data.results) {
        const tagsFromResult = (r: any) => {
          if (r.additionalSTags !== undefined) {
            const addS = (r.additionalSTags || []).map((d: string) => ({ displayName: d, source: 'additionalS' as const, rank: '' }));
            const a = (r.aTags || []).map((d: string) => ({ displayName: d, source: 'matched' as const, rank: 'A' as const }));
            const b = (r.bTags || []).map((d: string) => ({ displayName: d, source: 'matched' as const, rank: 'B' as const }));
            const c = (r.cTags || []).map((d: string) => ({ displayName: d, source: 'matched' as const, rank: 'C' as const }));
            return [...addS, ...a, ...b, ...c];
          }
          return (r.derivedTags || []).map((t: any) => ({
            displayName: t.displayName,
            source: t.source || 'suggested',
            rank: t.rank || '',
          }));
        };
        setAnalyzeResult(data.results.map((r: any) => ({
          workId: r.workId,
          title: r.title,
          tags: tagsFromResult(r).map((t: any) => ({
            name: t.displayName,
            source: t.source || 'suggested',
            rank: t.rank || '',
          })),
          elapsed: r.elapsed,
        })));
        const preview: Record<string, { derivedTags: Array<{ displayName: string; source?: string; rank?: string }>; characterTags?: string[]; needsReview?: boolean }> = {};
        data.results.forEach((r: any) => {
          preview[r.workId] = {
            derivedTags: tagsFromResult(r).map((t: any) => ({
              displayName: t.displayName,
              source: t.source,
              rank: t.rank,
            })),
            characterTags: r.characterTags,
            needsReview: r.needsReview === true,
          };
        });
        setAnalysisPreview(preview);
        fetchWorkList(workListFilter);
        setSelectedWorkIds(new Set());
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('AI分析中にエラーが発生しました');
    } finally {
      setAnalyzeLoading(false);
    }
  };

  // AI分析プレビューを承認してDBに保存
  const handleApproveAnalysisPreview = async () => {
    const entries = Object.entries(analysisPreview);
    if (entries.length === 0) return;
    if (!confirm(`${entries.length}件の作品のAI分析結果を保存しますか？`)) return;
    setAnalyzeApproveLoading(true);
    try {
      const results = entries.map(([workId, v]) => ({
        workId,
        derivedTags: v.derivedTags.map(t => ({
          displayName: t.displayName,
          confidence: 0.9,
          category: null,
          source: t.source || 'suggested',
          rank: t.rank,
        })),
        characterTags: v.characterTags || [],
        needsReview: v.needsReview,
      }));
      const res = await fetch('/api/admin/reanalyze/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      });
      const data = await res.json();
      if (data.success) {
        setAnalysisPreview({});
        setAnalyzeResult([]);
        fetchStats();
        fetchWorkList(workListFilter, currentPage);
        alert(`✅ ${data.stats?.saved ?? entries.length}件を保存しました`);
      } else {
        alert(data.error || '保存に失敗しました');
      }
    } catch (error) {
      console.error('Approve failed:', error);
      alert('保存中にエラーが発生しました');
    } finally {
      setAnalyzeApproveLoading(false);
    }
  };

  // 全選択/全解除
  const handleSelectAll = () => {
    setSelectedWorkIds(new Set(workList.map(w => w.workId)));
  };
  
  const handleDeselectAll = () => {
    setSelectedWorkIds(new Set());
  };

  // 一括: API取得 → コメント取得（AI分析は含まない）
  const handleApiThenCommentBulk = async () => {
    if (!adminToken) {
      alert('管理トークンを入力してください');
      return;
    }
    if (apiCommentBulkRunning) return;
    setApiCommentBulkRunning(true);
    setApiCommentBulkLog([`🚀 API → コメント取得 一括開始（API ${apiBulkRounds}ラウンド、コメント最大${commentBulkLimit}件）`]);
    try {
      setApiCommentBulkLog(prev => [...prev, '📡 API取得中...']);
      const apiRes = await fetch('/api/admin/dmm/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({
          target: 100,
          sort: apiSort,
          offset: apiOffset,
          rounds: Math.max(1, Math.min(20, apiBulkRounds)),
          ...(apiYearFilter && {
            gte_date: `${apiYearFilter}-01-01`,
            lte_date: `${apiYearFilter}-12-31`,
          }),
        }),
      });
      const apiData = await apiRes.json();
      if (!apiData.success) {
        setApiCommentBulkLog(prev => [...prev, `❌ API失敗: ${apiData.error || 'Unknown'}`]);
        return;
      }
      const saved = apiData.stats?.saved ?? 0;
      setApiCommentBulkLog(prev => [...prev, `✅ API完了: ${saved}件追加、次オフセット=${apiData.stats?.nextSuggestedOffset ?? '-'}`]);
      if (apiData.stats?.nextSuggestedOffset != null) setApiOffset(apiData.stats.nextSuggestedOffset);
      fetchStats();
      await new Promise(r => setTimeout(r, 1500));

      setApiCommentBulkLog(prev => [...prev, '📝 コメント取得中...']);
      const commentRes = await fetch('/api/admin/tags/fetch-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({ limit: Math.min(500, commentBulkLimit) }),
      });
      const commentData = await commentRes.json();
      const fetched = commentData.fetched ?? commentData.stats?.success ?? 0;
      setApiCommentBulkLog(prev => [...prev, `✅ コメント取得完了: ${fetched}件`]);
      fetchStats();
      fetchWorkList(workListFilter);
      setApiCommentBulkLog(prev => [...prev, '🎉 一括完了']);
    } catch (e) {
      setApiCommentBulkLog(prev => [...prev, `❌ エラー: ${e}`]);
    } finally {
      setApiCommentBulkRunning(false);
    }
  };

  // 一括処理（コメント未取得→コメント取得、タグ未抽出→AI分析）
  const handleBatchRun = async () => {
    if (!adminToken) {
      alert('管理トークンを入力してください');
      return;
    }
    if (batchRunning) return;
    
    setBatchRunning(true);
    setBatchLog([`🚀 一括処理開始 (最大${batchCount}件)`]);
    
    try {
      // Step 1: コメント取得（コメント未取得の作品）
      setBatchLog(prev => [...prev, '📝 コメント取得中...']);
      const commentRes = await fetch('/api/admin/tags/fetch-comments', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({ limit: batchCount }),
      });
      const commentData = await commentRes.json();
      setBatchLog(prev => [...prev, `✅ コメント取得完了 (${commentData.fetched || 0}件)`]);
      
      // 少し待機（API制限対策）
      await new Promise(r => setTimeout(r, 2000));
      
      // Step 2: AI分析（タグ未抽出の作品）
      setBatchLog(prev => [...prev, '🤖 AI分析中...']);
      // タグ未抽出の作品を取得
      const listRes = await fetch(`/api/admin/reanalyze?mode=no_derived&limit=${batchCount}&offset=0`, {
        headers: { 'x-eronator-admin-token': adminToken },
      });
      const listData = await listRes.json();
      if (listData.works && listData.works.length > 0) {
        const workIds = listData.works.map((w: any) => w.id);
        const analyzeRes = await fetch('/api/admin/reanalyze', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-eronator-admin-token': adminToken,
          },
          body: JSON.stringify({ workIds }),
        });
        const analyzeData = await analyzeRes.json();
        setBatchLog(prev => [...prev, `✅ AI分析完了 (${analyzeData.results?.length || 0}件)`]);
      } else {
        setBatchLog(prev => [...prev, '✅ AI分析対象なし']);
      }
      
      setBatchLog(prev => [...prev, '🎉 一括処理完了！']);

      fetchStats();
      fetchWorkList(workListFilter);
    } catch (error) {
      setBatchLog(prev => [...prev, `❌ エラー: ${error}`]);
    } finally {
      setBatchRunning(false);
    }
  };

  // 一括: コメント取得 + Phase0+1+2（100〜1000件、100刻み）
  const handleBulkCommentPhase012 = async () => {
    if (!adminToken) {
      alert('管理トークンを入力してください');
      return;
    }
    if (bulkCommentPhase012Running) return;
    setBulkCommentPhase012Running(true);
    const count = bulkCommentPhase012Count;
    try {
      const res = await fetch('/api/admin/bulk-comment-phase012', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({ count }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || res.statusText || 'Request failed');
      }
      if (!res.body) throw new Error('No response body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let startTime: number | undefined;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line) as { type?: string; phase?: string; done?: number; total?: number; round?: number; roundTotal?: number; error?: string };
            if (obj.type === 'progress') {
              if (startTime == null) startTime = Date.now();
              setProgress('phase012', {
                done: obj.done ?? 0,
                total: obj.total ?? count,
                phase: obj.phase,
                round: obj.round,
                roundTotal: obj.roundTotal,
                startTime,
              });
            } else if (obj.type === 'done') {
              setProgress('phase012', null);
              fetchStats();
              fetchWorkList(workListFilter);
            } else if (obj.type === 'error') {
              setProgress('phase012', null);
              alert(obj.error || 'エラーが発生しました');
            }
          } catch {
            // skip parse error
          }
        }
      }
      if (buffer.trim()) {
        try {
          const obj = JSON.parse(buffer) as { type?: string; error?: string };
          if (obj.type === 'done') {
            setProgress('phase012', null);
            fetchStats();
            fetchWorkList(workListFilter);
          } else if (obj.type === 'error') {
            setProgress('phase012', null);
            alert(obj.error || 'エラーが発生しました');
          }
        } catch {
          // skip
        }
      }
    } catch (e) {
      setProgress('phase012', null);
      alert(e instanceof Error ? e.message : '一括実行に失敗しました');
    } finally {
      setBulkCommentPhase012Running(false);
    }
  };

  // 要注意フラグを更新
  const handleToggleNeedsReview = async (workId: string, currentValue: boolean) => {
    try {
      const res = await fetch('/api/admin/works/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setNeedsReview',
          workId,
          needsReview: !currentValue
        }),
      });
      if (res.ok) {
        setWorkList(prev => prev.map(w => 
          w.workId === workId ? { ...w, needsReview: !currentValue } : w
        ));
      }
    } catch (error) {
      console.error('Failed to update needsReview:', error);
    }
  };

  // タグ候補を検索
  const searchTagSuggestions = async (query: string) => {
    if (!adminToken) return;
    if (query.length < 1) {
      setAddTagSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/works/update?q=${encodeURIComponent(query)}`, {
        headers: { 'x-eronator-admin-token': adminToken },
      });
      const data = await res.json();
      setAddTagSuggestions(data.tags || []);
    } catch (error) {
      console.error('Failed to search tags:', error);
    }
  };

  // タグを追加
  const handleAddTag = async (workId: string, tagName: string) => {
    if (!adminToken) {
      alert('管理トークンを入力してください');
      return;
    }
    if (!tagName.trim()) return;
    
    setAddTagLoading(true);
    try {
      const res = await fetch('/api/admin/works/update', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({
          action: 'addTag',
          workId,
          tagName: tagName.trim()
        }),
      });
      const data = await res.json();
      if (data.success) {
        const scrollY = window.scrollY;
        await fetchWorkList(workListFilter, currentPage);
        requestAnimationFrame(() => { window.scrollTo(0, scrollY); });
        setAddTagModal(null);
        setAddTagInput('');
        setAddTagSuggestions([]);
      } else {
        alert(data.error || 'タグの追加に失敗しました');
      }
    } catch (error) {
      console.error('Failed to add tag:', error);
      alert('タグの追加に失敗しました');
    } finally {
      setAddTagLoading(false);
    }
  };

  // タグを削除（スクロール位置を維持）
  const handleRemoveTag = async (workId: string, tagKey: string, tagName: string) => {
    if (!adminToken) {
      alert('管理トークンを入力してください');
      return;
    }
    if (!confirm(`タグ「${tagName}」を削除しますか？`)) return;
    
    const scrollY = window.scrollY;
    try {
      const res = await fetch('/api/admin/works/update', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({
          action: 'removeTag',
          workId,
          tagKey
        }),
      });
      if (res.ok) {
        await fetchWorkList(workListFilter, currentPage);
        requestAnimationFrame(() => { window.scrollTo(0, scrollY); });
      }
    } catch (error) {
      console.error('Failed to remove tag:', error);
    }
  };

  return (
    <div>
      <h2 style={{ fontSize: '1.1rem', marginBottom: '10px' }}>📥 作品インポート & タグ取得</h2>

      {/* 統計表示（コンパクト） */}
      <div style={{
        display: 'flex',
        gap: '16px',
        marginBottom: '12px',
        padding: '8px 12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '6px',
        fontSize: '13px',
      }}>
        {statsLoading ? (
          <span>読み込み中...</span>
        ) : stats ? (
          <>
            <span><strong>{stats.totalWorks}</strong>件 総作品</span>
            <span style={{ color: '#28a745' }}><strong>{stats.withComment}</strong> コメント済</span>
            <span style={{ color: '#dc3545' }}><strong>{stats.withoutComment}</strong> 未取得</span>
          </>
        ) : null}
      </div>

      {/* 一括（非表示・コード残す） */}
      <div style={{ display: 'none', marginBottom: '15px', border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setBulkSectionOpen(!bulkSectionOpen)}
          style={{
            width: '100%',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f0f0f0',
            border: 'none',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 'bold',
          }}
        >
          <span>📡 一括（API→コメント / コメント→AI分析）</span>
          <span>{bulkSectionOpen ? '▼ 閉じる' : '▶ 開く'}</span>
        </button>
        {bulkSectionOpen && (
          <div style={{ padding: '15px', backgroundColor: '#fff', borderTop: '1px solid #ccc' }}>
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e8f5e9', borderRadius: '8px', border: '1px solid #a5d6a7' }}>
              <h4 style={{ marginTop: 0 }}>API取得 → コメント取得</h4>
              <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
                APIで作品を追加してから、コメント未取得の作品のコメントを取得します（AI分析は含みません）
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                <span>API 連続ラウンド:</span>
                <input
                  type="number"
                  value={apiBulkRounds}
                  onChange={e => setApiBulkRounds(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                  style={{ width: '60px', padding: '8px' }}
                  min={1}
                  max={20}
                />
                <span style={{ fontSize: '13px' }}>（1ラウンド＝最大100件）</span>
                <span style={{ marginLeft: '8px' }}>コメント取得 最大:</span>
                <input
                  type="number"
                  value={commentBulkLimit}
                  onChange={e => setCommentBulkLimit(Math.max(10, Math.min(500, parseInt(e.target.value) || 100)))}
                  style={{ width: '70px', padding: '8px' }}
                  min={10}
                  max={500}
                />
                <span>件</span>
                <button
                  onClick={handleApiThenCommentBulk}
                  disabled={apiCommentBulkRunning}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: apiCommentBulkRunning ? '#ccc' : '#2e7d32',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: apiCommentBulkRunning ? 'not-allowed' : 'pointer',
                  }}
                >
                  {apiCommentBulkRunning ? '実行中...' : '🚀 API→コメント 一括実行'}
                </button>
              </div>
              {apiCommentBulkLog.length > 0 && (
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f1f8e9', borderRadius: '4px', fontSize: '13px', maxHeight: '120px', overflowY: 'auto' }}>
                  {apiCommentBulkLog.map((log, i) => (<div key={i}>{log}</div>))}
                </div>
              )}
            </div>
            <div style={{ padding: '15px', backgroundColor: '#e7f3ff', borderRadius: '8px', border: '1px solid #b8daff' }}>
              <h4 style={{ marginTop: 0 }}>コメント取得 → AI分析</h4>
              <p style={{ fontSize: '13px', color: '#666', marginBottom: '10px' }}>
                コメント未取得・タグ未抽出の作品に対して、コメント取得のあとAI分析を実行します
              </p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="number"
                  value={batchCount}
                  onChange={e => setBatchCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 10)))}
                  style={{ width: '80px', padding: '8px' }}
                  min={1}
                  max={500}
                />
                <span>件</span>
                <button
                  onClick={handleBatchRun}
                  disabled={batchRunning}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: batchRunning ? '#ccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: batchRunning ? 'not-allowed' : 'pointer',
                  }}
                >
                  {batchRunning ? '実行中...' : '🚀 一括実行'}
                </button>
              </div>
              {batchLog.length > 0 && (
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '13px', maxHeight: '150px', overflowY: 'auto' }}>
                  {batchLog.map((log, i) => (<div key={i}>{log}</div>))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ChatGPT連携（非表示・コード残す） */}
      <div style={{ display: 'none', marginBottom: '15px', border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setChatgptSectionOpen(!chatgptSectionOpen)}
          style={{
            width: '100%',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#f5f5f5',
            border: 'none',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 'bold',
          }}
        >
          <span>🤖 ChatGPT連携</span>
          <span>{chatgptSectionOpen ? '▼ 閉じる' : '▶ 開く'}</span>
        </button>
        {chatgptSectionOpen && (
          <div style={{ padding: '15px', backgroundColor: '#f8f9fa', borderTop: '1px solid #ccc' }}>
            {/* エクスポート */}
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>📤 エクスポート（選択した作品をAI向けに出力）</h4>
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                選択した作品をプロンプト+作品データ+有名タグリストを1ファイルに統合してエクスポートします
              </p>
              <button
                onClick={async () => {
                  if (selectedWorkIds.size === 0) {
                    alert('作品を選択してください');
                    return;
                  }
                  const selectedWorks = workList.filter(w => selectedWorkIds.has(w.workId));
                  const withoutComment = selectedWorks.filter(w => !w.commentText);
                  if (withoutComment.length > 0) {
                    alert(`${withoutComment.length}件の作品はコメントがありません。先にコメントを取得してください。`);
                    return;
                  }
                  if (!adminToken) {
                    alert('管理トークンを入力してください');
                    return;
                  }
                  setExportLoading(true);
                  try {
                    const res = await fetch('/api/admin/export-for-chatgpt', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
                      body: JSON.stringify({ workIds: Array.from(selectedWorkIds) }),
                    });
                    if (!res.ok) {
                      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
                      throw new Error(error.error || 'Export failed');
                    }
                    const blob = await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `eronator-tags-output-${selectedWorkIds.size}works-${Date.now()}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                    alert(`✅ エクスポート完了: ${selectedWorkIds.size}件`);
                  } catch (error) {
                    console.error('Export error:', error);
                    alert(`エクスポート失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  } finally {
                    setExportLoading(false);
                  }
                }}
                disabled={exportLoading || selectedWorkIds.size === 0}
                style={{
                  padding: '8px 16px',
                  backgroundColor: exportLoading || selectedWorkIds.size === 0 ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: exportLoading || selectedWorkIds.size === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                {exportLoading ? 'エクスポート中...' : `選択した${selectedWorkIds.size}件をエクスポート`}
              </button>
            </div>
            {/* インポート */}
            <div style={{ padding: '15px', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #ddd' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>📥 インポート（ChatGPTからの結果を取り込み）</h4>
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
                ChatGPTから返ってきたJSONファイルをアップロードして、プレビュー確認後に一括承認します
              </p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setImportFile(file || null);
                    setImportPreview(null);
                  }}
                  style={{ padding: '5px' }}
                />
                <button
                  onClick={async () => {
                    if (!importFile) { alert('ファイルを選択してください'); return; }
                    if (!adminToken) { alert('管理トークンを入力してください'); return; }
                    setImportLoading(true);
                    try {
                      const formData = new FormData();
                      formData.append('file', importFile);
                      const res = await fetch('/api/admin/import-from-chatgpt/preview', {
                        method: 'POST',
                        headers: { 'x-eronator-admin-token': adminToken },
                        body: formData,
                      });
                      const data = await res.json();
                      if (data.success) {
                        setImportPreview(data.preview);
                        setRejectedPreviewKeys(new Set());
                      } else {
                        alert(`プレビューエラー: ${data.error}`);
                      }
                    } catch (error) {
                      console.error('Preview error:', error);
                      alert(`プレビュー失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    } finally {
                      setImportLoading(false);
                    }
                  }}
                  disabled={importLoading || !importFile}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: importLoading || !importFile ? '#ccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: importLoading || !importFile ? 'not-allowed' : 'pointer',
                  }}
                >
                  {importLoading ? 'プレビュー中...' : 'プレビュー'}
                </button>
              </div>
              {importPreview && (
                <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#e7f1ff', borderRadius: '4px', border: '2px solid #0d6efd' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div>
                      <h5 style={{ margin: '0 0 5px 0' }}>📊 プレビュー状態（未承認）</h5>
                      <div style={{ fontSize: '12px' }}>
                        <div>総作品数: {importPreview.stats.total}件</div>
                        <div>タイトル不一致: <span style={{ color: '#dc3545', fontWeight: 'bold' }}>{importPreview.stats.titleMismatches}件</span></div>
                        <div>新規matchedTags: {importPreview.stats.newMatchedTags}件</div>
                        <div>新規suggestedTags: {importPreview.stats.newSuggestedTags}件</div>
                        <div>変更あり作品: <span style={{ fontWeight: 'bold' }}>{importPreview.stats.worksWithChanges}件</span></div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <button
                        onClick={() => { setImportPreview(null); setImportFile(null); }}
                        style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={async () => {
                          if (!importFile || !importPreview) return;
                          if (!confirm(`${importPreview.stats.worksWithChanges}件の作品に変更を適用しますか？`)) return;
                          if (!adminToken) { alert('管理トークンを入力してください'); return; }
                          setApproveLoading(true);
                          try {
                            const fileContent = await importFile.text();
                            const parsed = JSON.parse(fileContent);
                            const rawWorks = parsed.works && Array.isArray(parsed.works) ? parsed.works : parsed;
                            const importData = rawWorks.map((w: { workId: string; title?: string; matchedTags?: Array<{ displayName: string; category?: string }>; suggestedTags?: Array<{ displayName: string; category?: string }>; characterName?: string | null }) => ({
                              workId: w.workId,
                              title: w.title,
                              matchedTags: (w.matchedTags || []).filter((t) => !rejectedPreviewKeys.has(`${w.workId}_matched_${t.displayName}`)),
                              suggestedTags: (w.suggestedTags || []).filter((t) => !rejectedPreviewKeys.has(`${w.workId}_suggested_${t.displayName}`)),
                              characterName: rejectedPreviewKeys.has(`${w.workId}_character`) ? null : (w.characterName ?? null),
                            }));
                            const res = await fetch('/api/admin/import-from-chatgpt/approve', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
                              body: JSON.stringify({ importData }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              alert(`✅ インポート完了: ${data.stats.success}件成功, ${data.stats.newTags}件の新規タグ`);
                              setImportFile(null);
                              setImportPreview(null);
                              setRejectedPreviewKeys(new Set());
                              const scrollY = window.scrollY;
                              fetchStats();
                              await fetchWorkList(workListFilter, currentPage);
                              requestAnimationFrame(() => { window.scrollTo(0, scrollY); });
                            } else {
                              alert(`インポートエラー: ${data.error}`);
                            }
                          } catch (error) {
                            console.error('Approve error:', error);
                            alert(`インポート失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
                          } finally {
                            setApproveLoading(false);
                          }
                        }}
                        disabled={approveLoading || !importPreview || importPreview.stats.worksWithChanges === 0}
                        style={{
                          padding: '10px 20px',
                          backgroundColor: approveLoading || !importPreview || importPreview.stats.worksWithChanges === 0 ? '#ccc' : '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: approveLoading || !importPreview || importPreview.stats.worksWithChanges === 0 ? 'not-allowed' : 'pointer',
                          fontSize: '14px',
                          fontWeight: 'bold',
                        }}
                      >
                        {approveLoading ? 'インポート中...' : '一括承認してインポート'}
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#666', marginTop: '10px', padding: '8px', backgroundColor: '#fff', borderRadius: '4px' }}>
                    💡 作品リスト上で🔍マークが付いたタグがプレビュー状態です。×で「ナシ」にすると一括承認時に取り込まれません。
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ① APIインポート（常時表示） */}
      <div style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', marginBottom: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>DMM APIから作品をインポート</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', fontSize: '13px' }}>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span>ソート:</span>
              <select
                value={apiSort}
                onChange={e => setApiSort(e.target.value as 'rank' | 'review' | 'date')}
                style={{ padding: '6px 8px', minWidth: '100px', fontSize: '13px' }}
              >
                <option value="rank">人気順</option>
                <option value="review">レビュー順</option>
                <option value="date">発売日順</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span>offset:</span>
              <input
                type="number"
                value={apiOffset}
                onChange={e => setApiOffset(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ width: '80px', padding: '6px', fontSize: '13px' }}
                min={1}
              />
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <span>ラウンド:</span>
              <input
                type="number"
                value={apiRounds}
                onChange={e => setApiRounds(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                style={{ width: '50px', padding: '6px', fontSize: '13px' }}
                min={1}
                max={20}
              />
              <span style={{ color: '#666', fontSize: '12px' }}>×100件</span>
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>発売年:</span>
              <select
                value={apiYearFilter}
                onChange={e => setApiYearFilter(e.target.value)}
                style={{ padding: '6px 8px', minWidth: '120px', fontSize: '13px' }}
                title="指定した年の作品のみ取得。全期間=制限なし"
              >
                <option value="">全期間</option>
                {(() => {
                  const currentYear = new Date().getFullYear();
                  return Array.from({ length: 11 }, (_, i) => currentYear - i).map(y => (
                    <option key={y} value={String(y)}>{y}年</option>
                  ));
                })()}
              </select>
            </div>
            <button
              onClick={handleApiImport}
              disabled={apiLoading}
              style={{
                padding: '6px 14px',
                backgroundColor: apiLoading ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: apiLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {apiLoading ? '取得中...' : 'インポート'}
            </button>
          </div>
          {apiResult && (
            <div style={{ padding: '6px 10px', backgroundColor: '#d4edda', borderRadius: '4px', marginTop: '8px', fontSize: '12px' }}>
              ✅ {apiResult.imported}件追加, {apiResult.skipped}件スキップ
              {apiResult.nextSuggestedOffset != null && (
                <span style={{ marginLeft: '8px', color: '#155724' }}>→ 次: offset {apiResult.nextSuggestedOffset}</span>
              )}
            </div>
          )}
        </div>

      {/* ② コメント取得（常時表示） */}
      <div style={{ padding: '10px 12px', border: '1px solid #ddd', borderRadius: '6px', marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>作品コメントを取得</div>
        <p style={{ color: '#666', fontSize: '13px', marginBottom: '8px' }}>
          作品リストから選択してコメントを取得
        </p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 'bold', fontSize: '13px' }}>選択中: {selectedWorkIds.size}件</span>
          <button
            onClick={handleFetchSelectedComments}
            disabled={commentLoading || selectedWorkIds.size === 0}
            style={{
              padding: '6px 14px',
              backgroundColor: commentLoading || selectedWorkIds.size === 0 ? '#ccc' : '#17a2b8',
                color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: commentLoading || selectedWorkIds.size === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {commentLoading ? '取得中...' : 'コメント取得'}
          </button>
          <span style={{ marginLeft: '8px', color: '#666', fontSize: '13px' }}>|</span>
          <select
            value={bulkCommentPhase012Count}
            onChange={(e) => setBulkCommentPhase012Count(Number(e.target.value))}
            disabled={bulkCommentPhase012Running}
            style={{ padding: '6px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc' }}
          >
            {[100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((n) => (
              <option key={n} value={n}>{n}件</option>
            ))}
          </select>
          <button
            onClick={handleBulkCommentPhase012}
            disabled={bulkCommentPhase012Running || !adminToken}
            style={{
              padding: '6px 14px',
              backgroundColor: bulkCommentPhase012Running || !adminToken ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: bulkCommentPhase012Running || !adminToken ? 'not-allowed' : 'pointer',
            }}
          >
            {bulkCommentPhase012Running ? '実行中...' : '一括（コメント+Phase0+1+2）'}
          </button>
        </div>
        {commentResult && (
          <div style={{ padding: '6px 10px', backgroundColor: '#d4edda', borderRadius: '4px', marginTop: '8px', fontSize: '12px' }}>
            ✅ {commentResult.success}件成功, {commentResult.failed}件失敗
          </div>
        )}
      </div>

      {/* AI分析（非表示・コード残す） */}
      {false && activeStep === 'analyze' && (
        <div style={{ padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            AI分析（準有名タグ抽出）
            {aiProvider && aiProvider !== 'none' && (
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 'normal',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: aiProvider === 'cloudflare' ? '#e7f3ff' : aiProvider === 'groq' ? '#e8f5e9' : '#f3e5f5',
                  color: aiProvider === 'cloudflare' ? '#0d6efd' : aiProvider === 'groq' ? '#2e7d32' : '#6f42c1',
                  border: `1px solid ${aiProvider === 'cloudflare' ? '#b8daff' : aiProvider === 'groq' ? '#a5d6a7' : '#e1bee7'}`,
                }}
                title="現在のAIプロバイダ（.env.local の設定に依存）"
              >
                {aiProvider === 'cloudflare' ? '☁️ Cloudflare' : aiProvider === 'groq' ? '⚡ Groq' : aiProvider === 'huggingface' ? '🤗 Hugging Face' : aiProvider}
              </span>
            )}
          </h3>
          <p style={{ color: '#666', fontSize: '14px' }}>
            下の作品リストから選択して、コメントからAIでタグを抽出します。結果はプレビュー表示され、確認後に「承認して保存」でDBに反映されます。
          </p>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold' }}>選択中: {selectedWorkIds.size}件</span>
            <button
              onClick={handleAnalyzeSelected}
              disabled={analyzeLoading || selectedWorkIds.size === 0}
              style={{
                padding: '8px 16px',
                backgroundColor: analyzeLoading || selectedWorkIds.size === 0 ? '#ccc' : '#6f42c1',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: analyzeLoading || selectedWorkIds.size === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {analyzeLoading ? '分析中...' : '選択した作品をAI分析'}
            </button>
            <button
              type="button"
              onClick={async () => {
                setAiPromptModal(prev => ({ ...prev, open: true, loading: true, data: null }));
                try {
                  const res = await fetch('/api/admin/ai-prompt-preview');
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || '取得失敗');
                  setAiPromptModal(prev => ({ ...prev, loading: false, data }));
                } catch (e) {
                  setAiPromptModal(prev => ({ ...prev, loading: false, data: null }));
                  alert(e instanceof Error ? e.message : 'AI指示の取得に失敗しました');
                }
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f0f0f0',
                color: '#333',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              AI指示を表示
            </button>
            {Object.keys(analysisPreview).length > 0 && (
              <>
                <button
                  onClick={handleApproveAnalysisPreview}
                  disabled={analyzeApproveLoading}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: analyzeApproveLoading ? '#ccc' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: analyzeApproveLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  {analyzeApproveLoading ? '保存中...' : '承認して保存'}
                </button>
                <button
                  onClick={() => { setAnalysisPreview({}); setAnalyzeResult([]); }}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  キャンセル
                </button>
                <span style={{ fontSize: '13px', color: '#666' }}>
                  🔍 {Object.keys(analysisPreview).length}件のプレビュー中
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 作品リスト（詳細表示） */}
      <div style={{ 
        marginTop: '12px',
        padding: '15px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #ddd'
      }}>
        {/* プレビュー状態の警告バナー */}
        {false && Object.keys(analysisPreview).length > 0 && (
          <div style={{ display: 'none' }}>
            AI分析プレビュー（非表示）
          </div>
        )}
        {false && (importPreview?.stats?.worksWithChanges ?? 0) > 0 && (
          <div style={{ display: 'none' }}>ChatGPTプレビュー（非表示）</div>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h3 style={{ margin: 0 }}>📋 作品リスト ({totalWorks}件中 {workList.length}件表示)</h3>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              <button onClick={handleSelectAll} style={{ padding: '5px 10px', fontSize: '12px', cursor: 'pointer' }}>
                全選択
              </button>
              <button onClick={handleDeselectAll} style={{ padding: '5px 10px', fontSize: '12px', cursor: 'pointer' }}>
                全解除
              </button>
              <span style={{ fontSize: '13px', color: '#666' }}>選択中: {selectedWorkIds.size}件</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '5px' }}>
            {(['all', 'noComment', 'noTags', 'needsReview'] as const).map(f => (
              <button
                key={f}
                onClick={() => setWorkListFilter(f)}
                style={{
                  padding: '8px 15px',
                  backgroundColor: workListFilter === f ? (f === 'needsReview' ? '#dc3545' : '#007bff') : '#e9ecef',
                  color: workListFilter === f ? 'white' : 'black',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                {f === 'all' ? '全て' : f === 'noComment' ? 'コメント未取得' : f === 'noTags' ? 'タグ未抽出' : '⚠️ 要注意'}
              </button>
            ))}
            <button
              onClick={() => { fetchStats(); fetchWorkList(workListFilter, currentPage); }}
              style={{
                padding: '8px 15px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              🔄 更新
            </button>
          </div>
        </div>
        
        {workListLoading ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>読み込み中...</div>
        ) : (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#e0e0e0' }}>
                  <th style={{ padding: '10px', textAlign: 'center', width: '50px' }}>選択</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>タイトル</th>
                  <th style={{ padding: '10px', textAlign: 'left', width: '400px' }}>
                    タグ
                    <div style={{ fontSize: '10px', fontWeight: 'normal', color: '#666', marginTop: '2px' }}>
                      <span style={{ backgroundColor: '#e8d5ff', padding: '1px 4px', borderRadius: '4px', marginRight: '4px' }}>S</span>
                      <span style={{ backgroundColor: '#d4edda', padding: '1px 4px', borderRadius: '4px', marginRight: '4px' }}>A</span>
                      <span style={{ backgroundColor: '#fff3cd', padding: '1px 4px', borderRadius: '4px', marginRight: '4px' }}>B</span>
                      <span style={{ backgroundColor: '#e9ecef', padding: '1px 4px', borderRadius: '4px', marginRight: '4px' }}>★未分類</span>
                      <span style={{ backgroundColor: '#cfe2ff', padding: '1px 4px', borderRadius: '4px' }}>X</span>
                    </div>
                  </th>
                  <th style={{ padding: '10px', textAlign: 'left', width: '350px' }}>コメント</th>
                  <th style={{ padding: '10px', textAlign: 'center', width: '40px' }} title="要注意フラグ">⚠️</th>
                </tr>
              </thead>
              <tbody>
                {workList.map(work => (
                  <tr 
                    key={work.workId} 
                    style={{ 
                      borderBottom: '1px solid #ddd',
                      backgroundColor: work.needsReview ? '#fff5f5' : selectedWorkIds.has(work.workId) ? '#e8f4ff' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedWorkIds.has(work.workId)}
                        onChange={() => {
                          setSelectedWorkIds(prev => {
                            const next = new Set(prev);
                            if (next.has(work.workId)) {
                              next.delete(work.workId);
                            } else {
                              next.add(work.workId);
                            }
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td style={{ padding: '10px' }}>
                      <strong>{work.title}</strong>
                      <div style={{ fontSize: '12px', color: '#666' }}>{work.authorName}</div>
                      <div style={{ fontSize: '11px', color: '#999' }}>{work.workId}</div>
                      {/* タイトル不一致の警告 */}
                      {importPreview && (() => {
                        const previewWork = importPreview.works.find(pw => pw.workId === work.workId);
                        if (previewWork && !previewWork.titleMatch) {
                          return (
                            <div style={{ fontSize: '10px', color: '#dc3545', fontWeight: 'bold', marginTop: '3px' }}>
                              ⚠️ タイトル不一致: {previewWork.chatgptTitle}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {/* 作品リスト・タグ欄: S / 追加S / A / B / C を色とラベルで統一 */}
                      {work.officialTags && work.officialTags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '4px' }}>
                          {work.officialTags.map((tag, i) => (
                            <span key={`o-${i}`} style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              backgroundColor: '#e8d5ff',
                              border: '1px solid #6f42c1',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              color: '#6f42c1'
                            }} title="S（有名タグ）">
                              <span style={{ fontWeight: 'bold', opacity: 0.9 }}>S</span>
                              {tag.displayName}
                            </span>
                          ))}
                        </div>
                      )}
                      {work.additionalSTags && work.additionalSTags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '4px' }}>
                          {work.additionalSTags.map((tag, i) => (
                            <span key={`as-${i}`} style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              backgroundColor: '#f3e5f5',
                              border: '1px solid #9c27b0',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              fontSize: '11px',
                              color: '#7b1fa2'
                            }} title="追加S（AI提案の有名タグ）">
                              <span style={{ fontWeight: 'bold', opacity: 0.9 }}>S</span>
                              {tag.displayName}
                            </span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
                        {/* AI分析プレビュー（未承認）※作品リストでS/A/B/C色分け・太線でプレビューと識別 */}
                        {analysisPreview[work.workId] && (
                          <>
                            {analysisPreview[work.workId].derivedTags.map((tag, i) => {
                              const isAdditionalS = (tag as { source?: string }).source === 'additionalS';
                              const rank = tag.rank || '';
                              const chip = isAdditionalS ? RANK_CHIP.AdditionalS : rank === 'A' ? RANK_CHIP.A : rank === 'B' ? RANK_CHIP.B : rank === 'C' ? RANK_CHIP.C : { bg: '#e9ecef', border: '#6c757d', text: '#495057' };
                              const bgColor = chip.bg;
                              const borderColor = chip.border;
                              const typeLabel = isAdditionalS ? 'S' : rank === 'A' ? 'A' : rank === 'B' ? 'B' : rank === 'C' ? 'C' : '';
                              return (
                                <span
                                  key={`ai-preview-${i}-${tag.displayName}`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    backgroundColor: bgColor,
                                    border: `3px solid ${borderColor}`,
                                    padding: '2px 6px',
                                    borderRadius: '10px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                  }}
                                  title={`プレビュー（未承認）${typeLabel ? ` ${typeLabel}` : ''}`}
                                >
                                  {typeLabel && <span style={{ opacity: 0.9 }}>{typeLabel}</span>}
                                  {tag.displayName}
                                </span>
                              );
                            })}
                            {analysisPreview[work.workId].characterTags && analysisPreview[work.workId].characterTags!.length > 0 && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  backgroundColor: RANK_CHIP.X.bg,
                                  border: `3px solid ${RANK_CHIP.X.border}`,
                                  padding: '2px 6px',
                                  borderRadius: '10px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  color: RANK_CHIP.X.text,
                                }}
                                title="AI分析プレビュー - キャラクター名"
                              >
                                🔍 {analysisPreview[work.workId].characterTags![0]}
                              </span>
                            )}
                            {analysisPreview[work.workId].needsReview && (
                              <span style={{ fontSize: '10px', color: '#dc3545', fontWeight: 'bold' }} title="要注意">⚠️要確認</span>
                            )}
                          </>
                        )}
                        {/* DERIVEDタグ（AIプレビューがないときのみ通常表示）※作品リストでA/B/C色分け・ラベル表示 */}
                        {!analysisPreview[work.workId] && work.derivedTags.map((tag, i) => {
                          const rank = tag.rank || '';
                          const isManual = tag.source === 'manual';
                          const chip = rank === 'A' ? RANK_CHIP.A : rank === 'B' ? RANK_CHIP.B : rank === 'C' ? RANK_CHIP.C : { bg: '#e9ecef', border: '#6c757d' };
                          const bgColor = chip.bg;
                          const borderColor = chip.border;
                          const rankLabel = rank === 'A' ? 'A' : rank === 'B' ? 'B' : rank === 'C' ? 'C' : '';
                          return (
                            <span 
                              key={`d-${i}`} 
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                backgroundColor: bgColor,
                                border: `1px solid ${borderColor}`,
                                padding: '2px 6px',
                                borderRadius: '10px',
                                fontSize: '11px'
                              }} 
                              title={`${rank ? `ランク: ${rank}` : '未分類'}${isManual ? ' (手動追加)' : ''}`}
                            >
                              {rankLabel && <span style={{ fontWeight: 'bold', opacity: 0.9 }}>{rankLabel}</span>}
                              {isManual && <span style={{ fontSize: '9px' }}>✎</span>}
                              {tag.displayName}
                              <button
                                onClick={() => handleRemoveTag(work.workId, tag.tagKey, tag.displayName)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: '0 2px',
                                  fontSize: '10px',
                                  color: '#999',
                                  lineHeight: 1
                                }}
                                title="削除"
                              >×</button>
                            </span>
                          );
                        })}
                        
                        {/* プレビュー状態のタグ（未承認）※ナシにしたものは表示しない */}
                        {importPreview && (() => {
                          const previewWork = importPreview.works.find(pw => pw.workId === work.workId);
                          if (!previewWork || !previewWork.hasChanges) return null;
                          const rejectKey = (kind: 'matched' | 'suggested' | 'character', displayName: string) =>
                            kind === 'character' ? `${work.workId}_character` : `${work.workId}_${kind}_${displayName}`;
                          const isRejected = (kind: 'matched' | 'suggested' | 'character', displayName: string) =>
                            rejectedPreviewKeys.has(rejectKey(kind, displayName));
                          const handleReject = (kind: 'matched' | 'suggested' | 'character', displayName: string) => {
                            setRejectedPreviewKeys(prev => new Set(prev).add(rejectKey(kind, displayName)));
                          };
                          return (
                            <>
                              {previewWork.matchedTags.filter(tag => !isRejected('matched', tag.displayName)).map((tag, i) => {
                                const bgColor = tag.isNew ? '#ffe0b2' : '#d4edda';
                                const borderColor = tag.isNew ? '#e65100' : '#28a745';
                                return (
                                  <span
                                    key={`preview-matched-${i}-${tag.displayName}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '2px',
                                      backgroundColor: bgColor,
                                      border: `3px solid ${borderColor}`,
                                      padding: '2px 6px',
                                      borderRadius: '10px',
                                      fontSize: '11px',
                                      fontWeight: 'bold'
                                    }}
                                    title={`プレビュー（未承認）${tag.isNew ? ' - 新規タグ（DBに未登録）' : ' - 既存タグ'}`}
                                  >
                                    🔍 {tag.displayName}
                                    <button
                                      type="button"
                                      onClick={(e) => { e.preventDefault(); handleReject('matched', tag.displayName); }}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontSize: '10px', color: '#999', marginLeft: '2px' }}
                                      title="ナシ（承認しない）"
                                    >×</button>
                                  </span>
                                );
                              })}
                              {previewWork.suggestedTags.filter(tag => !isRejected('suggested', tag.displayName)).map((tag, i) => {
                                const bgColor = tag.isNew ? '#ffe0b2' : '#e9ecef';
                                const borderColor = tag.isNew ? '#e65100' : '#6c757d';
                                return (
                                  <span
                                    key={`preview-suggested-${i}-${tag.displayName}`}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '2px',
                                      backgroundColor: bgColor,
                                      border: `3px solid ${borderColor}`,
                                      padding: '2px 6px',
                                      borderRadius: '10px',
                                      fontSize: '11px',
                                      fontWeight: 'bold'
                                    }}
                                    title={`プレビュー（未承認）${tag.isNew ? ' - 新規タグ（DBに未登録）' : ' - 既存タグ'}`}
                                  >
                                    🔍 {tag.displayName}
                                    <button
                                      type="button"
                                      onClick={(e) => { e.preventDefault(); handleReject('suggested', tag.displayName); }}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontSize: '10px', color: '#999', marginLeft: '2px' }}
                                      title="ナシ（承認しない）"
                                    >×</button>
                                  </span>
                                );
                              })}
                              {previewWork.characterName && !isRejected('character', '') && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    backgroundColor: '#cfe2ff',
                                    border: '3px solid #084298',
                                    padding: '2px 6px',
                                    borderRadius: '10px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    color: '#084298'
                                  }}
                                  title="プレビュー（未承認） - キャラクター名"
                                >
                                  🔍 {previewWork.characterName}
                                  <button
                                    type="button"
                                    onClick={(e) => { e.preventDefault(); handleReject('character', ''); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontSize: '10px', color: '#999', marginLeft: '2px' }}
                                    title="ナシ（承認しない）"
                                  >×</button>
                                </span>
                              )}
                            </>
                          );
                        })()}
                        
                        {/* STRUCTURALタグ（Xタグ、キャラ名） */}
                        {work.structuralTags && work.structuralTags.map((tag, i) => (
                          <span key={`x-${i}`} style={{
                            display: 'inline-block',
                            backgroundColor: '#cfe2ff',
                            border: '1px solid #084298',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            fontSize: '11px',
                            color: '#084298'
                          }} title="キャラクター名">
                            {tag.displayName}
                          </span>
                        ))}
                        {/* タグ追加ボタン */}
                        <button
                          onClick={() => setAddTagModal({ workId: work.workId, title: work.title })}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '22px',
                            height: '22px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            lineHeight: 1
                          }}
                          title="タグを手動追加"
                        >+</button>
                      </div>
                      
                      {/* タグが一切ない場合（OFFICIALもDERIVEDもない場合） */}
                      {(!work.officialTags || work.officialTags.length === 0) && (!work.additionalSTags || work.additionalSTags.length === 0) && work.derivedTags.length === 0 && !work.structuralTags?.length && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#999', fontSize: '12px' }}>
                            {work.commentText ? 'タグなし' : 'コメント未取得'}
                          </span>
                          <button
                            onClick={() => setAddTagModal({ workId: work.workId, title: work.title })}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '22px',
                              height: '22px',
                              backgroundColor: '#007bff',
                              color: 'white',
                              border: 'none',
                              borderRadius: '50%',
                              cursor: 'pointer',
                              fontSize: '14px',
                              fontWeight: 'bold',
                              lineHeight: 1
                            }}
                            title="タグを手動追加"
                          >+</button>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px', fontSize: '12px', color: '#666' }}>
                      {work.commentText ? (
                        <div>
                          <div style={{ 
                            maxHeight: expandedComments.has(work.workId) ? 'none' : '60px',
                            overflow: 'hidden',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                          }}>
                            {work.commentText}
                          </div>
                          {work.commentText.length > 100 && (
                            <button
                              onClick={() => {
                                setExpandedComments(prev => {
                                  const next = new Set(prev);
                                  if (next.has(work.workId)) {
                                    next.delete(work.workId);
                                  } else {
                                    next.add(work.workId);
                                  }
                                  return next;
                                });
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#0066cc',
                                cursor: 'pointer',
                                padding: '2px 0',
                                fontSize: '11px'
                              }}
                            >
                              {expandedComments.has(work.workId) ? '▲ 閉じる' : '▼ 全文表示'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#dc3545' }}>❌ 未取得</span>
                      )}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={work.needsReview}
                        onChange={() => handleToggleNeedsReview(work.workId, work.needsReview)}
                        title="要注意フラグ"
                        style={{ 
                          width: '18px', 
                          height: '18px',
                          accentColor: '#dc3545'
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {workList.length === 0 && (
              <div style={{ padding: '30px', textAlign: 'center', color: '#999' }}>
                該当する作品がありません
              </div>
            )}
            
            {/* ページネーション */}
            {totalWorks > PAGE_SIZE && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                gap: '10px', 
                marginTop: '20px',
                padding: '15px'
              }}>
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: currentPage === 1 ? '#e0e0e0' : '#007bff',
                    color: currentPage === 1 ? '#999' : 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ≪ 最初
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: currentPage === 1 ? '#e0e0e0' : '#007bff',
                    color: currentPage === 1 ? '#999' : 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ＜ 前へ
                </button>
                <span style={{ fontSize: '14px' }}>
                  {currentPage} / {Math.ceil(totalWorks / PAGE_SIZE)} ページ
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalWorks / PAGE_SIZE), p + 1))}
                  disabled={currentPage >= Math.ceil(totalWorks / PAGE_SIZE)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: currentPage >= Math.ceil(totalWorks / PAGE_SIZE) ? '#e0e0e0' : '#007bff',
                    color: currentPage >= Math.ceil(totalWorks / PAGE_SIZE) ? '#999' : 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentPage >= Math.ceil(totalWorks / PAGE_SIZE) ? 'not-allowed' : 'pointer',
                  }}
                >
                  次へ ＞
                </button>
                <button
                  onClick={() => setCurrentPage(Math.ceil(totalWorks / PAGE_SIZE))}
                  disabled={currentPage >= Math.ceil(totalWorks / PAGE_SIZE)}
                  style={{
                    padding: '8px 12px',
                    backgroundColor: currentPage >= Math.ceil(totalWorks / PAGE_SIZE) ? '#e0e0e0' : '#007bff',
                    color: currentPage >= Math.ceil(totalWorks / PAGE_SIZE) ? '#999' : 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentPage >= Math.ceil(totalWorks / PAGE_SIZE) ? 'not-allowed' : 'pointer',
                  }}
                >
                  最後 ≫
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ファイルインポート（非表示・コード残す） */}
      <div style={{ display: 'none', marginTop: '30px' }}>
        <button
          onClick={() => setShowFileImport(!showFileImport)}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          {showFileImport ? '▼' : '▶'} ファイルから読み込む（緊急用）
        </button>
        {showFileImport && (
          <div style={{ 
            marginTop: '10px', 
            padding: '15px', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            border: '1px dashed #ccc'
          }}>
            <p style={{ color: '#666', fontSize: '13px' }}>
              JSONファイルから手動でインポートする場合に使用します
            </p>
            <input
              type="file"
              accept=".json"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </div>
        )}
      </div>

      {/* タグ追加モーダル */}
      {addTagModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '400px',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ marginTop: 0 }}>タグを手動追加</h3>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '15px' }}>
              {addTagModal.title}
            </p>
            
            <div style={{ marginBottom: '15px' }}>
              <input
                type="text"
                value={addTagInput}
                onChange={e => {
                  setAddTagInput(e.target.value);
                  searchTagSuggestions(e.target.value);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && addTagInput.trim()) {
                    handleAddTag(addTagModal.workId, addTagInput);
                  }
                }}
                placeholder="タグ名を入力..."
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
                autoFocus
              />
              
              {/* 候補リスト */}
              {addTagSuggestions.length > 0 && (
                <div style={{
                  marginTop: '5px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  maxHeight: '150px',
                  overflowY: 'auto'
                }}>
                  {addTagSuggestions.map((tag, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        setAddTagInput(tag.displayName);
                        setAddTagSuggestions([]);
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        backgroundColor: i % 2 === 0 ? '#f8f9fa' : 'white',
                        borderBottom: i < addTagSuggestions.length - 1 ? '1px solid #eee' : 'none'
                      }}
                      onMouseOver={e => (e.currentTarget.style.backgroundColor = '#e8f4ff')}
                      onMouseOut={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#f8f9fa' : 'white')}
                    >
                      {tag.displayName}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setAddTagModal(null);
                  setAddTagInput('');
                  setAddTagSuggestions([]);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#e9ecef',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                キャンセル
              </button>
              <button
                onClick={() => handleAddTag(addTagModal.workId, addTagInput)}
                disabled={addTagLoading || !addTagInput.trim()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: addTagLoading || !addTagInput.trim() ? '#ccc' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: addTagLoading || !addTagInput.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {addTagLoading ? '追加中...' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI指示プレビュー用モーダル */}
      {aiPromptModal.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setAiPromptModal(prev => ({ ...prev, open: false }))}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>AI指示（実際に送っているプロンプト）</h3>
              <button
                type="button"
                onClick={() => setAiPromptModal(prev => ({ ...prev, open: false }))}
                style={{ padding: '6px 12px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px' }}
              >
                閉じる
              </button>
            </div>
            <div style={{ padding: '16px', overflow: 'auto', flex: 1 }}>
              {aiPromptModal.loading && <p>読み込み中...</p>}
              {!aiPromptModal.loading && aiPromptModal.data && (
                <>
                  <div style={{ marginBottom: '12px', fontSize: '13px', color: '#666' }}>
                    タグ数: S={aiPromptModal.data.meta.officialTagCount} / A={aiPromptModal.data.meta.aTagCount} / B={aiPromptModal.data.meta.bTagCount} / C={aiPromptModal.data.meta.cTagCount}
                  </div>
                  <div style={{ marginBottom: '8px', fontSize: '12px', color: '#888' }}>
                    ※分析時は作品ごとに「使用禁止リスト」がその作品の既存Sタグに差し替わります（例では「母乳」で表示）
                  </div>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: '12px', backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '4px', maxHeight: '400px', overflow: 'auto', margin: 0 }}>
                    {aiPromptModal.data.prompt}
                  </pre>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
