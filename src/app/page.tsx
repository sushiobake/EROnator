/**
 * ルートページ（ゲーム状態管理）
 */

'use client';

import { useState, useEffect } from 'react';
import { TopScreen } from './components/TopScreen';
import { AiGate } from './components/AiGate';
import { Quiz } from './components/Quiz';
import { Reveal } from './components/Reveal';
import { Success } from './components/Success';
import { FailList } from './components/FailList';
import { DebugPanel } from './components/DebugPanel';
import { Stage } from './components/Stage';

type GameState =
  | 'TOP'
  | 'AI_GATE'
  | 'QUIZ'
  | 'REVEAL'
  | 'SUCCESS'
  | 'FAIL_LIST';

interface Question {
  kind: 'EXPLORE_TAG' | 'SOFT_CONFIRM' | 'HARD_CONFIRM';
  displayText: string;
}

interface Work {
  workId: string;
  title: string;
  authorName: string;
  productUrl: string;
  thumbnailUrl?: string | null;
}

// デバッグUI有効化判定（クライアント側）
function isDebugUIEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (process.env.NODE_ENV === 'production') return false;
  if (!process.env.NEXT_PUBLIC_DEBUG_TOKEN) return false;
  return true;
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
  const [isClient, setIsClient] = useState(false);
  const [state, setState] = useState<GameState>('TOP');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [revealWork, setRevealWork] = useState<Work | null>(null);
  const [successWork, setSuccessWork] = useState<Work | null>(null);
  const [successRecommendedWorks, setSuccessRecommendedWorks] = useState<Work[]>([]);
  const [failListCandidates, setFailListCandidates] = useState<Work[]>([]);
  const [debugData, setDebugData] = useState<DebugPayload | null>(null);
  const [revealAnalysis, setRevealAnalysis] = useState<any>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const de = localStorage.getItem('eronator.debugEnabled') === '1';
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

  const debugUIEnabled = isDebugUIEnabled();

  // デバッグ情報をコンソールに出力（開発用）
  useEffect(() => {
    if (isClient && process.env.NODE_ENV === 'development') {
      console.log('[Debug Panel] debugUIEnabled:', debugUIEnabled);
      console.log('[Debug Panel] debugEnabled:', debugEnabled);
      console.log('[Debug Panel] debugData:', debugData ? 'exists' : 'null');
      console.log('[Debug Panel] NEXT_PUBLIC_DEBUG_TOKEN:', process.env.NEXT_PUBLIC_DEBUG_TOKEN ? 'set' : 'not set');
      console.log('[Debug Panel] Should show panel:', debugUIEnabled && debugEnabled);
      if (!debugUIEnabled) {
        console.warn('[Debug Panel] debugUIEnabled is false. Check NEXT_PUBLIC_DEBUG_TOKEN in .env.local');
      }
      if (!debugEnabled) {
        console.warn('[Debug Panel] debugEnabled is false. Enable it in /admin/tags config tab');
      }
    }
  }, [isClient, debugUIEnabled, debugEnabled, debugData]);

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
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isClient && debugUIEnabled && debugEnabled && process.env.NEXT_PUBLIC_DEBUG_TOKEN) {
        headers['x-eronator-debug-token'] = process.env.NEXT_PUBLIC_DEBUG_TOKEN;
      }

      const response = await fetch('/api/start', {
        method: 'POST',
        headers,
        body: JSON.stringify({ aiGateChoice: choice }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      localStorage.setItem('eronator_sessionId', data.sessionId);
      setQuestion(data.question);
      setQuestionCount(data.sessionState.questionCount);
      setDebugData(data.debug || null);
      setState('QUIZ');
    } catch (error) {
      console.error('Error starting session:', error);
      const errorMessage = error instanceof Error ? error.message : 'セッション開始に失敗しました';
      alert(`セッション開始に失敗しました: ${errorMessage}`);
    }
  };

  const handleQuizAnswer = async (choice: string) => {
    if (!sessionId) return;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isClient && debugUIEnabled && debugEnabled && process.env.NEXT_PUBLIC_DEBUG_TOKEN) {
        headers['x-eronator-debug-token'] = process.env.NEXT_PUBLIC_DEBUG_TOKEN;
      }

      const response = await fetch('/api/answer', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId, choice }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit answer');
      }

      const data = await response.json();
      setDebugData(data.debug || null);

      if (data.state === 'REVEAL') {
        setRevealWork(data.work);
        setState('REVEAL');
      } else if (data.state === 'FAIL_LIST') {
        await loadFailList();
      } else if (data.state === 'QUIZ') {
        setQuestion(data.question);
        setQuestionCount(data.sessionState.questionCount);
        setState('QUIZ');
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      alert('回答の送信に失敗しました');
    }
  };

  const handleQuizBack = async () => {
    if (!sessionId) return;

    try {
      const response = await fetch('/api/back', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

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
      setQuestion(data.question);
      setQuestionCount(data.sessionState.questionCount);
      setState('QUIZ');
    } catch (error) {
      console.error('Error going back:', error);
      alert(error instanceof Error ? error.message : '前の質問に戻れませんでした');
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

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (isClient && debugUIEnabled && debugEnabled && process.env.NEXT_PUBLIC_DEBUG_TOKEN) {
        headers['x-eronator-debug-token'] = process.env.NEXT_PUBLIC_DEBUG_TOKEN;
      }

      const response = await fetch('/api/reveal', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sessionId, answer }),
      });

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
        setQuestion(data.question);
        setQuestionCount(data.sessionState.questionCount);
        setState('QUIZ');
      }
    } catch (error) {
      console.error('Error submitting reveal answer:', error);
      alert('回答の送信に失敗しました');
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

  const handleFailListSelectWork = (workId: string) => {
    // 作品選択時は終了（SUCCESSボーナスなし）
    alert(`作品を選択しました: ${workId}`);
  };

  const handleFailListNotInList = async (submittedTitleText: string) => {
    if (!sessionId) return;

    try {
      const response = await fetch('/api/failList', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, submittedTitleText }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit not in list');
      }

      alert('送信しました。ありがとうございます。');
    } catch (error) {
      console.error('Error submitting not in list:', error);
      alert('送信に失敗しました');
    }
  };

  if (state === 'TOP') {
    return (
      <>
        <TopScreen onPlay={handleTopPlay} />
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

  if (state === 'AI_GATE') {
    return (
      <Stage>
      <>
        <AiGate onSelect={handleAiGateSelect} />
        {debugUIEnabled && debugEnabled && (
          <DebugPanel
            debug={debugData}
            revealAnalysis={null}
            open={debugPanelOpen}
            onToggle={() => setDebugPanelOpen(v => !v)}
          />
        )}
      </>
      </Stage>
    );
  }

  if (state === 'QUIZ' && question) {
    return (
      <Stage>
      <>
        <Quiz
          question={question}
          questionCount={questionCount + 1}
          onAnswer={handleQuizAnswer}
          onBack={handleQuizBack}
          canGoBack={true}
        />
        {debugUIEnabled && debugEnabled && (
          <DebugPanel
            debug={debugData}
            revealAnalysis={null}
            open={debugPanelOpen}
            onToggle={() => setDebugPanelOpen(v => !v)}
          />
        )}
      </>
      </Stage>
    );
  }

  if (state === 'REVEAL' && revealWork) {
    return (
      <Stage>
      <>
        <Reveal work={revealWork} onAnswer={handleRevealAnswer} />
        {debugUIEnabled && debugEnabled && (
          <DebugPanel
            debug={debugData}
            revealAnalysis={null}
            open={debugPanelOpen}
            onToggle={() => setDebugPanelOpen(v => !v)}
          />
        )}
      </>
      </Stage>
    );
  }

  if (state === 'SUCCESS' && successWork) {
    return (
      <Stage>
      <>
        <Success work={successWork} recommendedWorks={successRecommendedWorks} onRestart={handleRestart} />
        {debugUIEnabled && debugEnabled && (
          <DebugPanel
            debug={debugData}
            revealAnalysis={revealAnalysis}
            open={debugPanelOpen}
            onToggle={() => setDebugPanelOpen(v => !v)}
          />
        )}
      </>
      </Stage>
    );
  }

  if (state === 'FAIL_LIST') {
    return (
      <Stage>
      <>
        <FailList
          candidates={failListCandidates}
          onSelectWork={handleFailListSelectWork}
          onNotInList={handleFailListNotInList}
          onRestart={handleRestart}
        />
        {debugUIEnabled && debugEnabled && (
          <DebugPanel
            debug={debugData}
            revealAnalysis={null}
            open={debugPanelOpen}
            onToggle={() => setDebugPanelOpen(v => !v)}
          />
        )}
      </>
      </Stage>
    );
  }

  return <div>Loading...</div>;
}
