'use client';

/**
 * F@NZA王クイズ プロトタイプ プレイ画面（/quiz-prototype/play）
 * - 左 2/3: サンプル画像パネル（固定サイズ）
 * - 右 1/3: 質問 + 特徴 + 4択パネル（固定サイズ）
 * - ボタンサイズ・漫画枠・「>>」はすべて固定して揺れない
 * - 同一作者を選択肢に入れない（questionBuilder.ts 側で制御）
 * - ローカル開発時のみデバッグパネルを表示
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QuizChoice, QuizQuestion } from '@/quiz-prototype/types';
import { calcRank } from '@/quiz-prototype/rank';

type Phase = 'loading' | 'playing' | 'feedback' | 'result';

interface FeedbackState {
  correct: boolean;
  label: string;
}

interface AnswerRecord {
  questionId: string;
  questionIndex: number;
  correctWorkId: string;
  correctTitle: string;
  correctAuthor: string;
  correctThumbnailUrl: string | null;
  selectedTitle: string;
  selectedAuthor: string;
  isCorrect: boolean;
}

const COLORS = {
  bg: '#f5f5f7',
  panelBorder: 'var(--color-border)',
  panelShadow: 'var(--shadow-md)',
  radius: 12,
  surface: 'var(--color-surface)',
  text: 'var(--color-text)',
  textMuted: 'var(--color-text-muted)',
  primary: 'var(--color-primary)',
  primaryBg: '#dbeafe',
  correctBg: '#dcfce7',
  correctFg: '#166534',
  correctBorder: '#22c55e',
  wrongBg: '#fee2e2',
  wrongFg: '#991b1b',
  wrongBorder: '#ef4444',
  darkPanel: '#111827',
  darkPanelBorder: '#1f2937',
};

const PANEL_HEIGHT = 640;
const CHOICE_HEIGHT = 74;
const ERONATOR_URL = 'https://eronator.com';

const IS_LOCAL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export default function QuizPlayPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const [hoveredChoice, setHoveredChoice] = useState<QuizChoice['id'] | null>(null);
  const [selectedChoiceId, setSelectedChoiceId] = useState<QuizChoice['id'] | null>(null);
  const [correctChoiceId, setCorrectChoiceId] = useState<QuizChoice['id'] | null>(null);
  const [showDebug, setShowDebug] = useState(true);

  const load = useCallback(async () => {
    setPhase('loading');
    setError(null);
    setFeedback(null);
    setAnswers([]);
    setIndex(0);
    setImageIndex(0);
    setSelectedChoiceId(null);
    setCorrectChoiceId(null);
    setHoveredChoice(null);
    setQuestions([]);
    try {
      const res = await fetch('/api/quiz-prototype/generate');
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.error ?? `HTTP ${res.status}`);
        return;
      }
      const qs = data.questions as QuizQuestion[];
      if (!Array.isArray(qs) || qs.length === 0) {
        setError('問題が取得できませんでした');
        return;
      }
      setQuestions(qs);
      setPhase('playing');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const current = questions[index];

  useEffect(() => {
    setImageIndex(0);
    setSelectedChoiceId(null);
    setCorrectChoiceId(null);
    setHoveredChoice(null);
  }, [index, current?.questionId]);

  useEffect(() => {
    if (questions.length === 0) return;
    for (const q of questions) {
      for (const src of q.images) {
        if (!src) continue;
        const img = new Image();
        img.src = src;
      }
    }
  }, [questions]);

  const onChoose = useCallback(
    (choice: QuizChoice) => {
      if (!current || phase !== 'playing') return;
      const isCorrect = choice.isCorrect;
      const correctChoice = current.choices.find((c) => c.isCorrect);
      const rec: AnswerRecord = {
        questionId: current.questionId,
        questionIndex: index + 1,
        correctWorkId: current.correctWorkId,
        correctTitle: correctChoice?.title ?? '',
        correctAuthor: correctChoice?.authorName ?? '',
        correctThumbnailUrl: current.correctThumbnailUrl,
        selectedTitle: choice.title,
        selectedAuthor: choice.authorName,
        isCorrect,
      };
      setSelectedChoiceId(choice.id);
      setCorrectChoiceId(correctChoice?.id ?? null);
      setAnswers((prev) => [...prev, rec]);
      setFeedback({ correct: isCorrect, label: isCorrect ? '正解！' : '不正解…' });
      setPhase('feedback');

      window.setTimeout(() => {
        setFeedback(null);
        if (index + 1 >= questions.length) {
          setPhase('result');
        } else {
          setIndex((i) => i + 1);
          setPhase('playing');
        }
      }, 900);
    },
    [current, index, phase, questions.length],
  );

  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      if (!current || phase !== 'playing') return;
      if (ev.key === 'ArrowLeft') { setImageIndex((p) => Math.max(0, p - 1)); return; }
      if (ev.key === 'ArrowRight') { setImageIndex((p) => Math.min(current.images.length - 1, p + 1)); return; }
      const keyMap: Record<string, QuizChoice['id']> = { '1': 'A', a: 'A', '2': 'B', b: 'B', '3': 'C', c: 'C', '4': 'D', d: 'D' };
      const mapped = keyMap[ev.key.toLowerCase()];
      if (!mapped) return;
      const choice = current.choices.find((c) => c.id === mapped);
      if (choice) onChoose(choice);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [current, onChoose, phase]);

  const correctCount = answers.filter((a) => a.isCorrect).length;
  const rank = useMemo(() => calcRank(correctCount), [correctCount]);

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: 'calc(100vh - 200px)', backgroundColor: COLORS.bg, color: COLORS.text }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '12px 20px 28px' }}>{children}</div>
    </div>
  );

  if (phase === 'loading' && !error && questions.length === 0) {
    return shell(<p style={{ fontSize: 16 }}>読み込み中…</p>);
  }
  if (error) {
    return shell(
      <>
        <p style={{ marginTop: 16, color: '#b91c1c' }}>{error}</p>
        <button type="button" onClick={() => void load()} style={outlineBtn()}>再試行</button>
      </>,
    );
  }

  if (phase === 'result') {
    return shell(
      <ResultView
        answers={answers}
        rank={rank}
        correctCount={correctCount}
        total={questions.length}
        onRetry={() => void load()}
        onBackTop={() => router.push('/quiz-prototype')}
      />,
    );
  }

  if (!current) return null;

  const currentImageSrc = current.images[imageIndex] ?? current.images[0] ?? '';
  const progress = ((index + (phase === 'feedback' ? 1 : 0)) / questions.length) * 100;

  return shell(
    <>
      {/* 固定デバッグパネル（ローカルのみ常時表示） */}
      {IS_LOCAL && (
        <DebugSidePanel
          current={current}
          questionIndex={index}
          totalQuestions={questions.length}
          onJumpResult={() => setPhase('result')}
          collapsed={!showDebug}
          onToggle={() => setShowDebug((v) => !v)}
        />
      )}

      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginBottom: 10 }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          <span>第 <strong style={{ color: 'var(--color-text)' }}>{index + 1}</strong> 問 / {questions.length}</span>
        </div>
      </header>

      <div style={{ height: 8, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ height: '100%', width: `${Math.min(100, progress)}%`, background: 'var(--color-primary)', transition: 'width 0.3s ease' }} />
      </div>

      <section style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'stretch' }}>
        {/* 左パネル: サンプル画像（固定） */}
        <div
          style={{
            height: PANEL_HEIGHT,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: COLORS.radius,
            border: `1px solid ${COLORS.darkPanelBorder}`,
            background: COLORS.darkPanel,
            boxShadow: COLORS.panelShadow,
            padding: 16,
            minWidth: 0,
          }}
        >
          <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', borderRadius: 8, background: '#000' }}>
            {currentImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentImageSrc}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14 }}>
                画像なし
              </div>
            )}
            {feedback && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', pointerEvents: 'none' }}>
                <span style={{ padding: '12px 28px', borderRadius: 14, fontSize: 36, fontWeight: 900, letterSpacing: '0.04em', color: '#fff', background: feedback.correct ? 'rgba(22,163,74,0.92)' : 'rgba(220,38,38,0.92)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                  {feedback.label}
                </span>
              </div>
            )}
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <button type="button" onClick={() => setImageIndex((p) => Math.max(0, p - 1))} disabled={imageIndex <= 0}
              style={{ padding: '8px 16px', fontSize: 15, color: '#fff', background: '#1f2937', border: '1px solid #374151', borderRadius: 8, cursor: imageIndex <= 0 ? 'not-allowed' : 'pointer', opacity: imageIndex <= 0 ? 0.4 : 1 }}>
              ◀
            </button>
            <div style={{ textAlign: 'center', fontSize: 13, color: '#e5e7eb' }}>
              {imageIndex + 1} / {current.images.length}
              <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center', gap: 6 }}>
                {current.images.map((_, i) => (
                  <span key={`${current.questionId}-dot-${i}`} style={{ width: 10, height: 10, borderRadius: 999, background: i === imageIndex ? '#fff' : '#4b5563' }} />
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setImageIndex((p) => Math.min(current.images.length - 1, p + 1))} disabled={imageIndex >= current.images.length - 1}
              style={{ padding: '8px 16px', fontSize: 15, color: '#fff', background: '#1f2937', border: '1px solid #374151', borderRadius: 8, cursor: imageIndex >= current.images.length - 1 ? 'not-allowed' : 'pointer', opacity: imageIndex >= current.images.length - 1 ? 0.4 : 1 }}>
              ▶
            </button>
          </div>
        </div>

        {/* 右パネル: 質問 + 特徴 + 4択（固定） */}
        <aside
          style={{
            height: PANEL_HEIGHT,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: COLORS.radius,
            border: `1px solid ${COLORS.panelBorder}`,
            background: COLORS.surface,
            boxShadow: COLORS.panelShadow,
            padding: 18,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{ marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-subtle)', letterSpacing: '0.1em', fontWeight: 600 }}>QUESTION {index + 1}</p>
            <h2 style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 800, lineHeight: 1.25 }}>この作品のタイトルは？</h2>
          </div>

          <div style={{ marginBottom: 10 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>特徴</p>
            <ul style={{ margin: '5px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {current.hintSentences.map((line, i) => {
                const m = line.match(/^「(.+)」(.*)$/);
                return (
                  <li key={`${current.questionId}-hint-${i}`}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '5px 10px', borderRadius: 6, background: 'var(--color-border-light)', fontSize: 13, lineHeight: 1.4 }}>
                    <span style={{ marginTop: 7, width: 6, height: 6, borderRadius: 999, background: 'var(--color-primary)', flexShrink: 0 }} />
                    <span>
                      {m ? (
                        <><span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>「{m[1]}」</span><span>{m[2]}</span></>
                      ) : line}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 10, border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)', width: '100%' }}>
              {current.choices.map((c, idx) => {
                const isSelected = selectedChoiceId === c.id;
                const isCorrect = correctChoiceId === c.id;
                const showCorrect = phase === 'feedback' && isCorrect;
                const showWrong = phase === 'feedback' && isSelected && !isCorrect;
                const isHovered = hoveredChoice === c.id && phase === 'playing';
                const disabled = phase !== 'playing';

                let bg = 'var(--color-surface)', color = 'var(--color-text)', boxShadow = 'none';
                let badgeBg = '#f1f5f9', badgeColor = 'var(--color-text-muted)';

                if (showCorrect) { bg = COLORS.correctBg; color = COLORS.correctFg; boxShadow = `inset 0 0 0 2px ${COLORS.correctBorder}`; badgeBg = COLORS.correctBorder; badgeColor = '#fff'; }
                else if (showWrong) { bg = COLORS.wrongBg; color = COLORS.wrongFg; boxShadow = `inset 0 0 0 2px ${COLORS.wrongBorder}`; badgeBg = COLORS.wrongBorder; badgeColor = '#fff'; }
                else if (isHovered) { bg = COLORS.primaryBg; color = 'var(--color-primary)'; boxShadow = 'inset 0 0 0 2px var(--color-primary)'; badgeBg = '#fff'; badgeColor = 'var(--color-primary)'; }

                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={disabled}
                    onMouseEnter={() => setHoveredChoice(c.id)}
                    onMouseLeave={() => setHoveredChoice(null)}
                    onClick={() => onChoose(c)}
                    style={{
                      position: 'relative', width: '100%', boxSizing: 'border-box', height: CHOICE_HEIGHT,
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 44px 10px 12px',
                      textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled && !showCorrect && !showWrong ? 0.75 : 1,
                      background: bg, color, border: 'none', borderTop: idx > 0 ? '1px solid #e5e7eb' : 'none',
                      boxShadow, transition: 'background-color 0.1s, color 0.1s, box-shadow 0.1s', overflow: 'hidden',
                    }}
                  >
                    <span style={{ width: 28, height: 28, borderRadius: 999, background: badgeBg, color: badgeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, fontWeight: 700, flexShrink: 0, transition: 'background-color 0.1s, color 0.1s' }}>
                      {c.id}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 14, fontWeight: 600, lineHeight: 1.25, wordBreak: 'break-word' }}>
                        {c.title}
                      </span>
                      <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: isHovered ? 'var(--color-primary)' : 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.authorName}
                      </span>
                    </span>
                    <span aria-hidden style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--color-primary)', opacity: isHovered ? 1 : 0, pointerEvents: 'none', transition: 'opacity 0.1s' }}>
                      &gt;&gt;
                    </span>
                  </button>
                );
              })}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--color-text-subtle)' }}>
              ショートカット: 1-4 / A-D で選択、←→ で画像切替
            </p>
          </div>
        </aside>
      </section>

    </>,
  );
}

