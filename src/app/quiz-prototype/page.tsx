'use client';

/**
 * F@NZA王クイズ プロトタイプ トップ画面（/quiz-prototype）
 * - 左: サンプル漫画3枚（ユーザー提供画像）
 * - 右: サンプルクイズ（どんなゲームか一目でわかる）
 * - 年齢確認はボタン直上に赤字で表示（オーバーレイではない）
 */

import { useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

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
  darkPanel: '#111827',
  darkPanelBorder: '#1f2937',
};

const PANEL_HEIGHT = 540;

/**
 * サンプル漫画画像のパス（ユーザー作画のため著作権・エロ問題なし）
 * 差し替えは public/quiz-prototype/sample-{1,2,3}.png を上書きするだけ
 */
const SAMPLE_IMAGES = [
  '/quiz-prototype/sample-1.png',
  '/quiz-prototype/sample-2.png',
  '/quiz-prototype/sample-3.png',
];

/** 右ペイン: 雰囲気を見せるだけのダミー選択肢 */
const SAMPLE_CHOICES = [
  { id: 'A', title: 'サンプル作品タイトルA', author: 'サンプルサークルA' },
  { id: 'B', title: 'サンプル作品タイトルB', author: 'サンプルサークルB' },
  { id: 'C', title: 'サンプル作品タイトルC', author: 'サンプルサークルC' },
  { id: 'D', title: 'サンプル作品タイトルD', author: 'サンプルサークルD' },
];

const SAMPLE_HINTS = [
  '「ドキドキする展開」の要素があります。',
  '「書き下ろし感のある絵柄」の要素があります。',
  '「同人誌ならではの温度感」があります。',
];

