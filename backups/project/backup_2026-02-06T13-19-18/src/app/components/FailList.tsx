/**
 * FAIL_LISTコンポーネント
 * 上位5件（既出除外・同一作者1本まで）を横一列・横スクロール。％表示あり。カードクリックで onSelectWork。
 */

'use client';

import { useState } from 'react';
import { ExternalLink } from './ExternalLink';
import { RestartButton } from './RestartButton';

interface FailListCandidateItem {
  workId: string;
  title: string;
  authorName: string;
  productUrl: string;
  thumbnailUrl?: string | null;
  matchRate?: number;
}

interface FailListProps {
  candidates: FailListCandidateItem[];
  onSelectWork: (workId: string) => void;
  onNotInList: (submittedTitleText: string) => void;
  onRestart?: () => void;
}

const CARD_MIN_WIDTH = 130;
const CARD_GAP = 12;

export function FailList({ candidates, onSelectWork, onNotInList, onRestart }: FailListProps) {
  const [submittedText, setSubmittedText] = useState('');
  const [showInput, setShowInput] = useState(false);

  const linkText = 'FANZAで見る';

  return (
    <div style={{ padding: '1rem 0', maxWidth: '100%', minWidth: 0 }}>
      <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>うーん…ちょっとわからなかったわ。</h1>
      <p style={{ marginBottom: '1rem', color: '#374151' }}>ちなみにこの中にはある？</p>
      <div style={{ overflowX: 'auto', overflowY: 'hidden', marginBottom: 8, maxWidth: '100%' }}>
        <div
          style={{
            display: 'flex',
            gap: CARD_GAP,
            flexWrap: 'nowrap',
            width: 'max-content',
            minHeight: 1,
          }}
        >
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
                padding: 10,
                backgroundColor: '#fafafa',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {typeof work.matchRate === 'number' && (
                <div style={{ marginBottom: 6 }}>
                  <p style={{ fontSize: 11, color: '#374151', fontWeight: 600, margin: '0 0 2px 0', lineHeight: 1.2 }}>
                    回答一致度
                  </p>
                  <p style={{ fontSize: 18, color: '#059669', fontWeight: 700, margin: 0, lineHeight: 1.2, letterSpacing: '0.02em' }}>
                    {Number(work.matchRate).toFixed(1)}％
                  </p>
                </div>
              )}
              <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
                <img
                  src={work.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(work.workId)}`}
                  alt={work.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#1f2937', margin: '0 0 2px 0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {work.title}
              </p>
              <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px 0' }}>{work.authorName}</p>
              <div style={{ fontSize: 10, color: '#6b7280' }}>
                <ExternalLink href={work.productUrl} linkText={linkText}>
                  {linkText}
                </ExternalLink>
              </div>
            </div>
          ))}
        </div>
      </div>
      {!showInput ? (
        <button
          onClick={() => setShowInput(true)}
          style={{
            padding: '0.5rem 1rem',
            fontSize: '1rem',
            marginTop: '1rem',
            cursor: 'pointer',
          }}
        >
          リストにない
        </button>
      ) : (
        <div style={{ marginTop: '2rem' }}>
          <p>作品名を入力してください:</p>
          <input
            type="text"
            value={submittedText}
            onChange={(e) => setSubmittedText(e.target.value)}
            style={{
              width: '300px',
              padding: '0.5rem',
              fontSize: '1rem',
              marginRight: '0.5rem',
            }}
            placeholder="作品名"
          />
          <button
            onClick={() => {
              if (submittedText.trim()) {
                onNotInList(submittedText.trim());
              }
            }}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            送信
          </button>
        </div>
      )}
      {onRestart && <RestartButton onRestart={onRestart} />}
    </div>
  );
}