function outlineBtn(color?: string) {
  return {
    marginTop: 16,
    padding: '8px 16px',
    fontSize: 14,
    borderRadius: 8,
    border: `1px solid ${color ?? 'var(--color-border)'}`,
    background: '#fff',
    color: color ?? 'var(--color-text)',
    cursor: 'pointer',
  } as const;
}

// ===================== デバッグサイドパネル（ローカルのみ・常時表示） =====================

/**
 * このコンポーネントは「ローカル開発時だけ画面右上に固定表示するデバッグパネル」を担当。
 * - 現在の問題の正解タイトル・作者
 * - 作品DB（Prisma の Work.tags 全部）の displayName を derived/official/structural ごとに色分け羅列
 * - 結果画面へジャンプするボタン
 * - 最小化ボタン（邪魔になったら畳める）
 */
function DebugSidePanel({
  current,
  questionIndex,
  totalQuestions,
  onJumpResult,
  collapsed,
  onToggle,
}: {
  current: QuizQuestion;
  questionIndex: number;
  totalQuestions: number;
  onJumpResult: () => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const correct = current.choices.find((c) => c.isCorrect);
  const tags = current.debugAllTags ?? { derived: [], official: [], structural: [] };

  const headerStyle: React.CSSProperties = {
    padding: '8px 12px',
    background: '#7c3aed',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    cursor: 'pointer',
    gap: 8,
  };

  if (collapsed) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 90,
          right: 16,
          zIndex: 10001,
          borderRadius: 8,
          background: '#fff',
          border: '2px solid #7c3aed',
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
          width: 120,
        }}
      >
        <div style={headerStyle} onClick={onToggle}>
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em' }}>DEBUG</span>
          <span style={{ fontSize: 14, fontWeight: 800 }}>+</span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 90,
        right: 16,
        zIndex: 10001,
        width: 360,
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 140px)',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 8,
        background: '#fff',
        border: '2px solid #7c3aed',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}
    >
      <div style={headerStyle} onClick={onToggle}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em' }}>
          DEBUG ｜ Q{questionIndex + 1} / {totalQuestions}
        </span>
        <span style={{ fontSize: 14, fontWeight: 800 }}>−</span>
      </div>

      <div style={{ padding: 10, overflow: 'auto', fontSize: 12, color: '#1f2937', lineHeight: 1.45 }}>
        <button
          type="button"
          onClick={onJumpResult}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 6,
            border: 'none',
            background: '#7c3aed',
            color: '#fff',
            cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          ▶ 結果画面へジャンプ
        </button>

        <div style={{ padding: '6px 8px', background: '#f5f3ff', borderRadius: 6, marginBottom: 10, border: '1px solid #ddd6fe' }}>
          <div style={{ fontSize: 10, color: '#6d28d9', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 2 }}>
            CORRECT ANSWER
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', wordBreak: 'break-word' }}>
            {correct?.title ?? '(不明)'}
          </div>
          <div style={{ fontSize: 11, color: '#4b5563', marginTop: 2 }}>
            {correct?.authorName ?? ''}
          </div>
          <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4 }}>
            workId: <code>{current.correctWorkId}</code>
          </div>
        </div>

        <DebugTagGroup label="derivedTags（コメント・AI由来）" color="#7c3aed" bg="#ede9fe" items={tags.derived} />
        <DebugTagGroup label="officialTags（公式タグ）" color="#2563eb" bg="#dbeafe" items={tags.official} />
        <DebugTagGroup label="structuralTags（構造由来）" color="#0f766e" bg="#ccfbf1" items={tags.structural} />

        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #e5e7eb' }}>
          <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, marginBottom: 4 }}>ヒント文（出題で使用）</div>
          <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 11, color: '#4b5563' }}>
            {current.hintSentences.map((h, i) => (
              <li key={`dbg-hint-${i}`} style={{ marginBottom: 2 }}>{h}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/** デバッグタグ一覧の1グループ（色分けされたバッジを並べる） */
function DebugTagGroup({ label, color, bg, items }: { label: string; color: string; bg: string; items: string[] }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color, letterSpacing: '0.04em', marginBottom: 4 }}>
        {label}（{items.length}）
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 10, color: '#9ca3af' }}>(なし)</div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {items.map((t, i) => (
            <span
              key={`${label}-${i}-${t}`}
              style={{
                display: 'inline-block',
                padding: '2px 7px',
                fontSize: 10,
                borderRadius: 4,
                background: bg,
                color,
                border: `1px solid ${color}33`,
                whiteSpace: 'nowrap',
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== 結果画面（⑤） =====================

function ResultView({
  answers,
  rank,
  correctCount,
  total,
  onRetry,
  onBackTop,
}: {
  answers: AnswerRecord[];
  rank: string;
  correctCount: number;
  total: number;
  onRetry: () => void;
  onBackTop: () => void;
}) {
  const shareText = encodeURIComponent(
    `F@NZA王クイズ で「${rank}」を獲得！ ${correctCount}/${total} 正解\n#F@NZA王クイズ`,
  );
  const shareUrl = typeof window !== 'undefined' ? window.location.origin + '/quiz-prototype' : '';
  const xPostHref = `https://x.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(shareUrl)}`;

  const pct = Math.round((correctCount / total) * 100);

  return (
    <>
      {/* 豪華なヘッダー */}
      <div
        style={{
          marginBottom: 24,
          padding: '28px 24px',
          borderRadius: 16,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4c1d95 100%)',
          boxShadow: '0 12px 40px rgba(79,70,229,0.35)',
          color: '#fff',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 装飾ライン */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 70% 20%, rgba(167,139,250,0.25) 0%, transparent 60%)', pointerEvents: 'none' }} />

        <p style={{ margin: 0, fontSize: 13, letterSpacing: '0.15em', color: '#c4b5fd', fontWeight: 600 }}>RESULT</p>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: 46,
            fontWeight: 900,
            letterSpacing: '0.06em',
            textShadow: '0 4px 16px rgba(0,0,0,0.4)',
            background: 'linear-gradient(90deg, #fde68a, #fbbf24, #f59e0b)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {rank}
        </p>
        <p style={{ margin: '10px 0 0', fontSize: 22, fontWeight: 700, color: '#e0e7ff' }}>
          {correctCount} / {total} 正解
        </p>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 240, height: 8, background: 'rgba(255,255,255,0.15)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #34d399, #10b981)', transition: 'width 0.6s ease' }} />
          </div>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#a5b4fc' }}>正答率 {pct}%</p>
      </div>

      {/* 各問一覧 */}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {answers.map((a) => <ResultRow key={a.questionId} a={a} />)}
      </ul>

      {/* 下部ボタン */}
      <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
        <a
          href={xPostHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: '12px 22px', fontSize: 15, fontWeight: 700, borderRadius: 10, background: '#000', color: '#fff', textDecoration: 'none', minWidth: 148, textAlign: 'center' }}
        >
          Xでポスト
        </a>
        <button
          type="button"
          onClick={onRetry}
          style={{ padding: '12px 22px', fontSize: 15, fontWeight: 700, borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', minWidth: 148 }}
        >
          もう1度遊ぶ
        </button>
        <button
          type="button"
          onClick={onBackTop}
          style={{ padding: '12px 22px', fontSize: 15, fontWeight: 700, borderRadius: 10, border: '1px solid var(--color-border)', background: '#fff', color: 'var(--color-text)', cursor: 'pointer', minWidth: 148 }}
        >
          トップに戻る
        </button>
        <a
          href={ERONATOR_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ padding: '12px 22px', fontSize: 15, fontWeight: 700, borderRadius: 10, border: '1px solid #f97316', background: '#fff7ed', color: '#c2410c', textDecoration: 'none', minWidth: 148, textAlign: 'center' }}
        >
          同人誌エロネイターを使ってみる
        </a>
      </div>
    </>
  );
}

/** 結果1行（タイトル画像 + 右側に情報） */
function ResultRow({ a }: { a: AnswerRecord }) {
  const isCorrect = a.isCorrect;
  const statusColor = isCorrect ? '#166534' : '#991b1b';
  const statusBg = isCorrect ? '#dcfce7' : '#fee2e2';
  const statusBorder = isCorrect ? '#22c55e' : '#ef4444';

  return (
    <li
      style={{
        display: 'grid',
        gridTemplateColumns: '200px 1fr',
        gap: 16,
        padding: 14,
        background: '#fff',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        alignItems: 'stretch',
      }}
    >
      {/* 左: タイトル画像 */}
      <div
        style={{
          width: 200,
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0b0b',
          borderRadius: 8,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {a.correctThumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.correctThumbnailUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <span style={{ color: '#888', fontSize: 12 }}>画像なし</span>
        )}
      </div>

      {/* 右: 情報縦並び */}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>第 {a.questionIndex} 問</span>
          {/* 正解/不正解を大きく目立たせる */}
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              padding: '3px 14px',
              borderRadius: 999,
              background: statusBg,
              color: statusColor,
              border: `1.5px solid ${statusBorder}`,
              letterSpacing: '0.04em',
            }}
          >
            {isCorrect ? '✓ 正解' : '✗ 不正解'}
          </span>
        </div>

        <p style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.3, wordBreak: 'break-word' }}>
          {a.correctTitle || '(タイトル不明)'}
        </p>
        <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
          {a.correctAuthor || ''}
        </p>

        {!isCorrect && (
          <p style={{ marginTop: 10, fontSize: 12, color: 'var(--color-text-muted)' }}>
            あなたの回答: {a.selectedTitle}{a.selectedAuthor ? `（${a.selectedAuthor}）` : ''}
          </p>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 10 }}>
          <a
            href={`https://www.dmm.co.jp/dc/doujin/-/detail/=/cid=${encodeURIComponent(a.correctWorkId)}/`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, borderRadius: 8, background: '#f97316', color: '#fff', textDecoration: 'none' }}
          >
            読んでみる（PR）
          </a>
        </div>
      </div>
    </li>
  );
}