export default function QuizTopPage() {
  const router = useRouter();
  const [monochrome, setMonochrome] = useState(true);
  const [imageIndex, setImageIndex] = useState(0);
  const [imageBroken, setImageBroken] = useState<Record<number, boolean>>({});

  const startPlay = () => router.push('/quiz-prototype/play');

  return (
    <div style={{ minHeight: 'calc(100vh - 200px)', backgroundColor: COLORS.bg, color: COLORS.text }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '8px 20px 28px' }}>

        {/* プレビュー: 本番と同じ 2/3 + 1/3 レイアウト */}
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: 20,
            alignItems: 'stretch',
          }}
        >
          {/* 左: 漫画サンプル枠 */}
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 11, letterSpacing: '0.1em', fontWeight: 600, color: '#9ca3af' }}>
                SAMPLE / こんな感じの漫画ページから出題されます
              </span>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: '#cbd5e1',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={monochrome}
                  onChange={(e) => setMonochrome(e.target.checked)}
                  style={{ margin: 0 }}
                />
                モノクロ
              </label>
            </div>

            <div
              style={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
                borderRadius: 8,
                background: '#000',
              }}
            >
              {imageBroken[imageIndex] ? (
                <PlaceholderFrame index={imageIndex} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={SAMPLE_IMAGES[imageIndex]}
                  alt={`漫画サンプル ${imageIndex + 1}`}
                  onError={() => setImageBroken((prev) => ({ ...prev, [imageIndex]: true }))}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    filter: monochrome ? 'grayscale(1) contrast(1.02)' : undefined,
                  }}
                />
              )}
            </div>

            {/* 画像ナビ */}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <button
                type="button"
                onClick={() => setImageIndex((p) => Math.max(0, p - 1))}
                disabled={imageIndex <= 0}
                style={navBtnStyle(imageIndex <= 0)}
              >
                ◀
              </button>
              <div style={{ textAlign: 'center', fontSize: 13, color: '#e5e7eb' }}>
                {imageIndex + 1} / {SAMPLE_IMAGES.length}
                <div style={{ marginTop: 4, display: 'flex', justifyContent: 'center', gap: 6 }}>
                  {SAMPLE_IMAGES.map((_, i) => (
                    <span
                      key={`dot-${i}`}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: i === imageIndex ? '#fff' : '#4b5563',
                      }}
                    />
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImageIndex((p) => Math.min(SAMPLE_IMAGES.length - 1, p + 1))}
                disabled={imageIndex >= SAMPLE_IMAGES.length - 1}
                style={navBtnStyle(imageIndex >= SAMPLE_IMAGES.length - 1)}
              >
                ▶
              </button>
            </div>
          </div>

          {/* 右: サンプルクイズ */}
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
              <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-subtle)', letterSpacing: '0.1em', fontWeight: 600 }}>
                SAMPLE QUESTION
              </p>
              <h2 style={{ margin: '2px 0 0', fontSize: 22, fontWeight: 800, lineHeight: 1.25 }}>
                この作品の名前は？
              </h2>
            </div>

            <div style={{ marginBottom: 10 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>
                特徴
              </p>
              <ul style={{ margin: '5px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {SAMPLE_HINTS.map((line, i) => {
                  const m = line.match(/^「(.+)」(.*)$/);
                  return (
                    <li
                      key={`sh-${i}`}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 6,
                        padding: '5px 10px',
                        borderRadius: 6,
                        background: 'var(--color-border-light)',
                        fontSize: 13,
                        lineHeight: 1.4,
                      }}
                    >
                      <span style={{ marginTop: 7, width: 6, height: 6, borderRadius: 999, background: 'var(--color-primary)', flexShrink: 0 }} />
                      <span>
                        {m ? (
                          <>
                            <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>「{m[1]}」</span>
                            <span>{m[2]}</span>
                          </>
                        ) : line}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* サンプル選択肢 */}
            <div style={{ marginTop: 'auto' }}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  borderRadius: 10,
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-md)',
                  opacity: 0.85,
                }}
              >
                {SAMPLE_CHOICES.map((c, idx) => (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px 10px 12px',
                      height: 54,
                      background: 'var(--color-surface)',
                      borderTop: idx > 0 ? '1px solid #e5e7eb' : 'none',
                    }}
                  >
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 999,
                        background: '#f1f5f9',
                        color: 'var(--color-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {c.id}
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.title}
                      </span>
                      <span style={{ display: 'block', marginTop: 2, fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.author}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        {/* 年齢確認 + スタートボタン */}
        <div
          style={{
            marginTop: 22,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {/* 年齢確認テキスト（前半のみ） */}
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: '#dc2626',
              letterSpacing: '0.03em',
            }}
          >
            ⚠️ このコンテンツは18歳以上の方を対象としています。
          </p>

          {/* ボタン直上の「18歳以上」バッジ */}
          <span
            style={{
              display: 'inline-block',
              padding: '3px 12px',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: '#dc2626',
              border: '2px solid #dc2626',
              borderRadius: 999,
              background: '#fff1f2',
            }}
          >
            18歳以上
          </span>

          <button
            type="button"
            onClick={startPlay}
            style={{
              padding: '16px 52px',
              fontSize: 18,
              fontWeight: 700,
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #f97316, #db2777)',
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(219,39,119,0.25)',
              letterSpacing: '0.06em',
            }}
          >
            クイズを始める（全10問）
          </button>
        </div>
      </div>
    </div>
  );
}

function navBtnStyle(disabled: boolean): CSSProperties {
  return {
    padding: '8px 16px',
    fontSize: 15,
    color: '#fff',
    background: '#1f2937',
    border: '1px solid #374151',
    borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
  };
}

function PlaceholderFrame({ index }: { index: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#cbd5e1',
        fontSize: 13,
        textAlign: 'center',
        padding: 12,
        lineHeight: 1.6,
      }}
    >
      <div>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>サンプル漫画 {index + 1}ページ目</p>
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#94a3b8' }}>
          public/quiz-prototype/sample-{index + 1}.png に画像を置くと
          <br />
          ここに表示されます
        </p>
      </div>
    </div>
  );
}
