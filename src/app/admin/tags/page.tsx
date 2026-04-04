/**
 * タグ管理・インポートページ
 * /admin で表示（/admin/tags は /admin にリダイレクト）
 * ProgressPanel / AdminProgressProvider は admin/layout.tsx で提供
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import ImportWorkflow from '../components/ImportWorkflow';
import RemoteAdminDiagnosticPanel from '../components/RemoteAdminDiagnosticPanel';
import { RecommendPlayHistoryDetailModal, formatRecommendFinalFiveSummary } from '../components/RecommendPlayHistoryDetailModal';
import ManualTagging from '../components/ManualTagging';
import SummaryQuestionEditor from '../components/SummaryQuestionEditor';
import TagManager from '../components/TagManager';
import ChangelogTab from './tabs/ChangelogTab';
import ConfigTab from './tabs/ConfigTab';
import { SimEarlyExitJudgmentColumnCell, EARLY_EXIT_OK_COLOR } from '../components/SimEarlyExitColumnCell';
import { SimEarlyExitThresholdsSummary } from '../components/SimEarlyExitThresholdsSummary';
import { buildSimEarlyExitColumnOkList } from '../utils/earlyExitReviewMerged';
import RecommendFamousTagsTab from './tabs/RecommendFamousTagsTab';
import TitleReadingInitialTab from './tabs/TitleReadingInitialTab';
import { AdminProgressProvider, useAdminProgress } from '../context/AdminProgressContext';
import { RANK_BG, RANK_TEXT, RANK_CHIP } from '../constants/rankColors';

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
  lastTaggingReasoning?: Record<string, unknown> | null;
  lastCheckReasoning?: Record<string, unknown> | null;
  lastCheckTagChanges?: { added?: string[]; removed?: string[]; newProposal?: string } | null;
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

type TabType = 'works' | 'tags' | 'summary' | 'import' | 'manual' | 'initial' | 'simulate' | 'config' | 'recFamous' | 'history' | 'recommendHistory' | 'contact' | 'changelog';

const EXPLORE_TAG_KIND_LABEL: Record<string, string> = { summary: 'まとめ', erotic: 'エロ', abstract: '抽象', normal: '通常' };

/** 発売日を日付のみ・見やすく表示（時刻は出さない） */
function formatReleaseDateOnly(value: string | null | undefined): string {
  if (value == null || value.trim() === '') return '—';
  const datePart = value.trim().split(/[T\s]/)[0];
  if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart || value;
  const [y, m, d] = datePart.split('-');
  return `${y}/${m}/${d}`;
}

/** 履歴詳細の回答表示: はい→◎ たぶんそう→〇 たぶんちがう→△ いいえ→× わからない→— どちらでもいい→※ */
function historyAnswerSymbol(a: string | undefined): string {
  if (a === 'YES') return '◎';
  if (a === 'PROBABLY_YES') return '〇';
  if (a === 'PROBABLY_NO') return '△';
  if (a === 'NO') return '×';
  if (a === 'UNKNOWN') return '—';
  if (a === 'DONT_CARE') return '※';
  if (a === 'CORRECT') return '当たり';
  if (a === 'WRONG') return '不正解';
  return a ?? '—';
}

