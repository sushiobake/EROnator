/**
 * ルートページ（ゲーム状態管理）
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TopScreen } from './components/TopScreen';
import { AiGate } from './components/AiGate';
import { Quiz } from './components/Quiz';
import { Reveal } from './components/Reveal';
import { Success, SuccessRecommendationsVertical } from './components/Success';
import { FailList, FailListVerticalList } from './components/FailList';
import { DebugPanel, type ForceNavigateScreen } from './components/DebugPanel';
import { Stage, type CharacterVariant } from './components/Stage';
import { useMediaQuery } from './components/useMediaQuery';
import { RecommendMode } from './components/RecommendMode';
import { StreamerCensoredText } from './components/StreamerCensoredText';
import { useToast } from './components/ToastContext';
import { SESSION_NOT_FOUND_CODE } from '@/constants/apiCodes';

async function parseApiErrorJson(response: Response): Promise<{ error: string; code?: string }> {
  const data = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
  return {
    error: typeof data.error === 'string' ? data.error : `通信に失敗しました (${response.status})`,
    code: typeof data.code === 'string' ? data.code : undefined,
  };
}

type GameState =
  | 'TOP'
  | 'AI_GATE'
  | 'QUIZ'
  | 'REVEAL'
  | 'SUCCESS'
  | 'FAIL_LIST'
  | 'ALMOST_SUCCESS'
  | 'RECOMMEND';


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
  kind:
    | 'EXPLORE_TAG'
    | 'SOFT_CONFIRM'
    | 'HARD_CONFIRM'
    | 'SPECIAL_QUESTION'
    | 'NEW_TAG_QUESTION'
    | 'NOISE_GUIDE_RECOMMEND';
  displayText: string;
  tagKey?: string;
  newTagVariantId?: string;
  exploreTagKind?: 'summary' | 'erotic' | 'abstract' | 'normal';
  specialQuestionType?:
    | 'SERIES'
    | 'TITLE_CHAR_TYPE'
    | 'POPULARITY'
    | 'TITLE_SYLLABLE'
    | 'TITLE_SYLLABLE_2'
    | 'AUTHOR_CHAR_TYPE'
    | 'TITLE_LENGTH_STYLE';
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
  /** FAIL_LIST で「リストにない」フォーム表示中はモバイル白板の縦伸びを止める */
  const [failListWhiteboardFill, setFailListWhiteboardFill] = useState(true);
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
  type ThinkingConfigState = {
    inGame: { displayMode: 'random' | 'sequential'; early: { texts: string[] }; mid: { texts: string[] }; late: { texts: string[] }; closing: { texts: string[] } };
    opening: { text: string };
    endingCorrect: { text: string };
    endingWrong: { text: string };
    failListSelect?: { text: string };
    failListNotInList?: { text: string };
  };
  const [gameCopy, setGameCopy] = useState<{
    topLines?: string[]; questionPreamble?: string; revealPreamble?: string; revealMain?: string;
    successSpeech?: string; successTitle?: string; recommendTitle?: string;
    failListSpeech?: string; failListSubMobile?: string; failListSubPc?: string; failListNotInListPrompt?: string;
    almostSuccessSpeech?: string; aiGatePreamble?: string; aiGateMain?: string;
    /** 推薦結果見出しと同じ。保存画像に埋め込む（/api/config/game-ui・/api/start で付与） */
    recommendResultsHeading?: string;
  } | null>(null);
  const [thinkingConfig, setThinkingConfig] = useState<ThinkingConfigState | null>(null);
  const thinkingSeqIndexRef = useRef<Record<string, number>>({ early: 0, mid: 0, late: 0, closing: 0 });
  const [currentThinkingText, setCurrentThinkingText] = useState('考え中…');
  const [pendingThinkingType, setPendingThinkingType] = useState<'opening' | 'inGame' | 'endingCorrect' | 'endingWrong' | 'failListSelect' | 'failListNotInList' | null>(null);
  const { showToast } = useToast();

  const sessionIdRef = useRef<string | null>(null);
  const gameStateRef = useRef<GameState>('TOP');

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    gameStateRef.current = state;
  }, [state]);

  /** 本番のみ: QUIZ/REVEAL 中に離脱したとき Session を元に ABANDONED を記録 */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production') return;

    const onPageHide = () => {
      const sid = sessionIdRef.current;
      const st = gameStateRef.current;
      if (!sid) return;
      if (st !== 'QUIZ' && st !== 'REVEAL') return;
      const payload = JSON.stringify({ sessionId: sid });
      const url = `${window.location.origin}/api/play-history/abandon`;
      const blob = new Blob([payload], { type: 'application/json' });
      if (!navigator.sendBeacon(url, blob)) {
        void fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, []);

  const clearStaleSessionAndReturnTop = useCallback(() => {
    setSessionId(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('eronator_sessionId');
    }
    setState('TOP');
    showToast('セッションが見つかりませんでした。トップからやり直してください。', 'info');
  }, [showToast]);

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
    if (state !== 'FAIL_LIST') setFailListWhiteboardFill(true);
  }, [state]);

  useEffect(() => {
    if (isThinking) setFailListWhiteboardFill(true);
  }, [isThinking]);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem('eronator.debugEnabled', debugEnabled ? '1' : '0');
  }, [isClient, debugEnabled]);

  useEffect(() => {
    if (!isClient) return;
    localStorage.setItem('eronator.debugPanel.open', debugPanelOpen ? '1' : '0');
  }, [isClient, debugPanelOpen]);

  /** ゲーム文言・考え中設定を取得（TOP or AI_GATE で未取得なら） */
  useEffect(() => {
    if ((state === 'TOP' || state === 'AI_GATE') && !gameCopy) {
      fetch('/api/config/game-ui')
        .then((r) => r.ok ? r.json() : null)
        .then((d: { gameCopy?: NonNullable<typeof gameCopy>; thinking?: ThinkingConfigState } | null) => {
          if (d?.gameCopy) setGameCopy(d.gameCopy);
          if (d?.thinking) setThinkingConfig(d.thinking);
        })
        .catch(() => {});
    }
  }, [state, gameCopy]);

  /** isThinking になったタイミングで表示文言を決定（7種: opening / inGame early,mid,late,closing / endingCorrect / endingWrong） */
  useEffect(() => {
    if (!isThinking || !pendingThinkingType) return;
    const cfg = thinkingConfig;
    if (pendingThinkingType === 'opening') {
      setCurrentThinkingText(cfg?.opening?.text ?? '考え中…');
      return;
    }
    if (pendingThinkingType === 'endingCorrect') {
      setCurrentThinkingText(cfg?.endingCorrect?.text ?? 'わかった！');
      return;
    }
    if (pendingThinkingType === 'endingWrong') {
      setCurrentThinkingText(cfg?.endingWrong?.text ?? 'うーん…次は…');
      return;
    }
    if (pendingThinkingType === 'failListSelect') {
      setCurrentThinkingText(cfg?.failListSelect?.text ?? '考え中…');
      return;
    }
    if (pendingThinkingType === 'failListNotInList') {
      setCurrentThinkingText(cfg?.failListNotInList?.text ?? '考え中…');
      return;
    }
    const inGame = cfg?.inGame ?? { displayMode: 'sequential' as const, early: { texts: ['考え中…'] }, mid: { texts: ['なんとなく見えてきた…'] }, late: { texts: ['おっ……これは……！'] }, closing: { texts: ['わかったかも……！'] } };
    const ec = effectiveCandidates;
    const level: 'early' | 'mid' | 'late' | 'closing' = (ec == null || ec > 500) ? 'early' : (ec > 50) ? 'mid' : (ec > 10) ? 'late' : 'closing';
    const arr = (inGame[level]?.texts ?? ['考え中…']).filter(Boolean);
    if (arr.length === 0) {
      setCurrentThinkingText('考え中…');
      return;
    }
    const text = inGame.displayMode === 'random'
      ? arr[Math.floor(Math.random() * arr.length)]
      : arr[thinkingSeqIndexRef.current[level]++ % arr.length];
    setCurrentThinkingText(text);
  }, [isThinking, pendingThinkingType, thinkingConfig, effectiveCandidates]);

  useEffect(() => {
    if (streamerMode) {
      document.body.classList.add('streamer-mode');
    } else {
      document.body.classList.remove('streamer-mode');
    }
  }, [streamerMode]);

  /** 実機Safariでthinking画像が遅延表示される不具合対策：ゲーム画面表示前にプリロード（デフォルト＋7種） */
  useEffect(() => {
    if (!isClient) return;
    const paths = ['/ilust/inari_thinking.png', '/ilust/inari_thinking_opening.png', '/ilust/inari_thinking_early.png', '/ilust/inari_thinking_mid.png', '/ilust/inari_thinking_late.png', '/ilust/inari_thinking_closing.png', '/ilust/inari_thinking_ending_correct.png', '/ilust/inari_thinking_ending_wrong.png', '/ilust/inari_thinking_fail_list_select.png', '/ilust/inari_thinking_fail_list_not_in_list.png'];
    paths.forEach((src) => { const img = new Image(); img.src = src; });
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
    setPendingThinkingType('opening');
    setIsThinking(true);
    const minDelay = new Promise<void>(r => setTimeout(r, 0));
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isClient && debugUIEnabled && debugEnabled && process.env.NEXT_PUBLIC_DEBUG_TOKEN) {
        headers['x-eronator-debug-token'] = process.env.NEXT_PUBLIC_DEBUG_TOKEN;
      }

      const [response] = await Promise.all([
        fetch('/api/start', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            aiGateChoice: choice,
            visitorId: (() => {
              try {
                let vid = localStorage.getItem('eronator.visitorId');
                if (!vid) {
                  vid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
                  localStorage.setItem('eronator.visitorId', vid);
                }
                return vid;
              } catch { return null; }
            })(),
          }),
        }),
        minDelay,
      ]);

      if (!response.ok) {
        const { error: errMsg, code } = await parseApiErrorJson(response);
        if (code === SESSION_NOT_FOUND_CODE) clearStaleSessionAndReturnTop();
        else showToast(errMsg);
        return;
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      localStorage.setItem('eronator_sessionId', data.sessionId);
      if (typeof data.visitorId === 'string' && data.visitorId.length > 0) {
        try {
          localStorage.setItem('eronator.visitorId', data.visitorId);
        } catch {
          /* ignore */
        }
      }
      questionShownAtRef.current = Date.now();
      setQuestion(data.question);
      setQuestionCharacterVariant(getQuestionCharacterVariant(data.question));
      setQuestionCount(data.sessionState.questionCount);
      setEffectiveCandidates(data.effectiveCandidates ?? null);
      setDebugData(data.debug || null);
      if (data.thinking) setThinkingConfig(data.thinking);
      if (data.gameCopy) setGameCopy(data.gameCopy);
      setState('QUIZ');
    } catch (error) {
      console.error('Error starting session:', error);
      const errorMessage = error instanceof Error ? error.message : 'セッション開始に失敗しました';
      showToast(`セッション開始に失敗しました: ${errorMessage}`);
    } finally {
      setIsThinking(false);
      setPendingThinkingType(null);
    }
  };

  const handleQuizAnswer = async (choice: string) => {
    if (!sessionId) return;

    setPendingThinkingType('inGame');
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
        const { error: errMsg, code } = await parseApiErrorJson(response);
        if (code === SESSION_NOT_FOUND_CODE) clearStaleSessionAndReturnTop();
        else showToast(errMsg);
        return;
      }

      const data = await response.json();
      setDebugData(data.debug || null);
      if (data.effectiveCandidates != null) setEffectiveCandidates(data.effectiveCandidates);

      if (data.state === 'REVEAL') {
        setRevealWork(data.work);
        setState('REVEAL');
      } else if (data.state === 'FAIL_LIST') {
        await loadFailList();
      } else if (data.state === 'RECOMMEND') {
        setState('RECOMMEND');
      } else if (data.state === 'TOP') {
        setSessionId(null);
        localStorage.removeItem('eronator_sessionId');
        setState('TOP');
      } else if (data.state === 'QUIZ') {
        questionShownAtRef.current = Date.now();
        setQuestion(data.question);
        setQuestionCharacterVariant(getQuestionCharacterVariant(data.question));
        setQuestionCount(data.sessionState.questionCount);
        setState('QUIZ');
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      showToast('回答の送信に失敗しました');
    } finally {
      setIsThinking(false);
      setPendingThinkingType(null);
    }
  };

  const handleQuizBack = async () => {
    if (!sessionId) return;

    setPendingThinkingType('inGame');
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
        const { error: errMsg, code } = await parseApiErrorJson(response);
        if (code === SESSION_NOT_FOUND_CODE) clearStaleSessionAndReturnTop();
        else showToast(errMsg);
        return;
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
      showToast(error instanceof Error ? error.message : '前の質問に戻れませんでした');
    } finally {
      setIsThinking(false);
      setPendingThinkingType(null);
    }
  };

  /** セッションをリセットしてトップへ（失敗フロー「トップに戻る」など） */
  const handleBackToTopWithReset = () => {
    setSessionId(null);
    localStorage.removeItem('eronator_sessionId');
    setState('TOP');
  };

  /** デバッグ用: 指定画面へ強制遷移（debugUIEnabled時のみ有効） */
  const handleForceNavigate = (screen: ForceNavigateScreen) => {
    const DUMMY_WORK: Work = {
      workId: 'debug-dummy',
      title: 'デバッグ用作品',
      authorName: 'デバッグ作者',
      productUrl: 'https://www.dmm.co.jp/',
    };
    const candidates = debugData?.topCandidates ?? [];
    const toWork = (c: { workId: string; title: string; authorName: string }) => ({
      workId: c.workId,
      title: c.title,
      authorName: c.authorName,
      productUrl: `https://www.dmm.co.jp/dc/doujin/-/detail/=/cid=${c.workId}/`,
    });

    if (screen === 'FAIL_LIST') {
      if (candidates.length > 0) {
        setFailListCandidates(candidates.map(toWork).slice(0, 10));
      } else {
        setFailListCandidates(
          Array.from({ length: 10 }, (_, i) => ({
            ...DUMMY_WORK,
            workId: `debug-fail-${i}`,
            title: `デバッグ候補${i + 1}`,
            authorName: `作者${i + 1}`,
          }))
        );
      }
      setState('FAIL_LIST');
      return;
    }
    if (screen === 'SUCCESS') {
      const work = candidates[0] ? toWork(candidates[0]) : DUMMY_WORK;
      setSuccessWork(work);
      setSuccessRecommendedWorks(candidates.slice(1, 6).map(c => ({ ...toWork(c), matchRate: 85 })));
      setQuestionCount(debugData?.session?.questionCount ?? 10);
      setState('SUCCESS');
      return;
    }
    if (screen === 'ALMOST_SUCCESS') {
      const c = candidates[1] ?? candidates[0];
      const work = c ? toWork(c) : DUMMY_WORK;
      setAlmostSuccessWork(work);
      setAlmostSuccessRecommendedWorks(candidates.slice(2, 7).map(x => ({ ...toWork(x), matchRate: 80 })));
      setQuestionCount(debugData?.session?.questionCount ?? 12);
      setState('ALMOST_SUCCESS');
      return;
    }
    if (screen === 'RECOMMEND') {
      setState('RECOMMEND');
      return;
    }
  };

  const handleRevealAnswer = async (answer: 'YES' | 'NO') => {
    if (!sessionId) return;

    setPendingThinkingType(answer === 'YES' ? 'endingCorrect' : 'endingWrong');
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
        const { error: errMsg, code } = await parseApiErrorJson(response);
        if (code === SESSION_NOT_FOUND_CODE) clearStaleSessionAndReturnTop();
        else showToast(errMsg);
        return;
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
      showToast('回答の送信に失敗しました');
    } finally {
      setIsThinking(false);
      setPendingThinkingType(null);
    }
  };

  const loadFailList = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/failList?sessionId=${sessionId}`);
      if (!response.ok) {
        const { error: errMsg, code } = await parseApiErrorJson(response);
        if (code === SESSION_NOT_FOUND_CODE) clearStaleSessionAndReturnTop();
        else showToast(errMsg);
        return;
      }
      const data = await response.json();
      setFailListCandidates(data.candidates);
      setState('FAIL_LIST');
    } catch (error) {
      console.error('Error loading fail list:', error);
      showToast('候補リストの読み込みに失敗しました');
    }
  };

  const handleFailListSelectWork = async (
    workId: string,
    selectedFrom: 'topCandidates' | 'search' = 'topCandidates',
    searchQuery?: string
  ) => {
    if (!sessionId) return;

    setPendingThinkingType('failListSelect');
    setIsThinking(true);
    const minDelay = new Promise<void>(r => setTimeout(r, MIN_THINKING_MS));
    try {
      const [response] = await Promise.all([
        fetch(
          `/api/failList/selected?sessionId=${encodeURIComponent(sessionId)}&workId=${encodeURIComponent(workId)}&selectedFrom=${encodeURIComponent(selectedFrom)}${searchQuery ? `&searchQuery=${encodeURIComponent(searchQuery)}` : ''}`
        ),
        minDelay,
      ]);
      if (!response.ok) {
        const { error: errMsg, code } = await parseApiErrorJson(response);
        if (code === SESSION_NOT_FOUND_CODE) clearStaleSessionAndReturnTop();
        else showToast(errMsg);
        return;
      }
      const data = await response.json();
      setAlmostSuccessWork(data.work);
      setAlmostSuccessRecommendedWorks(data.recommendedWorks ?? []);
      setState('ALMOST_SUCCESS');
    } catch (error) {
      console.error('Error loading selected work:', error);
      showToast('データの取得に失敗しました');
    } finally {
      setIsThinking(false);
      setPendingThinkingType(null);
    }
  };

  const handleFailListNotInList = async (submittedTitleText: string) => {
    if (!sessionId) return;

    setPendingThinkingType('failListNotInList');
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
        const { error: errMsg, code } = await parseApiErrorJson(response);
        if (code === SESSION_NOT_FOUND_CODE) clearStaleSessionAndReturnTop();
        else showToast(errMsg);
        return;
      }
    } catch (error) {
      console.error('Error submitting not in list:', error);
      showToast('送信に失敗しました');
    } finally {
      setIsThinking(false);
      setPendingThinkingType(null);
    }
  };

  if (state === 'RECOMMEND') {
    return <RecommendMode onBack={() => setState('TOP')} />;
  }

  if (state === 'TOP') {
    return (
      <>
        <TopScreen topLines={gameCopy?.topLines} onPlay={handleTopPlay} onRecommend={() => setState('RECOMMEND')} streamerMode={streamerMode} onToggleStreamerMode={() => {
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
            onForceNavigate={handleForceNavigate}
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
    late: 'thinking',
    closing: 'thinking',
  };
  const thinkingSpeech = (
    <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>{currentThinkingText}</p>
  );
  const thinkingSubType = isThinking && pendingThinkingType ? (pendingThinkingType === 'inGame' ? confidenceLevel : pendingThinkingType) : undefined;
  const gc = gameCopy;

  if (state === 'AI_GATE') {
    const handleTopReset = () => {
      setSessionId(null);
      if (typeof window !== 'undefined') localStorage.removeItem('eronator_sessionId');
      setState('TOP');
    };
    return (
      <>
        {debugUIEnabled && debugEnabled && (
          <DebugPanel
            debug={debugData}
            revealAnalysis={null}
            open={debugPanelOpen}
            onToggle={() => setDebugPanelOpen(v => !v)}
            onForceNavigate={handleForceNavigate}
          />
        )}
        <Stage
          characterVariant={isThinking ? 'thinking' : 'usually'}
          thinkingSubType={thinkingSubType}
          characterSpeech={
            isThinking
              ? thinkingSpeech
              : (
                <div style={isMobile ? { fontSize: 24, lineHeight: 1.3, textAlign: 'center' } : {}}>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: isMobile ? 22 : 15 }}>{gc?.aiGatePreamble ?? 'あなたが妄想した作品は……'}</p>
                  <p style={{ margin: '6px 0 0 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>{gc?.aiGateMain ?? 'AI生成作品ではない？'}</p>
                </div>
              )
          }
        >
          <>
            {!isThinking && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <AiGate onSelect={handleAiGateSelect} />
                <div style={{ marginTop: 16, width: '100%', maxWidth: 320, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                  type="button"
                  onClick={handleTopReset}
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
                    トップに戻る
                  </button>
                </div>
              </div>
            )}
          </>
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
            onForceNavigate={handleForceNavigate}
          />
        )}
        <Stage
          characterVariant={isThinking ? thinkingVariants[confidenceLevel] : questionCharacterVariant}
          thinkingSubType={thinkingSubType}
          characterSpeech={
            isThinking
              ? thinkingSpeech
              : (
                <div style={isMobile ? { fontSize: 24, lineHeight: 1.3, textAlign: 'center' } : {}}>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: isMobile ? 22 : 15 }}>{gc?.questionPreamble ?? 'あなたが妄想した作品は……'}</p>
                  <p style={{ margin: '6px 0 0 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: isMobile ? 30 : 24, height: isMobile ? 30 : 24, backgroundColor: '#334155', color: '#fff', borderRadius: 6, fontSize: isMobile ? 16 : 12, fontWeight: 'bold', marginRight: 10, verticalAlign: 'middle' }}>
                      {questionCount + 1}
                    </span>
                    {streamerMode ? <StreamerCensoredText text={question.displayText} inQuestion /> : question.displayText}
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
            revealAnalysis={revealAnalysis}
            open={debugPanelOpen}
            onToggle={() => setDebugPanelOpen(v => !v)}
            onForceNavigate={handleForceNavigate}
          />
        )}
        <Stage
          characterVariant={isThinking ? 'thinking' : 'usually'}
          thinkingSubType={thinkingSubType}
          characterSpeech={
            isThinking
              ? thinkingSpeech
              : (
                <div style={isMobile ? { fontSize: 24, lineHeight: 1.3, textAlign: 'center' } : {}}>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: isMobile ? 22 : 15 }}>{gc?.revealPreamble ?? 'あなたが妄想した作品は……'}</p>
                  <p style={{ margin: '6px 0 0 0', fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>{gc?.revealMain ?? 'ズバリ！コレ…でしょ！'}</p>
                </div>
              )
          }
          mobileExtendWhiteboard={isMobile}
        >
          {isThinking ? null : <Reveal work={revealWork} onAnswer={handleRevealAnswer} streamerMode={streamerMode} />}
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
            onForceNavigate={handleForceNavigate}
          />
        )}
        <Stage
          characterVariant="usually"
          characterSpeech={
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>
              {(gc?.successSpeech ?? '正解！？やっぱりね！').replace(/\{questionCount\}/g, String(questionCount ?? 0))}
            </p>
          }
          mobileBelowCanvas={isMobile && successRecommendedWorks.length > 0 ? (
            <SuccessRecommendationsVertical recommendedWorks={successRecommendedWorks} sessionId={sessionId} streamerMode={streamerMode} />
          ) : undefined}
          whiteboardWide={true}
        >
          <Success
            shareCaptureHeading={gc?.recommendResultsHeading ?? 'こんな作品なんてどう？'}
            work={successWork}
            recommendedWorks={successRecommendedWorks}
            onBackToTop={() => setState('TOP')}
            mobileListBelow={isMobile}
            sessionId={sessionId}
            questionCount={questionCount}
            successTitle={gc?.successTitle ?? '正解！？やっぱりね！'}
            recommendTitle={gc?.recommendTitle ?? 'そんなあなたには…おすすめもあるわ！'}
            streamerMode={streamerMode}
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
            onForceNavigate={handleForceNavigate}
          />
        )}
        <Stage
          characterVariant="usually"
          characterSpeech={
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>
              {(gc?.almostSuccessSpeech ?? 'それか～～～！次回は当てるからね！').replace(/\{questionCount\}/g, String(questionCount ?? 0))}
            </p>
          }
          mobileBelowCanvas={isMobile && almostSuccessRecommendedWorks.length > 0 ? (
            <SuccessRecommendationsVertical
              recommendedWorks={almostSuccessRecommendedWorks}
              recommendTitle={gc?.recommendTitle ?? 'そんなあなたには…おすすめもあるわ！'}
              sessionId={sessionId}
              streamerMode={streamerMode}
            />
          ) : undefined}
          whiteboardWide={true}
        >
          <Success
            shareCaptureHeading={gc?.recommendResultsHeading ?? 'こんな作品なんてどう？'}
            work={almostSuccessWork}
            recommendedWorks={almostSuccessRecommendedWorks}
            onBackToTop={() => setState('TOP')}
            successTitle={gc?.almostSuccessSpeech ?? 'それか～～～！次回は当てるからね！'}
            recommendTitle={gc?.recommendTitle ?? 'そんなあなたには…おすすめもあるわ！'}
            questionCount={questionCount}
            mobileListBelow={isMobile}
            sessionId={sessionId}
            streamerMode={streamerMode}
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
            onForceNavigate={handleForceNavigate}
          />
        )}
        <Stage
          characterVariant={isThinking ? 'thinking' : 'usually'}
          thinkingSubType={thinkingSubType}
          hideCharacter={true}
          mobileExtendWhiteboard={failListWhiteboardFill ? undefined : false}
          characterSpeech={
            isThinking
              ? thinkingSpeech
              : (
                <div style={isMobile ? { textAlign: 'center' } : {}}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>{gc?.failListSpeech ?? 'うーん…ちょっとわからなかったわ。'}</p>
                  <p style={{ margin: '6px 0 0 0', color: 'var(--color-text-muted)', fontSize: isMobile ? 20 : 15 }}>
                    {isMobile ? (gc?.failListSubMobile ?? '下のリストにある？') : (gc?.failListSubPc ?? 'ちなみにこの中にはある？')}
                  </p>
                </div>
              )
          }
          mobileBelowCanvas={isThinking ? undefined : (isMobile ? (
            <FailListVerticalList
              candidates={failListCandidates}
              onSelectWork={handleFailListSelectWork}
              streamerMode={streamerMode}
            />
          ) : undefined)}
          whiteboardWide={true}
        >
          {isThinking ? null : (
          <FailList
            candidates={failListCandidates}
            onSelectWork={handleFailListSelectWork}
            onNotInList={handleFailListNotInList}
            onBackToTop={() => setState('TOP')}
            onGoRecommend={() => setState('RECOMMEND')}
            onBackToTopWithReset={handleBackToTopWithReset}
            onWhiteboardVerticalFillChange={setFailListWhiteboardFill}
            notInListPrompt={gc?.failListNotInListPrompt ?? 'ない？ならここに作品名書いてよ！お願いだから！'}
            mobileListBelow={isMobile}
            hideCandidateGrid={isMobile}
            streamerMode={streamerMode}
          />
          )}
        </Stage>
      </>
    );
  }

  return <div>Loading...</div>;
}
