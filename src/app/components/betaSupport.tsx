/**
 * β期間中の「協力お願い」系UIと文言をまとめたファイル。
 * β終了時は BETA_SUPPORT_ENABLED を false にすれば以下がすべて非表示になる:
 *   - 失敗画面 検索ボックス上の赤字お願いコメント
 *   - 「推薦してもらう」「トップに戻る」押下時の引き留めモーダル
 *   - 惜しかった画面の「ご協力ありがとう」赤字バナー
 *   - 成功画面の Ci-en / X(#エロネイター) 協力依頼パネル
 */

'use client';

import { useEffect, type CSSProperties } from 'react';
import { XLogo } from './icons/XLogo';

/** βが有効か（false にすれば協力依頼系はすべて非表示） */
export const BETA_SUPPORT_ENABLED = true;

/** Ci-en のクリエイターページURL */
export const CIEN_URL = 'https://ci-en.net/creator/36415';

/**
 * X 共有テキスト（#エロネイター タグ付き）。
 * URLは付けない（R18系のURL付きポストはシャドウバンの温床になりやすい）。
 */
export const X_SHARE_TEXT = '同人誌版アキネイター「エロネイター」やってみた #エロネイター';

/** X 投稿用インテントURL（テキストのみ） */
export function buildXHashtagIntentUrl(): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(X_SHARE_TEXT)}`;
}

/** 失敗画面の検索ボックス上に小さく出す赤字お願いコメント */
export const FAILLIST_DEV_MESSAGE = 'エロネイターの精度向上のために、ご協力いただけると嬉しいです。';

/** 引き留めモーダル 文言 */
export const RETENTION_MODAL_TITLE = 'ちょっとだけお願いがあります。';
export const RETENTION_MODAL_BODY =
  '個人開発しているエロネイターの精度向上のために、よろしければ作品を検索して選んでいただけないでしょうか。';
export const RETENTION_MODAL_SEARCH_BTN = '検索してみる';
export const RETENTION_MODAL_SKIP_BTN_DEFAULT = 'そのまま進む';

/** 惜しかった画面に出す赤字お礼バナー */
export const BETA_THANKS_BANNER =
  'ご協力ありがとうございました。今後の精度向上に役立てさせていただきます。';

/** 成功画面の協力依頼パネル 文言 */
export const SUCCESS_CTA_PANEL_TITLE =
  '個人開発のエロネイターのために、ご協力していただけると大変うれしいです。';
export const SUCCESS_CTA_CIEN_LABEL = 'Ci-en（開発ログ・更新情報）';
export const SUCCESS_CTA_CIEN_NOTE = '無料でフォロー可';
export const SUCCESS_CTA_X_LABEL = '#エロネイター でポスト';

// ---- 共通トークン（暖色寄りの赤） ----
const WARM_RED_TEXT = '#b91c1c';
const WARM_RED_BG = '#fff5f5';
const WARM_RED_BORDER = '#ef4444';

/** 失敗画面 検索ボックス上に出す「赤字お願いコメント」 */
export function FailListDevMessageBanner() {
  if (!BETA_SUPPORT_ENABLED) return null;
  const style: CSSProperties = {
    margin: '0 0 8px 0',
    padding: '6px 10px',
    borderLeft: `3px solid ${WARM_RED_BORDER}`,
    background: WARM_RED_BG,
    color: WARM_RED_TEXT,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.45,
    borderRadius: 6,
  };
  return <p style={style}>{FAILLIST_DEV_MESSAGE}</p>;
}

/** 惜しかった画面に出す「ご協力ありがとう」バナー */
export function BetaThanksBanner() {
  if (!BETA_SUPPORT_ENABLED) return null;
  const style: CSSProperties = {
    margin: '0 0 10px 0',
    padding: '6px 10px',
    borderLeft: `3px solid ${WARM_RED_BORDER}`,
    background: WARM_RED_BG,
    color: WARM_RED_TEXT,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.45,
    borderRadius: 6,
    textAlign: 'center',
  };
  return <p style={style}>{BETA_THANKS_BANNER}</p>;
}

/** 引き留めモーダル Props */
export interface RetentionModalProps {
  open: boolean;
  onClose: () => void;
  onProceed: () => void;
  /** 「そのまま進む」ボタンのラベル上書き（押下ボタンに合わせる） */
  skipLabel?: string;
}

/** 失敗画面で「推薦してもらう」「トップに戻る」押下時に一度だけ出す引き留めモーダル */
export function RetentionModal({ open, onClose, onProceed, skipLabel }: RetentionModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !BETA_SUPPORT_ENABLED) return null;

  const overlay: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
  };
  const panel: CSSProperties = {
    width: '100%',
    maxWidth: 440,
    background: '#fff',
    borderRadius: 12,
    padding: 20,
    boxShadow: '0 12px 30px rgba(0,0,0,0.25)',
    borderTop: `4px solid ${WARM_RED_BORDER}`,
    boxSizing: 'border-box',
  };
  const title: CSSProperties = {
    margin: '0 0 10px 0',
    fontSize: 16,
    fontWeight: 800,
    color: WARM_RED_TEXT,
    lineHeight: 1.35,
  };
  const body: CSSProperties = {
    margin: '0 0 16px 0',
    fontSize: 13,
    color: '#1f2937',
    lineHeight: 1.6,
    wordBreak: 'break-word',
  };
  const buttonsRow: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  };
  const btnPrimary: CSSProperties = {
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 700,
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    minWidth: 140,
  };
  const btnSecondary: CSSProperties = {
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 600,
    background: '#fff',
    color: '#374151',
    border: '2px solid #d1d5db',
    borderRadius: 8,
    cursor: 'pointer',
    minWidth: 140,
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <p style={title}>{RETENTION_MODAL_TITLE}</p>
        <p style={body}>{RETENTION_MODAL_BODY}</p>
        <div style={buttonsRow}>
          <button type="button" style={btnSecondary} onClick={onProceed}>
            {skipLabel ?? RETENTION_MODAL_SKIP_BTN_DEFAULT}
          </button>
          <button type="button" style={btnPrimary} onClick={onClose}>
            {RETENTION_MODAL_SEARCH_BTN}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 成功画面の「協力依頼パネル」：赤字お願い + Ci-en + X ボタン */
export function SuccessBetaSupportCTA({ isMobile }: { isMobile: boolean }) {
  if (!BETA_SUPPORT_ENABLED) return null;

  const panel: CSSProperties = {
    margin: isMobile ? '8px 0 10px 0' : '10px 0 12px 0',
    padding: isMobile ? '8px 10px' : '10px 14px',
    borderLeft: `4px solid ${WARM_RED_BORDER}`,
    background: WARM_RED_BG,
    borderRadius: 8,
    boxSizing: 'border-box',
  };
  const title: CSSProperties = {
    margin: '0 0 8px 0',
    fontSize: isMobile ? 11 : 12,
    fontWeight: 700,
    color: WARM_RED_TEXT,
    lineHeight: 1.45,
    textAlign: 'center',
  };
  const btnRow: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: isMobile ? 6 : 8,
    alignItems: 'stretch',
    justifyContent: 'center',
  };
  const btnBase: CSSProperties = {
    flex: isMobile ? 'none' : '0 1 auto',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: isMobile ? '8px 12px' : '8px 14px',
    fontSize: 12,
    fontWeight: 700,
    borderRadius: 8,
    textDecoration: 'none',
    cursor: 'pointer',
    border: 'none',
  };
  const cienBtn: CSSProperties = {
    ...btnBase,
    background: '#f97316',
    color: '#fff',
    boxShadow: '0 1px 3px rgba(249, 115, 22, 0.3)',
  };
  const xBtn: CSSProperties = {
    ...btnBase,
    background: '#000',
    color: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
  };
  const noteStyle: CSSProperties = {
    fontSize: isMobile ? 9 : 10,
    fontWeight: 500,
    opacity: 0.9,
    marginLeft: 4,
  };

  return (
    <div style={panel}>
      <p style={title}>{SUCCESS_CTA_PANEL_TITLE}</p>
      <div style={btnRow}>
        <a href={CIEN_URL} target="_blank" rel="noopener noreferrer" style={cienBtn}>
          <span>{SUCCESS_CTA_CIEN_LABEL}</span>
          <span style={noteStyle}>（{SUCCESS_CTA_CIEN_NOTE}）</span>
        </a>
        <a
          href={buildXHashtagIntentUrl()}
          target="_blank"
          rel="noopener noreferrer"
          style={xBtn}
        >
          <XLogo size={isMobile ? 12 : 14} />
          <span>{SUCCESS_CTA_X_LABEL}</span>
        </a>
      </div>
    </div>
  );
}
