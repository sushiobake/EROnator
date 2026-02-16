/**
 * FAIL_LISTコンポーネント
 * 上位5件（既出除外・同一作者1本まで）を横一列・横スクロール。似てる度・FANZAは表示せず選ぶだけ。カードクリックで onSelectWork。
 */

'use client';

import { useState } from 'react';
import { RestartButton } from './RestartButton';
import { useMediaQuery } from './useMediaQuery';

interface FailListCandidateItem {
  workId: string;
  title: string;
  authorName: string;
  productUrl: string;
  thumbnailUrl?: string | null;
}

interface FailListProps {
  candidates: FailListCandidateItem[];
  onSelectWork: (workId: string) => void;
  onNotInList: (submittedTitleText: string) => void;
  onRestart?: () => void;
}

/** PC・スマホとも横スクロール */
const CARD_MIN_WIDTH = 130;
const CARD_GAP = 10;

export function FailList({ candidates, onSelectWork, onNotInList, onRestart }: FailListProps) {
  const [submittedText, setSubmittedText] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [submittedNotInList, setSubmittedNotInList] = useState(false);
  const isMobile = useMediaQuery(768);

  return (
    <div style={{ padding: isMobile ? '0.75rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
      <h1 style={{ fontSize: isMobile ? '1.2rem' : '1.25rem', marginBottom: isMobile ? '0.35rem' : '0.5rem' }}>うーん…ちょっとわからなかったわ。</h1>
      <p style={{ marginBottom: isMobile ? '0.75rem' : '1rem', fontSize: isMobile ? 17 : undefined, color: 'var(--color-text-muted)' }}>ちなみにこの中にはある？</p>
      <div
        style={{ overflowX: 'auto', overflowY: 'hidden', marginBottom: 8, maxWidth: '100%' }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', gap: CARD_GAP, flexWrap: 'nowrap', width: 'max-content' }}>
        {candidates.map((work) => (
          <div
            key={work.workId}
            role="button"
            tabIndex={0}
            onClick={() => onSelectWork(work.workId)}
            onKeyDown={(e) => e.key === 'Enter' && onSelectWork(work.workId)}
            style={{
              minWidth: CARD_MIN_WIDTH,
              width: CARD_MIN_WIDTH,
              padding: isMobile ? 8 : 10,
              backgroundColor: '#fafafa',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
              <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
                <img
                  src={work.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(work.workId)}`}
                  alt={work.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <p style={{ fontSize: isMobile ? 14 : 12, fontWeight: 600, color: 'var(--color-text)', margin: '0 0 2px 0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {work.title}
              </p>
              <p style={{ fontSize: isMobile ? 13 : 11, color: 'var(--color-text-muted)', margin: 0 }}>{work.authorName}</p>
            </div>
          ))}
        </div>
      </div>
      {!showInput ? (
        <button
          onClick={() => setShowInput(true)}
          style={{
            padding: isMobile ? '12px 20px' : '14px 24px',
            minHeight: 48,
            fontSize: isMobile ? 17 : 16,
            marginTop: isMobile ? '0.75rem' : '1rem',
            cursor: 'pointer',
          }}
        >
          リストにない
        </button>
      ) : (
        <div style={{ marginTop: isMobile ? '1.25rem' : '2rem', display: 'flex', flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: isMobile ? 6 : 8 }}>
          <p style={{ marginBottom: isMobile ? '0.35rem' : '0.5rem', width: '100%', fontSize: isMobile ? 17 : undefined }}>ない？ならここに作品名書いてよ！お願いだから！</p>
          <input
            type="text"
            value={submittedText}
            onChange={(e) => setSubmittedText(e.target.value)}
            style={{
              width: isMobile ? '100%' : 300,
              maxWidth: '100%',
              padding: isMobile ? 10 : 12,
              fontSize: isMobile ? 17 : 16,
              minHeight: 48,
              boxSizing: 'border-box',
            }}
            placeholder="作品名"
          />
          <button
            onClick={() => {
              if (submittedText.trim()) {
                onNotInList(submittedText.trim());
                setSubmittedNotInList(true);
              }
            }}
            style={{
              padding: isMobile ? '10px 20px' : '12px 24px',
              minHeight: 48,
              fontSize: isMobile ? 17 : 16,
              cursor: 'pointer',
            }}
          >
            送信
          </button>
        </div>
      )}
      {onRestart && submittedNotInList && <RestartButton onRestart={onRestart} />}
    </div>
  );
}