export default function AdminTagsPage() {
  const { setProgress } = useAdminProgress();
  const [activeTab, setActiveTab] = useState<TabType>('works');
  const [adminToken, setAdminToken] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'full' | 'append'>('full');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResponse | null>(null);
  const [selectedWorks, setSelectedWorks] = useState<Set<string>>(new Set());
  const [analysisResults, setAnalysisResults] = useState<Record<string, {
    derivedTags: Array<{ displayName: string; confidence: number; category: string | null; rank?: string; tagKey?: string; source?: string }>;
    characterTags: string[];
  }>>({});

  const [dbLoaded, setDbLoaded] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState<{ workId: string; comment: string } | null>(null);
  // ページネーション
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10000); // 使用作品DB: 全作品取得用
  const [displayPageSize] = useState(200); // 表示は200件/ページ
  const [totalPages, setTotalPages] = useState(1);
  // 検索・絞り込み・並び替え（使用作品DB）
  const [searchTitle, setSearchTitle] = useState('');
  const [searchCircleName, setSearchCircleName] = useState('');
  const [filterIsAi, setFilterIsAi] = useState<'all' | 'AI' | 'HAND' | 'UNKNOWN'>('all');
  const [filterTagCount, setFilterTagCount] = useState<'all' | '0-5' | '5-10' | '11+'>('all');
  const [showOnlyNeedsReview, setShowOnlyNeedsReview] = useState(false);
  const [moveSelectedToNeedsReviewLoading, setMoveSelectedToNeedsReviewLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'title' | 'circleName' | 'popularity' | 'createdAt' | 'releaseDate'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // コンフィグ用のstate
  const [config, setConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configMessage, setConfigMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);

  const fieldDesc = (key: string) => (
    <small style={{ display: 'block', marginTop: '0.25rem' }}>
      設定キー: <code style={{ padding: '0.15em 0.4em', backgroundColor: '#e8e8e8', borderRadius: '4px', fontWeight: 600, fontFamily: 'monospace' }}>{key}</code>
    </small>
  );

  // タグリスト用のstate
  const [tags, setTags] = useState<Array<{
    tagKey: string;
    displayName: string;
    tagType: string;
    category: string | null;
    questionText: string | null;
    workCount: number;
  }>>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [tagsFilter, setTagsFilter] = useState<'ALL' | 'OFFICIAL' | 'DERIVED' | 'STRUCTURAL'>('ALL');
  const [editingTag, setEditingTag] = useState<{ tagKey: string; questionText: string | null } | null>(null);
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
  const [simWorksStats, setSimWorksStats] = useState<{ totalWorks: number; gameRegisteredCount: number } | null>(null);
  const [simAmbiguityLevel, setSimAmbiguityLevel] = useState<number>(2);
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
    perfSummary?: Record<string, number>;
  } | null>(null);
  const [simShowWorkDetails, setSimShowWorkDetails] = useState(false);
  const [simExpandedSteps, setSimExpandedSteps] = useState(false);
  const [simTrialsPerWork, setSimTrialsPerWork] = useState(1);
  const [simUseSingleRequest, setSimUseSingleRequest] = useState(false);
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
      perfSummary?: Record<string, number>;
      steps?: Array<{
        qIndex: number;
        question: { kind: string; displayText: string; exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal' };
        answer: string;
        wasNoisy: boolean;
        confidenceBefore: number;
        confidenceAfter: number;
        revealResult?: string;
      }>;
      diagnostic?: unknown;
      analysisData?: { wasNoisyCount: number; firstNoisyStepIndex: number; noisyStepIndices: number[]; correctRank: number; top1Confidence: number; totalQuestions?: number; noisyRatio?: number };
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
      ambiguityLevel?: number;
      aiGateChoice: string;
      trialsPerWork: number;
    };
    failureSummary?: Record<string, number>;
    failureAnalysis?: { failureCount: number; avgWasNoisyCount: number | null; avgCorrectRank: number | null; avgTop1Confidence: number | null };
  } | null>(null);
  const [simBatchLoading, setSimBatchLoading] = useState(false);
  const [simMatrixRegenerating, setSimMatrixRegenerating] = useState(false);
  const [simSampleSize, setSimSampleSize] = useState<number>(50);
  const [simSaving, setSimSaving] = useState(false);
  const [simFailureFilter, setSimFailureFilter] = useState(false);
  const [simResultPage, setSimResultPage] = useState(0);
  const SIM_RESULT_PAGE_SIZE = 100;
  const [simPerfExpanded, setSimPerfExpanded] = useState(false);
  const [simBatchPerfExpanded, setSimBatchPerfExpanded] = useState(false);
  const [simModalPerfExpanded, setSimModalPerfExpanded] = useState(false);
  const [simModalRetryLoading, setSimModalRetryLoading] = useState(false);
  const [simResultModal, setSimResultModal] = useState<{
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
      question: { kind: string; displayText: string; exploreTagKind?: string; tagKey?: string; specialQuestionType?: string; titleCharType?: string; authorCharType?: string; rangeId?: string; titleSyllableRangeId?: string; titleSyllable2RangeId?: string; titleSyllable2Branch?: 'yesBranch' | 'noBranch' };
      answer: string;
      wasNoisy: boolean;
      confidenceBefore: number;
      confidenceAfter: number;
      revealResult?: string;
    }>;
    workDetails?: unknown;
    perfSummary?: Record<string, number>;
    diagnostic?: unknown;
    analysisData?: { wasNoisyCount: number; firstNoisyStepIndex: number; noisyStepIndices: number[]; correctRank: number; top1Confidence: number; totalQuestions?: number; noisyRatio?: number };
  } | null>(null);

  const simEarlyExitOkInline = useMemo(
    () => (simResult?.steps ? buildSimEarlyExitColumnOkList(simResult.steps as never[], config?.flow) : []),
    [simResult?.steps, config?.flow]
  );
  const simEarlyExitOkModal = useMemo(
    () => (simResultModal?.steps ? buildSimEarlyExitColumnOkList(simResultModal.steps as never[], config?.flow) : []),
    [simResultModal?.steps, config?.flow]
  );

  // シミュ結果の質問文言編集（'simResult-0' | 'simResultModal-2' など）
  const [editingQuestionKey, setEditingQuestionKey] = useState<string | null>(null);
  const [editingQuestionValue, setEditingQuestionValue] = useState('');
  const [editingQuestionLoading, setEditingQuestionLoading] = useState(false);

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
    resultWorkTitle?: string | null;
    submittedTitleText: string | null;
    sessionStartedAt?: string | null;
    clickedFanza?: boolean;
    createdAt: string;
    failListContext?: unknown | null;
    visitorId?: string | null;
    hasRecommendPlay?: boolean;
  }>>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLimit] = useState(50);
  const [historyOutcome, setHistoryOutcome] = useState<string>('');
  const [historyUseRemote, setHistoryUseRemote] = useState(true);
  const [historyRemoteSettingsOpen, setHistoryRemoteSettingsOpen] = useState(false);
  const [historyDetailRowId, setHistoryDetailRowId] = useState<string | null>(null);
  const [historySelectedIds, setHistorySelectedIds] = useState<Set<string>>(new Set());
  const [historyDeleteLoading, setHistoryDeleteLoading] = useState(false);
  const [historyReplayCache, setHistoryReplayCache] = useState<Record<string, Array<{ qIndex: number; kind: string; displayText?: string; answer?: string; exploreTagKind?: string; tagCoverage?: number; confidenceBefore?: number; confidenceAfter?: number; wasNoisy: boolean; missType?: 'clear' | 'weak'; revealWorkId?: string; revealWorkTitle?: string; revealResult?: 'SUCCESS' | 'MISS' }>>>({});
  const [historyReplayLoading, setHistoryReplayLoading] = useState(false);
  const [recHistLoading, setRecHistLoading] = useState(false);
  const [recHistItems, setRecHistItems] = useState<
    Array<{
      id: string;
      recommendSessionId: string;
      sessionStartedAt: string | null;
      clickedFanza: boolean;
      clickedFanzaWorkId?: string | null;
      detailJson: unknown;
      topWorkId: string | null;
      topWorkTitle: string | null;
      createdAt: string;
      visitorId?: string | null;
      hasNormalPlay?: boolean;
    }>
  >([]);
  const [recHistTotal, setRecHistTotal] = useState(0);
  const [recHistPage, setRecHistPage] = useState(1);
  const [recHistLimit] = useState(50);
  const [recHistSelectedIds, setRecHistSelectedIds] = useState<Set<string>>(new Set());
  const [recHistDeleteLoading, setRecHistDeleteLoading] = useState(false);
  const [recHistDetailRowId, setRecHistDetailRowId] = useState<string | null>(null);
  const CONTACT_INQUIRY_PAGE_SIZE = 30;
  const [contactLoading, setContactLoading] = useState(false);
  const [contactItems, setContactItems] = useState<
    Array<{ id: string; name: string; email: string; subject: string | null; message: string; createdAt: string }>
  >([]);
  const [contactTotal, setContactTotal] = useState(0);
  const [contactPage, setContactPage] = useState(1);
  const [productionHistoryUrl, setProductionHistoryUrl] = useState(
    () => (typeof window !== 'undefined' ? (process.env.NEXT_PUBLIC_PRODUCTION_APP_URL || '') : '')
  );
  const [productionHistoryToken, setProductionHistoryToken] = useState('');
  /** プレビューデプロイ用。入力があるときは本番URLより優先。localStorage に保存してリロード後も残す */
  const [previewHistoryUrl, setPreviewHistoryUrl] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const p = localStorage.getItem('eronator.adminRemotePreviewUrl');
      if (p) setPreviewHistoryUrl(p);
    } catch {
      /* ignore */
    }
  }, []);

  const setPreviewHistoryUrlPersisted = (value: string) => {
    setPreviewHistoryUrl(value);
    if (typeof window !== 'undefined') {
      try {
        if (value.trim()) localStorage.setItem('eronator.adminRemotePreviewUrl', value);
        else localStorage.removeItem('eronator.adminRemotePreviewUrl');
      } catch {
        /* ignore */
      }
    }
  };

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
          'Content-Type': 'application/json',
          'x-eronator-admin-token': token,
        },
        body: JSON.stringify({ page: 1, pageSize: 10000 }),
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
        
        // 初期は未選択
        setSelectedWorks(new Set());
        
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

  const toggleAllSelection = (worksToUse?: ParsedWork[]) => {
    const list = worksToUse ?? parseResult?.works;
    if (!list) return;
    if (selectedWorks.size === list.length) {
      setSelectedWorks(new Set());
    } else {
      setSelectedWorks(new Set(list.map(w => w.workId)));
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

      const response = await fetch('/api/admin/tags/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({ works: worksToAnalyze }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (debugEnabled) {
          console.error('[UI] API error:', response.status, errorText);
        }
        alert(`AI分析に失敗しました: ${response.status} ${errorText}`);
        return;
      }

      const data = await response.json();

      if (data.success && data.results) {
        // 結果をworkIdをキーにしたオブジェクトに変換
        const resultsMap: Record<string, typeof data.results[0]> = {};
        for (const result of data.results) {
          resultsMap[result.workId] = {
            derivedTags: result.derivedTags,
            characterTags: result.characterTags,
          };
        }
        
        setAnalysisResults(resultsMap);
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
  const [dmmImportSort, setDmmImportSort] = useState<'rank' | 'review' | 'date'>('rank');
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
          sort: dmmImportSort,
        }),
      });

      const data = await response.json();
      setDmmImportResult(data);

      if (data.success) {
        alert(`DMMインポート完了\n新規保存: ${data.stats.saved}件\nスキップ: ${data.stats.skipped}件（既存）`);
        // DBを再読み込み
        await handleLoadFromDb(1);
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
  const handleLoadFromDb = async (pageNum: number = 1, forceNeedsReviewOnly?: boolean) => {
    if (!adminToken) {
      alert('管理トークンを入力してください');
      return;
    }
    const useOnly = forceNeedsReviewOnly ?? showOnlyNeedsReview;

    setLoading(true);
    try {
      const response = await fetch('/api/admin/tags/load-from-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eronator-admin-token': adminToken,
        },
        body: JSON.stringify({
          page: 1,
          pageSize,
          needsReviewFilter: useOnly ? 'only' : 'exclude',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        alert(`DBからの読み込みに失敗しました: ${response.status} ${errorText}`);
        return;
      }

      const data = await response.json();

      if (data.success && Array.isArray(data.works)) {
        if (data.works.length === 0 && pageNum === 1 && !useOnly) {
          alert('ゲーム使用の作品がありません。\nタグチェックでタグ済・人間確認・チェック待ち・旧AIタグのいずれかに入れ、要注意でない作品がここに表示されます。');
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
        setCurrentPage(1);
        
        // 選択をクリア（新しいページなので）
        setSelectedWorks(new Set());
        
        // 既存のタグをanalysisResultsに設定
        const existingResults: Record<string, {
          derivedTags: Array<{ displayName: string; confidence: number; category: string | null; rank?: string; tagKey?: string; source?: string }>;
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

  // 使用作品DB: 検索・絞り込み・並び替え後の表示用リスト
  const { displayWorks, filteredTotal, totalWorks, displayTotalPages } = useMemo(() => {
    const works = parseResult?.works ?? [];
    const isDbMode = parseResult?.mode === 'db';
    const st = searchTitle.trim().toLowerCase();
    const sc = searchCircleName.trim().toLowerCase();
    let filtered = isDbMode ? works.filter((w) => {
      if (st && !w.title.toLowerCase().includes(st)) return false;
      if (sc && !w.circleName.toLowerCase().includes(sc)) return false;
      if (filterIsAi !== 'all' && w.isAi !== filterIsAi) return false;
      const tagCount = (w.officialTags?.length ?? 0) + (analysisResults[w.workId]?.derivedTags?.length ?? 0) + (analysisResults[w.workId]?.characterTags?.length ?? 0);
      if (filterTagCount === '0-5' && (tagCount < 0 || tagCount > 5)) return false;
      if (filterTagCount === '5-10' && (tagCount < 5 || tagCount > 10)) return false;
      if (filterTagCount === '11+' && tagCount < 11) return false;
      return true;
    }) : works;
    const cmp = (a: ParsedWork, b: ParsedWork) => {
      let v = 0;
      if (sortBy === 'title') v = (a.title || '').localeCompare(b.title || '', 'ja');
      else if (sortBy === 'circleName') v = (a.circleName || '').localeCompare(b.circleName || '', 'ja');
      else if (sortBy === 'popularity') v = (a.popularityBase + a.popularityPlayBonus) - (b.popularityBase + b.popularityPlayBonus);
      else if (sortBy === 'releaseDate') v = (a.releaseDate || '').localeCompare(b.releaseDate || '', 'ja');
      else v = (a.scrapedAt || '').localeCompare(b.scrapedAt || '', 'ja');
      // asc=昇順(A→Z, 小→大), desc=降順(Z→A, 大→小)
      return sortOrder === 'asc' ? -v : v;
    };
    filtered = [...filtered].sort(cmp);
    const total = filtered.length;
    const totalPagesVal = Math.max(1, Math.ceil(total / displayPageSize));
    const start = (currentPage - 1) * displayPageSize;
    const display = filtered.slice(start, start + displayPageSize);
    return { displayWorks: display, filteredTotal: total, totalWorks: works.length, displayTotalPages: totalPagesVal };
  }, [parseResult, searchTitle, searchCircleName, filterIsAi, filterTagCount, sortBy, sortOrder, currentPage, displayPageSize, analysisResults]);

  // 使用作品DB: 選択した作品をチェック完了に（needsReview=false）
  const handleCheckCompleteNeedsReview = async () => {
    if (!adminToken || selectedWorks.size === 0) return;
    const workIds = Array.from(selectedWorks);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/works/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({ action: 'setNeedsReview', workIds, needsReview: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setSelectedWorks((prev) => {
          const next = new Set(prev);
          workIds.forEach((id) => next.delete(id));
          return next;
        });
        await handleLoadFromDb(1, true);
      } else {
        alert(data.error || 'チェック完了の更新に失敗しました');
      }
    } catch (e) {
      console.error('handleCheckCompleteNeedsReview failed:', e);
      alert('チェック完了に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 使用作品DB: 要注意フォルダへ移動
  const handleMoveToNeedsReview = async (workId: string) => {
    if (!adminToken) return;
    if (!confirm('この作品を「要注意」フォルダに送ります。\nゲーム使用一覧からは外れ、タグチェックの要注意で確認できます。\nよろしいですか？')) return;
    try {
      const res = await fetch(`/api/admin/manual-tagging/works/${workId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
        body: JSON.stringify({ manualTaggingFolder: 'needs_review' }),
      });
      if (res.ok && parseResult?.mode === 'db' && parseResult?.works) {
        setParseResult({ ...parseResult, works: parseResult.works.filter((w) => w.workId !== workId) });
        setShowCommentModal(null);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || '移動に失敗しました');
      }
    } catch (e) {
      console.error('handleMoveToNeedsReview failed:', e);
      alert('移動に失敗しました');
    }
  };

  // 使用作品DB: 選択した作品をすべて要注意へ移動
  const handleMoveSelectedToNeedsReview = async () => {
    if (!adminToken || selectedWorks.size === 0) return;
    if (!confirm(`選択中の ${selectedWorks.size} 件をすべて「要注意」にしますか？\nゲーム使用一覧からは外れ、タグチェックの要注意で確認できます。`)) return;
    setMoveSelectedToNeedsReviewLoading(true);
    try {
      const ids = Array.from(selectedWorks);
      let ok = 0;
      let fail = 0;
      for (const workId of ids) {
        const res = await fetch(`/api/admin/manual-tagging/works/${workId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
          body: JSON.stringify({ manualTaggingFolder: 'needs_review' }),
        });
        if (res.ok) ok++;
        else fail++;
      }
      if (parseResult?.mode === 'db' && parseResult?.works) {
        setParseResult({ ...parseResult, works: parseResult.works.filter((w) => !selectedWorks.has(w.workId)) });
        setSelectedWorks(new Set());
      }
      setShowCommentModal(null);
      if (fail > 0) alert(`${ok} 件を要注意にしました。${fail} 件は失敗しました。`);
    } catch (e) {
      console.error('handleMoveSelectedToNeedsReview failed:', e);
      alert('一括移動に失敗しました');
    } finally {
      setMoveSelectedToNeedsReviewLoading(false);
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
        await handleLoadFromDb(currentPage);
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

  const handleRegenerateMatrix = async () => {
    if (!adminToken) {
      alert('管理トークンを入力してください');
      return;
    }
    setSimMatrixRegenerating(true);
    try {
      const res = await fetch('/api/admin/generate-worktag-matrix', {
        method: 'POST',
        headers: { 'x-eronator-admin-token': adminToken },
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || '行列を再生成しました。');
      } else {
        alert(data.error || '行列の再生成に失敗しました。');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '行列の再生成に失敗しました。');
    } finally {
      setSimMatrixRegenerating(false);
    }
  };

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

      if (data.success && Array.isArray(data.tags)) {
        setTags(data.tags);
        setTagsStats(data.stats || null);
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
          questionText: editingTag.questionText || null,
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
              ? { ...tag, questionText: editingTag.questionText }
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

  // シミュ結果の質問文言を保存（EXPLORE_TAG/SOFT_CONFIRM→tags/update、SPECIAL_QUESTION→special-questions）
  const handleSaveSimQuestionText = async (
    source: 'simResult' | 'simResultModal',
    stepIndex: number,
    step: { question: { kind: string; displayText: string; tagKey?: string; specialQuestionType?: string; titleCharType?: string; authorCharType?: string; rangeId?: string; titleSyllableRangeId?: string; titleSyllable2RangeId?: string; titleSyllable2Branch?: 'yesBranch' | 'noBranch' } },
    newText: string
  ) => {
    if (!adminToken || !newText.trim()) return;
    setEditingQuestionLoading(true);
    try {
      const q = step.question;
      if (q.kind === 'EXPLORE_TAG' || q.kind === 'SOFT_CONFIRM') {
        if (!q.tagKey) {
          alert('タグ情報がありません');
          return;
        }
        const res = await fetch('/api/admin/tags/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
          body: JSON.stringify({ tagKey: q.tagKey, questionText: newText.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error ?? '保存に失敗しました');
        if (source === 'simResult' && simResult) {
          setSimResult({
            ...simResult,
            steps: simResult.steps.map((s, i) =>
              i === stepIndex ? { ...s, question: { ...s.question, displayText: newText.trim() } } : s
            ),
          });
        } else if (source === 'simResultModal' && simResultModal) {
          setSimResultModal({
            ...simResultModal,
            steps: simResultModal.steps.map((s, i) =>
              i === stepIndex ? { ...s, question: { ...s.question, displayText: newText.trim() } } : s
            ),
          });
        }
        setEditingQuestionKey(null);
        alert('質問文言を保存しました');
        return;
      }
      if (q.kind === 'SPECIAL_QUESTION' && q.specialQuestionType) {
        const st = q.specialQuestionType;
        let body: { type: string; key?: string; value: string } = { type: st, value: newText.trim() };
        if (st === 'TITLE_CHAR_TYPE' && q.titleCharType) body.key = q.titleCharType;
        else if (st === 'AUTHOR_CHAR_TYPE' && q.authorCharType) body.key = q.authorCharType;
        else if (st === 'TITLE_SYLLABLE') {
          const rid = q.titleSyllableRangeId ?? q.rangeId;
          if (rid) body.key = rid; else { alert('TITLE_SYLLABLE の rangeId がありません'); return; }
        }
        else if (st === 'SERIES' || st === 'POPULARITY') {
          /* body はそのまま */
        } else if (st === 'TITLE_SYLLABLE_2' && q.titleSyllable2RangeId && q.titleSyllable2Branch) {
          body = { type: st, key: `${q.titleSyllable2RangeId}.${q.titleSyllable2Branch}.questionText`, value: newText.trim() };
        } else if (st === 'TITLE_SYLLABLE_2') {
          const cfgRes = await fetch('/api/admin/special-questions', { headers: { 'x-eronator-admin-token': adminToken } });
          const cfgData = await cfgRes.json().catch(() => ({}));
          type T2B = { yesBranch?: { questionText?: string }; noBranch?: { questionText?: string } };
          const cfg = (cfgData as { TITLE_SYLLABLE_2?: { branches?: Record<string, T2B> } }).TITLE_SYLLABLE_2;
          const branches = cfg?.branches ?? {};
          let found = false;
          for (const [pid, b] of Object.entries(branches)) {
            if (b?.yesBranch?.questionText === q.displayText) {
              body = { type: st, key: `${pid}.yesBranch.questionText`, value: newText.trim() };
              found = true;
              break;
            }
            if (b?.noBranch?.questionText === q.displayText) {
              body = { type: st, key: `${pid}.noBranch.questionText`, value: newText.trim() };
              found = true;
              break;
            }
          }
          if (!found) {
            alert('TITLE_SYLLABLE_2 の該当ブランチを特定できませんでした');
            return;
          }
        }
        const res = await fetch('/api/admin/special-questions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((data as { error?: string }).error ?? '保存に失敗しました');
        if (source === 'simResult' && simResult) {
          setSimResult({
            ...simResult,
            steps: simResult.steps.map((s, i) =>
              i === stepIndex ? { ...s, question: { ...s.question, displayText: newText.trim() } } : s
            ),
          });
        } else if (source === 'simResultModal' && simResultModal) {
          setSimResultModal({
            ...simResultModal,
            steps: simResultModal.steps.map((s, i) =>
              i === stepIndex ? { ...s, question: { ...s.question, displayText: newText.trim() } } : s
            ),
          });
        }
        setEditingQuestionKey(null);
        alert('質問文言を保存しました');
        return;
      }
      alert('この質問は編集できません');
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setEditingQuestionLoading(false);
    }
  };

  const handleDebugToggle = (enabled: boolean) => {
    setDebugEnabled(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('eronator.debugEnabled', enabled ? '1' : '0');
      setConfigMessage({ type: 'success', text: 'デバッグモードの設定を保存しました。ページをリロードしてください。' });
    }
  };

  /** リモート取得先: プレビューURLが空でなければそれ、否则本番URL */
  const remoteDeploymentUrl = previewHistoryUrl.trim() || productionHistoryUrl.trim();

  const fetchPlayHistory = async (page: number = 1) => {
    const token = historyUseRemote ? (productionHistoryToken || adminToken) : adminToken;
    if (!token) return;
    if (historyUseRemote && !remoteDeploymentUrl) {
      alert(
        'リモートの履歴を表示するには「本番URL」を入力するか、プレビューだけ試す場合は「プレビューURL」に貼ってください。.env.local に NEXT_PUBLIC_PRODUCTION_APP_URL を設定しても構いません。'
      );
      return;
    }
    setHistoryLoading(true);
    try {
      if (historyUseRemote) {
        const response = await fetch('/api/admin/play-history-remote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
          body: JSON.stringify({
            targetUrl: remoteDeploymentUrl,
            token: productionHistoryToken || adminToken,
            page,
            limit: historyLimit,
            outcome: historyOutcome || undefined,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `取得に失敗しました (${response.status})`);
        }
        const data = await response.json();
        if (data.success && Array.isArray(data.items)) {
          setHistoryItems(data.items);
          setHistoryTotal(data.total ?? 0);
          setHistoryPage(page);
        }
      } else {
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
      }
    } catch (e) {
      console.error('[play-history]', e);
      setHistoryItems([]);
      setHistoryTotal(0);
      alert(e instanceof Error ? e.message : '履歴の取得に失敗しました');
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchRecommendPlayHistory = async (page: number = 1) => {
    const token = historyUseRemote ? (productionHistoryToken || adminToken) : adminToken;
    if (!token) return;
    if (historyUseRemote && !remoteDeploymentUrl) {
      alert(
        'リモートの履歴を表示するには「本番URL」を入力するか、プレビューだけ試す場合は「プレビューURL」に貼ってください。.env.local に NEXT_PUBLIC_PRODUCTION_APP_URL を設定しても構いません。'
      );
      return;
    }
    setRecHistLoading(true);
    try {
      if (historyUseRemote) {
        const response = await fetch('/api/admin/recommend-play-history-remote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
          body: JSON.stringify({
            targetUrl: remoteDeploymentUrl,
            token: productionHistoryToken || adminToken,
            page,
            limit: recHistLimit,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || `取得に失敗しました (${response.status})`);
        }
        const data = await response.json();
        if (data.success && Array.isArray(data.items)) {
          setRecHistItems(data.items);
          setRecHistTotal(data.total ?? 0);
          setRecHistPage(page);
        }
      } else {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(recHistLimit));
        const response = await fetch(`/api/admin/recommend-play-history?${params.toString()}`, {
          headers: { 'x-eronator-admin-token': adminToken },
        });
        if (!response.ok) {
          if (response.status === 403) throw new Error('アクセスが拒否されました');
          throw new Error(`取得に失敗しました (${response.status})`);
        }
        const data = await response.json();
        if (data.success && Array.isArray(data.items)) {
          setRecHistItems(data.items);
          setRecHistTotal(data.total ?? 0);
          setRecHistPage(page);
        }
      }
    } catch (e) {
      console.error('[recommend-play-history]', e);
      setRecHistItems([]);
      setRecHistTotal(0);
      alert(e instanceof Error ? e.message : '履歴の取得に失敗しました');
    } finally {
      setRecHistLoading(false);
    }
  };

  const fetchContactInquiries = async (page: number = 1, fromUser: boolean = false) => {
    const token = historyUseRemote ? (productionHistoryToken || adminToken) : adminToken;
    if (!token) return;
    if (historyUseRemote && !remoteDeploymentUrl) {
      setContactItems([]);
      setContactTotal(0);
      if (fromUser) {
        alert(
          'リモートのお問い合わせを表示するには「本番URL」または「プレビューURL」を入力してください。（プレイ履歴タブの設定と共通です）'
        );
      }
      return;
    }
    setContactLoading(true);
    try {
      if (historyUseRemote) {
        const response = await fetch('/api/admin/contact-inquiries-remote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
          body: JSON.stringify({
            targetUrl: remoteDeploymentUrl,
            token: productionHistoryToken || adminToken,
            page,
            limit: CONTACT_INQUIRY_PAGE_SIZE,
          }),
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || `取得に失敗しました (${response.status})`);
        }
        const data = await response.json();
        if (data.success && Array.isArray(data.items)) {
          setContactItems(data.items);
          setContactTotal(data.total ?? 0);
          setContactPage(page);
        }
      } else {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', String(CONTACT_INQUIRY_PAGE_SIZE));
        const response = await fetch(`/api/admin/contact-inquiries?${params.toString()}`, {
          headers: { 'x-eronator-admin-token': adminToken },
        });
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error || `取得に失敗しました (${response.status})`);
        }
        const data = await response.json();
        if (data.success && Array.isArray(data.items)) {
          setContactItems(data.items);
          setContactTotal(data.total ?? 0);
          setContactPage(page);
        }
      }
    } catch (e) {
      console.error('[contact-inquiries]', e);
      setContactItems([]);
      setContactTotal(0);
      alert(e instanceof Error ? e.message : 'お問い合わせの取得に失敗しました');
    } finally {
      setContactLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'contact' && adminToken) {
      if (historyUseRemote && !remoteDeploymentUrl) {
        setContactItems([]);
        setContactTotal(0);
        return;
      }
      void fetchContactInquiries(1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- タブ切替時のみ再取得
  }, [activeTab, adminToken, historyUseRemote, productionHistoryUrl, previewHistoryUrl]);

  const handleHistoryDeleteSelected = async () => {
    const ids = Array.from(historySelectedIds);
    if (ids.length === 0) {
      alert('削除する履歴を選択してください。');
      return;
    }
    if (!confirm(`選択した ${ids.length} 件の履歴を削除します。よろしいですか？`)) return;
    const token = historyUseRemote ? (productionHistoryToken || adminToken) : adminToken;
    if (!token) return;
    if (historyUseRemote && !remoteDeploymentUrl) {
      alert('リモートの履歴を削除するには「本番URL」または「プレビューURL」を入力してください。');
      return;
    }
    setHistoryDeleteLoading(true);
    try {
      if (historyUseRemote) {
        const res = await fetch('/api/admin/play-history-remote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
          body: JSON.stringify({
            action: 'delete',
            targetUrl: remoteDeploymentUrl,
            token: productionHistoryToken || adminToken,
            ids,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '削除に失敗しました');
        setHistorySelectedIds(new Set());
        await fetchPlayHistory(historyPage);
        alert(`${data.deleted ?? ids.length} 件を削除しました。`);
      } else {
        const res = await fetch('/api/admin/play-history/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
          body: JSON.stringify({ ids }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '削除に失敗しました');
        setHistorySelectedIds(new Set());
        await fetchPlayHistory(historyPage);
        alert(`${data.deleted ?? ids.length} 件を削除しました。`);
      }
    } catch (e) {
      console.error('[play-history delete]', e);
      alert(e instanceof Error ? e.message : '削除に失敗しました');
    } finally {
      setHistoryDeleteLoading(false);
    }
  };

  const handleRecHistDeleteSelected = async () => {
    const ids = Array.from(recHistSelectedIds);
    if (ids.length === 0) {
      alert('削除する履歴を選択してください。');
      return;
    }
    if (!confirm(`選択した ${ids.length} 件の推薦プレイ履歴を削除します。よろしいですか？`)) return;
    const token = historyUseRemote ? (productionHistoryToken || adminToken) : adminToken;
    if (!token) return;
    if (historyUseRemote && !remoteDeploymentUrl) {
      alert('リモートの履歴を削除するには「本番URL」または「プレビューURL」を入力してください。');
      return;
    }
    setRecHistDeleteLoading(true);
    try {
      if (historyUseRemote) {
        const res = await fetch('/api/admin/recommend-play-history-remote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
          body: JSON.stringify({
            action: 'delete',
            targetUrl: remoteDeploymentUrl,
            token: productionHistoryToken || adminToken,
            ids,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '削除に失敗しました');
        setRecHistSelectedIds(new Set());
        await fetchRecommendPlayHistory(recHistPage);
        alert(`${data.deleted ?? ids.length} 件を削除しました。`);
      } else {
        const res = await fetch('/api/admin/recommend-play-history/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
          body: JSON.stringify({ ids }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '削除に失敗しました');
        setRecHistSelectedIds(new Set());
        await fetchRecommendPlayHistory(recHistPage);
        alert(`${data.deleted ?? ids.length} 件を削除しました。`);
      }
    } catch (e) {
      console.error('[recommend-play-history delete]', e);
      alert(e instanceof Error ? e.message : '削除に失敗しました');
    } finally {
      setRecHistDeleteLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'history') return;
    const token = historyUseRemote ? (productionHistoryToken || adminToken) : adminToken;
    if (historyUseRemote && !remoteDeploymentUrl) return;
    if (token) fetchPlayHistory(1);
  }, [activeTab, adminToken, historyOutcome, historyUseRemote, productionHistoryUrl, previewHistoryUrl]);

  useEffect(() => {
    if (activeTab !== 'recommendHistory') return;
    const token = historyUseRemote ? (productionHistoryToken || adminToken) : adminToken;
    if (historyUseRemote && !remoteDeploymentUrl) return;
    if (token) fetchRecommendPlayHistory(1);
  }, [activeTab, adminToken, historyUseRemote, productionHistoryUrl, previewHistoryUrl]);

  // 詳細モーダル用: 表示時にリプレイAPIで p値・確度 を再計算
  useEffect(() => {
    if (!historyDetailRowId || !adminToken) return;
    const row = historyItems.find((r) => r.id === historyDetailRowId);
    if (!row || historyReplayCache[row.id] !== undefined) return;

    let cancelled = false;
    setHistoryReplayLoading(true);
    fetch('/api/admin/play-history-replay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-eronator-admin-token': adminToken,
      },
      body: JSON.stringify({
        questionHistory: Array.isArray(row.questionHistory) ? row.questionHistory : [],
        aiGateChoice: row.aiGateChoice ?? null,
        outcome: row.outcome ?? null,
        resultWorkId: row.outcome === 'SUCCESS' && row.resultWorkId ? row.resultWorkId : null,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success && Array.isArray(data.steps)) {
          setHistoryReplayCache((prev) => ({ ...prev, [row.id]: data.steps }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHistoryReplayLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [historyDetailRowId, adminToken, historyItems, historyReplayCache]);

  return (
    <>
    <div style={{ padding: '2rem', maxWidth: '1680px', margin: '0 auto' }}>
      <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '0.75rem' }}>
        <strong>管理画面</strong> — 作品データベース管理、タグ管理、設定変更、作品インポートを行います。
      </div>

      {/* 管理トークンを入力 */}
      <section style={{ marginBottom: '1rem', padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#f9f9f9', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>アクセス認証</span>
        <input
          type="password"
          value={adminToken}
          onChange={handleTokenChange}
          placeholder="ERONATOR_ADMIN_TOKEN の値を入力"
          style={{ flex: '1', minWidth: '200px', maxWidth: '400px', padding: '0.4rem 0.6rem', fontSize: '0.9rem' }}
        />
        <span style={{ fontSize: '0.8rem', color: '#888' }}>.env.local の ERONATOR_ADMIN_TOKEN</span>
      </section>

      {/* タブナビゲーション */}
      <div style={{ borderBottom: '2px solid #ddd', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.06rem', flexWrap: 'nowrap', overflowX: 'auto' }}>
          <button
            onClick={() => setActiveTab('works')}
            style={{
              padding: '0.26rem 0.42rem',
              fontSize: '0.78rem',
              flexShrink: 0,
              backgroundColor: activeTab === 'works' ? '#0070f3' : 'transparent',
              color: activeTab === 'works' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'works' ? '2px solid #0070f3' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'works' ? 'bold' : 'normal',
            }}
          >
            使用作品DB
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            style={{
              padding: '0.26rem 0.42rem',
              fontSize: '0.78rem',
              flexShrink: 0,
              backgroundColor: activeTab === 'tags' ? '#0070f3' : 'transparent',
              color: activeTab === 'tags' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'tags' ? '2px solid #0070f3' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'tags' ? 'bold' : 'normal',
            }}
          >
            タグ＆質問リスト
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            style={{
              padding: '0.26rem 0.42rem',
              fontSize: '0.78rem',
              flexShrink: 0,
              backgroundColor: activeTab === 'summary' ? '#0070f3' : 'transparent',
              color: activeTab === 'summary' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'summary' ? '2px solid #0070f3' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'summary' ? 'bold' : 'normal',
            }}
          >
            まとめ質問
          </button>
          <button
            onClick={() => setActiveTab('import')}
            style={{
              padding: '0.26rem 0.42rem',
              fontSize: '0.78rem',
              flexShrink: 0,
              backgroundColor: activeTab === 'import' ? '#0070f3' : 'transparent',
              color: activeTab === 'import' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'import' ? '2px solid #0070f3' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'import' ? 'bold' : 'normal',
            }}
          >
            作品＆コメント取得
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            style={{
              padding: '0.26rem 0.42rem',
              fontSize: '0.78rem',
              flexShrink: 0,
              backgroundColor: activeTab === 'manual' ? '#28a745' : 'transparent',
              color: activeTab === 'manual' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'manual' ? '2px solid #28a745' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'manual' ? 'bold' : 'normal',
            }}
          >
            タグ付け＆タグチェック
          </button>
          <button
            onClick={() => setActiveTab('initial')}
            style={{
              padding: '0.26rem 0.42rem',
              fontSize: '0.78rem',
              flexShrink: 0,
              backgroundColor: activeTab === 'initial' ? '#0d9488' : 'transparent',
              color: activeTab === 'initial' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'initial' ? '2px solid #0d9488' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'initial' ? 'bold' : 'normal',
            }}
          >
            作品頭文字
          </button>
          <button
            onClick={() => setActiveTab('simulate')}
            style={{
              padding: '0.26rem 0.42rem',
              fontSize: '0.78rem',
              flexShrink: 0,
              backgroundColor: activeTab === 'simulate' ? '#ff6600' : 'transparent',
              color: activeTab === 'simulate' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'simulate' ? '2px solid #ff6600' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'simulate' ? 'bold' : 'normal',
            }}
          >
            シミュレーション
          </button>
          <button
            onClick={() => setActiveTab('config')}
            style={{
              padding: '0.26rem 0.42rem',
              fontSize: '0.78rem',
              flexShrink: 0,
              backgroundColor: activeTab === 'config' ? '#0070f3' : 'transparent',
              color: activeTab === 'config' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'config' ? '2px solid #0070f3' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'config' ? 'bold' : 'normal',
            }}
          >
            コンフィグ
          </button>
          <button
            onClick={() => setActiveTab('recFamous')}
            style={{
              padding: '0.26rem 0.42rem',
              fontSize: '0.78rem',
              flexShrink: 0,
              backgroundColor: activeTab === 'recFamous' ? '#0070f3' : 'transparent',
              color: activeTab === 'recFamous' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'recFamous' ? '2px solid #0070f3' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'recFamous' ? 'bold' : 'normal',
            }}
          >
            推薦・有名タグ
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '0.26rem 0.42rem',
              fontSize: '0.78rem',
              flexShrink: 0,
              backgroundColor: activeTab === 'history' ? '#6b21a8' : 'transparent',
              color: activeTab === 'history' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'history' ? '2px solid #6b21a8' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'history' ? 'bold' : 'normal',
            }}
          >
            本番プレイ履歴
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('recommendHistory')}
            style={{
              padding: '0.26rem 0.42rem',
              fontSize: '0.78rem',
              flexShrink: 0,
              backgroundColor: activeTab === 'recommendHistory' ? '#7c3aed' : 'transparent',
              color: activeTab === 'recommendHistory' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'recommendHistory' ? '2px solid #7c3aed' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'recommendHistory' ? 'bold' : 'normal',
            }}
          >
            推薦プレイ履歴
          </button>
          <button
            onClick={() => setActiveTab('contact')}
            style={{
              padding: '0.26rem 0.42rem',
              fontSize: '0.78rem',
              flexShrink: 0,
              backgroundColor: activeTab === 'contact' ? '#0d9488' : 'transparent',
              color: activeTab === 'contact' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'contact' ? '2px solid #0d9488' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'contact' ? 'bold' : 'normal',
            }}
          >
            お問い合わせ
          </button>
          <button
            onClick={() => setActiveTab('changelog')}
            style={{
              padding: '0.26rem 0.42rem',
              fontSize: '0.78rem',
              flexShrink: 0,
              backgroundColor: activeTab === 'changelog' ? '#059669' : 'transparent',
              color: activeTab === 'changelog' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'changelog' ? '2px solid #059669' : '2px solid transparent',
              cursor: 'pointer',
              fontWeight: activeTab === 'changelog' ? 'bold' : 'normal',
            }}
          >
            更新履歴編集
          </button>
        </div>
      </div>

      {/* タブコンテンツ */}
      {/* タブコンテンツ 作品DB */}
      {activeTab === 'works' && (
        <>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>使用作品DB</h2>
          {/* メイン: 作品一覧（DB読み込みまたはファイル読み込み）*/}
          {parseResult && parseResult.success && parseResult.works && (
            <section style={{ marginBottom: '2rem' }}>
              {parseResult.mode !== 'db' && (
                <h2 style={{ marginBottom: '1rem' }}>パース結果（ファイル読み込み）</h2>
              )}

              {/* ページネーション・全選択・検索（DB読み込みの場合のみ）*/}
              {parseResult.mode === 'db' && parseResult.stats && (
                <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: currentPage === 1 ? '#ccc' : '#666',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      前へ
                    </button>
                    <span style={{ fontSize: '0.9rem' }}>
                      ページ {currentPage} / {displayTotalPages}
                    </span>
                    <button
                      onClick={() => currentPage < displayTotalPages && setCurrentPage(currentPage + 1)}
                      disabled={currentPage === displayTotalPages}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: currentPage === displayTotalPages ? '#ccc' : '#666',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: currentPage === displayTotalPages ? 'not-allowed' : 'pointer',
                      }}
                    >
                      次へ
                    </button>
                    <button
                      onClick={() => { setCurrentPage(1); handleLoadFromDb(1); }}
                      disabled={loading}
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.85rem',
                        backgroundColor: loading ? '#ccc' : '#0070f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      🔄 再読み込み
                    </button>
                    <button
                      onClick={() => toggleAllSelection(displayWorks)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#666',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      {selectedWorks.size === displayWorks.length ? '全て解除' : '全て選択'}
                    </button>
                    <span style={{ fontSize: '0.9rem' }}>
                      選択中: <strong>{selectedWorks.size}</strong> / {displayWorks.length}件
                    </span>
                  </div>
                  {/* 検索・絞り込み（右側）*/}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    {!showOnlyNeedsReview ? (
                      <button
                        onClick={async () => { setShowOnlyNeedsReview(true); await handleLoadFromDb(1, true); }}
                        disabled={loading}
                        style={{ padding: '4px 10px', fontSize: '0.85rem', backgroundColor: loading ? '#ccc' : '#f0f0f0', color: '#555', border: '1px solid #ccc', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer' }}
                      >
                        要確認のみ表示
                      </button>
                    ) : (
                      <>
                        <span style={{ fontSize: '0.9rem', color: '#333', fontWeight: 500 }}>要確認のみ表示中</span>
                        <button
                          onClick={handleCheckCompleteNeedsReview}
                          disabled={loading || selectedWorks.size === 0}
                          style={{ padding: '4px 12px', fontSize: '0.85rem', backgroundColor: (loading || selectedWorks.size === 0) ? '#ccc' : '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: (loading || selectedWorks.size === 0) ? 'not-allowed' : 'pointer' }}
                        >
                          選択した作品をチェック完了に{selectedWorks.size > 0 ? ` (${selectedWorks.size}件)` : ''}
                        </button>
                        {displayWorks.length === 0 && (
                          <button
                            onClick={async () => { setShowOnlyNeedsReview(false); await handleLoadFromDb(1, false); }}
                            disabled={loading}
                            style={{ padding: '4px 10px', fontSize: '0.85rem', backgroundColor: loading ? '#ccc' : '#f0f0f0', color: '#555', border: '1px solid #ccc', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer' }}
                          >
                            一覧に戻る
                          </button>
                        )}
                      </>
                    )}
                    <input
                      type="text"
                      value={searchTitle}
                      onChange={(e) => { setSearchTitle(e.target.value); setCurrentPage(1); }}
                      placeholder="タイトル検索"
                      style={{ padding: '8px 10px', width: '140px', fontSize: '0.85rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                    <input
                      type="text"
                      value={searchCircleName}
                      onChange={(e) => { setSearchCircleName(e.target.value); setCurrentPage(1); }}
                      placeholder="サークル名検索"
                      style={{ padding: '8px 10px', width: '140px', fontSize: '0.85rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    />
                    <select
                      value={filterIsAi}
                      onChange={(e) => { setFilterIsAi(e.target.value as typeof filterIsAi); setCurrentPage(1); }}
                      style={{ padding: '8px 10px', fontSize: '0.85rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    >
                      <option value="all">isAi: すべて</option>
                      <option value="AI">AIのみ</option>
                      <option value="HAND">HANDのみ</option>
                      <option value="UNKNOWN">UNKNOWN</option>
                    </select>
                    <select
                      value={filterTagCount}
                      onChange={(e) => { setFilterTagCount(e.target.value as typeof filterTagCount); setCurrentPage(1); }}
                      style={{ padding: '8px 10px', fontSize: '0.85rem', border: '1px solid #ccc', borderRadius: '4px' }}
                    >
                      <option value="all">タグ数: すべて</option>
                      <option value="0-5">0〜5</option>
                      <option value="5-10">5〜10</option>
                      <option value="11+">11以上</option>
                    </select>
                    <span style={{ fontSize: '0.9rem', color: '#333', fontWeight: 'bold' }}>
                      {filteredTotal < totalWorks ? (
                        <>絞り込み: <strong style={{ color: '#0066cc' }}>{filteredTotal}</strong> 件（全{totalWorks}件中）</>
                      ) : (
                        <>{filteredTotal} 件</>
                      )}
                    </span>
                  </div>
                </div>
              )}

              {/* 作品一覧（テーブル形式）*/}
              <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#e0e0e0', borderBottom: '2px solid #ddd' }}>
                      <th style={{ padding: '4px 6px', textAlign: 'center', width: '36px' }}>
                        <input
                          type="checkbox"
                          checked={selectedWorks.size === displayWorks.length && displayWorks.length > 0}
                          onChange={() => toggleAllSelection(displayWorks)}
                        />
                      </th>
                      <th
                        style={{ padding: '4px 6px', textAlign: 'left', minWidth: '160px', cursor: 'pointer', color: '#0066cc', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                        onClick={() => { setSortBy('title'); setSortOrder(sortBy === 'title' ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc'); setCurrentPage(1); }}
                        title="クリックで並び替え"
                      >
                        タイトル ⇅ {sortBy === 'title' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        style={{ padding: '4px 6px', textAlign: 'left', minWidth: '120px', cursor: 'pointer', color: '#0066cc', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                        onClick={() => { setSortBy('circleName'); setSortOrder(sortBy === 'circleName' ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc'); setCurrentPage(1); }}
                        title="クリックで並び替え"
                      >
                        サークル名 ⇅ {sortBy === 'circleName' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: '4px 6px', textAlign: 'left', minWidth: '360px' }}>
                        タグ
                        <div style={{ fontSize: '9px', fontWeight: 'normal', color: '#666', marginTop: '1px' }}>
                          <span style={{ backgroundColor: '#e8d5ff', padding: '1px 3px', borderRadius: '3px', marginRight: '3px' }}>S</span>
                          <span style={{ backgroundColor: '#d4edda', padding: '1px 3px', borderRadius: '3px', marginRight: '3px' }}>A</span>
                          <span style={{ backgroundColor: '#fff3cd', padding: '1px 3px', borderRadius: '3px', marginRight: '3px' }}>B</span>
                          <span style={{ backgroundColor: '#e9ecef', padding: '1px 3px', borderRadius: '3px', marginRight: '3px' }}>★未分類</span>
                          <span style={{ backgroundColor: '#cfe2ff', padding: '1px 3px', borderRadius: '3px' }}>X</span>
                        </div>
                      </th>
                      <th style={{ padding: '4px 6px', textAlign: 'left', width: '44px' }}>isAi</th>
                      <th
                        style={{ padding: '4px 6px', textAlign: 'left', width: '72px', cursor: 'pointer', color: '#0066cc', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                        onClick={() => { setSortBy('popularity'); setSortOrder(sortBy === 'popularity' ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'desc'); setCurrentPage(1); }}
                        title="クリックで並び替え"
                      >
                        有名度 ⇅ {sortBy === 'popularity' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th
                        style={{ padding: '4px 6px', textAlign: 'left', width: '88px', cursor: 'pointer', color: '#0066cc', textDecoration: 'underline', textUnderlineOffset: '2px' }}
                        onClick={() => { setSortBy('releaseDate'); setSortOrder(sortBy === 'releaseDate' ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc'); setCurrentPage(1); }}
                        title="クリックで並び替え"
                      >
                        発売日 ⇅ {sortBy === 'releaseDate' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </th>
                      <th style={{ padding: '4px 6px', textAlign: 'left', width: '72px' }}>操作</th>
                      <th style={{ padding: '4px 6px 4px 20px', textAlign: 'center', width: '40px' }}>⚠️</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayWorks.map((work, index) => {
                      const result = analysisResults[work.workId];
                      return (
                        <tr
                          key={work.workId}
                          style={{
                            borderBottom: '1px solid #ddd',
                            backgroundColor: work.isDuplicate ? '#fff3cd' : (index % 2 === 0 ? 'white' : '#fafafa'),
                          }}
                        >
                          <td style={{ padding: '4px 6px', textAlign: 'center', verticalAlign: 'top' }}>
                            <input
                              type="checkbox"
                              checked={selectedWorks.has(work.workId)}
                              onChange={() => toggleWorkSelection(work.workId)}
                            />
                          </td>
                          <td style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '0.15rem' }}>
                              {work.title}
                              {work.isDuplicate && (
                                <span
                                  style={{
                                    marginLeft: '0.35rem',
                                    padding: '0.1rem 0.3rem',
                                    backgroundColor: '#ffc107',
                                    color: '#000',
                                    borderRadius: '3px',
                                    fontSize: '0.65rem',
                                  }}
                                >
                                  重複
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {work.productUrl && (
                                <a
                                  href={work.productUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontSize: '0.75rem', color: '#0070f3' }}
                                >
                                  🔗 リンク
                                </a>
                              )}
                              {work.scrapedAt && (
                                <span style={{ fontSize: '0.7rem', color: '#888' }}>
                                  作成日時: {new Date(work.scrapedAt).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '4px 6px', fontSize: '11px', verticalAlign: 'top' }}>{work.circleName}</td>
                          <td style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
                              {/* S（有名タグ） */}
                              {work.officialTags && work.officialTags.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '2px' }}>
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
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {/* A/B/C/★（準有名タグ） */}
                              {result?.derivedTags && result.derivedTags.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '2px' }}>
                                  {result.derivedTags.map((tag, i) => {
                                    const rank = tag.rank || '';
                                    const chip = rank === 'A' ? RANK_CHIP.A : rank === 'B' ? RANK_CHIP.B : rank === 'C' ? RANK_CHIP.C : { bg: '#e9ecef', border: '#6c757d', text: '#495057' };
                                    const rankLabel = rank === 'A' ? 'A' : rank === 'B' ? 'B' : rank === 'C' ? 'C' : '';
                                    return (
                                      <span
                                        key={`d-${i}`}
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                          backgroundColor: chip.bg,
                                          border: `1px solid ${chip.border}`,
                                          padding: '2px 6px',
                                          borderRadius: '10px',
                                          fontSize: '11px',
                                          color: chip.text,
                                        }}
                                        title={rank ? `ランク: ${rank}` : '未分類'}
                                      >
                                        {rankLabel && <span style={{ fontWeight: 'bold', opacity: 0.9 }}>{rankLabel}</span>}
                                        {tag.displayName}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                              {/* X（キャラクタータグ） */}
                              {result?.characterTags && result.characterTags.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                  {result.characterTags.map((tag, i) => (
                                    <span
                                      key={`x-${i}`}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        backgroundColor: RANK_CHIP.X.bg,
                                        border: `1px solid ${RANK_CHIP.X.border}`,
                                        padding: '2px 6px',
                                        borderRadius: '10px',
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        color: RANK_CHIP.X.text,
                                      }}
                                      title="キャラクター"
                                    >
                                      X {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {(!work.officialTags || work.officialTags.length === 0) && (!result?.derivedTags || result.derivedTags.length === 0) && (!result?.characterTags || result.characterTags.length === 0) && (
                                <span style={{ color: '#999', fontSize: '11px' }}>タグなし</span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                            <span
                              style={{
                                padding: '2px 4px',
                                backgroundColor: work.isAi === 'AI' ? '#fff3cd' : work.isAi === 'HAND' ? '#d4edda' : '#f8d7da',
                                borderRadius: '3px',
                                fontSize: '10px',
                              }}
                            >
                              {work.isAi}
                            </span>
                          </td>
                          <td style={{ padding: '4px 6px', fontSize: '11px', fontWeight: 'bold', verticalAlign: 'top' }}>
                            {Math.round(work.popularityBase)}+{Math.round(work.popularityPlayBonus)}
                          </td>
                          <td style={{ padding: '4px 6px', fontSize: '11px', verticalAlign: 'top', whiteSpace: 'nowrap', color: '#333' }}>
                            {formatReleaseDateOnly(work.releaseDate)}
                          </td>
                          <td style={{ padding: '4px 6px', verticalAlign: 'top' }}>
                            <button
                              onClick={() => setShowCommentModal({ workId: work.workId, comment: work.commentText ?? '' })}
                              style={{
                                padding: '2px 6px',
                                fontSize: '11px',
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
                          <td style={{ padding: '4px 6px 4px 20px', verticalAlign: 'top', textAlign: 'center' }}>
                            {parseResult.mode === 'db' && adminToken && (
                              <button
                                onClick={() => handleMoveToNeedsReview(work.workId)}
                                style={{
                                  padding: '1px 4px',
                                  fontSize: '12px',
                                  lineHeight: 1,
                                  backgroundColor: 'transparent',
                                  color: '#dc3545',
                                  border: '1px solid #dc3545',
                                  borderRadius: '3px',
                                  cursor: 'pointer',
                                }}
                                title="要注意フォルダへ移動"
                              >
                                ⚠️
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* 作品リスト右下: 選択を一括で要注意に */}
              {parseResult.mode === 'db' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem', paddingTop: '0.35rem' }}>
                  <button
                    type="button"
                    title="チェックした作品をすべて要注意にします"
                    disabled={selectedWorks.size === 0 || moveSelectedToNeedsReviewLoading}
                    onClick={handleMoveSelectedToNeedsReview}
                    style={{
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.8rem',
                      cursor: selectedWorks.size === 0 || moveSelectedToNeedsReviewLoading ? 'not-allowed' : 'pointer',
                      backgroundColor: selectedWorks.size === 0 || moveSelectedToNeedsReviewLoading ? '#e9ecef' : '#fd7e14',
                      color: selectedWorks.size === 0 || moveSelectedToNeedsReviewLoading ? '#adb5bd' : '#fff',
                      border: 'none',
                      borderRadius: '4px',
                    }}
                  >
                    {moveSelectedToNeedsReviewLoading ? '処理中…' : `選択しているものをすべて要注意にする${selectedWorks.size > 0 ? ` (${selectedWorks.size}件)` : ''}`}
                  </button>
                </div>
              )}
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
                      
                      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flexShrink: 0 }}>
                          <img
                            src={work.thumbnailUrl?.startsWith('http') ? work.thumbnailUrl : `/api/thumbnail?workId=${encodeURIComponent(work.workId)}`}
                            alt="表紙"
                            style={{ width: '120px', height: 'auto', borderRadius: '4px', border: '1px solid #ddd' }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <div style={{ marginBottom: '0.5rem' }}>
                            <strong>サークル:</strong> {work.circleName}
                          </div>
                          <div style={{ marginBottom: '0.5rem' }}>
                            <strong>isAi:</strong> {work.isAi}
                          </div>
                          {parseResult.mode === 'db' && (
                            <div style={{ marginBottom: '0.5rem' }}>
                              <strong>現在のフォルダ:</strong>{' '}
                              {(() => {
                                const folder = (work as { manualTaggingFolder?: string | null }).manualTaggingFolder;
                                const labels: Record<string, string> = { tagged: 'タグ済', needs_review: '要注意', needs_human_check: '人間確認', pending: 'チェック待ち', legacy_ai: '旧AIタグ', has_issues: '問題あり', untagged: '未タグ', ab_test: 'ABテスト', priority_untagged_1: '未タグ（優先順位①）', priority_untagged_2: '未タグ（優先順位②）' };
                                return folder ? (labels[folder] ?? folder) : '（未設定）';
                              })()}
                            </div>
                          )}
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
                            <strong>作成日時:</strong> {work.scrapedAt ? new Date(work.scrapedAt).toLocaleString('ja-JP') : '-'}
                          </div>
                          {/* 新フィールド */}
                        {work.contentId && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <strong>content_id:</strong> {work.contentId}
                          </div>
                        )}
                        {work.releaseDate && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <strong>発売日:</strong> {formatReleaseDateOnly(work.releaseDate)}
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
                        </div>
                      </div>

                      {/* Phase0 のタグ付け理由 */}
                      {work.lastTaggingReasoning && Object.keys(work.lastTaggingReasoning).length > 0 && (
                        <div style={{ padding: '0.6rem', background: '#f0f4f8', border: '1px solid #c9d6e3', borderRadius: '6px', marginBottom: '0.5rem' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.35rem' }}>Phase0 のタグ付け理由</div>
                          <div style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                            {Object.entries(work.lastTaggingReasoning).map(([k, v]) => (
                              <div key={k} style={{ marginBottom: '0.2rem' }}><span style={{ color: '#666' }}>{k}:</span> {String(v)}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Phase1 のチェック判断理由 */}
                      {(work.lastCheckReasoning && Object.keys(work.lastCheckReasoning).length > 0) && (
                        <div style={{ padding: '0.6rem', background: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '6px', marginBottom: '0.5rem' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.35rem' }}>Phase1 のチェック判断理由</div>
                          <div style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                            {Object.entries(work.lastCheckReasoning).map(([k, v]) => (
                              <div key={k} style={{ marginBottom: '0.2rem' }}><span style={{ color: '#666' }}>{k}:</span> {String(v)}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AIチェックによる修正提案 */}
                      {work.lastCheckTagChanges && (
                        (work.lastCheckTagChanges.added?.length ?? 0) > 0 ||
                        (work.lastCheckTagChanges.removed?.length ?? 0) > 0 ||
                        (work.lastCheckTagChanges.newProposal ?? '').trim() ? (
                        <div style={{ padding: '0.6rem', background: '#f0f8ff', border: '1px solid #b8d4e8', borderRadius: '6px', marginBottom: '0.5rem' }}>
                          <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>AIチェックによる修正提案</div>
                          {work.lastCheckTagChanges.added && work.lastCheckTagChanges.added.length > 0 && (
                            <div style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                              <span style={{ color: '#0d6efd', fontWeight: 'bold' }}>追加推奨:</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.2rem' }}>
                                {work.lastCheckTagChanges.added.map((tag) => (
                                  <span key={tag} style={{ padding: '0.1rem 0.3rem', backgroundColor: '#e7f1ff', borderRadius: '4px', fontSize: '0.8rem' }}>{tag}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {work.lastCheckTagChanges.removed && work.lastCheckTagChanges.removed.length > 0 && (
                            <div style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                              <span style={{ color: '#dc3545', fontWeight: 'bold' }}>削除推奨:</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.2rem' }}>
                                {work.lastCheckTagChanges.removed.map((tag) => (
                                  <span key={tag} style={{ padding: '0.1rem 0.3rem', backgroundColor: '#ffe7e7', borderRadius: '4px', fontSize: '0.8rem' }}>{tag}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {work.lastCheckTagChanges.newProposal?.trim() && (
                            <div style={{ fontSize: '0.8rem' }}>
                              <span style={{ fontWeight: 'bold' }}>その他:</span> {work.lastCheckTagChanges.newProposal}
                            </div>
                          )}
                        </div>
                      ) : null)}

                      {parseResult.mode === 'db' && adminToken && (
                        <div style={{ marginBottom: '1rem' }}>
                          <button
                            onClick={() => handleMoveToNeedsReview(work.workId)}
                            style={{
                              padding: '0.5rem 1rem',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.9rem',
                            }}
                          >
                            ⚠️ 要注意フォルダへ移動
                          </button>
                        </div>
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

      {activeTab === 'recFamous' && (
        <section style={{ marginBottom: '2rem' }}>
          <RecommendFamousTagsTab adminToken={adminToken} />
        </section>
      )}

      {/* タブコンテンツ コンフィグ */}
      {activeTab === 'config' && (
        <ConfigTab
          config={config}
          configLoading={configLoading}
          configSaving={configSaving}
          configMessage={configMessage}
          debugEnabled={debugEnabled}
          loadConfig={loadConfig}
          handleConfigSave={handleConfigSave}
          handleDebugToggle={handleDebugToggle}
          updateConfig={updateConfig}
          fieldDesc={fieldDesc}
        />
      )}

      {/* タブコンテンツ 作品インポート */}
      {activeTab === 'import' && (
        <section style={{ marginBottom: '2rem' }}>
          <ImportWorkflow />

          {/* 旧機能（非表示・コード残す） */}
          <details style={{ display: 'none', marginTop: '30px' }}>
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
                <label htmlFor="dmmImportSort" style={{ fontSize: '0.9rem' }}>ソート:</label>
                <select
                  id="dmmImportSort"
                  value={dmmImportSort}
                  onChange={(e) => setDmmImportSort(e.target.value as 'rank' | 'review' | 'date')}
                  disabled={dmmImporting}
                  style={{
                    padding: '0.5rem',
                    fontSize: '0.9rem',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                  }}
                >
                  <option value="rank">人気順</option>
                  <option value="review">レビュー順</option>
                  <option value="date">発売日順</option>
                </select>
              </div>
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
              onClick={() => handleLoadFromDb(1)}
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
                  onClick={() => toggleAllSelection(parseResult.works)}
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

      {/* タブコンテンツ 作品頭文字 */}
      {activeTab === 'initial' && (
        <TitleReadingInitialTab adminToken={adminToken} />
      )}

      {/* タブコンテンツ シミュレーション */}
      {activeTab === 'simulate' && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>シミュレーション</h2>
          <p style={{ color: '#666', marginBottom: '0.5rem' }}>
            指定した作品を「正解」として自動でゲームをプレイし、アルゴリズムの精度を検証します。
          </p>
          {simWorksStats !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <p style={{ margin: 0, fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>
                ゲーム有効: <span style={{ color: '#28a745' }}>{simWorksStats.gameRegisteredCount.toLocaleString()}</span>
                {' / '}
                全作品: <span style={{ color: '#666' }}>{simWorksStats.totalWorks.toLocaleString()}</span>
                {' 作品'}
              </p>
              <button
                onClick={handleRegenerateMatrix}
                disabled={simMatrixRegenerating || !adminToken}
                title="シミュレーション前に押すと WorkTag 行列を最新化します"
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.9rem',
                  backgroundColor: simMatrixRegenerating || !adminToken ? '#ccc' : '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: simMatrixRegenerating || !adminToken ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                }}
              >
                {simMatrixRegenerating ? '再生成中...' : '行列を再生成'}
              </button>
            </div>
          )}

          {/* 設定パネル（コンパクト） */}
          <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>サンプル数</label>
                <input
                  type="number"
                  min="0"
                  value={simSampleSize}
                  onChange={(e) => setSimSampleSize(Math.max(0, Number(e.target.value)))}
                  style={{ width: '80px', padding: '0.4rem', border: '1px solid #ccc', borderRadius: '4px' }}
                />
                <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '0.25rem' }}>（0=全件）</span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>曖昧さレベル 1-10</label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={simAmbiguityLevel}
                  onChange={(e) => setSimAmbiguityLevel(Number(e.target.value))}
                  style={{ width: '120px', verticalAlign: 'middle' }}
                />
                <span style={{ fontSize: '0.85rem', marginLeft: '0.5rem' }}>{simAmbiguityLevel}</span>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>AIゲート</label>
                <select
                  value={simAiGateChoice}
                  onChange={(e) => setSimAiGateChoice(e.target.value)}
                  style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="BOTH">両方</option>
                  <option value="AI_ONLY">AIのみ</option>
                  <option value="HAND_ONLY">手描きのみ</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem', fontWeight: 'bold' }}>試行回数/作品</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={simTrialsPerWork}
                  onChange={(e) => setSimTrialsPerWork(Number(e.target.value))}
                  style={{ width: '80px' }}
                />
                <span style={{ fontSize: '0.85rem', marginLeft: '0.25rem' }}>{simTrialsPerWork}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="sim-single-request"
                  checked={simUseSingleRequest}
                  onChange={(e) => setSimUseSingleRequest(e.target.checked)}
                />
                <label htmlFor="sim-single-request" style={{ fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer' }} title="HTTP往復を1回に抑えて高速化（進捗は完了時のみ）">
                  全件1回送信（高速）
                </label>
              </div>
              <button
                onClick={async () => {
                  if (simSampleSize > 5000 && simSampleSize < 10000 && !confirm(`${simSampleSize}件は時間がかかります。続行しますか？`)) return;
                  if (simSampleSize >= 10000 && !confirm(`${simSampleSize}件はかなり時間がかかります。本当に続行しますか？`)) return;
                  setSimBatchLoading(true);
                  setSimBatchResult(null);
                  const simStartTime = Date.now();
                  setProgress('simulate', { done: 0, total: 1, phase: '準備中...', startTime: simStartTime });
                  try {
                    if (!adminToken) {
                      alert('管理トークンを入力してください');
                      setSimBatchLoading(false);
                      return;
                    }
                    const idsRes = await fetch(`/api/admin/simulate?sampleSize=${simSampleSize || 0}`, {
                      headers: { 'x-eronator-admin-token': adminToken },
                    });
                    if (!idsRes.ok) throw new Error('サンプル取得に失敗しました');
                    const { workIds } = (await idsRes.json()) as { workIds: string[] };
                    const totalTrials = workIds.length * simTrialsPerWork;
                    setProgress('simulate', { done: 0, total: totalTrials, phase: '実行中', startTime: simStartTime });
                    const CHUNK_SIZE = 100;
                    const allResults: Array<{ workId: string; title: string; success: boolean; questionCount: number; outcome: string; steps?: unknown; workDetails?: unknown; diagnostic?: unknown; analysisData?: { wasNoisyCount: number; firstNoisyStepIndex: number; noisyStepIndices: number[]; correctRank: number; top1Confidence: number; totalQuestions?: number; noisyRatio?: number }; errorMessage?: string; perfSummary?: Record<string, number> }> = [];
                    let doneCount = 0;
                    let totalWorksInDb = 0;
                    const chunkTimings: Array<{ chunk: number; doneCount: number; elapsedMs: number }> = [];

                    if (simUseSingleRequest) {
                      setProgress('simulate', { done: 0, total: totalTrials, phase: '実行中（1回送信）', startTime: simStartTime });
                      const response = await fetch('/api/admin/simulate', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
                        body: JSON.stringify({
                          workIds,
                          ambiguityLevel: simAmbiguityLevel,
                          aiGateChoice: simAiGateChoice,
                          trialsPerWork: simTrialsPerWork,
                          includePerf: true,
                          parallelCount: 20,
                          totalTrials,
                          doneOffset: 0,
                        }),
                      });
                      if (!response.ok) {
                        const err = await response.json();
                        throw new Error(err.error || 'Batch simulation failed');
                      }
                      const data = (await response.json()) as { results: typeof allResults; metadata?: { totalWorksInDb?: number } };
                      allResults.push(...data.results);
                      if (data.metadata?.totalWorksInDb) totalWorksInDb = data.metadata.totalWorksInDb;
                      doneCount = data.results.length;
                      chunkTimings.push({ chunk: 1, doneCount, elapsedMs: Date.now() - simStartTime });
                    } else {
                      for (let i = 0; i < workIds.length; i += CHUNK_SIZE) {
                        const chunkStart = Date.now();
                        const chunk = workIds.slice(i, i + CHUNK_SIZE);
                        const doneOffset = i * simTrialsPerWork;
                        const response = await fetch('/api/admin/simulate', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
                          body: JSON.stringify({
                            workIds: chunk,
                            ambiguityLevel: simAmbiguityLevel,
                            aiGateChoice: simAiGateChoice,
                            trialsPerWork: simTrialsPerWork,
                            includePerf: true,
                            parallelCount: 20,
                            totalTrials,
                            doneOffset,
                          }),
                        });
                        if (!response.ok) {
                          const err = await response.json();
                          throw new Error(err.error || 'Batch simulation failed');
                        }
                        const data = (await response.json()) as { results: typeof allResults; metadata?: { totalWorksInDb?: number } };
                        allResults.push(...data.results);
                        if (data.metadata?.totalWorksInDb) totalWorksInDb = data.metadata.totalWorksInDb;
                        doneCount += data.results.length;
                        chunkTimings.push({ chunk: Math.floor(i / CHUNK_SIZE) + 1, doneCount, elapsedMs: Date.now() - chunkStart });
                        const elapsedTotal = Date.now() - simStartTime;
                        const avgMsPerItem = elapsedTotal / doneCount;
                        const remainItems = totalTrials - doneCount;
                        const etaSec = Math.round((avgMsPerItem * remainItems) / 1000);
                        const lastChunkSec = ((Date.now() - chunkStart) / 1000).toFixed(1);
                        setProgress('simulate', {
                          done: doneCount,
                          total: totalTrials,
                          phase: `実行中 | 直近${lastChunkSec}s | 残り約${etaSec}s`,
                          startTime: simStartTime,
                        });
                      }
                    }
                    const successCount = allResults.filter((r) => r.success).length;
                    const totalQuestions = allResults.reduce((s, r) => s + r.questionCount, 0);
                    const failureSummary: Record<string, number> = {};
                    const failures = allResults.filter((r) => !r.success);
                    for (const f of failures) {
                      failureSummary[f.outcome] = (failureSummary[f.outcome] ?? 0) + 1;
                    }
                    const durationSeconds = Math.round((Date.now() - simStartTime) / 1000);
                    // localStorage に履歴保存
                    try {
                      const simHist = JSON.parse(localStorage.getItem('sim-history') || '[]') as Array<Record<string, unknown>>;
                      simHist.unshift({
                        timestamp: new Date().toISOString(),
                        sampleSize: workIds.length,
                        trialsPerWork: simTrialsPerWork,
                        totalTrials,
                        successCount,
                        successRate: allResults.length > 0 ? Math.round((successCount / allResults.length) * 100) / 100 : 0,
                        durationSeconds,
                        avgSecPerItem: allResults.length > 0 ? Math.round((durationSeconds / allResults.length) * 10) / 10 : 0,
                        chunkTimings,
                      });
                      if (simHist.length > 20) simHist.length = 20;
                      localStorage.setItem('sim-history', JSON.stringify(simHist));
                    } catch {}
                    setProgress('simulate', { done: totalTrials, total: totalTrials, phase: `完了 ${durationSeconds}秒`, startTime: simStartTime });
                    const failureAnalysis = failures.length > 0 ? (() => {
                      const withAnalysis = failures.filter((f: { analysisData?: { wasNoisyCount: number } }) => f.analysisData);
                      const withDiag = failures.filter((f) => f.diagnostic);
                      return {
                        failureCount: failures.length,
                        avgWasNoisyCount: withAnalysis.length > 0
                          ? Math.round((withAnalysis.reduce((s: number, f: { analysisData?: { wasNoisyCount: number } }) => s + (f.analysisData!.wasNoisyCount), 0) / withAnalysis.length) * 100) / 100
                          : null,
                        avgCorrectRank: withDiag.length > 0
                          ? Math.round((withDiag.reduce((s: number, f) => s + ((f.diagnostic as { correctRank: number }).correctRank), 0) / withDiag.length) * 100) / 100
                          : null,
                        avgTop1Confidence: withDiag.length > 0
                          ? Math.round((withDiag.reduce((s: number, f) => s + ((f.diagnostic as { top1Confidence: number }).top1Confidence), 0) / withDiag.length) * 10000) / 10000
                          : null,
                      };
                    })() : null;
                    setSimBatchResult({
                      totalTrials: allResults.length,
                      successCount,
                      successRate: allResults.length > 0 ? Math.round((successCount / allResults.length) * 100) / 100 : 0,
                      avgQuestions: allResults.length > 0 ? Math.round((totalQuestions / allResults.length) * 10) / 10 : 0,
                      results: allResults,
                      failureSummary,
                      failureAnalysis,
                      metadata: {
                        timestamp: new Date().toISOString(),
                        sampleSize: workIds.length,
                        totalWorksInDb: totalWorksInDb || (simWorksStats?.gameRegisteredCount ?? 0),
                        ambiguityLevel: simAmbiguityLevel,
                        aiGateChoice: simAiGateChoice,
                        trialsPerWork: simTrialsPerWork,
                        durationSeconds,
                      },
                    } as Parameters<typeof setSimBatchResult>[0]);
                    setSimResultPage(0);
                  } catch (error) {
                    console.error('Batch simulation error:', error);
                    alert(error instanceof Error ? error.message : 'バッチシミュレーションに失敗しました');
                  } finally {
                    setSimBatchLoading(false);
                    setTimeout(() => setProgress('simulate', null), 15000);
                  }
                }}
                  disabled={simBatchLoading}
                  style={{
                    padding: '0.5rem 1.5rem',
                    background: simBatchLoading ? '#ccc' : '#ff6600',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: simBatchLoading ? 'default' : 'pointer',
                    fontSize: '0.95rem',
                  }}
                >
                  {simBatchLoading ? '実行中...' : simSampleSize > 0 ? `${simSampleSize}件で実行` : '全件で実行'}
                </button>
            </div>
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
                        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
                        body: JSON.stringify({
                          targetWorkId: simResult.targetWorkId,
                          ambiguityLevel: simAmbiguityLevel,
                          aiGateChoice: simAiGateChoice,
                          includePerf: true,
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

              <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                <span>{(simResult as { success?: boolean }).success ? '成功' : '失敗'} | <strong>作品:</strong> {simResult.targetWorkTitle} | <strong>最終:</strong> {simResult.finalWorkTitle || '(なし)'} | <strong>結果:</strong> {simResult.outcome}</span>
              </div>
              <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                質問数: {simResult.questionCount}問
                {((simResult as { diagnostic?: { correctRank?: number }; analysisData?: { correctRank?: number } }).diagnostic?.correctRank ?? (simResult as { analysisData?: { correctRank?: number } }).analysisData?.correctRank) != null && (
                  <>
                    {' | '}
                    正解の順位: {(() => {
                      const rank = (simResult as { diagnostic?: { correctRank?: number }; analysisData?: { correctRank?: number } }).diagnostic?.correctRank ?? (simResult as { analysisData?: { correctRank?: number } }).analysisData?.correctRank;
                      return rank === -1 ? '候補外' : `${rank}位`;
                    })()}
                  </>
                )}
              </div>
              {simResult.errorMessage && (
                <div style={{ marginBottom: '0.5rem', padding: '0.5rem', background: '#ffebee', borderRadius: '4px', fontSize: '0.85rem' }}>
                  <strong>エラー:</strong> {simResult.errorMessage}
                </div>
              )}
              {(simResult as { workDetails?: { tags?: Array<{ tagKey?: string; displayName: string; tagType?: string }> } }).workDetails?.tags && (simResult as { workDetails?: { tags?: Array<{ displayName: string }> } }).workDetails!.tags!.length > 0 && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>作品のタグ:</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.25rem' }}>
                    {((simResult as { workDetails?: { tags?: Array<{ tagKey?: string; displayName: string; tagType?: string }> } }).workDetails!.tags!)
                      .sort((a, b) => {
                        const order = { OFFICIAL: 0, DERIVED: 1, STRUCTURAL: 2 };
                        return (order[(a.tagType ?? '') as keyof typeof order] ?? 3) - (order[(b.tagType ?? '') as keyof typeof order] ?? 3);
                      })
                      .map((t, i) => {
                        const wasAsked = simResult.steps?.some((s: { question?: { tagKey?: string; displayText?: string } }) =>
                          (s.question?.tagKey === t.tagKey) || (s.question?.displayText?.includes(t.displayName))
                        );
                        return (
                          <span
                            key={t.tagKey ?? t.displayName ?? i}
                            style={{
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              background: t.tagType === 'OFFICIAL' ? RANK_BG.S : t.tagType === 'DERIVED' ? RANK_BG.B : RANK_BG.X,
                              color: t.tagType === 'OFFICIAL' ? RANK_TEXT.S : t.tagType === 'DERIVED' ? RANK_TEXT.B : RANK_TEXT.X,
                              border: wasAsked ? '2px solid #4caf50' : '1px solid #ccc',
                              fontWeight: wasAsked ? 'bold' : 'normal',
                            }}
                            title={wasAsked ? '質問で使用' : undefined}
                          >
                            {t.displayName}{wasAsked && ' ✓'}
                          </span>
                        );
                      })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '0.65rem', marginTop: '0.5rem', flexWrap: 'wrap', width: '100%' }}>
                <div style={{ flex: '0 0 auto' }}>
              {/* 計測結果（開こうとしたら開ける・デフォルト閉じ） */}
              {simResult.perfSummary && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setSimPerfExpanded(!simPerfExpanded)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      background: '#f5f5f5',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                    }}
                  >
                    {simPerfExpanded ? '▼ 計測 (ms) を閉じる' : '▶ 計測 (ms) を開く'}
                  </button>
                  {simPerfExpanded && (
                    <div style={{ 
                      marginTop: '0.5rem',
                      padding: '1rem', 
                      background: '#f5f5f5', 
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem'
                    }}>
                      <div>
                        runSimulation: {simResult.perfSummary.runSimulation}ms | selectNextQuestion: {simResult.perfSummary.selectNextQuestion}ms | processAnswer: {simResult.perfSummary.processAnswer}ms | fetchWorkTags: {simResult.perfSummary.fetchWorkTags}ms | tagCoverage: {simResult.perfSummary.tagCoverage}ms
                      </div>
                      {(simResult.perfSummary.buildUsedTagKeysFromHistory != null || simResult.perfSummary.selectUnifiedExploreOrSummary != null) && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#555' }}>
                          selectNextQuestion内訳: buildUsedTagKeysFromHistory: {simResult.perfSummary.buildUsedTagKeysFromHistory ?? 0}ms | selectUnifiedExploreOrSummary: {simResult.perfSummary.selectUnifiedExploreOrSummary ?? 0}ms | selectExploreQuestion: {simResult.perfSummary.selectExploreQuestion ?? 0}ms | selectNextQuestion_confirm: {simResult.perfSummary.selectNextQuestion_confirm ?? 0}ms | tryGetHardConfirmQuestion: {simResult.perfSummary.tryGetHardConfirmQuestion ?? 0}ms | tryEmergencyExploreFallback: {simResult.perfSummary.tryEmergencyExploreFallback ?? 0}ms
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ステップ詳細 & 作品詳細 */}
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                </div>
                <SimEarlyExitThresholdsSummary flow={config?.flow} />
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
                    overflowX: 'auto',
                    background: '#fff',
                    padding: '1rem',
                    borderRadius: '4px',
                    fontSize: '0.9rem'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                      <thead>
                        <tr style={{ background: '#f0f0f0' }}>
                          <th style={{ padding: '0.5rem', textAlign: 'left', width: '2.25rem' }}>Q#</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', minWidth: '280px' }}>質問</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center', width: '3.2rem' }}>回答</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center', whiteSpace: 'nowrap', minWidth: '3.35rem', boxSizing: 'border-box' }}>ノイズ</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right', width: '3.5rem' }}>p値</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right', width: '8.5rem', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>確度（①）</th>
                          <th style={{ padding: '0.5rem', textAlign: 'right', width: '7.75rem', minWidth: '7.75rem', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>候補（②）</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', width: '10%', minWidth: '5.5rem', maxWidth: '7.5rem', boxSizing: 'border-box' }}>早期失敗判定</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simResult.steps.map((step, i) => {
                          const isReveal = step.question.kind === 'REVEAL';
                          const revealSuccess = (step as any).revealResult === 'SUCCESS';
                          const revealMiss = (step as any).revealResult === 'MISS';
                          const ex = (step as { earlyExit?: import('@/types/earlyExitStepSnapshot').EarlyExitStepSnapshot }).earlyExit;
                          const eeOk = simEarlyExitOkInline[i] ?? { conf: false, cand: false };
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
                              <td style={{ padding: '0.5rem', minWidth: '280px' }}>
                                <span style={{ 
                                  display: 'inline-block',
                                  padding: '0.2rem 0.5rem',
                                  background: step.question.kind === 'EXPLORE_TAG' ? RANK_BG.S
                                    : step.question.kind === 'SOFT_CONFIRM' ? RANK_BG.B
                                    : step.question.kind === 'HARD_CONFIRM' ? RANK_BG.X
                                    : step.question.kind === 'SPECIAL_QUESTION' ? '#9c27b0'
                                    : step.question.kind === 'REVEAL' ? '#ffeb3b'
                                    : '#e0e0e0',
                                  color: step.question.kind === 'EXPLORE_TAG' ? RANK_TEXT.S : step.question.kind === 'SOFT_CONFIRM' ? RANK_TEXT.B : step.question.kind === 'HARD_CONFIRM' ? RANK_TEXT.X : step.question.kind === 'SPECIAL_QUESTION' ? '#fff' : undefined,
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
                                  {step.question.kind === 'HARD_CONFIRM' && (step.question as { hardConfirmType?: string }).hardConfirmType && (
                                    <span style={{ marginLeft: '0.25rem', opacity: 0.9 }}>
                                      {(step.question as { hardConfirmType?: string }).hardConfirmType === 'TITLE_INITIAL' ? '頭文字' : '作者'}
                                    </span>
                                  )}
                                  {step.question.kind === 'SPECIAL_QUESTION' && (step.question as { specialQuestionType?: string }).specialQuestionType && (
                                    <span style={{ marginLeft: '0.25rem', opacity: 0.9 }}>
                                      {(step.question as { specialQuestionType?: string }).specialQuestionType === 'SERIES' ? 'シリーズ' : (step.question as { specialQuestionType?: string }).specialQuestionType === 'TITLE_CHAR_TYPE' ? '文字種' : (step.question as { specialQuestionType?: string }).specialQuestionType}
                                    </span>
                                  )}
                                </span>
                                {(() => {
                                  const key = `simResult-${i}`;
                                  const editable = !isReveal && ((step.question.kind === 'EXPLORE_TAG' && step.question.exploreTagKind !== 'summary') || step.question.kind === 'SOFT_CONFIRM' || step.question.kind === 'SPECIAL_QUESTION');
                                  const isEditing = editingQuestionKey === key;
                                  if (editable && isEditing) {
                                    return (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.25rem' }}>
                                        <input
                                          type="text"
                                          value={editingQuestionValue}
                                          onChange={(e) => setEditingQuestionValue(e.target.value)}
                                          style={{ minWidth: '200px', padding: '0.2rem 0.4rem', fontSize: '0.9rem' }}
                                          autoFocus
                                        />
                                        <button type="button" onClick={() => handleSaveSimQuestionText('simResult', i, step, editingQuestionValue)} disabled={editingQuestionLoading} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>保存</button>
                                        <button type="button" onClick={() => { setEditingQuestionKey(null); }} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>キャンセル</button>
                                      </span>
                                    );
                                  }
                                  if (editable) {
                                    return (
                                      <span
                                        onClick={() => { setEditingQuestionKey(key); setEditingQuestionValue(step.question.displayText); }}
                                        style={{ marginLeft: '0.25rem', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                        title="クリックで編集"
                                      >
                                        {step.question.displayText}
                                      </span>
                                    );
                                  }
                                  return <span style={{ marginLeft: '0.25rem' }}>{step.question.displayText}</span>;
                                })()}
                                {(step as any).preferHighP && (
                                  <span style={{ marginLeft: '0.25rem', padding: '0.1rem 0.3rem', background: '#fff3e0', borderRadius: '4px', fontSize: '0.75rem' }}>当たり狙い</span>
                                )}
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
                                <span style={{ color: '#37474f', fontWeight: 600 }}>
                                  {step.answer}
                                </span>
                              </td>
                              <td style={{ padding: '0.5rem', textAlign: 'center', whiteSpace: 'nowrap', minWidth: '3.35rem', boxSizing: 'border-box' }}>
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
                              <td style={{ padding: '0.5rem', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <span style={{ color: '#37474f' }}>{(step.confidenceBefore * 100).toFixed(1)}%</span>
                                {!isReveal && (
                                  <>
                                    {' → '}
                                    <span
                                      style={{
                                        color: eeOk.conf ? EARLY_EXIT_OK_COLOR : '#37474f',
                                        fontWeight: eeOk.conf ? 600 : 400,
                                      }}
                                    >
                                      {(step.confidenceAfter * 100).toFixed(1)}%
                                    </span>
                                  </>
                                )}
                              </td>
                              <td style={{ padding: '0.5rem', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'normal' }}>
                                <span style={{
                                  color: eeOk.cand ? EARLY_EXIT_OK_COLOR : '#37474f',
                                  fontWeight: eeOk.cand ? 600 : 400,
                                }}>
                                  {(() => {
                                    const _c = ex?.effectiveCandidates ?? (step as any).effectiveCandidates;
                                    if (_c == null) return '-';
                                    const _n = typeof _c === 'number' ? _c : Number(_c);
                                    return Number.isFinite(_n) ? Math.floor(_n) : '-';
                                  })()}
                                </span>
                              </td>
                              <td style={{ padding: '0.5rem', textAlign: 'left', verticalAlign: 'top' }}>
                                <SimEarlyExitJudgmentColumnCell ex={ex} isReveal={isReveal} />
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
                      {'durationSeconds' in simBatchResult.metadata && typeof simBatchResult.metadata.durationSeconds === 'number' && (
                        <span style={{ marginLeft: '0.5rem' }}>
                          | シミュレーション時間: {Math.floor(simBatchResult.metadata.durationSeconds / 60)}分{simBatchResult.metadata.durationSeconds % 60}秒
                        </span>
                      )}
                    </span>
                  )}
                </h3>
                <button
                  onClick={async () => {
                    setSimSaving(true);
                    try {
                      const response = await fetch('/api/admin/simulate', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
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

              {/* 計測結果（1件目・開こうとしたら開ける・デフォルト閉じ） */}
              {simBatchResult.results?.[0]?.perfSummary && (
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setSimBatchPerfExpanded(!simBatchPerfExpanded)}
                    style={{
                      padding: '0.4rem 0.8rem',
                      background: '#fff3e0',
                      border: '1px solid #e0d0c0',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                    }}
                  >
                    {simBatchPerfExpanded ? '▼ 計測 (ms) 1件目 を閉じる' : '▶ 計測 (ms) 1件目 を開く'}
                  </button>
                  {simBatchPerfExpanded && (
                    <div style={{ 
                      marginTop: '0.5rem',
                      padding: '1rem', 
                      background: '#fff3e0', 
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem'
                    }}>
                      <div>
                        runSimulation: {simBatchResult.results[0].perfSummary.runSimulation}ms
                        {' | '}selectNextQuestion: {simBatchResult.results[0].perfSummary.selectNextQuestion}ms
                        {' | '}processAnswer: {simBatchResult.results[0].perfSummary.processAnswer}ms
                        {' | '}fetchWorkTags: {simBatchResult.results[0].perfSummary.fetchWorkTags}ms
                        {' | '}tagCoverage: {simBatchResult.results[0].perfSummary.tagCoverage}ms
                      </div>
                      {(simBatchResult.results[0].perfSummary.buildUsedTagKeysFromHistory != null || simBatchResult.results[0].perfSummary.selectUnifiedExploreOrSummary != null) && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#555' }}>
                          selectNextQuestion内訳: buildUsedTagKeysFromHistory: {simBatchResult.results[0].perfSummary.buildUsedTagKeysFromHistory ?? 0}ms | selectUnifiedExploreOrSummary: {simBatchResult.results[0].perfSummary.selectUnifiedExploreOrSummary ?? 0}ms | selectExploreQuestion: {simBatchResult.results[0].perfSummary.selectExploreQuestion ?? 0}ms | selectNextQuestion_confirm: {simBatchResult.results[0].perfSummary.selectNextQuestion_confirm ?? 0}ms | tryGetHardConfirmQuestion: {simBatchResult.results[0].perfSummary.tryGetHardConfirmQuestion ?? 0}ms | tryEmergencyExploreFallback: {simBatchResult.results[0].perfSummary.tryEmergencyExploreFallback ?? 0}ms
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

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

              {simBatchResult.failureSummary && Object.keys(simBatchResult.failureSummary).length > 0 && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fff3e0', borderRadius: '4px', fontSize: '0.9rem' }}>
                  <strong>失敗サマリー:</strong>{' '}
                  {Object.entries(simBatchResult.failureSummary).map(([k, v]) => `${k}: ${v}件`).join(', ')}
                  {simBatchResult.failureAnalysis && (
                    <span style={{ marginLeft: '1rem' }}>
                      | 失敗分析: avgWasNoisy={simBatchResult.failureAnalysis.avgWasNoisyCount ?? '-'}, avgCorrectRank={simBatchResult.failureAnalysis.avgCorrectRank ?? '-'}, avgTop1Conf={simBatchResult.failureAnalysis.avgTop1Confidence != null ? `${(simBatchResult.failureAnalysis.avgTop1Confidence * 100).toFixed(1)}%` : '-'}
                    </span>
                  )}
                </div>
              )}

              <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={simFailureFilter} onChange={(e) => setSimFailureFilter(e.target.checked)} />
                  失敗のみ表示
                </label>
                <button
                  onClick={() => {
                    const data = JSON.stringify(simBatchResult, null, 2);
                    const blob = new Blob([data], { type: 'application/json' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `sim-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.json`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                  style={{ padding: '0.4rem 0.8rem', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  JSONでダウンロード
                </button>
                {(() => {
                  const failed = simBatchResult.results.filter(r => !r.success);
                  const failedWorkIds = [...new Set(failed.map(r => r.workId))];
                  return failedWorkIds.length > 0 ? (
                    <button
                      onClick={async () => {
                        if (!adminToken) return;
                        if (!confirm(`失敗作品 ${failedWorkIds.length} 件を要確認に追加しますか？\n使用作品DBで「要確認のみ表示」で確認できます。`)) return;
                        try {
                          const res = await fetch('/api/admin/works/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
                            body: JSON.stringify({ action: 'setNeedsReview', workIds: failedWorkIds, needsReview: true }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            alert(`${data.updated ?? failedWorkIds.length} 件を要確認に追加しました。使用作品DBで「要確認のみ表示」で確認できます。`);
                          } else {
                            alert('追加に失敗しました');
                          }
                        } catch (e) {
                          alert('追加に失敗しました');
                        }
                      }}
                      style={{ padding: '0.4rem 0.8rem', background: '#e65100', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                    >
                      失敗作品をすべて要確認に追加（{failedWorkIds.length}件）
                    </button>
                  ) : null;
                })()}
              </div>

              {/* 全作品一覧（ページネーション） */}
              <div style={{ marginTop: '0.5rem' }}>
                <h4 style={{ marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                  結果一覧（クリックで詳細）
                </h4>
                {(() => {
                  const filtered = simFailureFilter ? simBatchResult.results.filter(r => !r.success) : simBatchResult.results;
                  const totalPages = Math.max(1, Math.ceil(filtered.length / SIM_RESULT_PAGE_SIZE));
                  const pageResults = filtered.slice(simResultPage * SIM_RESULT_PAGE_SIZE, (simResultPage + 1) * SIM_RESULT_PAGE_SIZE);
                  return (
                    <>
                      <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                        {simResultPage + 1}/{totalPages} ページ（{filtered.length}件）
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <button onClick={() => setSimResultPage(p => Math.max(0, p - 1))} disabled={simResultPage === 0} style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}>前へ</button>
                        <button onClick={() => setSimResultPage(p => Math.min(totalPages - 1, p + 1))} disabled={simResultPage >= totalPages - 1} style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}>次へ</button>
                      </div>
                <div style={{ 
                  maxHeight: '2800px', 
                  overflowY: 'auto',
                  background: '#fff',
                  padding: '0.5rem',
                  borderRadius: '4px'
                }}>
                  {pageResults.map((r, i) => (
                    <div 
                      key={`${r.workId}-${simResultPage}-${i}`} 
                      onClick={() => {
                        // 保存済みの結果をポップアップ表示（過程をデフォルト表示・2倍縦長）
                        setSimResultModal({
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
                          perfSummary: (r as { perfSummary?: Record<string, number> }).perfSummary,
                          diagnostic: (r as { diagnostic?: unknown }).diagnostic,
                          analysisData: (r as { analysisData?: { wasNoisyCount: number; firstNoisyStepIndex: number; noisyStepIndices: number[]; correctRank: number; top1Confidence: number } }).analysisData,
                        });
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
                    </>
                  );
                })()}
              </div>

              {/* 作品詳細ポップアップ（バッチ結果から選択時） */}
              {simResultModal && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 9999,
                    padding: '1rem',
                  }}
                  onClick={() => setSimResultModal(null)}
                >
                  <div
                    style={{
                      background: simResultModal.success ? '#e8f5e9' : '#ffebee',
                      padding: '1rem',
                      borderRadius: '8px',
                      maxWidth: '95vw',
                      maxHeight: '90vh',
                      overflowY: 'auto',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>
                        {simResultModal.success ? '成功' : '失敗'} - {simResultModal.outcome} | 作品: {simResultModal.targetWorkTitle}
                      </h3>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!simResultModal?.targetWorkId) return;
                            setSimModalRetryLoading(true);
                            try {
                              const response = await fetch('/api/admin/simulate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
                                body: JSON.stringify({
                                  targetWorkId: simResultModal.targetWorkId,
                                  ambiguityLevel: simAmbiguityLevel,
                                  aiGateChoice: simAiGateChoice,
                                  includePerf: true,
                                }),
                              });
                              const data = await response.json().catch(() => ({}));
                              if (!response.ok) {
                                throw new Error((data as { error?: string }).error ?? (data as { message?: string }).message ?? '再試行に失敗しました');
                              }
                              setSimResultModal({
                                success: data.success,
                                targetWorkId: data.targetWorkId,
                                targetWorkTitle: data.targetWorkTitle,
                                finalWorkId: data.finalWorkId,
                                finalWorkTitle: data.finalWorkTitle,
                                questionCount: data.questionCount,
                                outcome: data.outcome,
                                steps: data.steps ?? [],
                                workDetails: data.workDetails,
                                errorMessage: data.errorMessage,
                                perfSummary: data.perfSummary,
                                diagnostic: data.diagnostic,
                                analysisData: data.analysisData,
                              });
                            } catch (error) {
                              alert(error instanceof Error ? error.message : '再試行に失敗しました');
                            } finally {
                              setSimModalRetryLoading(false);
                            }
                          }}
                          disabled={simModalRetryLoading}
                          style={{ padding: '0.4rem 1rem', background: simModalRetryLoading ? '#ccc' : '#9c27b0', color: 'white', border: 'none', borderRadius: '4px', cursor: simModalRetryLoading ? 'default' : 'pointer', fontSize: '0.9rem' }}
                        >
                          {simModalRetryLoading ? '実行中...' : '🔄 もう1度試行'}
                        </button>
                        {!simResultModal.success && simResultModal.targetWorkId && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!adminToken || !simResultModal?.targetWorkId) return;
                              try {
                                const res = await fetch('/api/admin/works/update', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', 'x-eronator-admin-token': adminToken },
                                  body: JSON.stringify({ action: 'setNeedsReview', workId: simResultModal.targetWorkId, needsReview: true }),
                                });
                                if (res.ok) {
                                  alert('要確認に追加しました。使用作品DBで「要確認のみ表示」で確認できます。');
                                } else {
                                  alert('追加に失敗しました');
                                }
                              } catch (e) {
                                alert('追加に失敗しました');
                              }
                            }}
                            style={{ padding: '0.4rem 1rem', background: '#e65100', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }}
                          >
                            ✓ 要確認に追加
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSimResultModal(null)}
                          style={{ padding: '0.4rem 1rem', background: '#666', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          閉じる
                        </button>
                      </div>
                    </div>
                    <div style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                      質問数: {simResultModal.questionCount}問
                      {(() => {
                        const rank = (simResultModal.diagnostic as { correctRank?: number })?.correctRank ?? simResultModal.analysisData?.correctRank;
                        if (rank == null) return null;
                        return ` | 正解の順位: ${rank === -1 ? '候補外' : `${rank}位`}`;
                      })()}
                    </div>
                    {(simResultModal.workDetails as { tags?: Array<{ tagKey?: string; displayName: string; tagType?: string }> })?.tags && (simResultModal.workDetails as { tags: Array<{ tagKey?: string; displayName: string; tagType?: string }> }).tags.length > 0 && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong>作品のタグ:</strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.25rem' }}>
                          {((simResultModal.workDetails as { tags: Array<{ tagKey?: string; displayName: string; tagType?: string }> }).tags)
                            .sort((a, b) => {
                              const order = { OFFICIAL: 0, DERIVED: 1, STRUCTURAL: 2 };
                              return (order[(a.tagType ?? '') as keyof typeof order] ?? 3) - (order[(b.tagType ?? '') as keyof typeof order] ?? 3);
                            })
                            .map((t, i) => {
                              const wasAsked = simResultModal.steps?.some((s: { question?: { tagKey?: string; displayText?: string } }) =>
                                (s.question?.tagKey === t.tagKey) || (s.question?.displayText?.includes(t.displayName))
                              );
                              return (
                                <span
                                  key={t.tagKey ?? t.displayName ?? i}
                                  style={{
                                    padding: '0.15rem 0.4rem',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    background: t.tagType === 'OFFICIAL' ? RANK_BG.S : t.tagType === 'DERIVED' ? RANK_BG.B : RANK_BG.X,
                                    color: t.tagType === 'OFFICIAL' ? RANK_TEXT.S : t.tagType === 'DERIVED' ? RANK_TEXT.B : RANK_TEXT.X,
                                    border: wasAsked ? '2px solid #4caf50' : '1px solid #ccc',
                                    fontWeight: wasAsked ? 'bold' : 'normal',
                                  }}
                                  title={wasAsked ? '質問で使用' : undefined}
                                >
                                  {t.displayName}{wasAsked && ' ✓'}
                                </span>
                              );
                            })}
                        </div>
                      </div>
                    )}
                    {simResultModal.analysisData && (
                      <div style={{ marginBottom: '0.5rem', padding: '0.5rem', background: '#fff', borderRadius: '4px', fontSize: '0.85rem' }}>
                        <strong>分析:</strong> wasNoisy={simResultModal.analysisData.wasNoisyCount}回
                        {simResultModal.analysisData.noisyRatio != null && ` (noisyRatio=${(simResultModal.analysisData.noisyRatio * 100).toFixed(1)}%)`}
                        , correctRank={simResultModal.analysisData.correctRank}, top1Confidence={(simResultModal.analysisData.top1Confidence * 100).toFixed(1)}%
                        {simResultModal.analysisData.noisyStepIndices?.length > 0 && `, ノイズ発生Q#=[${simResultModal.analysisData.noisyStepIndices.join(',')}]`}
                      </div>
                    )}
                    {simResultModal.errorMessage && (
                      <div style={{ marginBottom: '0.5rem', padding: '0.5rem', background: '#ffebee', borderRadius: '4px', fontSize: '0.85rem' }}>
                        <strong>エラー:</strong> {simResultModal.errorMessage}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '0.65rem', width: '100%', marginTop: '0.5rem' }}>
                      <div style={{ flex: '0 0 auto' }}>
                        {simResultModal.perfSummary && (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => setSimModalPerfExpanded(!simModalPerfExpanded)}
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem', background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              {simModalPerfExpanded ? '▼ 計測を閉じる' : '▶ 計測 (ms) を開く'}
                            </button>
                            {simModalPerfExpanded && (
                              <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#f5f5f5', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                runSimulation: {simResultModal.perfSummary.runSimulation}ms | selectNextQuestion: {simResultModal.perfSummary.selectNextQuestion}ms
                              </div>
                            )}
                          </div>
                        )}
                        <strong style={{ display: 'block', marginTop: simResultModal.perfSummary ? '0.25rem' : 0 }}>過程</strong>
                      </div>
                      <SimEarlyExitThresholdsSummary flow={config?.flow} />
                    </div>
                    <div style={{ 
                        marginTop: '0.35rem',
                        maxHeight: '3200px',
                        overflowY: 'auto',
                        overflowX: 'auto',
                        background: '#fff',
                        padding: '1rem',
                        borderRadius: '4px',
                        fontSize: '0.9rem'
                      }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                          <thead>
                            <tr style={{ background: '#f0f0f0' }}>
                              <th style={{ padding: '0.5rem', textAlign: 'left', width: '2.25rem' }}>Q#</th>
                              <th style={{ padding: '0.5rem', textAlign: 'left', minWidth: '280px' }}>質問</th>
                              <th style={{ padding: '0.5rem', textAlign: 'center', width: '3.2rem' }}>回答</th>
                              <th style={{ padding: '0.5rem', textAlign: 'center', whiteSpace: 'nowrap', minWidth: '3.35rem', boxSizing: 'border-box' }}>ノイズ</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right', width: '3.5rem' }}>p値</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right', width: '8.5rem', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>確度（①）</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right', width: '7.75rem', minWidth: '7.75rem', boxSizing: 'border-box', whiteSpace: 'nowrap' }}>候補（②）</th>
                                  <th style={{ padding: '0.5rem', textAlign: 'left', width: '10%', minWidth: '5.5rem', maxWidth: '7.5rem', boxSizing: 'border-box' }}>早期失敗判定</th>
                            </tr>
                          </thead>
                          <tbody>
                            {simResultModal.steps.map((step, idx) => {
                              const isReveal = step.question.kind === 'REVEAL';
                              const revealSuccess = (step as { revealResult?: string }).revealResult === 'SUCCESS';
                              const revealMiss = (step as { revealResult?: string }).revealResult === 'MISS';
                              const ex = (step as { earlyExit?: import('@/types/earlyExitStepSnapshot').EarlyExitStepSnapshot }).earlyExit;
                              const eeOk = simEarlyExitOkModal[idx] ?? { conf: false, cand: false };
                              const stepExt = step as { tagCoverage?: number; effectiveCandidates?: number; preferHighP?: boolean; revealWorkTitle?: string };
                              const tagCoverage = stepExt.tagCoverage;
                              const pColor = tagCoverage !== undefined
                                ? (Math.abs(tagCoverage - 0.5) < 0.1 ? '#2e7d32' : Math.abs(tagCoverage - 0.5) > 0.4 ? '#c62828' : '#666')
                                : '#999';
                              const pBold = tagCoverage !== undefined && Math.abs(tagCoverage - 0.5) > 0.4;
                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid #eee', background: isReveal ? (revealSuccess ? '#c8e6c9' : '#ffcdd2') : 'transparent' }}>
                                  <td style={{ padding: '0.5rem' }}>{step.qIndex}</td>
                                  <td style={{ padding: '0.5rem', minWidth: '280px' }}>
                                    <span style={{ 
                                      display: 'inline-block',
                                      padding: '0.2rem 0.5rem',
                                      background: step.question.kind === 'EXPLORE_TAG' ? RANK_BG.S : step.question.kind === 'SOFT_CONFIRM' ? RANK_BG.B : step.question.kind === 'HARD_CONFIRM' ? RANK_BG.X : step.question.kind === 'SPECIAL_QUESTION' ? '#9c27b0' : step.question.kind === 'REVEAL' ? '#ffeb3b' : '#e0e0e0',
                                      borderRadius: '4px',
                                      fontSize: '0.8rem',
                                      marginRight: '0.5rem',
                                    }}>
                                      {step.question.kind}
                                      {step.question.exploreTagKind && (
                                        <span style={{ marginLeft: '0.25rem', opacity: 0.9 }}>
                                          {EXPLORE_TAG_KIND_LABEL[step.question.exploreTagKind]}
                                        </span>
                                      )}
                                      {step.question.kind === 'HARD_CONFIRM' && (step.question as { hardConfirmType?: string }).hardConfirmType && (
                                        <span style={{ marginLeft: '0.25rem', opacity: 0.9 }}>
                                          {(step.question as { hardConfirmType?: string }).hardConfirmType === 'TITLE_INITIAL' ? '頭文字' : '作者'}
                                        </span>
                                      )}
                                      {step.question.kind === 'SPECIAL_QUESTION' && (step.question as { specialQuestionType?: string }).specialQuestionType && (
                                        <span style={{ marginLeft: '0.25rem', opacity: 0.9 }}>
                                          {(step.question as { specialQuestionType?: string }).specialQuestionType === 'SERIES' ? 'シリーズ' : (step.question as { specialQuestionType?: string }).specialQuestionType === 'TITLE_CHAR_TYPE' ? '文字種' : (step.question as { specialQuestionType?: string }).specialQuestionType}
                                        </span>
                                      )}
                                    </span>
                                    {(() => {
                                      const key = `simResultModal-${idx}`;
                                      const editable = !isReveal && ((step.question.kind === 'EXPLORE_TAG' && step.question.exploreTagKind !== 'summary') || step.question.kind === 'SOFT_CONFIRM' || step.question.kind === 'SPECIAL_QUESTION');
                                      const isEditing = editingQuestionKey === key;
                                      if (editable && isEditing) {
                                        return (
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.25rem' }}>
                                            <input
                                              type="text"
                                              value={editingQuestionValue}
                                              onChange={(e) => setEditingQuestionValue(e.target.value)}
                                              style={{ minWidth: '200px', padding: '0.2rem 0.4rem', fontSize: '0.9rem' }}
                                              autoFocus
                                            />
                                            <button type="button" onClick={() => handleSaveSimQuestionText('simResultModal', idx, step, editingQuestionValue)} disabled={editingQuestionLoading} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>保存</button>
                                            <button type="button" onClick={() => { setEditingQuestionKey(null); }} style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>キャンセル</button>
                                          </span>
                                        );
                                      }
                                      if (editable) {
                                        return (
                                          <span
                                            onClick={() => { setEditingQuestionKey(key); setEditingQuestionValue(step.question.displayText); }}
                                            style={{ marginLeft: '0.25rem', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                                            title="クリックで編集"
                                          >
                                            {step.question.displayText}
                                          </span>
                                        );
                                      }
                                      return <span style={{ marginLeft: '0.25rem' }}>{step.question.displayText}</span>;
                                    })()}
                                    {revealMiss && <span style={{ marginLeft: '0.5rem', color: '#c62828', fontWeight: 'bold' }}>← 不正解！</span>}
                                    {stepExt.preferHighP && (
                                      <span style={{ marginLeft: '0.25rem', padding: '0.1rem 0.3rem', background: '#fff3e0', borderRadius: '4px', fontSize: '0.75rem' }}>当たり狙い</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                    <span style={{ color: '#37474f', fontWeight: 600 }}>
                                      {step.answer}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'center', whiteSpace: 'nowrap', minWidth: '3.35rem', boxSizing: 'border-box' }}>{step.wasNoisy && <span style={{ color: '#ff6600' }}>!</span>}</td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right', color: pColor, fontWeight: pBold ? 'bold' : 'normal' }}>
                                    {tagCoverage !== undefined ? `${(tagCoverage * 100).toFixed(0)}%` : '-'}
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    <span style={{ color: '#37474f' }}>{(step.confidenceBefore * 100).toFixed(1)}%</span>
                                    {!isReveal && (
                                      <>
                                        {' → '}
                                        <span
                                          style={{
                                            color: eeOk.conf ? EARLY_EXIT_OK_COLOR : '#37474f',
                                            fontWeight: eeOk.conf ? 600 : 400,
                                          }}
                                        >
                                          {(step.confidenceAfter * 100).toFixed(1)}%
                                        </span>
                                      </>
                                    )}
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'normal' }}>
                                    <span style={{
                                      color: eeOk.cand ? EARLY_EXIT_OK_COLOR : '#37474f',
                                      fontWeight: eeOk.cand ? 600 : 400,
                                    }}>
                                      {(() => {
                                      const _c = ex?.effectiveCandidates ?? stepExt.effectiveCandidates;
                                      if (_c == null) return '-';
                                      const _n = typeof _c === 'number' ? _c : Number(_c);
                                      return Number.isFinite(_n) ? Math.floor(_n) : '-';
                                    })()}
                                    </span>
                                  </td>
                                  <td style={{ padding: '0.5rem', textAlign: 'left', verticalAlign: 'top' }}>
                                    <SimEarlyExitJudgmentColumnCell ex={ex} isReveal={isReveal} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* サービスプレイ履歴タブ */}
      {activeTab === 'history' && (
        <section style={{ marginTop: '1rem' }}>
          <div style={{ marginBottom: '0.35rem', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '0.45rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>本番プレイ履歴</h2>
            <span style={{ color: '#666', fontSize: '0.78rem' }}>1プレイ＝1レコード。FANZAクリック等は本番デプロイ後。</span>
          </div>
          <div style={{ marginBottom: '0.5rem', padding: '0.35rem 0.55rem', background: '#f0f4ff', borderRadius: '6px', border: '1px solid #c5d4f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem', rowGap: '0.2rem' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={historyUseRemote}
                  onChange={(e) => setHistoryUseRemote(e.target.checked)}
                />
                <strong>本番の履歴</strong>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>（デプロイ先DB）</span>
              </label>
              {historyUseRemote ? (
                <>
                  <span style={{ fontSize: '0.75rem', color: '#0f766e', fontWeight: 600 }}>
                    {previewHistoryUrl.trim()
                      ? (() => {
                          try {
                            return `→ ${new URL(previewHistoryUrl.trim()).host}`;
                          } catch {
                            return '→ プレビュー（URL要確認）';
                          }
                        })()
                      : productionHistoryUrl.trim()
                        ? (() => {
                            try {
                              return `→ ${new URL(productionHistoryUrl.trim()).host}`;
                            } catch {
                              return '→ 本番（URL要確認）';
                            }
                          })()
                        : '→ 未設定'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setHistoryRemoteSettingsOpen((o) => !o)}
                    style={{
                      padding: '0.15rem 0.45rem',
                      fontSize: '0.72rem',
                      backgroundColor: '#fff',
                      border: '1px solid #94a3b8',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      marginLeft: 'auto',
                    }}
                  >
                    {historyRemoteSettingsOpen ? '設定を閉じる' : 'URL・トークン・診断を開く'}
                  </button>
                </>
              ) : null}
            </div>
            {historyUseRemote && historyRemoteSettingsOpen ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.45rem', paddingTop: '0.45rem', borderTop: '1px solid #c5d4f0' }}>
                <label>
                  本番URL（いつもここは本番のまま）:
                  <input
                    type="url"
                    value={productionHistoryUrl}
                    onChange={(e) => setProductionHistoryUrl(e.target.value)}
                    placeholder="https://eronator.vercel.app"
                    style={{ marginLeft: '0.5rem', padding: '0.35rem', width: 'min(100%, 360px)' }}
                  />
                </label>
                <label style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.35rem' }}>
                  <span>プレビューURL（任意・空なら本番URLを使用）:</span>
                  <input
                    type="url"
                    value={previewHistoryUrl}
                    onChange={(e) => setPreviewHistoryUrlPersisted(e.target.value)}
                    placeholder="https://〜〜.vercel.app（試したいデプロイを貼る。消せば本番に戻る）"
                    style={{ padding: '0.35rem', width: 'min(100%, 420px)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setPreviewHistoryUrlPersisted('')}
                    disabled={!previewHistoryUrl.trim()}
                    style={{
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.8rem',
                      cursor: previewHistoryUrl.trim() ? 'pointer' : 'not-allowed',
                      opacity: previewHistoryUrl.trim() ? 1 : 0.5,
                    }}
                  >
                    プレビューをクリア
                  </button>
                </label>
                <p style={{ fontSize: '0.85rem', color: '#0f766e', margin: 0, fontWeight: 600 }}>
                  いまの取得先:{' '}
                  {previewHistoryUrl.trim()
                    ? (() => {
                        try {
                          return `プレビュー（${new URL(previewHistoryUrl.trim()).host}）`;
                        } catch {
                          return 'プレビュー（URL形式を確認）';
                        }
                      })()
                    : productionHistoryUrl.trim()
                      ? (() => {
                          try {
                            return `本番（${new URL(productionHistoryUrl.trim()).host}）`;
                          } catch {
                            return '本番（URL形式を確認）';
                          }
                        })()
                      : '未設定（本番URLかプレビューURLを入力）'}
                </p>
                <RemoteAdminDiagnosticPanel
                  adminToken={adminToken}
                  remoteDeploymentUrl={remoteDeploymentUrl}
                  tokenForRemote={productionHistoryToken.trim() || adminToken}
                />
                <label>
                  本番用管理トークン:（未入力なら上の「管理トークン」を使用）
                  <input
                    type="password"
                    value={productionHistoryToken}
                    onChange={(e) => setProductionHistoryToken(e.target.value)}
                    placeholder="本番の ERONATOR_ADMIN_TOKEN"
                    style={{ marginLeft: '0.5rem', padding: '0.35rem', width: 'min(100%, 240px)' }}
                  />
                </label>
                <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>
                  プレビューURLはブラウザの localStorage に保存されます（リロードしても残る）。Vercel
                  プレビューを触るときは .env.local に{' '}
                  <code>ERONATOR_REMOTE_ADMIN_TRUST_VERCEL_APP=1</code>（ローカル開発のみ）。本番サーバー上ではこの取得APIは無効です。
                </p>
              </div>
            ) : null}
          </div>
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
                <option value="ABANDONED">ABANDONED（途中離脱）</option>
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
            <>
            <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleHistoryDeleteSelected}
                disabled={historyDeleteLoading || historySelectedIds.size === 0}
                style={{
                  padding: '0.4rem 0.75rem',
                  backgroundColor: historySelectedIds.size === 0 ? '#ccc' : '#c62828',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: historySelectedIds.size === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {historyDeleteLoading ? '削除中...' : `選択した履歴を削除（${historySelectedIds.size}件）`}
              </button>
              <button
                type="button"
                onClick={() => setHistorySelectedIds(historyItems.length > 0 && historySelectedIds.size === historyItems.length ? new Set() : new Set(historyItems.map((r) => r.id)))}
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem', background: '#eee', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
              >
                {historyItems.length > 0 && historySelectedIds.size === historyItems.length ? '選択解除' : '全選択'}
              </button>
              <span style={{ fontSize: '0.85rem', color: '#666' }}>
                {historyUseRemote ? '表示中の本番履歴を削除します。' : 'ローカルの履歴を削除します。'}
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', background: '#f5f5f5' }}>
                    <th style={{ padding: '0.5rem', textAlign: 'center', width: '1%' }}>選択</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', width: '1%' }}>結果</th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', width: '1%' }}>質問数</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left' }}>作品</th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', whiteSpace: 'nowrap', width: '1%' }}>日時</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center', width: '1%' }} title="総合滞在時間">滞在</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center', width: '1%' }} title="FANZAで見るクリック">FANZA</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center', width: '1%' }} title="リピート">★リピ</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center', width: '1%' }} title="SNS投稿">★SNS</th>
                    <th style={{ padding: '0.5rem', textAlign: 'center', width: '1%' }}>詳細</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((row) => (
                    <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={historySelectedIds.has(row.id)}
                          onChange={() => setHistorySelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.id)) next.delete(row.id);
                            else next.add(row.id);
                            return next;
                          })}
                        />
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <span style={{
                          color: row.outcome === 'SUCCESS' ? '#2e7d32' : row.outcome === 'FAIL_LIST' ? '#c62828' : row.outcome === 'ABANDONED' ? '#e65100' : '#666',
                          fontWeight: 'bold',
                        }}>
                          {row.outcome}
                        </span>
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'right' }}>{row.questionCount}</td>
                      <td style={{ padding: '0.5rem', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.resultWorkTitle ?? row.submittedTitleText ?? undefined}>
                        {row.resultWorkId != null ? (row.resultWorkTitle ?? '—') : (row.submittedTitleText ?? '—')}
                      </td>
                      <td style={{ padding: '0.5rem', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        <div>{row.createdAt ? new Date(row.createdAt).toLocaleString('ja-JP') : '—'}</div>
                        <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.1rem' }}>
                          {row.visitorId ? (
                            <>
                              #{row.visitorId.slice(-8)}
                              {row.hasRecommendPlay && <span style={{ marginLeft: '0.3rem', color: '#7c3aed', fontWeight: 'bold', fontSize: '0.7rem' }}>推薦◎</span>}
                            </>
                          ) : (
                            <span style={{ color: '#bbb' }}>ID未記録（実装前／未送信）</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {row.sessionStartedAt && row.createdAt
                          ? (() => {
                              const start = new Date(row.sessionStartedAt).getTime();
                              const end = new Date(row.createdAt).getTime();
                              const sec = Math.round((end - start) / 1000);
                              if (sec < 60) return `${sec}秒`;
                              const m = Math.floor(sec / 60);
                              const s = sec % 60;
                              return s > 0 ? `${m}分${s}秒` : `${m}分`;
                            })()
                          : '—'}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }} title={row.clickedFanza ? 'FANZAで見るをクリック済み' : ''}>
                        {row.clickedFanza ? '◎' : 'ー'}
                      </td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', color: '#999' }}>ー</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center', color: '#999' }}>ー</td>
                      <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setHistoryDetailRowId(row.id)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.85rem',
                            backgroundColor: '#6b21a8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          詳細
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {historyDetailRowId != null && (() => {
              const row = historyItems.find((r) => r.id === historyDetailRowId);
              const replayed = row ? historyReplayCache[row.id] : undefined;
              const steps = replayed ?? (Array.isArray(row?.questionHistory) ? row!.questionHistory as Array<{ qIndex?: number; kind?: string; displayText?: string; answer?: string; exploreTagKind?: string; wasNoisy?: boolean; tagCoverage?: number; confidenceBefore?: number; confidenceAfter?: number; durationSeconds?: number }> : []);
              const hasReplay = replayed != null;
              return (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10000,
                  }}
                  onClick={() => setHistoryDetailRowId(null)}
                >
                  <div
                    style={{
                      background: '#fff',
                      borderRadius: '8px',
                      width: '95vw',
                      maxWidth: '1400px',
                      height: '90vh',
                      maxHeight: '900px',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '1.1rem' }}>過程（質問・回答の流れ）</strong>
                      <button
                        type="button"
                        onClick={() => setHistoryDetailRowId(null)}
                        style={{ padding: '0.4rem 1rem', background: '#666', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' }}
                      >
                        閉じる
                      </button>
                    </div>
                    <div style={{ overflow: 'auto', padding: '1.25rem', flex: 1, minHeight: 0 }}>
                      {historyReplayLoading && !hasReplay ? (
                        <p style={{ color: '#666', fontSize: '1rem' }}>p値・確度を計算中...</p>
                      ) : steps.length === 0 ? (
                        <p style={{ color: '#666', fontSize: '1rem' }}>記録がありません。</p>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '1rem' }}>
                          <thead>
                            <tr style={{ background: '#f0f0f0' }}>
                              <th style={{ padding: '0.6rem', textAlign: 'left' }}>Q#</th>
                              <th style={{ padding: '0.6rem', textAlign: 'left' }}>質問</th>
                              <th style={{ padding: '0.6rem', textAlign: 'center' }}>回答</th>
                              <th style={{ padding: '0.6rem', textAlign: 'center', whiteSpace: 'nowrap' }}>滞在</th>
                              <th style={{ padding: '0.6rem', textAlign: 'center' }}>ミス</th>
                              <th style={{ padding: '0.6rem', textAlign: 'right' }}>p値</th>
                              <th style={{ padding: '0.6rem', textAlign: 'right', minWidth: '320px', whiteSpace: 'nowrap' }}>確度</th>
                            </tr>
                          </thead>
                          <tbody>
                            {steps.map((step, i) => {
                              const isReveal = step.kind === 'REVEAL';
                              const revealSuccess = (step as { revealResult?: string }).revealResult === 'SUCCESS';
                              const revealMiss = (step as { revealResult?: string }).revealResult === 'MISS';
                              return (
                              <tr
                                key={i}
                                style={{
                                  borderBottom: '1px solid #eee',
                                  background: isReveal ? (revealSuccess ? '#c8e6c9' : revealMiss ? '#ffcdd2' : '#fff9c4') : undefined,
                                }}
                              >
                                <td style={{ padding: '0.6rem' }}>{step.qIndex ?? i + 1}</td>
                                <td style={{ padding: '0.6rem' }}>
                                  <span style={{
                                    display: 'inline-block',
                                    padding: '0.25rem 0.5rem',
                                    background: step.kind === 'EXPLORE_TAG' ? RANK_BG.S : step.kind === 'SOFT_CONFIRM' ? RANK_BG.B : step.kind === 'HARD_CONFIRM' ? RANK_BG.X : step.kind === 'SPECIAL_QUESTION' ? '#9c27b0' : step.kind === 'REVEAL' ? '#ffeb3b' : '#e0e0e0',
                                    color: step.kind === 'EXPLORE_TAG' ? RANK_TEXT.S : step.kind === 'SOFT_CONFIRM' ? RANK_TEXT.B : step.kind === 'HARD_CONFIRM' ? RANK_TEXT.X : step.kind === 'SPECIAL_QUESTION' ? '#fff' : undefined,
                                    borderRadius: '4px',
                                    fontSize: '0.9rem',
                                    marginRight: '0.5rem',
                                    fontWeight: isReveal ? 'bold' : 'normal',
                                  }}>
                                    {step.kind ?? '—'}
                                    {step.exploreTagKind && (
                                      <span style={{ marginLeft: '0.25rem', opacity: 0.9 }}>
                                        {EXPLORE_TAG_KIND_LABEL[step.exploreTagKind] ?? step.exploreTagKind}
                                      </span>
                                    )}
                                    {(step as { specialQuestionType?: string }).specialQuestionType && (
                                      <span style={{ marginLeft: '0.25rem', opacity: 0.9 }}>
                                        {(step as { specialQuestionType?: string }).specialQuestionType === 'SERIES' ? 'シリーズ' : (step as { specialQuestionType?: string }).specialQuestionType === 'TITLE_CHAR_TYPE' ? '文字種' : (step as { specialQuestionType?: string }).specialQuestionType}
                                      </span>
                                    )}
                                  </span>
                                  {step.displayText ?? '—'}
                                  {isReveal && revealMiss && (
                                    <span style={{ marginLeft: '0.5rem', color: '#c62828', fontWeight: 'bold' }}>← 不正解</span>
                                  )}
                                </td>
                                <td style={{ padding: '0.6rem', textAlign: 'center' }}>
                                  <span style={{
                                    color: step.answer === 'YES' || step.answer === 'CORRECT' ? '#2e7d32' : step.answer === 'NO' || step.answer === 'WRONG' ? '#c62828' : '#666',
                                    fontWeight: 'bold',
                                  }}>
                                    {historyAnswerSymbol(step.answer)}
                                  </span>
                                </td>
                                <td style={{ padding: '0.6rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  {(step as { durationSeconds?: number }).durationSeconds != null
                                    ? `${(step as { durationSeconds: number }).durationSeconds}秒`
                                    : '—'}
                                </td>
                                <td style={{ padding: '0.6rem', textAlign: 'center' }}>
                                  {(step as { missType?: 'clear' | 'weak' }).missType === 'clear' ? (
                                    <span style={{ color: '#c62828', fontWeight: 'bold' }}>!</span>
                                  ) : (step as { missType?: 'clear' | 'weak' }).missType === 'weak' ? (
                                    <span style={{ color: '#f57c00' }}>△</span>
                                  ) : step.wasNoisy != null && step.wasNoisy ? (
                                    <span style={{ color: '#ff6600' }}>!</span>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td style={{ padding: '0.6rem', textAlign: 'right' }}>
                                  {step.tagCoverage != null ? `${(step.tagCoverage * 100).toFixed(0)}%` : '—'}
                                </td>
                                <td style={{ padding: '0.6rem', textAlign: 'right', whiteSpace: 'nowrap', minWidth: '320px' }}>
                                  {step.confidenceBefore != null
                                    ? step.confidenceAfter != null
                                      ? `${(step.confidenceBefore * 100).toFixed(1)}% → ${(step.confidenceAfter * 100).toFixed(1)}%`
                                      : `${(step.confidenceBefore * 100).toFixed(1)}%`
                                    : step.confidenceAfter != null
                                      ? `${(step.confidenceAfter * 100).toFixed(1)}%`
                                      : '—'}
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                      {row?.outcome === 'FAIL_LIST' && (
                        <div style={{ marginTop: '1rem', padding: '0.85rem', background: '#fff8e1', borderRadius: '6px', border: '1px solid #ffcc80', fontSize: '0.88rem' }}>
                          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>FAIL_LIST 時の候補スナップショット（分析用）</strong>
                          {row.failListContext != null
                            ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '240px', overflow: 'auto', fontSize: '0.8rem' }}>{JSON.stringify(row.failListContext, null, 2)}</pre>
                            : <p style={{ margin: 0, color: '#999', fontSize: '0.8rem' }}>スナップショット未保存（旧データまたは保存エラー）</p>
                          }
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
            </>
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

      {activeTab === 'recommendHistory' && (
        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>推薦プレイ履歴</h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            推薦モードで結果まで完了したプレイのみ1件として保存されます（本番プレイ履歴と同様）。タグの流れ・並べ替え・おすすめ結果・FANZAクリックを確認できます。
          </p>
          <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f5f3ff', borderRadius: '8px', border: '1px solid #ddd6fe' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#5b21b6' }}>
              リモート取得・本番URL・プレビューURL・管理トークンは<strong>本番プレイ履歴タブ</strong>と共通です。
            </p>
          </div>
          {historyUseRemote && !remoteDeploymentUrl && (
            <p style={{ color: '#b45309', marginBottom: '1rem', fontSize: '0.9rem' }}>
              リモート取得がオンですが、本番URLもプレビューURLも空です。本番プレイ履歴タブでどちらかを入力するか、オフにするとローカルSQLiteのみ表示されます。
            </p>
          )}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => fetchRecommendPlayHistory(1)}
              disabled={recHistLoading}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: recHistLoading ? '#ccc' : '#7c3aed',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: recHistLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {recHistLoading ? '読込中...' : '再読み込み'}
            </button>
            <span style={{ color: '#666', fontSize: '0.9rem' }}>
              全 {recHistTotal} 件 {recHistPage > 1 && `（ページ ${recHistPage}）`}
            </span>
          </div>
          {recHistLoading && recHistItems.length === 0 ? (
            <p>読み込み中...</p>
          ) : recHistItems.length === 0 ? (
            <p style={{ color: '#666' }}>履歴がありません。</p>
          ) : (
            <>
              <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleRecHistDeleteSelected}
                  disabled={recHistDeleteLoading || recHistSelectedIds.size === 0}
                  style={{
                    padding: '0.4rem 0.75rem',
                    backgroundColor: recHistSelectedIds.size === 0 ? '#ccc' : '#c62828',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: recHistSelectedIds.size === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                  }}
                >
                  {recHistDeleteLoading ? '削除中...' : `選択した履歴を削除（${recHistSelectedIds.size}件）`}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRecHistSelectedIds(
                      recHistItems.length > 0 && recHistSelectedIds.size === recHistItems.length
                        ? new Set()
                        : new Set(recHistItems.map((r) => r.id))
                    )
                  }
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.85rem', background: '#eee', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
                >
                  {recHistItems.length > 0 && recHistSelectedIds.size === recHistItems.length ? '選択解除' : '全選択'}
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd', background: '#f5f5f5' }}>
                      <th style={{ padding: '0.45rem', textAlign: 'center', width: '1%' }}>選択</th>
                      <th style={{ padding: '0.45rem', textAlign: 'left', minWidth: '200px' }}>最終5タグ</th>
                      <th style={{ padding: '0.45rem', textAlign: 'left', maxWidth: '140px' }}>1位作品</th>
                      <th style={{ padding: '0.45rem', textAlign: 'left', whiteSpace: 'nowrap', width: '1%' }}>日時</th>
                      <th style={{ padding: '0.45rem', textAlign: 'center', width: '1%' }} title="推薦開始〜記録まで">滞在</th>
                      <th style={{ padding: '0.45rem', textAlign: 'center', width: '1%' }}>FANZA</th>
                      <th style={{ padding: '0.45rem', textAlign: 'center', width: '1%' }}>詳細</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recHistItems.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '0.45rem', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={recHistSelectedIds.has(row.id)}
                            onChange={() =>
                              setRecHistSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(row.id)) next.delete(row.id);
                                else next.add(row.id);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td
                          style={{ padding: '0.45rem', maxWidth: '360px', fontSize: '0.8rem', lineHeight: 1.35, wordBreak: 'break-word' }}
                          title={formatRecommendFinalFiveSummary(row.detailJson)}
                        >
                          {formatRecommendFinalFiveSummary(row.detailJson)}
                        </td>
                        <td
                          style={{ padding: '0.45rem', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.8rem' }}
                          title={row.topWorkTitle ?? row.topWorkId ?? undefined}
                        >
                          {row.topWorkTitle ?? row.topWorkId ?? '—'}
                        </td>
                        <td style={{ padding: '0.45rem', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                          <div>{row.createdAt ? new Date(row.createdAt).toLocaleString('ja-JP') : '—'}</div>
                          <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.1rem' }}>
                            {row.visitorId ? (
                              <>
                                #{row.visitorId.slice(-8)}
                                {row.hasNormalPlay && <span style={{ marginLeft: '0.3rem', color: '#0070f3', fontWeight: 'bold', fontSize: '0.7rem' }}>通常◎</span>}
                              </>
                            ) : (
                              <span style={{ color: '#bbb' }}>ID未記録（実装前／未送信）</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.45rem', textAlign: 'center', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                          {row.sessionStartedAt && row.createdAt
                            ? (() => {
                                const start = new Date(row.sessionStartedAt).getTime();
                                const end = new Date(row.createdAt).getTime();
                                const sec = Math.round((end - start) / 1000);
                                if (sec < 60) return `${sec}秒`;
                                const m = Math.floor(sec / 60);
                                const s = sec % 60;
                                return s > 0 ? `${m}分${s}秒` : `${m}分`;
                              })()
                            : '—'}
                        </td>
                        <td
                          style={{ padding: '0.45rem', textAlign: 'center', fontSize: '0.75rem' }}
                          title={
                            row.clickedFanza
                              ? row.clickedFanzaWorkId
                                ? `クリック: ${row.clickedFanzaWorkId}`
                                : 'クリック済み（作品IDは旧データ）'
                              : ''
                          }
                        >
                          {row.clickedFanza ? (row.clickedFanzaWorkId ? '◎' : '○') : 'ー'}
                        </td>
                        <td style={{ padding: '0.45rem', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setRecHistDetailRowId(row.id)}
                            style={{
                              padding: '0.22rem 0.45rem',
                              fontSize: '0.82rem',
                              backgroundColor: '#7c3aed',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                          >
                            詳細
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {recHistDetailRowId != null && (() => {
                const row = recHistItems.find((r) => r.id === recHistDetailRowId);
                if (!row) return null;
                return <RecommendPlayHistoryDetailModal row={row} onClose={() => setRecHistDetailRowId(null)} />;
              })()}
              {recHistTotal > recHistLimit && (
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => fetchRecommendPlayHistory(recHistPage - 1)}
                    disabled={recHistLoading || recHistPage <= 1}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: recHistPage <= 1 ? '#ccc' : '#7c3aed',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: recHistPage <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    前へ
                  </button>
                  <span style={{ fontSize: '0.9rem' }}>
                    ページ {recHistPage} / {Math.ceil(recHistTotal / recHistLimit) || 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchRecommendPlayHistory(recHistPage + 1)}
                    disabled={recHistLoading || recHistPage >= Math.ceil(recHistTotal / recHistLimit)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: recHistPage >= Math.ceil(recHistTotal / recHistLimit) ? '#ccc' : '#7c3aed',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: recHistPage >= Math.ceil(recHistTotal / recHistLimit) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    次へ
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {activeTab === 'contact' && (
        <section style={{ marginTop: '1rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>お問い合わせ一覧</h2>
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            公開フォーム（<code>/contact</code>）から送信された内容です。
            <strong>プレイ履歴タブ</strong>の設定をそのまま使います。プレビューURLに何か入っていれば<strong>そちら優先</strong>、空なら本番URLのDBを見ます。
          </p>
          {historyUseRemote && !remoteDeploymentUrl && (
            <p style={{ color: '#b45309', marginBottom: '1rem', fontSize: '0.9rem' }}>
              リモート取得がオンですが、本番URLもプレビューURLも空です。プレイ履歴タブでどちらかを入力するか、オフにするとローカルSQLiteのみ表示されます。
            </p>
          )}
          <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => fetchContactInquiries(contactPage, true)}
              disabled={contactLoading || !adminToken}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: contactLoading || !adminToken ? '#ccc' : '#0d9488',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: contactLoading || !adminToken ? 'not-allowed' : 'pointer',
              }}
            >
              {contactLoading ? '読込中...' : '再読み込み'}
            </button>
            <span style={{ color: '#666', fontSize: '0.9rem' }}>全 {contactTotal} 件</span>
          </div>
          {!adminToken ? (
            <p style={{ color: '#666' }}>管理トークンを入力してください。</p>
          ) : contactLoading && contactItems.length === 0 ? (
            <p>読み込み中...</p>
          ) : contactItems.length === 0 ? (
            <p style={{ color: '#666' }}>お問い合わせはまだありません。</p>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd', background: '#f5f5f5' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>日時</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>お名前</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>メール</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>件名</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>内容</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contactItems.map((row) => (
                      <tr key={row.id} style={{ borderBottom: '1px solid #eee', verticalAlign: 'top' }}>
                        <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                          {new Date(row.createdAt).toLocaleString('ja-JP')}
                        </td>
                        <td style={{ padding: '0.5rem' }}>{row.name}</td>
                        <td style={{ padding: '0.5rem', wordBreak: 'break-all' }}>{row.email ?? '—'}</td>
                        <td style={{ padding: '0.5rem' }}>{row.subject ?? '—'}</td>
                        <td style={{ padding: '0.5rem', maxWidth: 360, whiteSpace: 'pre-wrap' }}>{row.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {contactTotal > CONTACT_INQUIRY_PAGE_SIZE && (
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => fetchContactInquiries(contactPage - 1, false)}
                    disabled={contactLoading || contactPage <= 1}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: contactPage <= 1 ? '#ccc' : '#0d9488',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: contactPage <= 1 ? 'not-allowed' : 'pointer',
                    }}
                  >
                    前へ
                  </button>
                  <span style={{ fontSize: '0.9rem' }}>
                    ページ {contactPage} / {Math.ceil(contactTotal / CONTACT_INQUIRY_PAGE_SIZE) || 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => fetchContactInquiries(contactPage + 1, false)}
                    disabled={
                      contactLoading || contactPage >= Math.ceil(contactTotal / CONTACT_INQUIRY_PAGE_SIZE)
                    }
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor:
                        contactPage >= Math.ceil(contactTotal / CONTACT_INQUIRY_PAGE_SIZE) ? '#ccc' : '#0d9488',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor:
                        contactPage >= Math.ceil(contactTotal / CONTACT_INQUIRY_PAGE_SIZE)
                          ? 'not-allowed'
                          : 'pointer',
                    }}
                  >
                    次へ
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* 更新履歴編集タブ */}
      {activeTab === 'changelog' && <ChangelogTab adminToken={adminToken} />}
    </div>
      </>
  );
}