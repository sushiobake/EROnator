/**
 * 本編成功／推薦モードなど結果画面の4アクションを統一表示。
 * スマホ: 1行目=保存×2・2行目=ポスト+トップ（いずれも横並び）。PC: 1段で flex-wrap。
 * 保存系は teal 統一、ポストは黒＋Xロゴ、トップはプライマリ。
 */

'use client';

import type { CSSProperties } from 'react';
import { XLogo } from './icons/XLogo';

/** 保存系ボタン共通色 */
export const RESULT_SAVE_BG = '#0d9488';

const SAVE_SHADOW = '0 1px 4px rgba(13, 148, 136, 0.35)';
const ROW_GAP = 8;
const ROW_GAP_MOBILE = 5;
const RADIUS = 10;
const RADIUS_MOBILE = 7;

export interface ResultScreenFourButtonsProps {
  onSavePlain?: () => void;
  onSaveMosaic?: () => void;
  onPost: () => void;
  /** 省略時は「トップに戻る」を出さない（ポストを横いっぱいに） */
  onBackToTop?: () => void;
  /** true: 保存行とポスト行を分ける（各行情報は横並び） */
  isMobile: boolean;
  /** 「ポストする」ボタンのラベル上書き（例: '推薦してもらう'） */
  postLabel?: string;
  /** true: Xロゴを非表示（ポスト以外の用途に使う時） */
  postHideIcon?: boolean;
  /** 「ポストする」相当の背景色上書き（省略時は黒） */
  postBackground?: string;
  /** true: 「ポスト」ボタンを先頭に出し、PC は [post, save, mosaic, top]、モバイルは post=フル幅→保存/モザイク→top=フル幅 */
  postFirst?: boolean;
  /** 「ポスト」ボタンのメインラベル上に小さく出す文字（例: '好みの同人誌を'） */
  postLabelPrefix?: string;
}

export function ResultScreenFourButtons({
  onSavePlain,
  onSaveMosaic,
  onPost,
  onBackToTop,
  isMobile,
  postLabel,
  postHideIcon,
  postBackground,
  postFirst,
  postLabelPrefix,
}: ResultScreenFourButtonsProps) {
  const pad = isMobile ? '5px 8px' : '10px 16px';
  const fontSize = isMobile ? 11 : 13;
  const minH = isMobile ? 34 : 44;
  const radius = isMobile ? RADIUS_MOBILE : RADIUS;

  const btnSave: CSSProperties = {
    flex: 1,
    minWidth: 0,
    minHeight: minH,
    padding: pad,
    fontSize,
    fontWeight: 600,
    backgroundColor: RESULT_SAVE_BG,
    color: '#fff',
    border: 'none',
    borderRadius: radius,
    cursor: 'pointer',
    boxShadow: SAVE_SHADOW,
  };

  const btnPost: CSSProperties = {
    flex: 1,
    minWidth: 0,
    minHeight: minH,
    padding: pad,
    fontSize,
    fontWeight: 600,
    backgroundColor: postBackground ?? '#000',
    color: '#fff',
    border: 'none',
    borderRadius: radius,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: isMobile ? 4 : 6,
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)',
  };

  // post ボタン中身（prefix があれば 2 行レイアウト）
  const postIconSize = isMobile ? 12 : 16;
  const postPrefixFs = Math.max(10, fontSize - 3);
  const postInner = postLabelPrefix ? (
    <>
      {!postHideIcon && <XLogo size={postIconSize} />}
      <span
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          lineHeight: 1.15,
        }}
      >
        <span style={{ fontSize: postPrefixFs, fontWeight: 500, opacity: 0.85 }}>
          {postLabelPrefix}
        </span>
        <span style={{ fontWeight: 700 }}>{postLabel ?? 'ポストする'}</span>
      </span>
    </>
  ) : (
    <>
      {!postHideIcon && <XLogo size={postIconSize} />}
      {postLabel ?? 'ポストする'}
    </>
  );

  const btnTop: CSSProperties = {
    flex: 1,
    minWidth: 0,
    minHeight: minH,
    padding: pad,
    fontSize,
    fontWeight: 600,
    backgroundColor: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: radius,
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
  };

  const row: CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ROW_GAP,
    width: '100%',
  };

  const saveMosaicStyle: CSSProperties = isMobile
    ? {
        ...btnSave,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1.12,
        fontSize: 10,
        padding: '5px 6px',
        minHeight: 44,
      }
    : {
        ...btnSave,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1.15,
        fontSize: 11,
        padding: '6px 10px',
        minHeight: 44,
      };

  if (isMobile) {
    if (postFirst) {
      // レイアウト: [推薦フル幅] / [保存・モザイク] / [トップフル幅]
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: ROW_GAP_MOBILE, width: '100%' }}>
          <button
            type="button"
            onClick={onPost}
            style={{ ...btnPost, flex: '1 1 100%', maxWidth: '100%' }}
          >
            {postInner}
          </button>
          {(onSavePlain || onSaveMosaic) && (
            <div style={{ ...row, gap: ROW_GAP_MOBILE }}>
              {onSavePlain && (
                <button type="button" onClick={onSavePlain} style={btnSave}>
                  結果を保存
                </button>
              )}
              {onSaveMosaic && (
                <button type="button" onClick={onSaveMosaic} style={saveMosaicStyle}>
                  <span>結果を</span>
                  <span>「モザイクで」</span>
                  <span>保存</span>
                </button>
              )}
            </div>
          )}
          {onBackToTop && (
            <button type="button" onClick={onBackToTop} style={{ ...btnTop, flex: '1 1 100%', maxWidth: '100%' }}>
              トップに戻る
            </button>
          )}
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: ROW_GAP_MOBILE, width: '100%' }}>
        <div style={{ ...row, gap: ROW_GAP_MOBILE }}>
          {onSavePlain && (
            <button type="button" onClick={onSavePlain} style={btnSave}>
              結果を保存
            </button>
          )}
          {onSaveMosaic && (
            <button type="button" onClick={onSaveMosaic} style={saveMosaicStyle}>
              <span>結果を</span>
              <span>「モザイクで」</span>
              <span>保存</span>
            </button>
          )}
        </div>
        <div style={{ ...row, gap: ROW_GAP_MOBILE }}>
          <button
            type="button"
            onClick={onPost}
            style={{
              ...btnPost,
              ...(onBackToTop ? {} : { flex: '1 1 100%', maxWidth: '100%' }),
            }}
          >
            {postInner}
          </button>
          {onBackToTop && (
            <button type="button" onClick={onBackToTop} style={btnTop}>
              トップに戻る
            </button>
          )}
        </div>
      </div>
    );
  }

  const postButton = (
    <button type="button" onClick={onPost} style={btnPost}>
      {postInner}
    </button>
  );
  const saveButton = onSavePlain ? (
    <button type="button" onClick={onSavePlain} style={btnSave}>
      結果を保存
    </button>
  ) : null;
  const mosaicButton = onSaveMosaic ? (
    <button type="button" onClick={onSaveMosaic} style={saveMosaicStyle}>
      <span>結果を</span>
      <span>「モザイクで」</span>
      <span>保存</span>
    </button>
  ) : null;
  const topButton = onBackToTop ? (
    <button type="button" onClick={onBackToTop} style={btnTop}>
      トップに戻る
    </button>
  ) : null;

  if (postFirst) {
    return (
      <div style={row}>
        {postButton}
        {saveButton}
        {mosaicButton}
        {topButton}
      </div>
    );
  }

  return (
    <div style={row}>
      {saveButton}
      {mosaicButton}
      {postButton}
      {topButton}
    </div>
  );
}

