/**
 * F@NZA王クイズ プロトタイプ 共通レイアウト
 * - 全ページ共通で左上にロゴを表示（クリックでトップへ）
 * - 下部に 1 行の小さなフッター（エロネイター本体のリンクを踏襲、サイズは抑えめ）
 */

import type { ReactNode } from 'react';
import Link from 'next/link';

const X_URL = 'https://x.com/eronator_jp';
const ERONATOR_URL = 'https://eronator.com';
const VERSION = 'F@NZA王クイズ β(v0.3)';

export default function QuizPrototypeLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: '100vh',
        background: '#f5f5f7',
      }}
    >
      {/* 全画面共通ヘッダー（左上ロゴ） */}
      <header
        style={{
          padding: '10px 20px 0',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Link href="/quiz-prototype" style={{ display: 'inline-flex', alignItems: 'center' }} aria-label="F@NZA王クイズ トップ">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/quiz-prototype/logo.png"
            alt="F@NZA王クイズ"
            style={{ height: 42, width: 'auto', objectFit: 'contain', display: 'block' }}
          />
        </Link>
      </header>

      <main style={{ flex: 1, minHeight: 0 }}>{children}</main>

      <QuizFooter />
    </div>
  );
}

/** 1 行に全リンク・注記・バージョンをまとめた小さなフッター */
function QuizFooter() {
  const linkSm: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--color-text-muted)',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    whiteSpace: 'nowrap',
  };
  const sep: React.CSSProperties = {
    color: 'var(--color-border)',
    fontSize: 11,
    userSelect: 'none',
  };
  const note: React.CSSProperties = {
    fontSize: 10,
    color: 'var(--color-text-subtle)',
    whiteSpace: 'nowrap',
  };

  return (
    <footer
      style={{
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        padding: '6px 12px',
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          rowGap: 4,
          columnGap: 10,
        }}
      >
        <Link href="/quiz-prototype" style={linkSm}>トップに戻る</Link>
        <span style={sep}>|</span>
        <Link href="/contact" style={linkSm}>お問い合わせ</Link>
        <span style={sep}>|</span>
        <a href={X_URL} target="_blank" rel="noopener noreferrer" style={linkSm}>公式X</a>
        <span style={sep}>|</span>
        <Link href="/privacy" style={linkSm}>プライバシーポリシー</Link>
        <span style={sep}>|</span>
        <Link href="/terms" style={linkSm}>利用規約</Link>
        <span style={sep}>|</span>
        <a href={ERONATOR_URL} target="_blank" rel="noopener noreferrer" style={linkSm}>同人誌エロネイターを使ってみる</a>
        <span style={sep}>|</span>
        <span style={note}>このコンテンツは18歳以上の方を対象としています</span>
        <span style={sep}>|</span>
        <span style={note}>アフィリエイト広告を利用しています</span>
        <span style={sep}>|</span>
        <span style={{ ...note, fontWeight: 600, color: 'var(--color-text-muted)' }}>{VERSION}</span>
      </div>
    </footer>
  );
}
