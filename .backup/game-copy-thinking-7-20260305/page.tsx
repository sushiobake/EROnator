/**
 * ルートページ（ゲーム状態管理）
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { TopScreen } from './components/TopScreen';
import { AiGate } from './components/AiGate';
import { Quiz } from './components/Quiz';
import { Reveal } from './components/Reveal';
import { Success, SuccessRecommendationsVertical } from './components/Success';
import { FailList, FailListVerticalList } from './components/FailList';
import { DebugPanel } from './components/DebugPanel';
import { Stage, type CharacterVariant } from './components/Stage';
import { useMediaQuery } from './components/useMediaQuery';
import { RecommendMode } from './components/RecommendMode';

type GameState =
  | 'TOP'
  | 'AI_GATE'
  | 'QUIZ'
  | 'REVEAL'
  | 'SUCCESS'
  | 'FAIL_LIST'
  | 'ALMOST_SUCCESS'
  | 'RECOMMEND';

/** 配信者モード用: 露骨な質問テキストを抽象化 */
function sanitizeQuestionText(text: string): string {
  const eroticWords = [
    'おっぱい', '巨乳', '貧乳', '爆乳', '中出し', '口内射精', 'フェラ', 'パイズリ',
    'アナル', '潮吹き', '絶頂', 'オナニー', '手コキ', '足コキ', '母乳', 'ふたなり',
    '触手', '調教', '緊縛', '陵辱', '痴漢', '露出', '寝取られ', '催眠',
    'ランジェリー', '水着', 'メイド', 'ナース', 'バニー',
  ];
  let sanitized = text;
  for (const word of eroticWords) {
    sanitized = sanitized.replaceAll(word, '〇〇');
  }
  return sanitized;
}

/** 質問種別に応じてキャラ画像バリアントを返す。通常→question固定、エロ→embarrassing/very_embarrassingをランダム */
function getQuestionCharacterVariant(question: { exploreTagKind?: string; kind?: string } | null): CharacterVariant {
  if (!question) return 'question';
  if (question.exploreTagKind === 'erotic') {
    return Math.random() < 0.5 ? 'embarrassing' : 'very_embarrassing';
  }
  // 通常・まとめ・抽象・HARD_CONFIRM は question に統一（thinking は isThinking 時のみ使用）
  return 'question';
}

interface Question {
  kind: 'EXPLORE_TAG' | 'SOFT_CONFIRM' | 'HARD_CONFIRM' | 'SPECIAL_QUESTION';
  displayText: string;
  exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal';
  specialQuestionType?: 'SERIES' | 'TITLE_CHAR_TYPE' | 'POPULARITY' | 'TITLE_SYLLABLE';
}

interface Work {
  workId: string;
  title: string;
  authorName: string;
  productUrl: string;
  thumbnailUrl?: string | null;
}