/** 失敗フロー「トップに戻る」（セッションリセット）— 結果画面のトップボタンと揃えた見た目 */
export function failFlowBackToTopButtonStyle(isMobile: boolean): CSSProperties {
  return {
    marginTop: isMobile ? '1rem' : '1.25rem',
    width: '100%',
    maxWidth: 420,
    padding: isMobile ? '12px 20px' : '12px 24px',
    minHeight: 48,
    fontSize: isMobile ? 16 : 15,
    fontWeight: 600,
    backgroundColor: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: RADIUS,
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
  };
}

/** 失敗リスト「リストにない」＋「トップに戻る」の1行—成功画面のポスト行と同寸法 */
export function getFailListBottomRowStyles(isMobile: boolean): {
  row: CSSProperties;
  btnWhite: CSSProperties;
  btnTop: CSSProperties;
  btnPrimaryInline: CSSProperties;
  fontBody: number;
  radius: number;
  minH: number;
  gap: number;
} {
  const pad = isMobile ? '5px 8px' : '10px 16px';
  const fontSize = isMobile ? 11 : 13;
  const minH = isMobile ? 34 : 44;
  const radius = isMobile ? RADIUS_MOBILE : RADIUS;
  const gap = isMobile ? ROW_GAP_MOBILE : ROW_GAP;
  const baseBtn: CSSProperties = {
    flex: 1,
    minWidth: 0,
    minHeight: minH,
    padding: pad,
    fontSize,
    fontWeight: 600,
    border: 'none',
    borderRadius: radius,
    cursor: 'pointer',
  };
  return {
    row: {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      gap,
      width: '100%',
      maxWidth: 420,
      alignSelf: 'stretch',
    },
    btnWhite: {
      ...baseBtn,
      backgroundColor: '#fff',
      color: 'var(--color-text)',
      border: '2px solid var(--color-border)',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
    },
    btnTop: {
      ...baseBtn,
      backgroundColor: 'var(--color-primary)',
      color: '#fff',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
    },
    /** フォーム内「送信」「トップに戻る」—同幅・結果行と同じ高さ（横並び用） */
    btnPrimaryInline: {
      ...baseBtn,
      flex: '1 1 0',
      minWidth: 0,
      maxWidth: 200,
      backgroundColor: 'var(--color-primary)',
      color: '#fff',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
      whiteSpace: 'nowrap',
    },
    fontBody: fontSize,
    radius,
    minH,
    gap,
  };
}
