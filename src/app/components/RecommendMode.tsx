'use client';

import { useState, useEffect, useCallback, useRef, useMemo, type CSSProperties } from 'react';
import html2canvas from 'html2canvas';
import { ExternalLink } from './ExternalLink';
import { MosaicImage } from './MosaicImage';
import { MobileRecommendCaptureGrid } from './MobileRecommendCaptureGrid';
import { useMediaQuery } from './useMediaQuery';
import { Stage } from './Stage';
import { ResultScreenFourButtons } from './ResultScreenFourButtons';
import { MobileWorkCardHorizontal } from './MobileWorkCardHorizontal';
import { RecommendDebugPanel, type RecommendDebugData } from './RecommendDebugPanel';
import { AiGate } from './AiGate';
import type { RecommendCopy } from '@/server/config/schema';
import {
  getSortPromptFront,
  getSortPromptBack,
  getBtnNextSortFront,
  getBtnNextSortBack,
  getFamousQuestionForCategory,
} from '@/server/config/schema';

type WorkResult = {
  workId: string;
  title: string;
  authorName: string;
  productUrl: string;
  thumbnailUrl?: string | null;
  reviewAverage?: number | null;
  reviewCount?: number | null;
  matchRate: number;
};

const REC_CARD_MIN_WIDTH = 130;
const REC_GAP = 10;
const LINK_TEXT = '読んでみる';
const REC_SCALE = 0.8;
const BACKGROUND_URL = '/ilust/back.png';
const LOGO_URL = '/ilust/inari_thinking_opening.png';
const SHARE_CAPTURE_LOGO_URL = '/ilust/eronator_logo.jpg';

/** 推薦モード本番（モバイル）：Stage 内キャンバス論理高さ 800×1.5 に対し縦 1.05 倍（1260px） */
const MOBILE_RECOMMEND_CANVAS_BODY_PX = 1260;
/** モバイルタグ流れ：「ひとつ前」絶対配置で本文と重ならないよう確保 */
const MOBILE_TAG_FLOW_BACK_RESERVE_PX = 34;

/** ダウンロード用の専用レイアウト（白背景） */
const CAPTURE_WIDTH = 1200;
const CAPTURE_WIDTH_MOBILE = 400;
const CAPTURE_PAD = 16;
const CAPTURE_CARD_GAP = 10;

const CATEGORIES = ['ストーリー', 'プレイ', 'キャラクター'] as const;
type CategoryLabel = (typeof CATEGORIES)[number];

type FrontStep = 'f1' | 'f1_2' | 'f2' | 'f2_2' | 'f3' | 'f3_2';
type BackStep = 's4' | 's5' | 's6' | 's7' | 's8';
type RecommendStep = 'ai_gate' | 'initial' | FrontStep | 'sort1' | BackStep | 'sort2' | 'thinking' | 'results';

/** 有名ステップで「次へ」したときの戻り先（ひとつ前に戻るで1段階ずつ戻す） */
type FrontNavEntry = { returnTo: FrontStep; undoCount: number };
type BackNavEntry = { returnTo: BackStep; undoCount: number };

interface RecommendModeProps {
  onBack: () => void;
}

type FamousTagItem = { tagKey: string; displayName: string; count: number };
type SelectedTag = { tagKey: string; displayName: string; category?: CategoryLabel };
type RankedTag = { tagKey: string; displayName: string; category?: CategoryLabel; rank: 1 | 2 | 3 | 4 | 5 };

/**
 * いま選んでいるタグの要約（ピル型）。PCはOK行の直下。モバイルはOK行の下。整理画面では使わない。
 */
const PICKED_TAGS_ROW_HEIGHT = 64;

function RecommendPickedTagsRow({ tags, isMobile }: { tags: SelectedTag[]; isMobile: boolean }) {
  return (
    <div
      style={{
        marginTop: 6,
        width: '100%',
        maxWidth: 640,
        minHeight: PICKED_TAGS_ROW_HEIGHT,
        maxHeight: PICKED_TAGS_ROW_HEIGHT,
        overflowY: isMobile ? 'hidden' : 'auto',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignContent: 'flex-start',
        alignItems: 'flex-start',
        boxSizing: 'border-box',
      }}
    >
      {tags.map((x) => (
        <span
          key={x.tagKey}
          title={x.displayName}
          style={{
            display: 'inline-block',
            fontSize: isMobile ? 9 : 11,
            fontWeight: 500,
            lineHeight: 1.3,
            padding: isMobile ? '1px 5px' : '4px 10px',
            borderRadius: 9999,
            backgroundColor: '#dbeafe',
            color: '#1d4ed8',
            border: '1px solid #93c5fd',
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box',
            verticalAlign: 'middle',
          }}
        >
          {x.displayName}
        </span>
      ))}
    </div>
  );
}


