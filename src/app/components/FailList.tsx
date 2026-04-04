/**
 * FAIL_LISTコンポーネント
 * 上位N件（config failListN・既出除外・同一作者1本まで）をグリッド表示。
 * PC: 5列×行（推薦結果のPCグリッドに近い）、モバイル: 2列（推薦キャプチャの2列に近い）。
 */

'use client';

import { useEffect, useState } from 'react';
import {
  failFlowBackToTopButtonStyle,
  getFailListBottomRowStyles,
} from './ResultScreenFourButtons';
import { useMediaQuery } from './useMediaQuery';
import { useClickGuard } from './useClickGuard';
import { StreamerCensoredText } from './StreamerCensoredText';

interface FailListCandidateItem {
  workId: string;
  title: string;
  authorName: string;
  productUrl: string;
  thumbnailUrl?: string | null;
}

const DEFAULT_NOT_IN_LIST_PROMPT = 'ない？ならここに作品名書いてよ！お願いだから！';

const CARD_GAP = 10;

interface FailListProps {
  candidates: FailListCandidateItem[];
  onSelectWork: (workId: string, selectedFrom?: 'topCandidates' | 'search', searchQuery?: string) => void;
  onNotInList: (submittedTitleText: string) => void;
  onGoRecommend?: () => void;
  /** 結果画面と同様の「トップに戻る」（セッション維持でトップへ） */
  onBackToTop: () => void;
  /** リストにない送信後：セッションリセットしてトップへ（表示は「トップに戻る」） */
  onBackToTopWithReset?: () => void;
  /** true: モバイル白板を縦に伸ばす（リスト表示時）。フォーム表示中は false にする */
  onWhiteboardVerticalFillChange?: (fill: boolean) => void;
  /** 「リストにない」押下後に表示する一文（コンフィグで変更可） */
  notInListPrompt?: string;
  failListBtnNotInList?: string;
  failListBtnRecommend?: string;
  failListBtnTop?: string;
  failListSearchIntro?: string;
  failListSearchPlaceholder?: string;
  /** @deprecated レイアウト用。mobileBelowCanvas で FailListVerticalList を使用 */
  mobileListBelow?: boolean;
  /** true のとき候補グリッドを出さない（スマホでキャンバス下リストと重複させない） */
  hideCandidateGrid?: boolean;
  /** 配信者モード時はタイトルを部分的伏字 */
  streamerMode?: boolean;
}

interface SearchCandidateItem {
  workId: string;
  title: string;
  authorName: string;
  thumbnailUrl?: string | null;
  source?: 'active' | 'reserve';
}