// デバッグUI有効化判定（クライアント側）
// ローカル開発 or Vercelプレビューでトークンが設定されていればパネル表示を許可
// プレビュー判定: layout で注入した window.__ERONATOR_VERCEL_ENV または NEXT_PUBLIC_VERCEL_ENV を使用
function isDebugUIEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (!process.env.NEXT_PUBLIC_DEBUG_TOKEN) return false;
  if (process.env.NODE_ENV !== 'production') return true;
  const isPreview =
    (typeof (window as unknown as { __ERONATOR_VERCEL_ENV?: string }).__ERONATOR_VERCEL_ENV === 'string' &&
      (window as unknown as { __ERONATOR_VERCEL_ENV?: string }).__ERONATOR_VERCEL_ENV === 'preview') ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview';
  if (isPreview) return true;
  return false;
}

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
      before: number;
      after: number;
      delta: number;
    }>;
  };
  lastAnswerMeta?: {
    questionId?: string;
    answerValue: string;
    touchedTagKeys: string[];
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

export default function Home() {
  const isMobile = useMediaQuery(768);
  const [isClient, setIsClient] = useState(false);
  const [state, setState] = useState<GameState>('TOP');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [revealWork, setRevealWork] = useState<Work | null>(null);
  const [successWork, setSuccessWork] = useState<Work | null>(null);
  const [successRecommendedWorks, setSuccessRecommendedWorks] = useState<Work[]>([]);
  const [failListCandidates, setFailListCandidates] = useState<Work[]>([]);
  const [almostSuccessWork, setAlmostSuccessWork] = useState<Work | null>(null);
  const [almostSuccessRecommendedWorks, setAlmostSuccessRecommendedWorks] = useState<(Work & { matchRate?: number })[]>([]);
  const [debugData, setDebugData] = useState<DebugPayload | null>(null);
  const [revealAnalysis, setRevealAnalysis] = useState<any>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);
  const [questionCharacterVariant, setQuestionCharacterVariant] = useState<CharacterVariant>('usually');
  const [isThinking, setIsThinking] = useState(false);
  const [effectiveCandidates, setEffectiveCandidates] = useState<number | null>(null);
  const [streamerMode, setStreamerMode] = useState(false);
  const questionShownAtRef = useRef<number>(0);
  const [thinkingConfig, setThinkingConfig] = useState<{
    displayMode: 'random' | 'sequential';
    early: string[];
    mid: string[];
    late: string[];
    closing: string[];
  } | null>(null);
  const thinkingSeqIndexRef = useRef<Record<string, number>>({ early: 0, mid: 0, late: 0, closing: 0 });
  const [currentThinkingText, setCurrentThinkingText] = useState('考え中…');

  /** ローカル確認用: .env.local に NEXT_PUBLIC_MIN_THINKING_MS=2000 などで調整。未設定時は開発 1000ms・本番 200ms */
  const MIN_THINKING_MS =
    (typeof process.env.NEXT_PUBLIC_MIN_THINKING_MS !== 'undefined' && Number(process.env.NEXT_PUBLIC_MIN_THINKING_MS)) ||
    (process.env.NODE_ENV === 'development' ? 1000 : 200);

  useEffect(() => {
    setIsClient(true);
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'stream') {
      setStreamerMode(true);
      document.cookie = 'eronator_streamer=1;path=/;max-age=86400';
    } else if (document.cookie.includes('eronator_streamer=1')) {
      setStreamerMode(true);
    }
    let de = localStorage.getItem('eronator.debugEnabled') === '1';
    const isPreviewWithToken =
      process.env.NODE_ENV === 'production' &&
      process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview' &&
      !!process.env.NEXT_PUBLIC_DEBUG_TOKEN;
    if (!de && isPreviewWithToken) {
      de = true;
      localStorage.setItem('eronator.debugEnabled', '1');
    }
    const po = localStorage.getItem('eronator.debugPanel.open') === '1';
    setDebugEnabled(de);
    setDebugPanelOpen(po);

    // localStorageの変更を監視（他のタブやページからの変更を検知）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'eronator.debugEnabled') {
        setDebugEnabled(e.newValue === '1');
      }
      if (e.key === 'eronator.debugPanel.open') {
        setDebugPanelOpen(e.newValue === '1');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // 同じページ内での変更も検知するため、定期的にチェック
    const intervalId = setInterval(() => {
      const currentDe = localStorage.getItem('eronator.debugEnabled') === '1';
      const currentPo = localStorage.getItem('eronator.debugPanel.open') === '1';
      setDebugEnabled(prev => {
        if (prev !== currentDe) {
          return currentDe;
        }
        return prev;
      });
      setDebugPanelOpen(prev => {
        if (prev !== currentPo) {
          return currentPo;
        }
        return prev;
      });
    }, 500); // 500msごとにチェック

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem('eronator.debugEnabled', debugEnabled ? '1' : '0');
  }, [isClient, debugEnabled]);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem('eronator.debugPanel.open', debugPanelOpen ? '1' : '0');
  }, [isClient, debugPanelOpen]);

  /** 「考え中」設定を取得（AI_GATE表示時にプリロード） */
  useEffect(() => {
    if (state === 'AI_GATE' && !thinkingConfig) {
      fetch('/api/config/thinking')
        .then((r) => r.ok ? r.json() : null)
        .then((t) => { if (t) setThinkingConfig(t); })
        .catch(() => {});
    }
  }, [state, thinkingConfig]);

  /** isThinking になったタイミングで表示文言を決定（同じ thinking 中は固定） */
  useEffect(() => {
    if (!isThinking) return;
    const cfg = thinkingConfig ?? { displayMode: 'sequential' as const, early: ['考え中…'], mid: ['なんとなく見えてきた…'], late: ['おっ……これは……！'], closing: ['わかったかも……！'] };
    const ec = effectiveCandidates;
    const level: 'early' | 'mid' | 'late' | 'closing' = (ec == null || ec > 500) ? 'early' : (ec > 50) ? 'mid' : (ec > 10) ? 'late' : 'closing';
    const arr = (cfg[level] ?? ['考え中…']).filter(Boolean);
    if (arr.length === 0) {
      setCurrentThinkingText('考え中…');
      return;
    }
    const text = cfg.displayMode === 'random'
      ? arr[Math.floor(Math.random() * arr.length)]
      : arr[thinkingSeqIndexRef.current[level]++ % arr.length];
    setCurrentThinkingText(text);
  }, [isThinking, thinkingConfig, effectiveCandidates]);

  useEffect(() => {
    if (streamerMode) {
      document.body.classList.add('streamer-mode');
    } else {
      document.body.classList.remove('streamer-mode');
    }
  }, [streamerMode]);

  /** 実機Safariでthinking画像が遅延表示される不具合対策：ゲーム画面表示前にプリロード */
  useEffect(() => {
    if (!isClient) return;
    const img = new Image();
    img.src = '/ilust/inari_thinking.png';
  }, [isClient]);


  const debugUIEnabled = isDebugUIEnabled();

  // デバッグ情報のターミナル出力は無効化

  // sessionIdをLocalStorageで保持
  useEffect(() => {
    const stored = localStorage.getItem('eronator_sessionId');
    if (stored) {
      setSessionId(stored);
    }
  }, []);

  const handleTopPlay = () => {
    setState('AI_GATE');
  };

  const handleAiGateSelect = async (choice: 'YES' | 'NO' | 'DONT_CARE') => {
    setIsThinking(true);
    const minDelay = new Promise<void>(r => setTimeout(r, MIN_THINKING_MS));
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isClient && debugUIEnabled && debugEnabled && process.env.NEXT_PUBLIC_DEBUG_TOKEN) {
        headers['x-eronator-debug-token'] = process.env.NEXT_PUBLIC_DEBUG_TOKEN;
      }

      const [response] = await Promise.all([
        fetch('/api/start', {
          method: 'POST',
          headers,
          body: JSON.stringify({ aiGateChoice: choice }),
        }),
        minDelay,
      ]);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      localStorage.setItem('eronator_sessionId', data.sessionId);
      questionShownAtRef.current = Date.now();
      setQuestion(data.question);
      setQuestionCharacterVariant(getQuestionCharacterVariant(data.question));
      setQuestionCount(data.sessionState.questionCount);
      setEffectiveCandidates(data.effectiveCandidates ?? null);
      setDebugData(data.debug || null);
      if (data.thinking) setThinkingConfig(data.thinking);
      setState('QUIZ');
    } catch (error) {
      console.error('Error starting session:', error);
      const errorMessage = error instanceof Error ? error.message : 'セッション開始に失敗しました';
      alert(`セッション開始に失敗しました: ${errorMessage}`);
    } finally {
      setIsThinking(false);
    }
  };

  const handleQuizAnswer = async (choice: string) => {
    if (!sessionId) return;

    setIsThinking(true);
    const minDelay = new Promise<void>(r => setTimeout(r, MIN_THINKING_MS));
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isClient && debugUIEnabled && debugEnabled && process.env.NEXT_PUBLIC_DEBUG_TOKEN) {
        headers['x-eronator-debug-token'] = process.env.NEXT_PUBLIC_DEBUG_TOKEN;
      }

      const [response] = await Promise.all([
        fetch('/api/answer', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sessionId,
            choice,
            questionShownAt: questionShownAtRef.current ? new Date(questionShownAtRef.current).toISOString() : undefined,
          }),
        }),
        minDelay,
      ]);

      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }

      const data = await response.json();
      setDebugData(data.debug || null);
      if (data.effectiveCandidates != null) setEffectiveCandidates(data.effectiveCandidates);

      if (data.state === 'REVEAL') {
        setRevealWork(data.work);
        setState('REVEAL');
      } else if (data.state === 'FAIL_LIST') {
        await loadFailList();
      } else if (data.state === 'QUIZ') {
        questionShownAtRef.current = Date.now();
        setQuestion(data.question);
        setQuestionCharacterVariant(getQuestionCharacterVariant(data.question));
        setQuestionCount(data.sessionState.questionCount);
        setState('QUIZ');
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert('回答の送信に失敗しました');
    } finally {
      setIsThinking(false);
    }
  };

  const handleQuizBack = async () => {
    if (!sessionId) return;

    setIsThinking(true);
    const minDelay = new Promise<void>(r => setTimeout(r, MIN_THINKING_MS));
    try {
      const [response] = await Promise.all([
        fetch('/api/back', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        }),
        minDelay,
      ]);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to go back');
      }

      const data = await response.json();

      // AIゲートに戻る場合
      if (data.state === 'AI_GATE') {
        setState('AI_GATE');
        return;
      }

      // 前の質問に戻る場合
      questionShownAtRef.current = Date.now();
      setQuestion(data.question);
      setQuestionCharacterVariant(getQuestionCharacterVariant(data.question));
      setQuestionCount(data.sessionState.questionCount);
      setState('QUIZ');
    } catch (error) {
      console.error('Error going back:', error);
      alert(error instanceof Error ? error.message : '前の質問に戻れませんでした');
    } finally {
      setIsThinking(false);
    }
  };

  const handleRestart = () => {
    // セッションIDをクリアしてトップに戻る
    setSessionId(null);
    localStorage.removeItem('eronator_sessionId');
    setState('TOP');
  };

  const handleRevealAnswer = async (answer: 'YES' | 'NO') => {
    if (!sessionId) return;

    setIsThinking(true);
    const minDelay = new Promise<void>(r => setTimeout(r, MIN_THINKING_MS));
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isClient && debugUIEnabled && debugEnabled && process.env.NEXT_PUBLIC_DEBUG_TOKEN) {
        headers['x-eronator-debug-token'] = process.env.NEXT_PUBLIC_DEBUG_TOKEN;
      }

      const [response] = await Promise.all([
        fetch('/api/reveal', {
          method: 'POST',
          headers,
          body: JSON.stringify({ sessionId, answer }),
        }),
        minDelay,
      ]);

      if (!response.ok) {
        throw new Error('Failed to submit reveal answer');
      }

      const data = await response.json();
      setDebugData(data.debug || null);
      setRevealAnalysis(data.revealAnalysis || null);

      if (data.state === 'SUCCESS') {
        if (revealWork) {
          setSuccessWork(revealWork);
          setSuccessRecommendedWorks(Array.isArray(data.recommendedWorks) ? data.recommendedWorks : []);
          setState('SUCCESS');
        }
      } else if (data.state === 'FAIL_LIST') {
        await loadFailList();
      } else if (data.state === 'QUIZ') {
        questionShownAtRef.current = Date.now();
        setQuestion(data.question);
        setQuestionCharacterVariant(getQuestionCharacterVariant(data.question));
        setQuestionCount(data.sessionState.questionCount);
        setState('QUIZ');
      }
    } catch (error) {
      console.error('Error submitting reveal answer:', error);
      alert('回答の送信に失敗しました');
    } finally {
      setIsThinking(false);
    }
  };

  const loadFailList = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/failList?sessionId=${sessionId}`);
      if (!response.ok) {
        throw new Error('Failed to load fail list');
      }
      const data = await response.json();
      setFailListCandidates(data.candidates);
      setState('FAIL_LIST');
    } catch (error) {
      console.error('Error loading fail list:', error);
      alert('候補リストの読み込みに失敗しました');
    }
  };

  const handleFailListSelectWork = async (workId: string) => {
    if (!sessionId) return;

    setIsThinking(true);
    const minDelay = new Promise<void>(r => setTimeout(r, MIN_THINKING_MS));
    try {
      const [response] = await Promise.all([
        fetch(
          `/api/failList/selected?sessionId=${encodeURIComponent(sessionId)}&workId=${encodeURIComponent(workId)}`
        ),
        minDelay,
      ]);
      if (!response.ok) throw new Error('Failed to load selected work');
      const data = await response.json();
      setAlmostSuccessWork(data.work);
      setAlmostSuccessRecommendedWorks(data.recommendedWorks ?? []);
      setState('ALMOST_SUCCESS');
    } catch (error) {
      console.error('Error loading selected work:', error);
      alert('データの取得に失敗しました');
    } finally {
      setIsThinking(false);
    }
  };

  const handleFailListNotInList = async (submittedTitleText: string) => {
    if (!sessionId) return;

    setIsThinking(true);
    const minDelay = new Promise<void>(r => setTimeout(r, MIN_THINKING_MS));
    try {
      const [response] = await Promise.all([
        fetch('/api/failList', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, submittedTitleText }),
        }),
        minDelay,
      ]);

      if (!response.ok) {
        throw new Error('Failed to submit not in list');
      }
    } catch (error) {
      console.error('Error submitting not in list:', error);
      alert('送信に失敗しました');
    } finally {
      setIsThinking(false);
    }
  };

  if (state === 'RECOMMEND') {
    return <RecommendMode onBack={() => setState('TOP')} />;
  }

  if (state === 'TOP') {
    return (
      <>
        <TopScreen onPlay={handleTopPlay} onRecommend={() => setState('RECOMMEND')} streamerMode={streamerMode} onToggleStreamerMode={() => {
          const next = !streamerMode;
          setStreamerMode(next);
          if (next) {
            document.cookie = 'eronator_streamer=1;path=/;max-age=86400';
          } else {
            document.cookie = 'eronator_streamer=;path=/;max-age=0';
          }
        }} />
        {debugUIEnabled && debugEnabled && (
          <DebugPanel
            debug={debugData}
            revealAnalysis={null}
            open={debugPanelOpen}
            onToggle={() => setDebugPanelOpen(v => !v)}
          />
        )}
      </>
    );
  }

  const getConfidenceLevel = (ec: number | null): 'early' | 'mid' | 'late' | 'closing' => {
    if (ec == null || ec > 500) return 'early';
    if (ec > 50) return 'mid';
    if (ec > 10) return 'late';
    return 'closing';
  };
  const confidenceLevel = getConfidenceLevel(effectiveCandidates);

  const thinkingVariants: Record<string, CharacterVariant> = {
    early: 'thinking',
    mid: 'thinking',
    late: 'question',
    closing: 'question',
  };
  const thinkingSpeech = (
    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>{currentThinkingText}</p>
  );

  if (state === 'AI_GATE') {
    return (
      <>
        {debugUIEnabled && debugEnabled && (
          <DebugPanel
            debug={debugData}
            revealAnalysis={null}
            open={debugPanelOpen}
            onToggle={() => setDebugPanelOpen(v => !v)}
          />
        )}
        <Stage
          characterVariant={isThinking ? 'thinking' : 'usually'}
          characterSpeech={
            isThinking
              ? thinkingSpeech
              : (
                <div style={isMobile ? { fontSize: 24, lineHeight: 1.3, textAlign: 'center' } : {}}>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: isMobile ? 22 : 15 }}>あなたが妄想した作品は……</p>
                  <p style={{ margin: '6px 0 0 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>AI生成作品ではない？</p>
                </div>
              )
          }
        >
          {isThinking ? null : <AiGate onSelect={handleAiGateSelect} />}
        </Stage>
      </>
    );
  }

  if (state === 'QUIZ' && question) {
    return (
      <>
        {debugUIEnabled && debugEnabled && (
          <DebugPanel
            debug={debugData}
            revealAnalysis={null}
            open={debugPanelOpen}
            onToggle={() => setDebugPanelOpen(v => !v)}
          />
        )}
        <Stage
          characterVariant={isThinking ? thinkingVariants[confidenceLevel] : questionCharacterVariant}
          characterSpeech={
            isThinking
              ? thinkingSpeech
              : (
                <div style={isMobile ? { fontSize: 24, lineHeight: 1.3, textAlign: 'center' } : {}}>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: isMobile ? 22 : 15 }}>あなたが妄想した作品は……</p>
                  <p style={{ margin: '6px 0 0 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: isMobile ? 30 : 24, height: isMobile ? 30 : 24, backgroundColor: '#334155', color: '#fff', borderRadius: 6, fontSize: isMobile ? 16 : 12, fontWeight: 'bold', marginRight: 10, verticalAlign: 'middle' }}>
                      {questionCount + 1}
                    </span>
                    {streamerMode ? sanitizeQuestionText(question.displayText) : question.displayText}
                  </p>
                </div>
              )
          }
        >
          {isThinking ? null : (
          <Quiz
            question={question}
            questionCount={questionCount + 1}
            onAnswer={handleQuizAnswer}
            onBack={handleQuizBack}
            canGoBack={true}
          />
          )}
        </Stage>
      </>
    );
  }

  if (state === 'REVEAL' && revealWork) {
    return (
      <>
        {debugUIEnabled && debugEnabled && (
          <DebugPanel
            debug={debugData}
            revealAnalysis={null}
            open={debugPanelOpen}
            onToggle={() => setDebugPanelOpen(v => !v)}
          />
        )}
        <Stage
          characterVariant={isThinking ? 'thinking' : 'usually'}
          characterSpeech={
            isThinking
              ? thinkingSpeech
              : (
                <div style={isMobile ? { fontSize: 24, lineHeight: 1.3, textAlign: 'center' } : {}}>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: isMobile ? 22 : 15 }}>あなたが妄想した作品は……</p>
                  <p style={{ margin: '6px 0 0 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>ズバリ！コレ…でしょ！</p>
                </div>
              )
          }
          mobileExtendWhiteboard={isMobile}
        >
          {isThinking ? null : <Reveal work={revealWork} onAnswer={handleRevealAnswer} />}
        </Stage>
      </>
    );
  }

  if (state === 'SUCCESS' && successWork) {
    return (
      <>
        {debugUIEnabled && debugEnabled && (
          <DebugPanel
            debug={debugData}
            revealAnalysis={revealAnalysis}
            open={debugPanelOpen}
            onToggle={() => setDebugPanelOpen(v => !v)}
          />
        )}
        <Stage
          characterVariant="usually"
          characterSpeech={
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>
              正解！？やっぱりね！
            </p>
          }
          mobileBelowCanvas={isMobile && successRecommendedWorks.length > 0 ? (
            <SuccessRecommendationsVertical recommendedWorks={successRecommendedWorks} sessionId={sessionId} />
          ) : undefined}
          whiteboardWide={true}
        >
          <Success
            work={successWork}
            recommendedWorks={successRecommendedWorks}
            onRestart={handleRestart}
            mobileListBelow={isMobile}
            sessionId={sessionId}
            questionCount={questionCount}
          />
        </Stage>
      </>
    );
  }

  if (state === 'ALMOST_SUCCESS' && almostSuccessWork) {
    return (
      <>
        {debugUIEnabled && debugEnabled && (
          <DebugPanel
            debug={debugData}
            revealAnalysis={null}
            open={debugPanelOpen}
            onToggle={() => setDebugPanelOpen(v => !v)}
          />
        )}
        <Stage
          characterVariant="usually"
          characterSpeech={
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>
              それか～～～！次回は当てるからね！
            </p>
          }
          mobileBelowCanvas={isMobile && almostSuccessRecommendedWorks.length > 0 ? (
            <SuccessRecommendationsVertical
              recommendedWorks={almostSuccessRecommendedWorks}
              recommendTitle="そんなあなたには…おすすめもあるわ！"
              sessionId={sessionId}
            />
          ) : undefined}
        >
          <Success
            work={almostSuccessWork}
            recommendedWorks={almostSuccessRecommendedWorks}
            onRestart={handleRestart}
            successTitle="それか～～～！次回は当てるからね！"
            recommendTitle="そんなあなたには…おすすめもあるわ！"
            questionCount={questionCount}
            mobileListBelow={isMobile}
            sessionId={sessionId}
          />
        </Stage>
      </>
    );
  }

  if (state === 'FAIL_LIST') {
    return (
      <>
        {debugUIEnabled && debugEnabled && (
          <DebugPanel
            debug={debugData}
            revealAnalysis={null}
            open={debugPanelOpen}
            onToggle={() => setDebugPanelOpen(v => !v)}
          />
        )}
        <Stage
          characterVariant={isThinking ? 'thinking' : 'usually'}
          characterSpeech={
            isThinking
              ? thinkingSpeech
              : (
                <div style={isMobile ? { textAlign: 'center' } : {}}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>うーん…ちょっとわからなかったわ。</p>
                  <p style={{ margin: '6px 0 0 0', color: 'var(--color-text-muted)', fontSize: isMobile ? 20 : 15 }}>
                    {isMobile ? '下のリストにある？' : 'ちなみにこの中にはある？'}
                  </p>
                </div>
              )
          }
          mobileBelowCanvas={isThinking ? undefined : (isMobile ? (
            <FailListVerticalList
              candidates={failListCandidates}
              onSelectWork={handleFailListSelectWork}
            />
          ) : undefined)}
        >
          {isThinking ? null : (
          <FailList
            candidates={failListCandidates}
            onSelectWork={handleFailListSelectWork}
            onNotInList={handleFailListNotInList}
            onRestart={handleRestart}
            mobileListBelow={isMobile}
          />
          )}
        </Stage>
      </>
    );
  }

  return <div>Loading...</div>;
}
