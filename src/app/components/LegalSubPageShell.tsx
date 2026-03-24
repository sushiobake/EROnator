'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { useMediaQuery } from './useMediaQuery';

/** 法務・問い合わせ系サブページ用。ゲーム下部フッターに近いダークトーン＋背景 */
const ACCENT = '#5eead4';

const contentBox: CSSProperties = {
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  overflowWrap: 'break-word',
  wordBreak: 'break-word',
  overflowX: 'hidden',
};

export function LegalSubPageShell({ children }: { children: ReactNode }) {
  const isMobile = useMediaQuery(768);
  const outerPad = isMobile ? 'max(12px, env(safe-area-inset-left))' : undefined;
  const outerPadR = isMobile ? 'max(12px, env(safe-area-inset-right))' : undefined;

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflowX: 'hidden',
        width: '100%',
        maxWidth: '100vw',
        boxSizing: 'border-box',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          backgroundImage:
            'linear-gradient(165deg, rgba(15,23,42,0.94) 0%, rgba(30,41,59,0.9) 45%, rgba(15,23,42,0.96) 100%), url(/back.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: isMobile ? `12px ${outerPadR} 2rem ${outerPad}` : 'clamp(1rem, 4vw, 2rem)',
          paddingBottom: '2.5rem',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: 720,
            width: '100%',
            margin: '0 auto',
            flex: 1,
            background: 'rgba(15, 23, 42, 0.93)',
            borderRadius: isMobile ? 12 : 16,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
            padding: isMobile ? '1rem 14px 1.25rem' : 'clamp(1.25rem, 4vw, 2rem)',
            color: '#e2e8f0',
            boxSizing: 'border-box',
            minWidth: 0,
            ...contentBox,
          }}
        >
          <div style={{ marginBottom: '1.25rem' }}>
            <Link
              href="/"
              style={{
                color: ACCENT,
                textDecoration: 'underline',
                textUnderlineOffset: 3,
                fontSize: isMobile ? '0.9rem' : '0.95rem',
                display: 'inline-block',
                maxWidth: '100%',
              }}
            >
              ← トップページに戻る
            </Link>
          </div>
          <div style={contentBox}>{children}</div>
        </div>
      </div>
    </div>
  );
}