function FailListWorkTile({
  work,
  onSelect,
  interactionDisabled,
  streamerMode,
  compact,
}: {
  work: FailListCandidateItem;
  onSelect: () => void;
  interactionDisabled: boolean;
  streamerMode?: boolean;
  /** キャンバス下の2列用に余白を少し詰める */
  compact?: boolean;
}) {
  const pad = compact ? 8 : 10;
  const titleFs = compact ? 11 : 12;
  const authorFs = compact ? 9 : 10;
  return (
    <div
      role="button"
      tabIndex={interactionDisabled ? -1 : 0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      style={{
        minWidth: 0,
        padding: pad,
        backgroundColor: '#fafafa',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        cursor: interactionDisabled ? 'not-allowed' : 'pointer',
        opacity: interactionDisabled ? 0.7 : 1,
      }}
    >
      <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
        <img
          src={work.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(work.workId)}`}
          alt={work.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
      <p
        style={{
          fontSize: titleFs,
          fontWeight: 600,
          color: 'var(--color-text)',
          margin: '0 0 2px 0',
          lineHeight: 1.3,
          minHeight: compact ? 29 : 31,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as const,
        }}
      >
        {streamerMode ? <StreamerCensoredText text={work.title} censorAll /> : work.title}
      </p>
      <p style={{ fontSize: authorFs, color: 'var(--color-text-muted)', margin: 0 }}>{work.authorName}</p>
    </div>
  );
}

/** スマホ用：Stage mobileBelowCanvas — 2列グリッド（推薦結果の2列レイアウトに近い） */
interface FailListVerticalListProps {
  candidates: FailListCandidateItem[];
  onSelectWork: (workId: string) => void;
  streamerMode?: boolean;
}

export function FailListVerticalList({ candidates, onSelectWork, streamerMode }: FailListVerticalListProps) {
  const interactionDisabled = useClickGuard([]);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: CARD_GAP,
        padding: '0 0.5rem',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {candidates.map((work) => (
        <FailListWorkTile
          key={work.workId}
          work={work}
          compact
          streamerMode={streamerMode}
          interactionDisabled={interactionDisabled}
          onSelect={() => {
            if (interactionDisabled) return;
            onSelectWork(work.workId);
          }}
        />
      ))}
    </div>
  );
}

export function FailList({
  candidates,
  onSelectWork,
  onNotInList,
  onBackToTop,
  onGoRecommend,
  onBackToTopWithReset,
  onWhiteboardVerticalFillChange,
  notInListPrompt = DEFAULT_NOT_IN_LIST_PROMPT,
  failListBtnNotInList = 'リストにない',
  failListBtnRecommend = '推薦で探す',
  failListBtnTop = 'トップに戻る',
  failListSearchIntro = 'タイトルの一部を入力して。私の頭脳に照らし合わせるから',
  failListSearchPlaceholder = '例: 鬼、学園、寝取られ など',
  mobileListBelow: _,
  hideCandidateGrid = false,
  streamerMode,
}: FailListProps) {
  const [submittedText, setSubmittedText] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [submittedNotInList, setSubmittedNotInList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchCandidateItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const interactionDisabled = useClickGuard([]);
  const isMobile = useMediaQuery(768);
  const chrome = getFailListBottomRowStyles(isMobile);

  useEffect(() => {
    const formOpen = showInput && !submittedNotInList;
    onWhiteboardVerticalFillChange?.(!formOpen);
  }, [showInput, submittedNotInList, onWhiteboardVerticalFillChange]);

  const handleSelectWork = (workId: string) => {
    if (interactionDisabled) return;
    onSelectWork(workId, 'topCandidates');
  };

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const res = await fetch(`/api/works/search?q=${encodeURIComponent(q)}`);
        if (!res.ok) {
          setSearchResults([]);
          return;
        }
        const data = await res.json();
        setSearchResults(Array.isArray(data?.works) ? data.works : []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleNotInList = () => {
    if (interactionDisabled || !submittedText.trim()) return;
    onNotInList(submittedText.trim());
    setSubmittedNotInList(true);
  };

  const inputStyle = {
    flex: '1 1 120px' as const,
    minWidth: 0,
    width: 'auto' as const,
    padding: isMobile ? '6px 8px' : '8px 10px',
    fontSize: chrome.fontBody,
    fontWeight: 500,
    minHeight: chrome.minH,
    boxSizing: 'border-box' as const,
    border: '2px solid var(--color-border)',
    borderRadius: chrome.radius,
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
  };

  return (
    <div style={{ padding: isMobile ? '0.75rem 0' : '1rem 0', maxWidth: '100%', minWidth: 0 }}>
      {!hideCandidateGrid && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))',
            gap: CARD_GAP,
            marginBottom: 8,
            width: '100%',
          }}
        >
          {candidates.map((work) => (
            <FailListWorkTile
              key={work.workId}
              work={work}
              streamerMode={streamerMode}
              interactionDisabled={interactionDisabled}
              onSelect={() => handleSelectWork(work.workId)}
            />
          ))}
        </div>
      )}
      {!submittedNotInList && !showInput && (
        <div
          style={{
            ...chrome.row,
            marginTop: isMobile ? '0.75rem' : '1rem',
            justifyContent: 'center',
            alignSelf: 'center',
          }}
        >
          <button type="button" onClick={() => setShowInput(true)} style={chrome.btnWhite}>
            {failListBtnNotInList}
          </button>
          {onGoRecommend && (
            <button type="button" onClick={onGoRecommend} style={chrome.btnWhite}>
              {failListBtnRecommend}
            </button>
          )}
          <button type="button" onClick={onBackToTop} style={chrome.btnTop}>
            {failListBtnTop}
          </button>
        </div>
      )}
      {showInput && !submittedNotInList && (
        <div
          style={{
            marginTop: isMobile ? '0.75rem' : '1rem',
            width: '100%',
            maxWidth: 420,
            minWidth: 0,
            alignSelf: 'center',
            boxSizing: 'border-box',
          }}
        >
          <p
            style={{
              margin: `0 0 ${chrome.gap}px 0`,
              width: '100%',
              fontSize: chrome.fontBody,
              fontWeight: 600,
              color: 'var(--color-text)',
              lineHeight: 1.35,
              wordBreak: 'break-word',
            }}
          >
            {notInListPrompt}
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: chrome.gap,
              width: '100%',
              minWidth: 0,
            }}
          >
            <input
              type="text"
              value={submittedText}
              onChange={(e) => setSubmittedText(e.target.value)}
              style={inputStyle}
              placeholder="作品名"
            />
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                flex: '1 1 140px',
                minWidth: 0,
                gap: chrome.gap,
              }}
            >
              <button
                type="button"
                onClick={handleNotInList}
                disabled={interactionDisabled}
                style={{
                  ...chrome.btnPrimaryInline,
                  opacity: interactionDisabled ? 0.7 : 1,
                  cursor: interactionDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                送信
              </button>
              <button type="button" onClick={onBackToTop} style={chrome.btnPrimaryInline}>
                {failListBtnTop}
              </button>
            </div>
          </div>
        </div>
      )}
      <div
        style={{
          marginTop: isMobile ? '0.75rem' : '1rem',
          width: '100%',
          maxWidth: 520,
          minWidth: 0,
          alignSelf: 'center',
          boxSizing: 'border-box',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          padding: isMobile ? '8px' : '10px',
          background: '#fff',
        }}
      >
        <p style={{ margin: '0 0 8px 0', fontSize: chrome.fontBody, fontWeight: 600, color: 'var(--color-text)' }}>
          {failListSearchIntro}
        </p>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ ...inputStyle, width: '100%' }}
          placeholder={failListSearchPlaceholder}
        />
        {searchLoading && (
          <p style={{ margin: '8px 0 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>検索中...</p>
        )}
        {searchResults.length > 0 && (
          <div style={{ marginTop: 8, display: 'grid', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
            {searchResults.map((w) => (
              <button
                key={`search-${w.workId}`}
                type="button"
                onClick={() => onSelectWork(w.workId, 'search', searchQuery.trim())}
                disabled={interactionDisabled}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '64px 1fr',
                  gap: 8,
                  alignItems: 'center',
                  width: '100%',
                  textAlign: 'left',
                  border: '1px solid #e5e7eb',
                  background: '#fafafa',
                  borderRadius: 8,
                  padding: 8,
                  cursor: interactionDisabled ? 'not-allowed' : 'pointer',
                }}
              >
                <img
                  src={w.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(w.workId)}`}
                  alt={w.title}
                  style={{ width: 64, height: 48, borderRadius: 6, objectFit: 'cover' }}
                />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                    {streamerMode ? <StreamerCensoredText text={w.title} censorAll /> : w.title}
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {w.authorName}
                    {w.source === 'reserve' ? ' / reserve' : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {submittedNotInList && onBackToTopWithReset && (
        <button type="button" onClick={onBackToTopWithReset} style={failFlowBackToTopButtonStyle(isMobile)}>
          {failListBtnTop}
        </button>
      )}
    </div>
  );
}