export function RecommendMode({ onBack }: RecommendModeProps) {
  const isMobile = useMediaQuery(768);
  const [step, setStep] = useState<RecommendStep>('ai_gate');
  const [aiGateChoice, setAiGateChoice] = useState<'YES' | 'NO' | 'DONT_CARE' | null>(null);
  const [popularityChoice, setPopularityChoice] = useState<'famous' | 'hidden' | 'middle' | null>(null);
  const [priorityOrder, setPriorityOrder] = useState<CategoryLabel[]>([]);
  const [famousTags, setFamousTags] = useState<Record<CategoryLabel, FamousTagItem[]>>({
    ストーリー: [],
    プレイ: [],
    キャラクター: [],
  });
  const [selectedFamous, setSelectedFamous] = useState<SelectedTag[]>([]);
  const [rankedFamous, setRankedFamous] = useState<RankedTag[]>([]);
  const [unknownTags, setUnknownTags] = useState<Array<{ tagKey: string; displayName: string; count?: number; isFamous?: boolean }>>([]);
  const [selectedUnknown, setSelectedUnknown] = useState<SelectedTag[]>([]);
  const [rankedFinal, setRankedFinal] = useState<RankedTag[]>([]);
  const [sort1Ranks, setSort1Ranks] = useState<Map<string, 1 | 2 | 3 | 4 | 5>>(new Map());
  const [sort2Ranks, setSort2Ranks] = useState<Map<string, 1 | 2 | 3 | 4 | 5>>(new Map());
  const [stepBeforeSort2, setStepBeforeSort2] = useState<BackStep>('s8');
  /** sort1 に入る直前の有名ステップ（戻る・スタック欠損時） */
  const [stepBeforeSort1, setStepBeforeSort1] = useState<FrontStep>('f1');
  const [recommendedWorks, setRecommendedWorks] = useState<WorkResult[]>([]);
  const [totalMatched, setTotalMatched] = useState(0);
  const [famousTagKeysAll, setFamousTagKeysAll] = useState<string[]>([]);
  const [displayedFamousKeys, setDisplayedFamousKeys] = useState<Set<string>>(new Set());
  const [debugData, setDebugData] = useState<RecommendDebugData | null>(null);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [recommendCopy, setRecommendCopy] = useState<RecommendCopy | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const mobileResultRef = useRef<HTMLDivElement>(null);
  const [captureMosaic, setCaptureMosaic] = useState(false);

  const [recommendSessionId] = useState(() =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `rec-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const sessionStartedAtRef = useRef<number>(Date.now());
  const stepTransitionsRef = useRef<Array<{ step: string; at: number }>>([]);

  const rc = recommendCopy ?? {
    aiGatePreamble: 'あなたの好みは？',
    aiGateMain: 'AI生成作品？それとも違う？',
    initialMain: 'あなたの好みは？',
    initialPriorityQuestion: 'あなたが優先したいのは？順位をつけて！',
    questionFamous: 'あなたが望む同人誌にはどんな特徴がある？ 3つまで選んで！',
    questionUnknown: 'この中に欲しい特徴はある？ 3つまで選んで！',
    sortPrompt: '今選んでいる要素を、好きな順に５つ並べて',
    thinkingText: 'あなたにぴったりの作品を探しているわ…',
    btnNext: '次へ',
    btnRetry: 'やり直し',
    btnOk: 'これでok',
    btnNotInList: 'この中にはない',
    btnFix: '修正する',
    btnFixRecommend: 'ひとつ前に戻る',
    btnTopReset: 'トップに戻る',
    recommendResultsHeading: 'こんな作品なんてどう？',
  };

  /** 推薦フロー内の「戻る」（やり直しと区別） */
  const rcFixBack = (rc as RecommendCopy).btnFixRecommend?.trim()
    ? (rc as RecommendCopy).btnFixRecommend!
    : (rc.btnFix ?? 'ひとつ前に戻る');

  const isDebugLocal =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || localStorage.getItem('eronator.debugEnabled') === '1');

  /** デバッグ用: 結果表示画面へ強制遷移（ダミーデータ使用） */
  const handleForceNavigateToResults = useCallback(() => {
    const DUMMY_WORKS: WorkResult[] = [
      { workId: 'debug-1', title: 'デバッグ作品1', authorName: 'デバッグ作者', productUrl: 'https://www.dmm.co.jp/', matchRate: 92 },
      { workId: 'debug-2', title: 'デバッグ作品2', authorName: 'デバッグ作者', productUrl: 'https://www.dmm.co.jp/', matchRate: 88 },
      { workId: 'debug-3', title: 'デバッグ作品3', authorName: 'デバッグ作者', productUrl: 'https://www.dmm.co.jp/', matchRate: 85 },
      { workId: 'debug-4', title: 'デバッグ作品4', authorName: 'デバッグ作者', productUrl: 'https://www.dmm.co.jp/', matchRate: 82 },
      { workId: 'debug-5', title: 'デバッグ作品5', authorName: 'デバッグ作者', productUrl: 'https://www.dmm.co.jp/', matchRate: 78 },
      { workId: 'debug-6', title: 'デバッグ作品6', authorName: 'デバッグ作者', productUrl: 'https://www.dmm.co.jp/', matchRate: 75 },
      { workId: 'debug-7', title: 'デバッグ作品7', authorName: 'デバッグ作者', productUrl: 'https://www.dmm.co.jp/', matchRate: 72 },
      { workId: 'debug-8', title: 'デバッグ作品8', authorName: 'デバッグ作者', productUrl: 'https://www.dmm.co.jp/', matchRate: 68 },
      { workId: 'debug-9', title: 'デバッグ作品9', authorName: 'デバッグ作者', productUrl: 'https://www.dmm.co.jp/', matchRate: 65 },
      { workId: 'debug-10', title: 'デバッグ作品10', authorName: 'デバッグ作者', productUrl: 'https://www.dmm.co.jp/', matchRate: 62 },
    ];
    setRecommendedWorks(DUMMY_WORKS);
    setTotalMatched(100);
    setStep('results');
    setDebugData({
      phase: 'results',
      tagsWithWeights: [{ tagKey: 'debug', displayName: 'デバッグ用', weight: 1, source: '強制遷移' }],
      works: DUMMY_WORKS.map((w, i) => ({ workId: w.workId, title: w.title, matchRate: w.matchRate, score: w.matchRate / 100, tags: [] })),
    });
  }, []);

  const loadFamousTags = useCallback(async () => {
    try {
      const res = await fetch('/api/recommend');
      const data = await res.json();
      if (data.success && data.tags) {
        setFamousTags({
          ストーリー: data.tags['ストーリー'] ?? [],
          プレイ: data.tags['プレイ'] ?? [],
          キャラクター: data.tags['キャラクター'] ?? [],
        });
        const all: string[] = [];
        for (const cat of CATEGORIES) {
          for (const t of data.tags[cat] ?? []) all.push(t.tagKey);
        }
        setFamousTagKeysAll(all);
      }
    } catch (e) {
      console.error('Failed to load famous tags', e);
    }
  }, []);

  useEffect(() => {
    loadFamousTags();
  }, [loadFamousTags]);

  useEffect(() => {
    fetch('/api/config/recommend')
      .then((r) => r.ok ? r.json() : null)
      .then((d: { recommendCopy?: RecommendCopy } | null) => {
        if (d?.recommendCopy) setRecommendCopy(d.recommendCopy);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    stepTransitionsRef.current.push({ step: String(step), at: Date.now() });
  }, [step]);

  const resetInitial = () => {
    setPopularityChoice(null);
    setPriorityOrder([]);
  };

  const addToPriority = (cat: CategoryLabel) => {
    if (priorityOrder.includes(cat)) return;
    if (priorityOrder.length >= 3) return;
    setPriorityOrder(prev => [...prev, cat]);
  };

  const canProceedFromInitial = popularityChoice !== null && priorityOrder.length === 3;

  const getFamousOptionsForStep = (s: FrontStep): FamousTagItem[] => {
    const p1 = priorityOrder[0];
    const p2 = priorityOrder[1];
    const p3 = priorityOrder[2];
    if (!p1) return [];
    if (s === 'f1') return famousTags[p1].slice(0, 20);
    if (s === 'f1_2') return famousTags[p1].slice(20, 40);
    if (s === 'f2' && p2) return famousTags[p2].slice(0, 20);
    if (s === 'f2_2' && p2) return famousTags[p2].slice(20, 40);
    if (s === 'f3' && p3) return famousTags[p3].slice(0, 20);
    if (s === 'f3_2' && p3) return famousTags[p3].slice(20, 40);
    return [];
  };

  const FRONT_STEPS: FrontStep[] = ['f1', 'f1_2', 'f2', 'f2_2', 'f3', 'f3_2'];
  const getNextFrontStep = (current: FrontStep): FrontStep | 'sort1' => {
    const idx = FRONT_STEPS.indexOf(current);
    if (idx < 0 || idx >= FRONT_STEPS.length - 1) return 'sort1';
    return FRONT_STEPS[idx + 1]!;
  };
  /** 2+選択時：次のカテゴリへ（_2をスキップ） */
  const getNextCategoryStep = (current: FrontStep): FrontStep | 'sort1' => {
    if (current === 'f1' || current === 'f1_2') return 'f2';
    if (current === 'f2' || current === 'f2_2') return 'f3';
    return 'sort1';
  };

  /** 「これでok」直後の遷移先（バリデーション・ボタン無効化と共通） */
  const getNextFrontStepAfterOk = (s: FrontStep, addedTags: SelectedTag[], skipAdding: boolean): FrontStep | 'sort1' => {
    const addedLen = skipAdding ? 0 : addedTags.length;
    const needExtraPage = addedLen <= 1;
    const isSecondPage = s.endsWith('_2');
    if (isSecondPage) return getNextFrontStep(s);
    if (needExtraPage || skipAdding) {
      return (s === 'f1' ? 'f1_2' : s === 'f2' ? 'f2_2' : 'f3_2') as FrontStep;
    }
    return getNextCategoryStep(s);
  };

  const currentFamousOptions = ['f1', 'f1_2', 'f2', 'f2_2', 'f3', 'f3_2'].includes(step as string)
    ? getFamousOptionsForStep(step as FrontStep)
    : [];
  const [checkedFamous, setCheckedFamous] = useState<Set<string>>(new Set());
  const [checkedUnknown, setCheckedUnknown] = useState<Set<string>>(new Set());
  const [lastAddedFamousCount, setLastAddedFamousCount] = useState(0);
  const [frontNavStack, setFrontNavStack] = useState<FrontNavEntry[]>([]);
  const [backNavStack, setBackNavStack] = useState<BackNavEntry[]>([]);
  /** カテゴリ内で1件も選べていないときの警告（これでok 抑止） */
  const [famousPickWarning, setFamousPickWarning] = useState<string | null>(null);

  const selectedFamousRef = useRef<SelectedTag[]>([]);
  const frontNavStackRef = useRef<FrontNavEntry[]>([]);
  const selectedUnknownRef = useRef<SelectedTag[]>([]);
  const backNavStackRef = useRef<BackNavEntry[]>([]);
  const unknownTagsForBackRef = useRef<Array<{ tagKey: string; displayName: string; count?: number; isFamous?: boolean }>>([]);

  selectedFamousRef.current = selectedFamous;
  frontNavStackRef.current = frontNavStack;
  selectedUnknownRef.current = selectedUnknown;
  backNavStackRef.current = backNavStack;
  unknownTagsForBackRef.current = unknownTags;

  const MAX_SELECT = 3;
  const toggleFamous = (tagKey: string, displayName: string, category: CategoryLabel) => {
    setFamousPickWarning(null);
    setCheckedFamous(prev => {
      const next = new Set(prev);
      if (next.has(tagKey)) next.delete(tagKey);
      else if (next.size < MAX_SELECT) next.add(tagKey);
      return next;
    });
  };

  const toggleUnknown = (tagKey: string, displayName: string) => {
    setCheckedUnknown(prev => {
      const next = new Set(prev);
      if (next.has(tagKey)) next.delete(tagKey);
      else if (next.size < MAX_SELECT) next.add(tagKey);
      return next;
    });
  };

  const countCategoryAfterAdd = (targetCat: CategoryLabel, added: SelectedTag[]) =>
    selectedFamous.filter(t => t.category === targetCat).length + added.filter(t => t.category === targetCat).length;

  const goNextFromFamous = (skipAdding?: boolean) => {
    const s = step as FrontStep;
    const cat = s.startsWith('f1') ? priorityOrder[0]! : s.startsWith('f2') ? priorityOrder[1]! : priorityOrder[2]!;
    const added: SelectedTag[] = skipAdding ? [] : (() => {
      const a: SelectedTag[] = [];
      for (const key of checkedFamous) {
        const opt = currentFamousOptions.find(o => o.tagKey === key);
        if (opt) a.push({ tagKey: key, displayName: opt.displayName, category: cat });
      }
      return a;
    })();

    const nextStep = getNextFrontStepAfterOk(s, added, Boolean(skipAdding));

    const hint = (rc as RecommendCopy).famousPickMinHint ?? '１個くらい気になるやつ選んでよ！';
    const isSecondFamousPage = s.endsWith('_2');
    /** 1ページ目: 「この中にはない」は予備(_2)へ進める。_2ページ目: カテゴリ合計0のまま「この中にはない」は不可 */
    if (isSecondFamousPage && skipAdding && countCategoryAfterAdd(cat, []) < 1) {
      setFamousPickWarning(hint);
      return;
    }
    /** このカテゴリ（1+1-2 合算）で1件も無いときは「これでok」不可 */
    if (!skipAdding && countCategoryAfterAdd(cat, added) < 1) {
      setFamousPickWarning(hint);
      return;
    }
    setFamousPickWarning(null);

    setLastAddedFamousCount(added.length);
    setSelectedFamous(prev => {
      const keys = new Set(prev.map(x => x.tagKey));
      const toAdd = added.filter(x => !keys.has(x.tagKey));
      return [...prev, ...toAdd];
    });
    setDisplayedFamousKeys(prev => {
      const next = new Set(prev);
      for (const opt of currentFamousOptions) next.add(opt.tagKey);
      return next;
    });
    setCheckedFamous(new Set());

    if (nextStep === 'sort1') {
      setStepBeforeSort1(s);
    }
    setFrontNavStack(prev => [...prev, { returnTo: s, undoCount: added.length }]);
    setStep(nextStep);
  };

  const fetchUnknownAndGoToS4 = async (rankedList: RankedTag[]) => {
    try {
      const res = await fetch('/api/recommend/unknown-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rankedFamous: rankedList.map(t => ({ tagKey: t.tagKey, rank: t.rank })),
          displayedFamousKeys: Array.from(displayedFamousKeys),
          priorityOrder,
          famousTagKeys: famousTagKeysAll,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tags) && data.tags.length > 0) {
        setUnknownTags(data.tags);
        setBackNavStack([]);
        setStep('s4');
        if (isDebugLocal) {
          setDebugData({
            phase: 'q4',
            selectedFamous: rankedList.map(t => ({
              tagKey: t.tagKey,
              displayName: t.displayName,
              weight: 6 - t.rank,
              important: false,
            })),
            unknownTagsWithCount: data.tags.map((x: { tagKey: string; displayName: string; count?: number }) => ({
              tagKey: x.tagKey,
              displayName: x.displayName,
              count: x.count ?? 0,
            })),
          });
        }
      } else {
        setStep('thinking');
        submitRecommend(rankedList);
      }
    } catch (e) {
      console.error('Failed to fetch unknown tags', e);
      setStep('thinking');
      submitRecommend(rankedList);
    }
  };

  const BACK_STEPS: BackStep[] = ['s4', 's5', 's6', 's7', 's8'];
  const getBackBatchStart = (s: BackStep) => {
    const idx = BACK_STEPS.indexOf(s);
    return idx >= 0 ? idx * 20 : 0;
  };

  const buildCheckedUnknownKeys = (
    target: BackStep,
    sel: SelectedTag[],
    tags: Array<{ tagKey: string; displayName: string; count?: number; isFamous?: boolean }>,
  ) => {
    const start = getBackBatchStart(target);
    const batchKeys = new Set(tags.slice(start, start + 20).map(x => x.tagKey));
    const next = new Set<string>();
    for (const x of sel) {
      if (batchKeys.has(x.tagKey)) next.add(x.tagKey);
    }
    return next;
  };

  /** 後半の質問画面へ戻したとき、確定済みタグを現在バッチのチェックに反映（sort2 からの復帰用） */
  const syncCheckedUnknownForBackStep = (target: BackStep, sel: SelectedTag[]) => {
    setCheckedUnknown(buildCheckedUnknownKeys(target, sel, unknownTags));
  };

  const goNextFromUnknown = (skipAdding?: boolean) => {
    const s = step as BackStep;
    const start = getBackBatchStart(s);
    const batch = unknownTags.slice(start, start + 20);
    const added: SelectedTag[] = skipAdding ? [] : (() => {
      const a: SelectedTag[] = [];
      for (const key of checkedUnknown) {
        const t = batch.find(x => x.tagKey === key) ?? unknownTags.find(x => x.tagKey === key);
        if (t) a.push({ tagKey: key, displayName: t.displayName });
      }
      return a;
    })();
    const keysExisting = new Set(selectedUnknown.map(x => x.tagKey));
    const dedupAdded = added.filter(x => !keysExisting.has(x.tagKey));
    const mergedUnknown = [...selectedUnknown, ...dedupAdded];
    setSelectedUnknown(mergedUnknown);
    setCheckedUnknown(new Set());
    setBackNavStack(prev => [...prev, { returnTo: s, undoCount: added.length }]);

    const idx = BACK_STEPS.indexOf(s);
    const goSort2 = () => {
      setStepBeforeSort2(s);
      setStep('sort2');
    };
    if (skipAdding) {
      if (idx < 4) setStep(BACK_STEPS[idx + 1]!);
      else goSort2();
    } else {
      if (idx < 2) {
        setStep(BACK_STEPS[idx + 1]!);
      } else if (idx === 2) {
        if (mergedUnknown.length > 0) goSort2();
        else setStep('s7');
      } else if (idx === 3) {
        if (mergedUnknown.length > 0) goSort2();
        else setStep('s8');
      } else {
        goSort2();
      }
    }
  };

  const submitRecommend = async (finalRanked?: RankedTag[]) => {
    const ranked = finalRanked ?? rankedFinal;
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          popularityChoice: popularityChoice ?? undefined,
          rankedFinal: ranked.map(t => ({ tagKey: t.tagKey, rank: t.rank })),
          famousTagKeys: famousTagKeysAll,
          debug: isDebugLocal,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.recommendedWorks)) {
        setRecommendedWorks(data.recommendedWorks);
        setTotalMatched(data.totalMatched ?? 0);
        setStep('results');
        if (isDebugLocal && data.debug) {
          setDebugData({
            phase: 'results',
            tagsWithWeights: data.debug.tagsWithWeights ?? [],
            works: data.debug.works ?? [],
          });
        }
        const recs = data.recommendedWorks as WorkResult[];
        const sort1Obj = Object.fromEntries(sort1Ranks);
        const sort2Obj = Object.fromEntries(sort2Ranks);
        const detail = {
          version: 1 as const,
          recommendSessionId,
          sessionStartedAt: new Date(sessionStartedAtRef.current).toISOString(),
          endedAt: new Date().toISOString(),
          totalDurationMs: Date.now() - sessionStartedAtRef.current,
          aiGateChoice,
          popularityChoice,
          priorityOrder,
          stepTransitions: stepTransitionsRef.current,
          rankedFamous: rankedFamous.map(t => ({
            tagKey: t.tagKey,
            displayName: t.displayName,
            rank: t.rank,
            category: t.category,
          })),
          selectedFamous,
          selectedUnknown,
          sort1Ranks: sort1Obj,
          sort2Ranks: sort2Obj,
          rankedFinal: ranked.map(t => ({
            tagKey: t.tagKey,
            displayName: t.displayName,
            rank: t.rank,
            category: t.category,
          })),
          recommendedWorks: recs.map(w => ({
            workId: w.workId,
            title: w.title,
            authorName: w.authorName,
            productUrl: w.productUrl,
            matchRate: w.matchRate,
          })),
          totalMatched: data.totalMatched ?? 0,
          isMobile,
        };
        const top = recs[0];
        void (async () => {
          try {
            const res = await fetch('/api/recommend/play-history', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                recommendSessionId,
                sessionStartedAt: new Date(sessionStartedAtRef.current).toISOString(),
                detail,
                topWorkId: top?.workId ?? null,
                topWorkTitle: top?.title ?? null,
              }),
            });
            if (!res.ok) {
              const errText = await res.text().catch(() => '');
              console.warn('[recommend] play-history save failed', res.status, errText.slice(0, 300));
            }
          } catch (err) {
            console.warn('[recommend] play-history save error', err);
          }
        })();
      } else {
        setStep('initial');
      }
    } catch (e) {
      console.error('Recommend submit failed', e);
      setStep('initial');
    }
  };

  const currentUnknownBatch = ['s4', 's5', 's6', 's7', 's8'].includes(step as string)
    ? unknownTags.slice(getBackBatchStart(step as BackStep), getBackBatchStart(step as BackStep) + 20)
    : [];

  /** 早期 return より前（hooks 順序） */
  const isFamousStep = ['f1', 'f1_2', 'f2', 'f2_2', 'f3', 'f3_2'].includes(step as string);
  const isBackStep = ['s4', 's5', 's6', 's7', 's8'].includes(step as string);
  const famousCatForPicked =
    isFamousStep && priorityOrder.length >= 3
      ? (step as string).startsWith('f1')
        ? priorityOrder[0]!
        : (step as string).startsWith('f2')
          ? priorityOrder[1]!
          : priorityOrder[2]!
      : null;

  const frontPickedTagsDisplay = useMemo(() => {
    const seen = new Set<string>();
    const out: SelectedTag[] = [];
    for (const x of selectedFamous) {
      if (!seen.has(x.tagKey)) {
        seen.add(x.tagKey);
        out.push(x);
      }
    }
    if (famousCatForPicked) {
      for (const key of checkedFamous) {
        if (seen.has(key)) continue;
        const opt = currentFamousOptions.find(o => o.tagKey === key);
        if (opt) {
          seen.add(key);
          out.push({ tagKey: key, displayName: opt.displayName, category: famousCatForPicked });
        }
      }
    }
    return out;
  }, [selectedFamous, checkedFamous, currentFamousOptions, famousCatForPicked]);

  const backPickedTagsDisplay = useMemo(() => {
    const seen = new Set<string>();
    const out: SelectedTag[] = [];
    for (const x of selectedUnknown) {
      if (!seen.has(x.tagKey)) {
        seen.add(x.tagKey);
        out.push(x);
      }
    }
    for (const key of checkedUnknown) {
      if (seen.has(key)) continue;
      const row = currentUnknownBatch.find(y => y.tagKey === key) ?? unknownTags.find(y => y.tagKey === key);
      if (row) {
        seen.add(key);
        out.push({ tagKey: key, displayName: row.displayName });
      }
    }
    return out;
  }, [selectedUnknown, checkedUnknown, currentUnknownBatch, unknownTags]);

  if (step === 'ai_gate') {
    return (
      <>
      <Stage
        characterVariant="usually"
        mobileExtendWhiteboard={isMobile}
      >
        <>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '100%',
              ...(isMobile
                ? { minHeight: '100%', justifyContent: 'center', boxSizing: 'border-box', padding: '12px 0 20px' }
                : {}),
            }}
          >
            <div style={{ marginBottom: 12, textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: isMobile ? 14 : 15 }}>{rc.aiGatePreamble}</p>
              <p style={{ margin: '4px 0 0 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 16 : 17 }}>{rc.aiGateMain}</p>
            </div>
            <AiGate onSelect={choice => { setAiGateChoice(choice); setStep('initial'); }} />
            <div style={{ marginTop: 16, width: '100%', maxWidth: 320, display: 'flex', justifyContent: 'flex-end' }}>
              <button
              type="button"
              onClick={onBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                fontSize: 14,
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: 6,
                color: 'var(--color-text-muted)',
              }}
            >
              <svg style={{ width: 16, height: 16 }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
                {rc.btnTopReset}
              </button>
            </div>
          </div>
        </>
      </Stage>
        {isDebugLocal && (
          <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />
        )}
      </>
    );
  }

  if (step === 'thinking') {
    return (
      <>
        <Stage
          characterVariant="thinking"
          thinkingSubType="opening"
          characterSpeech={
            isMobile ? undefined : (
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: 20 }}>
                {rc.thinkingText}
              </p>
            )
          }
          mobileHideCharacter={isMobile}
          mobileExtendWhiteboard={isMobile}
          whiteboardWide={true}
          mobileCanvasBodyHeightPx={isMobile ? MOBILE_RECOMMEND_CANVAS_BODY_PX : undefined}
        >
          {isMobile ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100%',
                textAlign: 'center',
                padding: '12px 8px',
                boxSizing: 'border-box',
              }}
            >
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: 16, lineHeight: 1.45 }}>
                {rc.thinkingText}
              </p>
            </div>
          ) : null}
        </Stage>
        {isDebugLocal && (
          <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />
        )}
      </>
    );
  }

  if (step === 'results') {
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}?result=recommend` : '';
    const shareText = '【ERONATOR】おすすめ10件をもらった！ あなたの妄想、エロネイターが当ててみる？\n#エロネイター';
    const tweetIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

    const handleSharePC = (withMosaic?: boolean) => {
      const el = resultRef.current;
      if (!el) return;
      const doCapture = () => {
        html2canvas(el, { scale: 2, useCORS: true })
          .then(canvas => {
            canvas.toBlob(
              blob => {
                if (!blob) return;
                const downloadUrl = URL.createObjectURL(blob);
                const downloadLink = document.createElement('a');
                downloadLink.href = downloadUrl;
                downloadLink.download = withMosaic ? 'eronator-result-mosaic.png' : 'eronator-result.png';
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                URL.revokeObjectURL(downloadUrl);
                if (withMosaic) setCaptureMosaic(false);
              },
              'image/png'
            );
          })
          .catch(err => {
            console.error('キャプチャ失敗:', err);
            if (withMosaic) setCaptureMosaic(false);
          });
      };
      if (withMosaic) {
        setCaptureMosaic(true);
        setTimeout(doCapture, 1200);
      } else {
        doCapture();
      }
    };

    const handleShareMobile = (withMosaic?: boolean) => {
      const el = mobileResultRef.current;
      if (!el) return;
      const doCapture = () => {
        html2canvas(el, { scale: 2, useCORS: true })
          .then(canvas => {
            canvas.toBlob(
              blob => {
                if (!blob) return;
                const downloadUrl = URL.createObjectURL(blob);
                const downloadLink = document.createElement('a');
                downloadLink.href = downloadUrl;
                downloadLink.download = withMosaic ? 'eronator-result-mosaic.png' : 'eronator-result.png';
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                URL.revokeObjectURL(downloadUrl);
                if (withMosaic) setCaptureMosaic(false);
              },
              'image/png'
            );
          })
          .catch(err => {
            console.error('キャプチャ失敗:', err);
            if (withMosaic) setCaptureMosaic(false);
          });
      };
      if (withMosaic) {
        setCaptureMosaic(true);
        setTimeout(doCapture, 1200);
      } else {
        doCapture();
      }
    };

    if (isMobile) {
      return (
        <>
        {/* モバイル用ダウンロード：縦2列レイアウト */}
        <div
          ref={mobileResultRef}
          style={{
            position: 'fixed',
            left: -9999,
            top: 0,
            width: CAPTURE_WIDTH_MOBILE,
            backgroundColor: '#fff',
            padding: CAPTURE_PAD,
            boxSizing: 'border-box',
            zIndex: -1,
          }}
          aria-hidden
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 8 }}>
            <img src={SHARE_CAPTURE_LOGO_URL} alt="ERONATOR" style={{ height: 32, width: 'auto', maxWidth: '48%', marginBottom: 4 }} />
            <p
              style={{
                margin: 0,
                padding: '0 6px',
                fontSize: 11,
                fontWeight: 700,
                color: '#1f2937',
                lineHeight: 1.35,
                textAlign: 'center',
              }}
            >
              {rc.recommendResultsHeading ?? 'こんな作品なんてどう？'}
            </p>
          </div>
          <MobileRecommendCaptureGrid works={recommendedWorks} captureMosaic={captureMosaic} maxItems={10} />
        </div>
        <div
          style={{
            position: 'relative',
            minHeight: '100dvh',
            width: '100%',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            paddingTop: 4,
            paddingBottom: 0,
          }}
        >
          <div style={{ position: 'fixed', inset: 0, backgroundImage: `url(${BACKGROUND_URL})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(10px)', zIndex: -2, pointerEvents: 'none' }} />
          <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.7) 100%)', zIndex: -1, pointerEvents: 'none' }} />
          <div style={{ width: '100%', maxWidth: 600, padding: '12px 14px 32px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 0, zIndex: 10 }}>
            <div style={{ fontSize: 14, color: 'var(--color-text)', margin: '0 0 10px 0', fontWeight: 500, padding: '8px 12px', backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              {rc.recommendResultsHeading ?? 'こんな作品なんてどう？'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {recommendedWorks.slice(0, 10).map(rec => (
                <MobileWorkCardHorizontal key={rec.workId} work={rec} showFanzaLink={true} matchRate={rec.matchRate} matchRateLabel="好みマッチ度" recommendSessionId={recommendSessionId} recommendFanzaWorkId={rec.workId} />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
              <ResultScreenFourButtons
                onSavePlain={() => handleShareMobile(false)}
                onSaveMosaic={() => handleShareMobile(true)}
                onPost={() => window.open(tweetIntent, '_blank', 'noopener,noreferrer')}
                onBackToTop={onBack}
                isMobile
              />
            </div>
          </div>
        </div>
        {isDebugLocal && (
          <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />
        )}
      </>
      );
    }

    return (
      <>
      {/* ダウンロード用：画面外に固定サイズでレンダー */}
      <div
        ref={resultRef}
        style={{
          position: 'fixed',
          left: -9999,
          top: 0,
          width: CAPTURE_WIDTH,
          backgroundColor: '#fff',
          padding: CAPTURE_PAD,
          boxSizing: 'border-box',
          zIndex: -1,
        }}
        aria-hidden
      >
        {/* 上段：ロゴ＋結果見出し（保存画像用） */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 }}>
          <img
            src={SHARE_CAPTURE_LOGO_URL}
            alt="ERONATOR"
            style={{ height: 38, width: 'auto', maxWidth: '42%', marginBottom: 4 }}
          />
          <p
            style={{
              margin: 0,
              padding: '0 12px',
              fontSize: 13,
              fontWeight: 700,
              color: '#1f2937',
              lineHeight: 1.35,
              textAlign: 'center',
            }}
          >
            {rc.recommendResultsHeading ?? 'こんな作品なんてどう？'}
          </p>
        </div>
        {/* 作品カード：5列グリッド、余白ギリギリまで拡大 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: CAPTURE_CARD_GAP,
          }}
        >
          {recommendedWorks.slice(0, 10).map(rec => (
            <div
              key={rec.workId}
              style={{
                padding: 10,
                backgroundColor: '#fafafa',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}
            >
              {typeof rec.matchRate === 'number' && (
                <div style={{ marginBottom: 6 }}>
                  <p style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, margin: '0 0 2px 0', lineHeight: 1.2 }}>好みマッチ度</p>
                  <p style={{ fontSize: 16, color: '#059669', fontWeight: 700, margin: 0, lineHeight: 1.2, letterSpacing: '0.02em' }}>{Number(rec.matchRate).toFixed(1)}％</p>
                </div>
              )}
              <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
                {captureMosaic ? (
                  <MosaicImage
                    src={`/api/thumbnail?workId=${encodeURIComponent(rec.workId)}`}
                    alt={rec.title}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <img
                    src={`/api/thumbnail?workId=${encodeURIComponent(rec.workId)}`}
                    alt={rec.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#1f2937', margin: '0 0 2px 0', lineHeight: 1.3, minHeight: 31, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                {rec.title}
              </p>
              <p style={{ fontSize: 10, color: '#6b7280', margin: 0 }}>{rec.authorName}</p>
            </div>
          ))}
        </div>
      </div>
      <Stage
        characterVariant="usually"
        characterSpeech={
          <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: 20 }}>{rc.recommendResultsHeading ?? 'こんな作品なんてどう？'}</p>
        }
        whiteboardWide={true}
      >
        <RecommendResultsGrid
          works={recommendedWorks}
          totalMatched={totalMatched}
          onBack={onBack}
          shareUrl={shareUrl}
          shareText={shareText}
          onSharePC={handleSharePC}
          isMobile={false}
          recommendSessionId={recommendSessionId}
        />
      </Stage>
      {isDebugLocal && (
        <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />
      )}
      </>
    );
  }

  const INITIAL_BTN_BASE = '#3b82f6';
  const INITIAL_BTN_LIGHT = ['#3b82f6', '#60a5fa', '#93c5fd'] as const;
  const initBtnBase = {
    padding: isMobile ? '10px 14px' : '12px 18px',
    fontSize: isMobile ? 15 : 14,
    fontWeight: 500,
    borderRadius: 12,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    boxSizing: 'border-box' as const,
  };

  if (step === 'initial') {
    return (
      <>
      <Stage
        characterVariant="usually"
        mobileExtendWhiteboard={isMobile}
        mobileWhiteboardZoom={isMobile ? 1.3 : undefined}
        mobileWhiteboardPadding={isMobile ? '8px 10px' : undefined}
        whiteboardWide={true}
      >
        <div style={{ padding: isMobile ? '0.25rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
          {isMobile && <div style={{ height: 28 }} />}
          <p style={{ margin: isMobile ? '0 0 6px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 16 : 17, lineHeight: 1.3 }}>
            {rc.initialMain}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 4 : 8, marginBottom: isMobile ? 8 : 32, ...(isMobile ? { width: '80%', maxWidth: '100%', marginLeft: 'auto', boxSizing: 'border-box' as const } : {}) }}>
            {[
              { value: 'famous' as const, label: 'やっぱり有名作品！' },
              { value: 'hidden' as const, label: '隠れた名作！' },
              { value: 'middle' as const, label: '中間くらいの作品！' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPopularityChoice(value)}
                style={{
                  ...(isMobile
                    ? { ...initBtnBase, padding: '11px 16px', fontSize: 18, minHeight: 50, borderRadius: 10, fontWeight: 500 }
                    : initBtnBase),
                  backgroundColor: popularityChoice === value ? '#dbeafe' : '#faf8f5',
                  color: popularityChoice === value ? '#1d4ed8' : 'var(--color-text)',
                  border: popularityChoice === value ? `2px solid ${INITIAL_BTN_BASE}` : '2px solid #e5e7eb',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p style={{ margin: isMobile ? '4px 0 4px 0' : '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 16 : 17, lineHeight: 1.3 }}>
            {rc.initialPriorityQuestion}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: isMobile ? 4 : 8, marginBottom: isMobile ? 6 : 20, ...(isMobile ? { width: '80%', maxWidth: '100%', marginLeft: 'auto', boxSizing: 'border-box' as const } : {}) }}>
            {CATEGORIES.map((cat) => {
              const idx = priorityOrder.indexOf(cat);
              const selected = idx >= 0;
              const shade = selected ? INITIAL_BTN_LIGHT[idx]! : INITIAL_BTN_BASE;
              return (
                <button
                  key={cat}
                  onClick={() => addToPriority(cat)}
                  style={{
                    ...(isMobile
                      ? { ...initBtnBase, padding: '11px 16px', fontSize: 18, minHeight: 50, borderRadius: 10, fontWeight: 500 }
                      : initBtnBase),
                    backgroundColor: selected ? `${shade}22` : '#faf8f5',
                    color: selected ? '#1d4ed8' : 'var(--color-text)',
                    border: selected ? `2px solid ${shade}` : '2px solid #e5e7eb',
                    gap: 6,
                  }}
                >
                  {cat}
                  {selected && <span style={{ fontSize: isMobile ? 12 : 13, fontWeight: 'bold' }}>{['①', '②', '③'][idx]}</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'nowrap', gap: isMobile ? 8 : 12, alignItems: 'stretch', ...(isMobile ? { width: '80%', maxWidth: '100%', marginLeft: 'auto', boxSizing: 'border-box' as const } : {}) }}>
            <button
              onClick={() => {
              if (!canProceedFromInitial) return;
              setFrontNavStack([]);
              setStep('f1');
            }}
              disabled={!canProceedFromInitial}
              style={{
                flex: isMobile ? '1.22 1 0' : undefined,
                minWidth: 0,
                padding: isMobile ? '12px 14px' : '16px 32px',
                fontSize: isMobile ? 17 : 17,
                minHeight: isMobile ? 48 : undefined,
                fontWeight: 600,
                backgroundColor: canProceedFromInitial ? INITIAL_BTN_BASE : '#e5e7eb',
                color: canProceedFromInitial ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: isMobile ? 10 : 12,
                cursor: canProceedFromInitial ? 'pointer' : 'not-allowed',
                boxSizing: 'border-box',
              }}
            >
              {rc.btnNext}
            </button>
            <button
              onClick={resetInitial}
              style={{
                flex: isMobile ? '1 1 0' : undefined,
                minWidth: 0,
                padding: isMobile ? '12px 14px' : '10px 20px',
                fontSize: isMobile ? 17 : 14,
                minHeight: isMobile ? 48 : undefined,
                fontWeight: 600,
                backgroundColor: 'transparent',
                color: 'var(--color-text-muted)',
                border: '1px solid #d1d5db',
                borderRadius: isMobile ? 10 : 8,
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {rc.btnRetry}
            </button>
          </div>
          <div style={{ marginTop: isMobile ? 12 : 16, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setStep('ai_gate')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? 6 : 5,
                padding: isMobile ? '6px 10px' : '5px 8px',
                fontSize: isMobile ? 12 : 10,
                cursor: 'pointer',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: isMobile ? 6 : 5,
                color: 'var(--color-text-muted)',
              }}
            >
              <svg style={{ width: isMobile ? 14 : 16, height: isMobile ? 14 : 16 }} viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
              </svg>
              {rcFixBack}
            </button>
          </div>
        </div>
      </Stage>
      {isDebugLocal && (
        <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />
      )}
      </>
    );
  }

  const buildCheckedFamousKeys = (target: FrontStep, sel: SelectedTag[]) => {
    const opts = getFamousOptionsForStep(target);
    const optKeys = new Set(opts.map(o => o.tagKey));
    return new Set(sel.filter(x => optKeys.has(x.tagKey)).map(x => x.tagKey));
  };

  const handleBackFromSort1 = () => {
    setSort1Ranks(new Map());
    const prevStack = frontNavStackRef.current;
    const sel = selectedFamousRef.current;
    if (prevStack.length === 0) {
      const target = stepBeforeSort1;
      setCheckedFamous(buildCheckedFamousKeys(target, sel));
      setStep(target);
      return;
    }
    const ent = prevStack[prevStack.length - 1]!;
    const nextStack = prevStack.slice(0, -1);
    if (ent.undoCount <= 0) {
      setSelectedFamous(sel);
      setCheckedFamous(buildCheckedFamousKeys(ent.returnTo, sel));
    } else {
      const popped = sel.slice(-ent.undoCount);
      setSelectedFamous(sel.slice(0, -ent.undoCount));
      setCheckedFamous(new Set(popped.map(x => x.tagKey)));
    }
    setFrontNavStack(nextStack);
    setStep(ent.returnTo);
  };

  const handleTagFlowBackOne = () => {
    const s = step as FrontStep | BackStep;
    setFamousPickWarning(null);
    if (s === 'f1') {
      setFrontNavStack([]);
      setCheckedFamous(new Set());
      setStep('initial');
    } else if (isFamousStep) {
      const prevStack = frontNavStackRef.current;
      if (prevStack.length === 0) return;
      const ent = prevStack[prevStack.length - 1]!;
      const nextStack = prevStack.slice(0, -1);
      const sel = selectedFamousRef.current;
      if (ent.undoCount <= 0) {
        setSelectedFamous(sel);
        setCheckedFamous(buildCheckedFamousKeys(ent.returnTo, sel));
      } else {
        const popped = sel.slice(-ent.undoCount);
        setSelectedFamous(sel.slice(0, -ent.undoCount));
        setCheckedFamous(new Set(popped.map(x => x.tagKey)));
      }
      setFrontNavStack(nextStack);
      setStep(ent.returnTo);
    } else if (s === 's4') {
      setBackNavStack([]);
      setStep('sort1');
    } else if (isBackStep) {
      const prevStack = backNavStackRef.current;
      const sel = selectedUnknownRef.current;
      const tags = unknownTagsForBackRef.current;
      if (prevStack.length > 0) {
        const ent = prevStack[prevStack.length - 1]!;
        const nextStack = prevStack.slice(0, -1);
        if (ent.undoCount <= 0) {
          setSelectedUnknown(sel);
          setCheckedUnknown(buildCheckedUnknownKeys(ent.returnTo, sel, tags));
        } else {
          const popped = sel.slice(-ent.undoCount);
          setSelectedUnknown(sel.slice(0, -ent.undoCount));
          setCheckedUnknown(new Set(popped.map(x => x.tagKey)));
        }
        setBackNavStack(nextStack);
        setStep(ent.returnTo);
      } else {
        const prevMap: Record<string, BackStep> = { s5: 's4', s6: 's5', s7: 's6', s8: 's7' };
        const prevStep = prevMap[s];
        if (prevStep) {
          setCheckedUnknown(buildCheckedUnknownKeys(prevStep, sel, tags));
          setStep(prevStep);
        }
      }
    }
  };

  const handleBackFromSort2 = () => {
    setSort2Ranks(new Map());
    const target = stepBeforeSort2 ?? 's8';
    const sel = selectedUnknownRef.current;
    const tags = unknownTagsForBackRef.current;
    setStep(target);
    setCheckedUnknown(buildCheckedUnknownKeys(target, sel, tags));
  };

  const questionNumDisplay = isFamousStep
    ? (step === 'f1' ? '1' : step === 'f1_2' ? '1-2' : step === 'f2' ? '2' : step === 'f2_2' ? '2-2' : step === 'f3' ? '3' : '3-2')
    : isBackStep
      ? String(BACK_STEPS.indexOf(step as BackStep) + 4)
      : '1';
  const instruction =
    famousCatForPicked != null ? getFamousQuestionForCategory(rc as RecommendCopy, famousCatForPicked) : rc.questionUnknown;

  const previewAddedForFamousOk = (): SelectedTag[] => {
    if (!isFamousStep) return [];
    const s = step as FrontStep;
    const cat = s.startsWith('f1') ? priorityOrder[0]! : s.startsWith('f2') ? priorityOrder[1]! : priorityOrder[2]!;
    const a: SelectedTag[] = [];
    for (const key of checkedFamous) {
      const opt = currentFamousOptions.find(o => o.tagKey === key);
      if (opt) a.push({ tagKey: key, displayName: opt.displayName, category: cat });
    }
    return a;
  };

  /** 質問1 / 1-2 など、同一カテゴリ内でまだ1件も無いときは「これでok」不可（「この中にはない」は別ボタン） */
  const famousPrimaryDisabled =
    isFamousStep &&
    (() => {
      const s = step as FrontStep;
      const cat = s.startsWith('f1') ? priorityOrder[0]! : s.startsWith('f2') ? priorityOrder[1]! : priorityOrder[2]!;
      return countCategoryAfterAdd(cat, previewAddedForFamousOk()) < 1;
    })();

  /** 何か選択中は「この中にはない」と併用できない */
  const notInListDisabled =
    (isFamousStep && checkedFamous.size > 0) || (isBackStep && checkedUnknown.size > 0);

  const sortFixBtnStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: isMobile ? '6px 12px' : '5px 8px',
    fontSize: isMobile ? 14 : 10,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 6,
    color: 'var(--color-text-muted)',
  };

  /** PC・整理画面下段の「ひとつ前」（コンパクト） */
  const recommendBackOneStepStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    padding: isMobile ? '2px 5px' : '4px 8px',
    fontSize: isMobile ? 10 : 10,
    lineHeight: 1.2,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 4,
    color: 'var(--color-text-muted)',
  };

  /** モバイル：フッター直上・右下固定の「ひとつ前」（コンパクト） */
  const recommendMobileQuizBackStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    padding: '2px 6px',
    fontSize: 10,
    lineHeight: 1.2,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: 4,
    color: 'var(--color-text-muted)',
  };

  const rcTyped = rc as RecommendCopy;

  if (step === 'sort1') {
    const items = selectedFamous;
    const sort1Max = items.length === 0 ? 0 : Math.min(5, items.length);
    const toggleRank = (tagKey: string) => {
      setSort1Ranks(prev => {
        const current = prev.get(tagKey);
        const used = new Set(prev.values());
        if (current) {
          const next = new Map(prev);
          next.delete(tagKey);
          return next;
        }
        if (used.size >= sort1Max) return prev;
        const nextRank = ([1, 2, 3, 4, 5] as const).find(r => r <= sort1Max && !used.has(r));
        if (nextRank === undefined) return prev;
        return new Map(prev).set(tagKey, nextRank);
      });
    };
    const resetSort1 = () => setSort1Ranks(new Map());
    const ranked = Array.from(sort1Ranks.entries())
      .filter(([, r]) => r >= 1 && r <= sort1Max)
      .sort((a, b) => a[1] - b[1])
      .map(([tagKey]) => items.find(i => i.tagKey === tagKey))
      .filter(Boolean) as SelectedTag[];
    const canProceedSort1 = sort1Max > 0 && ranked.length === sort1Max;
    const proceedFromSort1 = () => {
      const r: RankedTag[] = ranked.map((t, i) => ({ ...t, rank: (i + 1) as 1 | 2 | 3 | 4 | 5 }));
      setRankedFamous(r);
      fetchUnknownAndGoToS4(r);
    };
    const col1 = items.slice(0, 5);
    const col2 = items.slice(5, 10);
    const col3 = items.slice(10, 15);
    const renderCol = (col: SelectedTag[], idx: number) => (
      <div key={`sort1-col-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 3 : 6 }}>
        {col.map(t => {
          const r = sort1Ranks.get(t.tagKey);
          return (
            <button
              key={t.tagKey}
              type="button"
              onClick={() => toggleRank(t.tagKey)}
              style={{
                padding: isMobile ? '5px 7px' : '10px 12px',
                fontSize: isMobile ? 11 : 16.5,
                fontWeight: 500,
                textAlign: 'left',
                minHeight: isMobile ? 23 : 36,
                backgroundColor: r ? '#dbeafe' : '#faf8f5',
                color: r ? '#1d4ed8' : 'var(--color-text)',
                border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              {t.displayName}
            </button>
          );
        })}
      </div>
    );
    const sortBtnStyle = {
      padding: isMobile ? '6px 10px' : '8px 16px',
      fontSize: isMobile ? 13 : 13,
      fontWeight: 600,
      borderRadius: 6,
      cursor: 'pointer' as const,
      boxSizing: 'border-box' as const,
      ...(isMobile ? { minHeight: 30 } : {}),
    };
    return (
      <>
        <Stage
          characterVariant="usually"
          characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{getSortPromptFront(rcTyped)}</p>}
          mobileHideCharacter={isMobile}
          mobileExtendWhiteboard={isMobile}
          mobileWhiteboardOverflowY={isMobile ? 'hidden' : undefined}
          whiteboardWide={true}
          mobileCanvasBodyHeightPx={isMobile ? MOBILE_RECOMMEND_CANVAS_BODY_PX : undefined}
        >
          <div
            style={{
              padding: isMobile ? '0.15rem 0' : '1rem 0',
              maxWidth: '100%',
              minWidth: 0,
              ...(isMobile
                ? {
                    height: '100%',
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                  }
                : {}),
            }}
          >
            {!isMobile ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16, maxWidth: 600 }}>
                  {col1.length > 0 && renderCol(col1, 0)}
                  {col2.length > 0 && renderCol(col2, 1)}
                  {col3.length > 0 && renderCol(col3, 2)}
                </div>
                <div style={{ margin: '0 0 16px 0', display: 'flex', flexWrap: 'wrap', gap: 6, flexDirection: 'row' }}>
                  {([1, 2, 3, 4, 5] as const).map(r => {
                    const tt = ranked.find((_, i) => i + 1 === r);
                    return (
                      <span key={r} style={{ padding: '5px 10px', minWidth: 64, fontSize: 12, backgroundColor: tt ? '#dbeafe' : 'transparent', color: tt ? '#1d4ed8' : 'var(--color-text-muted)', borderRadius: 6, border: `2px solid ${tt ? '#3b82f6' : '#e5e7eb'}` }}>
                        {r}位{tt ? `: ${tt.displayName}` : ''}
                      </span>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', width: '100%' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={proceedFromSort1}
                      disabled={!canProceedSort1}
                      style={{
                        padding: '13px 26px',
                        fontSize: 14,
                        fontWeight: 600,
                        backgroundColor: canProceedSort1 ? '#3b82f6' : '#e5e7eb',
                        color: canProceedSort1 ? '#fff' : '#9ca3af',
                        border: 'none',
                        borderRadius: 10,
                        cursor: canProceedSort1 ? 'pointer' : 'not-allowed',
                        boxSizing: 'border-box',
                      }}
                    >
                      {getBtnNextSortFront(rcTyped)}
                    </button>
                    <button type="button" onClick={resetSort1} style={{ ...sortBtnStyle, backgroundColor: '#faf8f5', color: 'var(--color-text)', border: '2px solid #e5e7eb' }}>
                      {rc.btnRetry}
                    </button>
                  </div>
                  <button type="button" onClick={handleBackFromSort1} style={recommendBackOneStepStyle}>
                    <svg style={{ width: 12, height: 12, flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                    </svg>
                    {rcFixBack}
                  </button>
                </div>
              </>
            ) : (
              <div
                style={{
                  width: '100%',
                  maxWidth: 320,
                  margin: '0 auto',
                  boxSizing: 'border-box',
                  position: 'relative',
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    paddingBottom: MOBILE_TAG_FLOW_BACK_RESERVE_PX,
                  }}
                >
                  <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 14, lineHeight: 1.3, flexShrink: 0 }}>
                    {getSortPromptFront(rcTyped)}
                  </p>
                  <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', width: '100%' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, marginBottom: 6, maxWidth: 600 }}>
                      {items.map(t => {
                        const r = sort1Ranks.get(t.tagKey);
                        return (
                          <button
                            key={t.tagKey}
                            type="button"
                            onClick={() => toggleRank(t.tagKey)}
                            style={{
                              padding: '5px 7px',
                              fontSize: 11,
                              fontWeight: 500,
                              textAlign: 'left',
                              minHeight: 23,
                              backgroundColor: r ? '#dbeafe' : '#faf8f5',
                              color: r ? '#1d4ed8' : 'var(--color-text)',
                              border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                              borderRadius: 8,
                              cursor: 'pointer',
                            }}
                          >
                            {t.displayName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div
                    style={{
                      margin: '6px 0 0 0',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 6,
                      rowGap: 6,
                      width: '100%',
                      flexShrink: 0,
                    }}
                  >
                    {([1, 2, 3, 4, 5] as const).map(r => {
                      const tt = ranked.find((_, i) => i + 1 === r);
                      return (
                        <span
                          key={r}
                          style={{
                            padding: '2px 6px',
                            minWidth: 0,
                            fontSize: 9,
                            backgroundColor: tt ? '#dbeafe' : 'transparent',
                            color: tt ? '#1d4ed8' : 'var(--color-text-muted)',
                            borderRadius: 6,
                            border: `2px solid ${tt ? '#3b82f6' : '#e5e7eb'}`,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            boxSizing: 'border-box',
                          }}
                        >
                          {r}位{tt ? `: ${tt.displayName}` : ''}
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', width: '100%', marginTop: 14, marginBottom: 0, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={proceedFromSort1}
                      disabled={!canProceedSort1}
                      style={{
                        padding: '8px 11px',
                        fontSize: 13,
                        minHeight: 30,
                        fontWeight: 600,
                        backgroundColor: canProceedSort1 ? '#3b82f6' : '#e5e7eb',
                        color: canProceedSort1 ? '#fff' : '#9ca3af',
                        border: 'none',
                        borderRadius: 10,
                        cursor: canProceedSort1 ? 'pointer' : 'not-allowed',
                        boxSizing: 'border-box',
                      }}
                    >
                      {getBtnNextSortFront(rcTyped)}
                    </button>
                    <button type="button" onClick={resetSort1} style={{ ...sortBtnStyle, backgroundColor: '#faf8f5', color: 'var(--color-text)', border: '2px solid #e5e7eb' }}>
                      {rc.btnRetry}
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 0,
                    left: 0,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    paddingRight: 2,
                    pointerEvents: 'none',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleBackFromSort1}
                    style={{ ...recommendMobileQuizBackStyle, pointerEvents: 'auto' }}
                  >
                    <svg style={{ width: 12, height: 12, flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                    </svg>
                    {rcFixBack}
                  </button>
                </div>
              </div>
            )}
          </div>
        </Stage>
        {isDebugLocal && <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />}
      </>
    );
  }

  if (step === 'sort2') {
    const combined = [...rankedFamous, ...selectedUnknown.slice(0, 9)];
    const sort2Max = combined.length === 0 ? 0 : Math.min(5, combined.length);
    const toggleRank = (tagKey: string) => {
      setSort2Ranks(prev => {
        const current = prev.get(tagKey);
        const used = new Set(prev.values());
        if (current) {
          const next = new Map(prev);
          next.delete(tagKey);
          return next;
        }
        if (used.size >= sort2Max) return prev;
        const nextRank = ([1, 2, 3, 4, 5] as const).find(r => r <= sort2Max && !used.has(r));
        if (nextRank === undefined) return prev;
        return new Map(prev).set(tagKey, nextRank);
      });
    };
    const resetSort2 = () => setSort2Ranks(new Map());
    const ranked = Array.from(sort2Ranks.entries())
      .filter(([, r]) => r >= 1 && r <= sort2Max)
      .sort((a, b) => a[1] - b[1])
      .map(([tagKey]) => combined.find(i => i.tagKey === tagKey))
      .filter(Boolean) as (SelectedTag & { category?: CategoryLabel })[];
    const canProceedSort2 = sort2Max > 0 && ranked.length === sort2Max;
    const proceedFromSort2 = () => {
      const r: RankedTag[] = ranked.map((t, i) => ({ ...t, rank: (i + 1) as 1 | 2 | 3 | 4 | 5 }));
      setRankedFinal(r);
      setStep('thinking');
      submitRecommend(r);
    };
    const backTags = selectedUnknown.slice(0, 9);
    const col1 = backTags.slice(0, 5);
    const col2 = backTags.slice(5, 10);
    const col3 = backTags.slice(10, 15);
    const renderCol = (col: typeof backTags, idx: number) => (
      <div key={`sort2-col-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {col.map(t => {
          const r = sort2Ranks.get(t.tagKey);
          return (
            <button
              key={t.tagKey}
              type="button"
              onClick={() => toggleRank(t.tagKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: isMobile ? '5px 7px' : '10px 12px',
                fontSize: isMobile ? 11 : 16.5,
                minHeight: isMobile ? 23 : 36,
                fontWeight: 500,
                textAlign: 'left',
                width: '100%',
                boxSizing: 'border-box',
                backgroundColor: r ? '#dbeafe' : '#faf8f5',
                color: r ? '#1d4ed8' : 'var(--color-text)',
                border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.displayName}</span>
            </button>
          );
        })}
      </div>
    );
    const sortBtnStyle2 = {
      padding: isMobile ? '6px 10px' : '8px 16px',
      fontSize: isMobile ? 13 : 13,
      fontWeight: 600,
      borderRadius: 6,
      cursor: 'pointer' as const,
      boxSizing: 'border-box' as const,
      ...(isMobile ? { minHeight: 30 } : {}),
    };
    return (
      <>
        <Stage
          characterVariant="usually"
          characterSpeech={isMobile ? undefined : <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{getSortPromptBack(rcTyped)}</p>}
          mobileHideCharacter={isMobile}
          mobileExtendWhiteboard={isMobile}
          mobileWhiteboardOverflowY={isMobile ? 'hidden' : undefined}
          whiteboardWide={true}
          mobileCanvasBodyHeightPx={isMobile ? MOBILE_RECOMMEND_CANVAS_BODY_PX : undefined}
        >
          <div
            style={{
              padding: isMobile ? '0.15rem 0' : '1rem 0',
              maxWidth: '100%',
              minWidth: 0,
              ...(isMobile
                ? {
                    height: '100%',
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                  }
                : {}),
            }}
          >
            {isMobile ? (
              <div
                style={{
                  width: '100%',
                  maxWidth: 320,
                  margin: '0 auto',
                  boxSizing: 'border-box',
                  position: 'relative',
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    paddingBottom: MOBILE_TAG_FLOW_BACK_RESERVE_PX,
                  }}
                >
                  <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 14, lineHeight: 1.3, flexShrink: 0 }}>{getSortPromptBack(rcTyped)}</p>
                  <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', width: '100%' }}>
                    <p style={{ fontSize: 8, color: 'var(--color-text-muted)', margin: '0 0 4px 0', fontWeight: 500 }}>前半の１位～５位</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginBottom: 6, paddingBottom: 6, borderBottom: '3px solid #6b7280' }}>
                      {rankedFamous.map((t) => {
                        const rr = sort2Ranks.get(t.tagKey);
                        return (
                          <button
                            key={t.tagKey}
                            type="button"
                            onClick={() => toggleRank(t.tagKey)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '5px 7px',
                              fontSize: 11,
                              minHeight: 23,
                              fontWeight: 500,
                              textAlign: 'left',
                              width: '100%',
                              boxSizing: 'border-box',
                              backgroundColor: rr ? '#dbeafe' : '#faf8f5',
                              color: rr ? '#1d4ed8' : 'var(--color-text)',
                              border: `2px solid ${rr ? '#3b82f6' : '#e5e7eb'}`,
                              borderRadius: 8,
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.displayName}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 6, marginBottom: 6 }}>
                      {backTags.map(t => {
                        const r = sort2Ranks.get(t.tagKey);
                        return (
                          <button
                            key={t.tagKey}
                            type="button"
                            onClick={() => toggleRank(t.tagKey)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '5px 7px',
                              fontSize: 11,
                              minHeight: 23,
                              fontWeight: 500,
                              textAlign: 'left',
                              width: '100%',
                              boxSizing: 'border-box',
                              backgroundColor: r ? '#dbeafe' : '#faf8f5',
                              color: r ? '#1d4ed8' : 'var(--color-text)',
                              border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                              borderRadius: 8,
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.displayName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div
                    style={{
                      margin: '6px 0 0 0',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: 6,
                      rowGap: 6,
                      width: '100%',
                      flexShrink: 0,
                    }}
                  >
                    {Array.from({ length: sort2Max }, (_, i) => (i + 1) as 1 | 2 | 3 | 4 | 5).map(r => {
                      const tt = ranked.find((_, j) => j + 1 === r);
                      return (
                        <span
                          key={r}
                          style={{
                            padding: '2px 6px',
                            minWidth: 0,
                            fontSize: 9,
                            backgroundColor: tt ? '#dbeafe' : 'transparent',
                            color: tt ? '#1d4ed8' : 'var(--color-text-muted)',
                            borderRadius: 6,
                            border: `2px solid ${tt ? '#3b82f6' : '#e5e7eb'}`,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            boxSizing: 'border-box',
                          }}
                        >
                          {r}位{tt ? `: ${tt.displayName}` : ''}
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', width: '100%', marginTop: 14, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={proceedFromSort2}
                      disabled={!canProceedSort2}
                      style={{
                        padding: '8px 11px',
                        fontSize: 13,
                        minHeight: 30,
                        fontWeight: 600,
                        backgroundColor: canProceedSort2 ? '#3b82f6' : '#e5e7eb',
                        color: canProceedSort2 ? '#fff' : '#9ca3af',
                        border: 'none',
                        borderRadius: 10,
                        cursor: canProceedSort2 ? 'pointer' : 'not-allowed',
                        boxSizing: 'border-box',
                      }}
                    >
                      {getBtnNextSortBack(rcTyped)}
                    </button>
                    <button type="button" onClick={resetSort2} style={{ ...sortBtnStyle2, backgroundColor: '#faf8f5', color: 'var(--color-text)', border: '2px solid #e5e7eb' }}>
                      {rc.btnRetry}
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 0,
                    left: 0,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    paddingRight: 2,
                    pointerEvents: 'none',
                  }}
                >
                  <button
                    type="button"
                    onClick={handleBackFromSort2}
                    style={{ ...recommendMobileQuizBackStyle, pointerEvents: 'auto' }}
                  >
                    <svg style={{ width: 12, height: 12, flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                    </svg>
                    {rcFixBack}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 8, color: 'var(--color-text-muted)', margin: '0 0 8px 0', fontWeight: 500 }}>前半の１位～５位</p>
                <div style={{ display: 'flex', gap: 13, marginBottom: 16, alignItems: 'stretch' }}>
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 112 }}>
                      {rankedFamous.map((t) => {
                        const r = sort2Ranks.get(t.tagKey);
                        return (
                          <button
                            key={t.tagKey}
                            type="button"
                            onClick={() => toggleRank(t.tagKey)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '10px 12px',
                              fontSize: 16.5,
                              minHeight: 36,
                              fontWeight: 500,
                              textAlign: 'left',
                              width: '100%',
                              boxSizing: 'border-box',
                              backgroundColor: r ? '#dbeafe' : '#faf8f5',
                              color: r ? '#1d4ed8' : 'var(--color-text)',
                              border: `2px solid ${r ? '#3b82f6' : '#e5e7eb'}`,
                              borderRadius: 8,
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.displayName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, borderLeft: '3px solid #6b7280', paddingLeft: 13 }}>
                    {col1.length > 0 && renderCol(col1, 0)}
                    {col2.length > 0 && renderCol(col2, 1)}
                    {col3.length > 0 && renderCol(col3, 2)}
                  </div>
                </div>
                <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6, flexDirection: 'row' }}>
                  {Array.from({ length: sort2Max }, (_, i) => (i + 1) as 1 | 2 | 3 | 4 | 5).map(r => {
                    const tt = ranked.find((_, j) => j + 1 === r);
                    return (
                      <span key={r} style={{ padding: '5px 10px', minWidth: 64, fontSize: 12, backgroundColor: tt ? '#dbeafe' : 'transparent', color: tt ? '#1d4ed8' : 'var(--color-text-muted)', borderRadius: 6, border: `2px solid ${tt ? '#3b82f6' : '#e5e7eb'}` }}>
                        {r}位{tt ? `: ${tt.displayName}` : ''}
                      </span>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', width: '100%' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    <button type="button" onClick={proceedFromSort2} disabled={!canProceedSort2} style={{ padding: '13px 26px', fontSize: 14, fontWeight: 600, backgroundColor: canProceedSort2 ? '#3b82f6' : '#e5e7eb', color: canProceedSort2 ? '#fff' : '#9ca3af', border: 'none', borderRadius: 10, cursor: canProceedSort2 ? 'pointer' : 'not-allowed' }}>
                      {getBtnNextSortBack(rcTyped)}
                    </button>
                    <button type="button" onClick={resetSort2} style={{ ...sortBtnStyle2, backgroundColor: '#faf8f5', color: 'var(--color-text)', border: '2px solid #e5e7eb' }}>
                      {rc.btnRetry}
                    </button>
                  </div>
                  <button type="button" onClick={handleBackFromSort2} style={recommendBackOneStepStyle}>
                    <svg style={{ width: 12, height: 12, flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                    </svg>
                    {rcFixBack}
                  </button>
                </div>
              </>
            )}
          </div>
        </Stage>
        {isDebugLocal && <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />}
      </>
    );
  }

  const renderTagGrid = () => {
    const TAG_SELECT_BLUE = '#3b82f6';
    const TagButton = ({
      tagKey,
      displayName,
      checked,
      onToggle,
    }: {
      tagKey: string;
      displayName: string;
      checked: boolean;
      onToggle: () => void;
    }) => (
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          minWidth: 0,
          maxWidth: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          padding: isMobile ? '5px 6px' : '8px 10px',
          fontSize: isMobile ? 10 : 14,
          minHeight: isMobile ? 22 : 34,
          fontWeight: 500,
          textAlign: 'left',
          backgroundColor: checked ? '#dbeafe' : '#faf8f5',
          color: checked ? '#1d4ed8' : 'var(--color-text)',
          border: `2px solid ${checked ? TAG_SELECT_BLUE : '#e5e7eb'}`,
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
      </button>
    );

    const gridStyle: React.CSSProperties = {
      display: 'grid',
      gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
      gap: isMobile ? 5 : 6,
      marginBottom: isMobile ? 8 : 16,
    };

    if (isFamousStep) {
      const opts = currentFamousOptions;
      const cat = (step as string).startsWith('f1') ? priorityOrder[0]! : (step as string).startsWith('f2') ? priorityOrder[1]! : priorityOrder[2]!;
      return opts.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 20 }}>このカテゴリにはタグがありません。そのまま次へ進んでね。</p>
      ) : (
        <div style={gridStyle}>
          {opts.map(opt => (
            <TagButton
              key={opt.tagKey}
              tagKey={opt.tagKey}
              displayName={opt.displayName}
              checked={checkedFamous.has(opt.tagKey)}
              onToggle={() => toggleFamous(opt.tagKey, opt.displayName, cat)}
            />
          ))}
        </div>
      );
    }
    const batch = currentUnknownBatch;
    return batch.length === 0 ? (
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 20 }}>この中にはありません。そのまま次へ進んでね。</p>
    ) : (
      <div style={gridStyle}>
        {batch.map(t => (
          <TagButton
            key={t.tagKey}
            tagKey={t.tagKey}
            displayName={t.displayName}
            checked={checkedUnknown.has(t.tagKey)}
            onToggle={() => toggleUnknown(t.tagKey, t.displayName)}
          />
        ))}
      </div>
    );
  };

  return (
    <>
    <Stage
      characterVariant="usually"
      characterSpeech={
        isMobile ? undefined : (
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, backgroundColor: '#334155', color: '#fff', borderRadius: 6, fontSize: 12, fontWeight: 'bold', marginRight: 8, verticalAlign: 'middle' }}>
                {questionNumDisplay}
              </span>
              {instruction}
            </p>
          </div>
        )
      }
      mobileHideCharacter={isMobile}
      mobileExtendWhiteboard={isMobile}
      mobileWhiteboardOverflowY={isMobile ? 'hidden' : undefined}
      whiteboardWide={true}
      mobileCanvasBodyHeightPx={isMobile ? MOBILE_RECOMMEND_CANVAS_BODY_PX : undefined}
    >
      <div
        style={{
          padding: isMobile ? '0.25rem 0' : '1rem 0',
          maxWidth: '100%',
          minWidth: 0,
          ...(isMobile
            ? {
                height: '100%',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxSizing: 'border-box',
              }
            : {}),
        }}
      >
        {isMobile ? (
          <div
            style={{
              width: '100%',
              maxWidth: 320,
              margin: '0 auto',
              boxSizing: 'border-box',
              position: 'relative',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                paddingBottom: MOBILE_TAG_FLOW_BACK_RESERVE_PX,
              }}
            >
              <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: 13, lineHeight: 1.35, flexShrink: 0 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, backgroundColor: '#334155', color: '#fff', borderRadius: 6, fontSize: 9, fontWeight: 'bold', marginRight: 6, verticalAlign: 'middle' }}>
                  {questionNumDisplay}
                </span>
                {instruction}
              </p>
              <div style={{ width: '100%', overflow: 'hidden', flexShrink: 0 }}>{renderTagGrid()}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', width: '100%', marginBottom: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  aria-disabled={famousPrimaryDisabled && isFamousStep}
                  onClick={() => (isFamousStep ? goNextFromFamous() : goNextFromUnknown())}
                  style={{
                    flex: '1 1 30%',
                    minWidth: 0,
                    padding: '6px 10px',
                    fontSize: 14,
                    minHeight: 34,
                    fontWeight: 600,
                    backgroundColor: isFamousStep && famousPrimaryDisabled ? '#e5e7eb' : '#3b82f6',
                    color: isFamousStep && famousPrimaryDisabled ? '#9ca3af' : '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: isFamousStep && famousPrimaryDisabled ? 'not-allowed' : 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  {rc.btnOk}
                </button>
                <button
                  type="button"
                  disabled={notInListDisabled}
                  onClick={() => (isFamousStep ? goNextFromFamous(true) : goNextFromUnknown(true))}
                  style={{
                    flex: '1 1 40%',
                    minWidth: 0,
                    padding: '6px 10px',
                    fontSize: 14,
                    minHeight: 34,
                    fontWeight: 600,
                    backgroundColor: notInListDisabled ? '#f3f4f6' : '#faf8f5',
                    color: notInListDisabled ? '#9ca3af' : 'var(--color-text)',
                    border: '2px solid #e5e7eb',
                    borderRadius: 8,
                    cursor: notInListDisabled ? 'not-allowed' : 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  {rc.btnNotInList}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isFamousStep) {
                      setFamousPickWarning(null);
                      setCheckedFamous(new Set());
                    } else {
                      setCheckedUnknown(new Set());
                    }
                  }}
                  style={{
                    flex: '1 1 25%',
                    minWidth: 0,
                    padding: '6px 10px',
                    fontSize: 14,
                    minHeight: 34,
                    fontWeight: 600,
                    backgroundColor: '#fff',
                    color: 'var(--color-text-muted)',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  {rc.btnRetry}
                </button>
              </div>
              {isFamousStep && <RecommendPickedTagsRow tags={frontPickedTagsDisplay} isMobile={isMobile} />}
              {isBackStep && <RecommendPickedTagsRow tags={backPickedTagsDisplay} isMobile={isMobile} />}
              {isFamousStep && famousPickWarning && (
                <p style={{ margin: '8px 0 0 0', fontSize: 13, color: '#dc2626', fontWeight: 600, flexShrink: 0 }}>{famousPickWarning}</p>
              )}
              <div style={{ flex: 1, minHeight: 0, pointerEvents: 'none' }} aria-hidden />
            </div>
            {(isFamousStep || isBackStep) && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 2,
                  right: 0,
                  left: 0,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  paddingRight: 2,
                  pointerEvents: 'none',
                }}
              >
                <button
                  type="button"
                  onClick={handleTagFlowBackOne}
                  style={{ ...recommendMobileQuizBackStyle, pointerEvents: 'auto' }}
                >
                  <svg style={{ width: 12, height: 12, flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                  </svg>
                  {rcFixBack}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div style={{ width: '100%', maxWidth: 640, marginBottom: 16 }}>
              {renderTagGrid()}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'center',
                marginTop: 0,
                width: '100%',
                maxWidth: 640,
              }}
            >
              <button
                type="button"
                aria-disabled={famousPrimaryDisabled}
                onClick={() => (isFamousStep ? goNextFromFamous() : goNextFromUnknown())}
                style={{
                  padding: '16px 32px',
                  fontSize: 17,
                  fontWeight: 600,
                  backgroundColor: famousPrimaryDisabled ? '#e5e7eb' : '#3b82f6',
                  color: famousPrimaryDisabled ? '#9ca3af' : '#fff',
                  border: 'none',
                  borderRadius: 12,
                  cursor: famousPrimaryDisabled ? 'not-allowed' : 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                {rc.btnOk}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isFamousStep) {
                    setFamousPickWarning(null);
                    setCheckedFamous(new Set());
                  } else {
                    setCheckedUnknown(new Set());
                  }
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  backgroundColor: '#faf8f5',
                  color: 'var(--color-text)',
                  border: '2px solid #e5e7eb',
                  borderRadius: 8,
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                {rc.btnRetry}
              </button>
              <button
                type="button"
                disabled={notInListDisabled}
                onClick={() => (isFamousStep ? goNextFromFamous(true) : goNextFromUnknown(true))}
                style={{
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  backgroundColor: notInListDisabled ? '#f3f4f6' : '#faf8f5',
                  color: notInListDisabled ? '#9ca3af' : 'var(--color-text)',
                  border: '2px solid #e5e7eb',
                  borderRadius: 8,
                  cursor: notInListDisabled ? 'not-allowed' : 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                {rc.btnNotInList}
              </button>
            </div>
            {isFamousStep && <RecommendPickedTagsRow tags={frontPickedTagsDisplay} isMobile={isMobile} />}
            {isBackStep && <RecommendPickedTagsRow tags={backPickedTagsDisplay} isMobile={isMobile} />}
            {isFamousStep && famousPickWarning && (
              <p style={{ margin: '8px 0 0 0', fontSize: 14, color: '#dc2626', fontWeight: 600 }}>{famousPickWarning}</p>
            )}
            {(isFamousStep || isBackStep) && (
              <div style={{ marginTop: 8, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" onClick={handleTagFlowBackOne} style={recommendBackOneStepStyle}>
                  <svg style={{ width: 12, height: 12, flexShrink: 0 }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
                  </svg>
                  {rcFixBack}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Stage>

    {isDebugLocal && (
      <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} onForceNavigateToResults={handleForceNavigateToResults} />
    )}
    </>
  );
}

function RecommendResultsGrid({
  works,
  totalMatched,
  onBack,
  shareUrl,
  shareText,
  onSharePC,
  isMobile,
  recommendSessionId,
}: {
  works: WorkResult[];
  totalMatched: number;
  onBack: () => void;
  shareUrl: string;
  shareText: string;
  onSharePC?: (withMosaic?: boolean) => void;
  isMobile: boolean;
  recommendSessionId: string;
}) {
  const tweetIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
  const s = REC_SCALE;
  const cardW = Math.round(REC_CARD_MIN_WIDTH * s * 1.34);
  const gapPx = Math.round(REC_GAP * s);
  const columnGapPx = Math.round(gapPx * 1.5);
  const cardPad = Math.round(8 * s);
  const row1 = works.slice(0, 5);
  const row2 = works.slice(5, 10);
  const renderRow = (row: WorkResult[]) => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        columnGap: columnGapPx,
        rowGap: gapPx,
        flexWrap: 'nowrap',
        width: 'max-content',
        minHeight: 1,
        marginBottom: row2.length > 0 ? gapPx : 0,
      }}
    >
      {row.map(rec => (
        <div
          key={rec.workId}
          style={{
            minWidth: cardW,
            width: cardW,
            padding: cardPad,
            backgroundColor: '#fafafa',
            border: '1px solid #e5e7eb',
            borderRadius: Math.round(10 * s),
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            flexShrink: 0,
            overflow: 'visible',
          }}
        >
          {typeof rec.matchRate === 'number' && (
            <div style={{ marginBottom: isMobile ? Math.round(4 * s) : Math.round(6 * s) }}>
              <p style={{ fontSize: isMobile ? 9 : 10, color: 'var(--color-text-muted)', fontWeight: 600, margin: '0 0 2px 0', lineHeight: 1.2 }}>好みマッチ度</p>
              <p style={{ fontSize: isMobile ? 14 : 16, color: '#059669', fontWeight: 700, margin: 0, lineHeight: 1.2, letterSpacing: '0.02em' }}>
                {Number(rec.matchRate).toFixed(1)}％
              </p>
            </div>
          )}
          <div
            style={{
              width: '100%',
              aspectRatio: '4/3',
              borderRadius: Math.round(6 * s),
              overflow: 'hidden',
              marginBottom: isMobile ? Math.round(4 * s) : Math.round(6 * s),
            }}
          >
            <img
              src={rec.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(rec.workId)}`}
              alt={rec.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <p
            style={{
              fontSize: isMobile ? 12 : 13,
              fontWeight: 600,
              color: 'var(--color-text)',
              margin: '0 0 2px 0',
              lineHeight: 1.3,
              minHeight: isMobile ? 32 : 34,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
            }}
          >
            {rec.title}
          </p>
          <p style={{ fontSize: isMobile ? 9 : 10, color: 'var(--color-text-muted)', margin: '0 0 4px 0' }}>{rec.authorName}</p>
          <div style={{ fontSize: isMobile ? 10 : 13, color: 'var(--color-text-muted)' }}>
            <ExternalLink href={rec.productUrl} linkText={LINK_TEXT} recommendSessionId={recommendSessionId} recommendFanzaWorkId={rec.workId}>
              {LINK_TEXT}
            </ExternalLink>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ padding: 0, maxWidth: '100%', minWidth: 0 }}>
      {!isMobile && (
        <div style={{ overflowX: 'auto', overflowY: 'hidden', marginBottom: Math.round(8 * s), maxWidth: '100%' }}>
          {renderRow(row1)}
          {row2.length > 0 && renderRow(row2)}
        </div>
      )}
      <div
        style={{
          marginTop: isMobile ? Math.round(12 * s) : Math.round(14 * s),
          width: '100%',
        }}
      >
        <ResultScreenFourButtons
          onSavePlain={onSharePC ? () => onSharePC(false) : undefined}
          onSaveMosaic={onSharePC ? () => onSharePC(true) : undefined}
          onPost={() => window.open(tweetIntent, '_blank', 'noopener,noreferrer')}
          onBackToTop={onBack}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
}
