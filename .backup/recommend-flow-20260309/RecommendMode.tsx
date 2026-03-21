'use client';

import { useState, useEffect, useCallback } from 'react';
import { ExternalLink } from './ExternalLink';
import { RestartButton } from './RestartButton';
import { useMediaQuery } from './useMediaQuery';
import { Stage } from './Stage';
import { MobileWorkCardHorizontal } from './MobileWorkCardHorizontal';
import { RecommendDebugPanel, type RecommendDebugData } from './RecommendDebugPanel';
import { AiGate } from './AiGate';
import type { RecommendCopy } from '@/server/config/schema';

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

const CATEGORIES = ['ストーリー', 'プレイ', 'キャラクター'] as const;
type CategoryLabel = (typeof CATEGORIES)[number];

type RecommendStep = 'ai_gate' | 'initial' | 1 | 2 | 3 | 4 | 5 | 6 | 'thinking' | 'results';

interface RecommendModeProps {
  onBack: () => void;
}

type FamousTagItem = { tagKey: string; displayName: string; count: number };
type SelectedFamous = { tagKey: string; displayName: string; category: CategoryLabel; important: boolean };
type SelectedUnknown = { tagKey: string; displayName: string; important: boolean };

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
  const [selectedFamous, setSelectedFamous] = useState<SelectedFamous[]>([]);
  const [unknownTags, setUnknownTags] = useState<Array<{ tagKey: string; displayName: string; count?: number }>>([]);
  const [selectedUnknown, setSelectedUnknown] = useState<SelectedUnknown[]>([]);
  const [recommendedWorks, setRecommendedWorks] = useState<WorkResult[]>([]);
  const [totalMatched, setTotalMatched] = useState(0);
  const [famousTagKeysAll, setFamousTagKeysAll] = useState<string[]>([]);
  const [debugData, setDebugData] = useState<RecommendDebugData | null>(null);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [recommendCopy, setRecommendCopy] = useState<RecommendCopy | null>(null);

  const rc = recommendCopy ?? {
    aiGatePreamble: 'あなたの好みは？',
    aiGateMain: 'AI生成作品？それとも違う？',
    initialMain: 'あなたの好みは？',
    initialPriorityQuestion: 'あなたが優先したいのは？順位をつけて！',
    questionFamous: 'あなたが望む同人誌にはどんな特徴がある？ 3つまで選んで！ 特に重要なものがあれば1つだけチェックして！',
    questionUnknown: 'この中に欲しい特徴はある？ 3つまで選んで！ 特に重要なら1つだけチェックして！',
    importantPrompt: '特に重視する要素はある？あれば選んで！',
    thinkingText: 'あなたにぴったりの作品を探しているわ…',
    btnNext: '次へ',
    btnRetry: 'やり直し',
    btnOk: 'これでok',
    btnNotInList: 'この中にはない',
    btnFix: '修正する',
    btnTopReset: 'トップに戻る',
  };

  const isDebugLocal =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || localStorage.getItem('eronator.debugEnabled') === '1');

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

  const getFamousOptionsForStep = (s: 1 | 2 | 3): FamousTagItem[] => {
    const p1 = priorityOrder[0];
    const p2 = priorityOrder[1];
    if (!p1) return [];
    if (s === 1) return famousTags[p1].slice(0, 20);
    if (s === 2) return famousTags[p1].slice(20, 40);
    if (s === 3 && p2) return famousTags[p2].slice(0, 20);
    return [];
  };

  const currentFamousOptions = getFamousOptionsForStep(step as 1 | 2 | 3);
  const [checkedFamous, setCheckedFamous] = useState<Set<string>>(new Set());
  const [importantFamous, setImportantFamous] = useState<string | null>(null);
  const [checkedUnknown, setCheckedUnknown] = useState<Set<string>>(new Set());
  const [importantUnknown, setImportantUnknown] = useState<string | null>(null);

  const MAX_SELECT = 3;
  const toggleFamous = (tagKey: string, displayName: string, category: CategoryLabel) => {
    setCheckedFamous(prev => {
      const next = new Set(prev);
      if (next.has(tagKey)) {
        next.delete(tagKey);
        if (importantFamous === tagKey) setImportantFamous(null);
      } else if (next.size < MAX_SELECT) {
        next.add(tagKey);
      }
      return next;
    });
  };
  const setImportantFamousOne = (tagKey: string | null) => {
    if (tagKey === null || checkedFamous.has(tagKey)) setImportantFamous(tagKey);
  };

  const toggleUnknown = (tagKey: string, displayName: string) => {
    setCheckedUnknown(prev => {
      const next = new Set(prev);
      if (next.has(tagKey)) {
        next.delete(tagKey);
        if (importantUnknown === tagKey) setImportantUnknown(null);
      } else if (next.size < MAX_SELECT) {
        next.add(tagKey);
      }
      return next;
    });
  };
  const setImportantUnknownOne = (tagKey: string | null) => {
    if (tagKey === null || checkedUnknown.has(tagKey)) setImportantUnknown(tagKey);
  };

  const [lastAddedFamousCount, setLastAddedFamousCount] = useState(0);
  const [lastAddedUnknownCount, setLastAddedUnknownCount] = useState(0);

  const goNextFromFamous = (skipAdding?: boolean) => {
    const category = step === 1 || step === 2 ? priorityOrder[0]! : priorityOrder[1]!;
    const added: SelectedFamous[] = skipAdding ? [] : (() => {
      const a: SelectedFamous[] = [];
      for (const key of checkedFamous) {
        const opt = currentFamousOptions.find(o => o.tagKey === key);
        if (opt) a.push({ tagKey: key, displayName: opt.displayName, category, important: importantFamous === key });
      }
      return a;
    })();
    setLastAddedFamousCount(added.length);
    setSelectedFamous(prev => [...prev, ...added]);
    setCheckedFamous(new Set());
    setImportantFamous(null);
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else if (step === 3) fetchUnknownAndGoTo4([...selectedFamous, ...added]);
  };

  const fetchUnknownAndGoTo4 = async (famousList: SelectedFamous[]) => {
    try {
      const res = await fetch('/api/recommend/unknown-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedFamous: famousList.map(t => ({ tagKey: t.tagKey, important: t.important })),
          priorityOrder,
          famousTagKeys: famousTagKeysAll,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tags) && data.tags.length > 0) {
        setUnknownTags(data.tags);
        setStep(4);
        if (isDebugLocal) {
          setDebugData({
            phase: 'q4',
            selectedFamous: famousList.map(t => ({
              tagKey: t.tagKey,
              displayName: t.displayName,
              weight: t.important ? 2.5 : 1,
              important: t.important,
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
        submitRecommend(famousList, []);
      }
    } catch (e) {
      console.error('Failed to fetch unknown tags', e);
      setStep('thinking');
      submitRecommend(famousList, []);
    }
  };

  const goNextFromUnknown = (skipAdding?: boolean) => {
    const start = step === 4 ? 0 : step === 5 ? 20 : 40;
    const batch = unknownTags.slice(start, start + 20);
    const added: SelectedUnknown[] = skipAdding ? [] : (() => {
      const a: SelectedUnknown[] = [];
      for (const key of checkedUnknown) {
        const t = batch.find(x => x.tagKey === key) ?? unknownTags.find(x => x.tagKey === key);
        if (t) a.push({ tagKey: key, displayName: t.displayName, important: importantUnknown === key });
      }
      return a;
    })();
    setLastAddedUnknownCount(added.length);
    const nextUnknown = [...selectedUnknown, ...added];
    setSelectedUnknown(nextUnknown);
    setCheckedUnknown(new Set());
    setImportantUnknown(null);
    if (step === 4) setStep(5);
    else if (step === 5) setStep(6);
    else if (step === 6) {
      setStep('thinking');
      submitRecommend(selectedFamous, nextUnknown);
    }
  };

  const submitRecommend = async (
    famousList?: SelectedFamous[],
    unknownList?: SelectedUnknown[]
  ) => {
    const f = famousList ?? selectedFamous;
    const u = unknownList ?? selectedUnknown;
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          popularityChoice: popularityChoice ?? undefined,
          selectedFamous: f.map(t => ({ tagKey: t.tagKey, important: t.important })),
          selectedUnknown: u.map(t => ({ tagKey: t.tagKey, important: t.important })),
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
      } else {
        setStep(step === 6 ? 6 : 'initial');
      }
    } catch (e) {
      console.error('Recommend submit failed', e);
      setStep(step === 6 ? 6 : 'initial');
    }
  };

  const currentUnknownBatch = step === 4 ? unknownTags.slice(0, 20) : step === 5 ? unknownTags.slice(20, 40) : unknownTags.slice(40, 60);

  if (step === 'ai_gate') {
    return (
      <>
      <Stage
        characterVariant="usually"
        characterSpeech={
          <div style={isMobile ? { fontSize: 24, lineHeight: 1.3, textAlign: 'center' } : {}}>
            <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: isMobile ? 22 : 15 }}>{rc.aiGatePreamble}</p>
            <p style={{ margin: '6px 0 0 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>{rc.aiGateMain}</p>
          </div>
        }
      >
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
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
          <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} />
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
            <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: isMobile ? 26 : 20 }}>
              {rc.thinkingText}
            </p>
          }
        >
          {null}
        </Stage>
        {isDebugLocal && (
          <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} />
        )}
      </>
    );
  }

  if (step === 'results') {
    const onRetry = () => {
      setRecommendedWorks([]);
      setStep('ai_gate');
      setSelectedFamous([]);
      setSelectedUnknown([]);
      setPopularityChoice(null);
      setPriorityOrder([]);
      setAiGateChoice(null);
      setDebugData(null);
    };
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}?result=recommend` : '';
    const shareText = '【ERONATOR】おすすめ10件をもらった！ あなたの妄想、エロネイターが当ててみる？\n#エロネイター';
    const tweetIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;

    if (isMobile) {
      return (
        <>
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
              こんな作品なんてどう？
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {recommendedWorks.slice(0, 10).map(rec => (
                <MobileWorkCardHorizontal key={rec.workId} work={rec} showFanzaLink={true} matchRate={rec.matchRate} />
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 'auto' }}>
              <RestartButton onRestart={onRetry} label="もう一度おすすめを探す" inline compact={true} small={true} />
              <button
                type="button"
                onClick={onBack}
                style={{ padding: '8px 14px', fontSize: 12, fontWeight: 600, backgroundColor: 'transparent', color: 'var(--color-text-muted)', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}
              >
                トップに戻る
              </button>
              <a
                href="#"
                onClick={e => {
                  e.preventDefault();
                  window.open(tweetIntent, '_blank', 'noopener,noreferrer');
                }}
                style={{
                  padding: '8px 14px',
                  height: 36,
                  boxSizing: 'border-box',
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#fff',
                  backgroundColor: '#0f1419',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  lineHeight: 1,
                }}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Xでポストする
              </a>
            </div>
          </div>
        </div>
        {isDebugLocal && (
          <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} />
        )}
      </>
      );
    }

    return (
      <>
      <Stage
        characterVariant="usually"
        characterSpeech={
          <p style={{ margin: 0, fontWeight: 700, color: 'var(--color-text)', fontSize: 20 }}>こんな作品なんてどう？</p>
        }
        whiteboardWide={true}
      >
        <RecommendResultsGrid
          works={recommendedWorks}
          totalMatched={totalMatched}
          onBack={onBack}
          onRetry={onRetry}
          isMobile={false}
        />
      </Stage>
      {isDebugLocal && (
        <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} />
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
        characterSpeech={null}
        whiteboardWide={true}
      >
        <div style={{ padding: isMobile ? '0.75rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
          <p style={{ margin: '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>
            {rc.initialMain}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 32 }}>
            {[
              { value: 'famous' as const, label: 'やっぱり有名作品！' },
              { value: 'hidden' as const, label: '隠れた名作！' },
              { value: 'middle' as const, label: '中間くらいの作品！' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPopularityChoice(value)}
                style={{
                  ...initBtnBase,
                  backgroundColor: popularityChoice === value ? '#dbeafe' : '#faf8f5',
                  color: popularityChoice === value ? '#1d4ed8' : 'var(--color-text)',
                  border: popularityChoice === value ? `2px solid ${INITIAL_BTN_BASE}` : '2px solid #e5e7eb',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p style={{ margin: '0 0 16px 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>
            {rc.initialPriorityQuestion}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
            {CATEGORIES.map((cat) => {
              const idx = priorityOrder.indexOf(cat);
              const selected = idx >= 0;
              const shade = selected ? INITIAL_BTN_LIGHT[idx]! : INITIAL_BTN_BASE;
              return (
                <button
                  key={cat}
                  onClick={() => addToPriority(cat)}
                  style={{
                    ...initBtnBase,
                    backgroundColor: selected ? `${shade}22` : '#faf8f5',
                    color: selected ? '#1d4ed8' : 'var(--color-text)',
                    border: selected ? `2px solid ${shade}` : '2px solid #e5e7eb',
                    gap: 6,
                  }}
                >
                  {cat}
                  {selected && <span style={{ fontSize: 13, fontWeight: 'bold' }}>{['①', '②', '③'][idx]}</span>}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <button
              onClick={() => canProceedFromInitial && setStep(1)}
              disabled={!canProceedFromInitial}
              style={{
                padding: isMobile ? '14px 24px' : '16px 32px',
                fontSize: isMobile ? 16 : 17,
                fontWeight: 600,
                backgroundColor: canProceedFromInitial ? INITIAL_BTN_BASE : '#e5e7eb',
                color: canProceedFromInitial ? '#fff' : '#9ca3af',
                border: 'none',
                borderRadius: 12,
                cursor: canProceedFromInitial ? 'pointer' : 'not-allowed',
              }}
            >
              {rc.btnNext}
            </button>
            <button
              onClick={resetInitial}
              style={{
                padding: isMobile ? '8px 16px' : '10px 20px',
                fontSize: isMobile ? 13 : 14,
                fontWeight: 600,
                backgroundColor: 'transparent',
                color: 'var(--color-text-muted)',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                cursor: 'pointer',
              }}
            >
              {rc.btnRetry}
            </button>
          </div>
          <div style={{ marginTop: 16, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setStep('ai_gate')}
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
                <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
              </svg>
              {rc.btnFix}
            </button>
          </div>
        </div>
      </Stage>
      {isDebugLocal && (
        <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} />
      )}
      </>
    );
  }

  const isFamousStep = step === 1 || step === 2 || step === 3;
  const questionNum = typeof step === 'number' ? step : 1;
  const instruction = isFamousStep ? rc.questionFamous : rc.questionUnknown;

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
          display: 'flex',
          alignItems: 'center',
          padding: '10px 12px',
          fontSize: isMobile ? 15 : 14,
          fontWeight: 500,
          textAlign: 'left',
          backgroundColor: checked ? '#dbeafe' : '#faf8f5',
          color: checked ? '#1d4ed8' : 'var(--color-text)',
          border: `2px solid ${checked ? TAG_SELECT_BLUE : '#e5e7eb'}`,
          borderRadius: 8,
          cursor: 'pointer',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
      </button>
    );

    const gridStyle: React.CSSProperties = {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 8,
      marginBottom: 20,
    };

    const SelectedRow = ({
      items,
      importantKey,
      onSetImportant,
    }: {
      items: Array<{ tagKey: string; displayName: string }>;
      importantKey: string | null;
      onSetImportant: (tagKey: string) => void;
    }) => (
      <div style={{ marginTop: 16, marginBottom: 16, minHeight: 110 }}>
        <p style={{ fontSize: isMobile ? 14 : 13, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 10px 0' }}>
          {rc.importantPrompt}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {items.map(({ tagKey, displayName }) => {
            const isImportant = importantKey === tagKey;
            return (
              <button
                key={tagKey}
                type="button"
                onClick={() => onSetImportant(tagKey)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '10px 12px',
                  fontSize: isMobile ? 15 : 14,
                  fontWeight: 500,
                  textAlign: 'left',
                  backgroundColor: isImportant ? '#fee2e2' : '#dbeafe',
                  color: isImportant ? '#b91c1c' : '#1d4ed8',
                  border: `2px solid ${isImportant ? '#dc2626' : TAG_SELECT_BLUE}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
              </button>
            );
          })}
        </div>
      </div>
    );

    if (isFamousStep) {
      const opts = currentFamousOptions;
      const cat = step === 1 || step === 2 ? priorityOrder[0]! : priorityOrder[1]!;
      const selectedItems = currentFamousOptions.filter(o => checkedFamous.has(o.tagKey)).map(o => ({ tagKey: o.tagKey, displayName: o.displayName }));
      return opts.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 20 }}>このカテゴリにはタグがありません。そのまま次へ進んでね。</p>
      ) : (
        <>
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
          <SelectedRow
            items={selectedItems}
            importantKey={importantFamous}
            onSetImportant={k => setImportantFamousOne(importantFamous === k ? null : k)}
          />
        </>
      );
    }
    const batch = currentUnknownBatch;
    const selectedUnknownItems = batch.filter(t => checkedUnknown.has(t.tagKey)).map(t => ({ tagKey: t.tagKey, displayName: t.displayName }));
    return batch.length === 0 ? (
      <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 20 }}>この中にはありません。そのまま次へ進んでね。</p>
    ) : (
      <>
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
        <SelectedRow
          items={selectedUnknownItems}
          importantKey={importantUnknown}
          onSetImportant={k => setImportantUnknownOne(importantUnknown === k ? null : k)}
        />
      </>
    );
  };

  return (
    <>
    <Stage
      characterVariant="usually"
      characterSpeech={
        <div style={isMobile ? { fontSize: 24, lineHeight: 1.3, textAlign: 'center' } : {}}>
          <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: isMobile ? 28 : 22, height: isMobile ? 28 : 22, backgroundColor: '#334155', color: '#fff', borderRadius: 6, fontSize: isMobile ? 14 : 12, fontWeight: 'bold', marginRight: 8, verticalAlign: 'middle' }}>
              {questionNum}
            </span>
            {instruction}
          </p>
        </div>
      }
      whiteboardWide={true}
    >
      <div style={{ padding: isMobile ? '0.75rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
        {renderTagGrid()}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
          <button
            onClick={() => (isFamousStep ? goNextFromFamous() : goNextFromUnknown())}
            style={{
              padding: isMobile ? '14px 24px' : '16px 32px',
              fontSize: isMobile ? 16 : 17,
              fontWeight: 600,
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            {rc.btnOk}
          </button>
          <button
            onClick={() => {
              if (isFamousStep) {
                setCheckedFamous(new Set());
                setImportantFamous(null);
              } else {
                setCheckedUnknown(new Set());
                setImportantUnknown(null);
              }
            }}
            style={{
              padding: isMobile ? '14px 24px' : '16px 32px',
              fontSize: isMobile ? 16 : 17,
              fontWeight: 600,
              backgroundColor: '#faf8f5',
              color: 'var(--color-text)',
              border: '2px solid #e5e7eb',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            {rc.btnRetry}
          </button>
          <button
            onClick={() => (isFamousStep ? goNextFromFamous(true) : goNextFromUnknown(true))}
            style={{
              padding: isMobile ? '14px 24px' : '16px 32px',
              fontSize: isMobile ? 16 : 17,
              fontWeight: 600,
              backgroundColor: '#faf8f5',
              color: 'var(--color-text)',
              border: '2px solid #e5e7eb',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            {rc.btnNotInList}
          </button>
        </div>
        {step >= 1 && (
          <div style={{ marginTop: 16, width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                if (isFamousStep && step === 1) {
                  setCheckedFamous(new Set());
                  setImportantFamous(null);
                  setStep('initial');
                } else if (isFamousStep) {
                  const prevStep = step === 2 ? 1 : 2;
                  const toRestore = selectedFamous.slice(-lastAddedFamousCount);
                  setSelectedFamous(prev => prev.slice(0, -lastAddedFamousCount));
                  setCheckedFamous(new Set(toRestore.map(x => x.tagKey)));
                  setImportantFamous(toRestore.find(x => x.important)?.tagKey ?? null);
                  setStep(prevStep);
                } else if (step === 4) {
                  const toRestore = selectedFamous.slice(-lastAddedFamousCount);
                  setSelectedFamous(prev => prev.slice(0, -lastAddedFamousCount));
                  setCheckedFamous(new Set(toRestore.map(x => x.tagKey)));
                  setImportantFamous(toRestore.find(x => x.important)?.tagKey ?? null);
                  setStep(3);
                } else if (step >= 5) {
                  const prevStep = step === 5 ? 4 : 5;
                  const toRestore = selectedUnknown.slice(-lastAddedUnknownCount);
                  setSelectedUnknown(prev => prev.slice(0, -lastAddedUnknownCount));
                  setCheckedUnknown(new Set(toRestore.map(x => x.tagKey)));
                  setImportantUnknown(toRestore.find(x => x.important)?.tagKey ?? null);
                  setStep(prevStep);
                }
              }}
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
                <path d="M7.83 11H20v2H7.83l5.59 5.59L12 20l-8-8 8-8 1.41 1.41L7.83 11z" />
              </svg>
              {rc.btnFix}
            </button>
          </div>
        )}
      </div>
    </Stage>
    {isDebugLocal && (
      <RecommendDebugPanel debug={debugData} open={debugPanelOpen} onToggle={() => setDebugPanelOpen(v => !v)} />
    )}
    </>
  );
}

function RecommendResultsGrid({
  works,
  totalMatched,
  onBack,
  onRetry,
  isMobile,
}: {
  works: WorkResult[];
  totalMatched: number;
  onBack: () => void;
  onRetry: () => void;
  isMobile: boolean;
}) {
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}?result=recommend` : '';
  const shareText = '【ERONATOR】おすすめ10件をもらった！ あなたの妄想、エロネイターが当ててみる？\n#エロネイター';
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
              <p style={{ fontSize: isMobile ? 9 : 10, color: 'var(--color-text-muted)', fontWeight: 600, margin: '0 0 2px 0', lineHeight: 1.2 }}>似てる度</p>
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
            <ExternalLink href={rec.productUrl} linkText={LINK_TEXT}>
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
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'flex-start',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: Math.round(12 * s),
          marginTop: isMobile ? Math.round(12 * s) : Math.round(14 * s),
        }}
      >
        <RestartButton onRestart={onRetry} label="もう一度おすすめを探す" inline compact={isMobile} small={!isMobile} />
        <button
          type="button"
          onClick={onBack}
          style={{
            padding: `${Math.round(8 * s)}px ${Math.round(14 * s)}px`,
            fontSize: Math.round(12 * s),
            fontWeight: 600,
            backgroundColor: 'transparent',
            color: 'var(--color-text-muted)',
            border: '1px solid #d1d5db',
            borderRadius: Math.round(8 * s),
            cursor: 'pointer',
          }}
        >
          トップに戻る
        </button>
        <a
          href="#"
          onClick={e => {
            e.preventDefault();
            window.open(tweetIntent, '_blank', 'noopener,noreferrer');
          }}
          style={{
            padding: `${Math.round(8 * s)}px ${Math.round(14 * s)}px`,
            height: Math.round(36 * s),
            boxSizing: 'border-box',
            fontSize: Math.round(12 * s),
            fontWeight: 600,
            color: '#fff',
            backgroundColor: '#0f1419',
            border: 'none',
            borderRadius: Math.round(8 * s),
            cursor: 'pointer',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: Math.round(6 * s),
            lineHeight: 1,
          }}
        >
          <svg width={Math.round(14 * s)} height={Math.round(14 * s)} viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Xでポストする
        </a>
      </div>
    </div>
  );
}
