'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { APP_VERSION } from '@/config/app';
import { XLogo } from './icons/XLogo';
import { useMediaQuery } from './useMediaQuery';

const X_URL = 'https://x.com/eronator_jp';

/** 全ページ下部の共通フッター。問い合わせ・X・法務・注記・バージョン（/api/app-info と同期） */
export function SiteFooter() {
  const isMobile = useMediaQuery(768);
  const [versionLine, setVersionLine] = useState(APP_VERSION);

  useEffect(() => {
    fetch('/api/app-info')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { version?: string } | null) => {
        if (data && typeof data.version === 'string' && data.version.trim()) {
          setVersionLine(data.version.trim());
        }
      })
      .catch(() => {});
  }, []);

  const mainStyle: CSSProperties = {
    fontSize: isMobile ? 17 : 16,
    color: 'var(--color-primary)',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    fontWeight: 600,
    letterSpacing: '0.02em',
    minHeight: isMobile ? 44 : undefined,
    display: 'inline-flex',
    alignItems: 'center',
    padding: isMobile ? '6px 4px' : undefined,
    boxSizing: 'border-box',
  };
  const xRowStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: isMobile ? 17 : 16,
    color: 'var(--color-primary)',
    textDecoration: 'underline',
    textUnderlineOffset: 3,
    fontWeight: 600,
    letterSpacing: '0.02em',
    minHeight: isMobile ? 44 : undefined,
    padding: isMobile ? '6px 4px' : undefined,
    boxSizing: 'border-box',
  };
  const smallLink: CSSProperties = {
    fontSize: isMobile ? 13 : 11,
    color: 'var(--color-text-muted)',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    fontWeight: isMobile ? 500 : 400,
    minHeight: isMobile ? 44 : undefined,
    display: 'inline-flex',
    alignItems: 'center',
    padding: isMobile ? '8px 6px' : undefined,
    boxSizing: 'border-box',
    lineHeight: isMobile ? 1.3 : undefined,
    textAlign: isMobile ? 'center' : undefined,
  };
  const noteStyle: CSSProperties = {
    fontSize: isMobile ? 11 : 10,
    color: 'var(--color-text-subtle)',
    lineHeight: 1.45,
    textAlign: 'center',
    margin: 0,
  };
  const pipe: CSSProperties = {
    color: 'var(--color-border)',
    fontSize: isMobile ? 14 : 12,
    userSelect: 'none',
    alignSelf: isMobile ? 'center' : undefined,
  };

  return (
    <footer
      style={{
        marginTop: 'auto',
        padding: isMobile ? '14px 12px 18px' : '12px 14px 16px',
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: isMobile ? 10 : 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          flexWrap: isMobile ? 'nowrap' : 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: isMobile ? 4 : '8px 12px',
          rowGap: isMobile ? 6 : 6,
          width: '100%',
          maxWidth: 560,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: isMobile ? '6px 10px' : '8px 12px',
            rowGap: 6,
          }}
        >
          <Link href="/contact" style={mainStyle}>
            お問い合わせ
          </Link>
          <span style={pipe}>|</span>
          <a href={X_URL} target="_blank" rel="noopener noreferrer" style={xRowStyle}>
            <XLogo size={isMobile ? 16 : 15} />
            公式X
          </a>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            justifyContent: 'center',
            alignItems: 'stretch',
            gap: isMobile ? 2 : '8px 12px',
            rowGap: 6,
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          <Link
            href="/privacy"
            style={{
              ...smallLink,
              ...(isMobile
                ? {
                    width: '100%',
                    maxWidth: '100%',
                    justifyContent: 'center',
                    textAlign: 'center',
                    whiteSpace: 'normal',
                    boxSizing: 'border-box',
                  }
                : {}),
            }}
          >
            プライバシーポリシー
          </Link>
          {!isMobile && (
            <span style={pipe} aria-hidden>
              |
            </span>
          )}
          <Link
            href="/terms"
            style={{
              ...smallLink,
              ...(isMobile
                ? {
                    width: '100%',
                    maxWidth: '100%',
                    justifyContent: 'center',
                    textAlign: 'center',
                    whiteSpace: 'normal',
                    boxSizing: 'border-box',
                  }
                : {}),
            }}
          >
            利用規約
          </Link>
        </div>
      </div>
      <div style={{ maxWidth: 520, width: '100%' }}>
        <p style={noteStyle}>このコンテンツは18歳以上の方を対象としています</p>
        <p style={noteStyle}>アフィリエイト広告を利用しています</p>
      </div>
      <p
        style={{
          ...noteStyle,
          marginTop: 2,
          fontSize: isMobile ? 12 : 11,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          letterSpacing: '0.04em',
        }}
        aria-label="アプリバージョン"
      >
        {versionLine}
      </p>
    </footer>
  );
}
