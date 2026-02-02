/**
 * SUCCESSコンポーネント（アキネーター風レイアウト）
 */

'use client';

import { ExternalLink } from './ExternalLink';
import { RestartButton } from './RestartButton';

interface SuccessProps {
  work: {
    workId: string;
    title: string;
    authorName: string;
    productUrl: string;
    thumbnailUrl?: string | null;
  };
  onRestart?: () => void;
}

export function Success({ work, onRestart }: SuccessProps) {
  const linkText = 'FANZAで見る'; // 固定テンプレート

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        minHeight: '100vh',
        maxWidth: '1600px',
        margin: '0 auto',
        gap: '3rem',
      }}
    >
      {/* 左側: キャラクター領域 */}
      <div
        style={{
          flex: '0 0 auto',
          width: '450px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* キャラクター画像のプレースホルダー（後で差し替え） */}
        <div
          style={{
            width: '100%',
            height: '500px',
            backgroundColor: '#e8e8e8',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
            fontSize: '1rem',
            border: '2px dashed #ccc',
          }}
        >
          キャラクター画像
        </div>
      </div>

      {/* 右側: フキダシと作品情報 */}
      <div
        style={{
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: '800px',
        }}
      >
        {/* フキダシ */}
        <div
          style={{
            position: 'relative',
            backgroundColor: '#f5f5f5',
            borderRadius: '20px',
            padding: '2rem 2.5rem',
            marginBottom: '1.5rem',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            lineHeight: '1.6',
            color: '#333',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
            width: '100%',
          }}
        >
          <div style={{ marginBottom: '1rem' }}>正解です！</div>
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#fff',
              borderRadius: '8px',
              border: '1px solid #ddd',
            }}
          >
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              {work.title}
            </h2>
            <p style={{ fontSize: '1rem', color: '#666', marginBottom: '1rem' }}>
              作者: {work.authorName}
            </p>
            {work.thumbnailUrl && (
              <img
                src={work.thumbnailUrl}
                alt={work.title}
                style={{ maxWidth: '200px', margin: '1rem 0', borderRadius: '4px' }}
              />
            )}
            <div style={{ marginTop: '1rem' }}>
              <ExternalLink href={work.productUrl} linkText={linkText}>
                {linkText}
              </ExternalLink>
            </div>
          </div>
          {/* フキダシの矢印（左側、キャラクター方向） */}
          <svg
            style={{
              position: 'absolute',
              left: '-25px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '25px',
              height: '35px',
              filter: 'drop-shadow(2px 2px 2px rgba(0, 0, 0, 0.1))',
            }}
            viewBox="0 0 25 35"
          >
            <path
              d="M 0 17.5 L 25 0 L 25 35 Z"
              fill="#f5f5f5"
            />
          </svg>
        </div>

        {/* 再開ボタン */}
        {onRestart && (
          <div style={{ width: '100%', marginTop: '0.5rem', display: 'flex', justifyContent: 'center' }}>
            <RestartButton onRestart={onRestart} />
          </div>
        )}
      </div>
    </div>
  );
}
