/**
 * FAIL_LISTコンポーネント
 * 上位N件表示 + リスト外入力
 */

'use client';

import { useState } from 'react';
import { ExternalLink } from './ExternalLink';
import { RestartButton } from './RestartButton';

interface FailListProps {
  candidates: Array<{
    workId: string;
    title: string;
    authorName: string;
    productUrl: string;
    thumbnailUrl?: string | null;
  }>;
  onSelectWork: (workId: string) => void;
  onNotInList: (submittedTitleText: string) => void;
  onRestart?: () => void;
}

export function FailList({ candidates, onSelectWork, onNotInList, onRestart }: FailListProps) {
  const [submittedText, setSubmittedText] = useState('');
  const [showInput, setShowInput] = useState(false);

  const linkText = 'FANZAで見る'; // 固定テンプレート

  return (
    <div style={{ padding: '2rem' }}>
      <h1>候補リスト</h1>
      <p>もしかして、以下の作品ですか？</p>
      <div style={{ margin: '1rem 0' }}>
        {candidates.map((work) => (
          <div
            key={work.workId}
            style={{
              padding: '1rem',
              margin: '0.5rem 0',
              border: '1px solid #ccc',
              cursor: 'pointer',
            }}
            onClick={() => onSelectWork(work.workId)}
          >
            <h3>{work.title}</h3>
            <p>作者: {work.authorName}</p>
            <img
              src={work.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(work.workId)}`}
              alt={work.title}
              style={{ maxWidth: '150px', margin: '0.5rem 0' }}
            />
            <ExternalLink href={work.productUrl} linkText={linkText}>
              {linkText}
            </ExternalLink>
          </div>
        ))}
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
