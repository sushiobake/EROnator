/**
 * FAIL_LISTコンポーネント
 * 上位N件（config failListN・既出除外・同一作者1本まで）をグリッド表示。
 * PC: 左に候補、右に検索→常時の作品名入力→推薦/トップ。ボタンで白板サイズは変えない。
 */

'use client';

import { useEffect, useState, type CSSProperties } from 'react';
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

const DEFAULT_NOT_IN_LIST_PROMPT =
  'それでも見つからなければ、作品名を教えてくれると助かるわ。';
const DEFAULT_SEARCH_HEADING = '候補にないなら、ここで検索してみて';
const DEFAULT_SEARCH_INTRO = 'タイトルの一部でいいから入れてみて。';
const DEFAULT_SEARCH_PLACEHOLDER = '例: 鬼、学園、寝取られ など';
const DEFAULT_BTN_RECOMMEND = '推薦してもらう';
const DEFAULT_BTN_TOP = 'トップに戻る';

const CARD_GAP = 10;

interface FailListProps {
  candidates: FailListCandidateItem[];
  onSelectWork: (workId: string, selectedFrom?: 'topCandidates' | 'search', searchQuery?: string) => void;
  onNotInList: (submittedTitleText: string) => void;
  onGoRecommend?: () => void;
  onBackToTop: () => void;
  onBackToTopWithReset?: () => void;
  notInListPrompt?: string;
  failListBtnRecommend?: string;
  failListBtnTop?: string;
  failListSearchHeading?: string;
  failListSearchIntro?: string;
  failListSearchPlaceholder?: string;
  /** @deprecated 未使用（互換のため残す） */
  mobileListBelow?: boolean;
  hideCandidateGrid?: boolean;
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
  notInListPrompt = DEFAULT_NOT_IN_LIST_PROMPT,
  failListBtnRecommend = DEFAULT_BTN_RECOMMEND,
  failListBtnTop = DEFAULT_BTN_TOP,
  failListSearchHeading = DEFAULT_SEARCH_HEADING,
  failListSearchIntro = DEFAULT_SEARCH_INTRO,
  failListSearchPlaceholder = DEFAULT_SEARCH_PLACEHOLDER,
  mobileListBelow: _,
  hideCandidateGrid = false,
  streamerMode,
}: FailListProps) {
  const [submittedText, setSubmittedText] = useState('');
  const [submittedNotInList, setSubmittedNotInList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchCandidateItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const interactionDisabled = useClickGuard([]);
  const isMobile = useMediaQuery(768);
  const chrome = getFailListBottomRowStyles(isMobile);

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

  const panelStyle: CSSProperties = {
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: isMobile ? '8px' : '10px 12px',
    background: '#fff',
  };

  const candidateGrid = !hideCandidateGrid ? (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(5, minmax(0, 1fr))',
        gap: CARD_GAP,
        marginBottom: isMobile ? 8 : 0,
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
  ) : null;

  const searchBlock = (
    <>
      <p
        style={{
          margin: '0 0 6px 0',
          fontSize: chrome.fontBody + 1,
          fontWeight: 700,
          color: 'var(--color-text)',
        }}
      >
        {failListSearchHeading}
      </p>
      <p
        style={{
          margin: '0 0 8px 0',
          fontSize: Math.max(11, chrome.fontBody - 1),
          fontWeight: 500,
          color: 'var(--color-text-muted)',
          lineHeight: 1.35,
        }}
      >
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
        <div
          style={{
            marginTop: 8,
            display: 'grid',
            gap: 8,
            maxHeight: 220,
            overflowY: 'auto',
            textAlign: 'left',
          }}
        >
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
    </>
  );

  /** 常時表示の作品名入力（送信後は非表示） */
  const titleBlock =
    !submittedNotInList && (
      <div style={{ ...panelStyle, textAlign: 'left' }}>
        <p
          style={{
            margin: `0 0 ${chrome.gap}px 0`,
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
            style={{ ...inputStyle, flex: '1 1 180px', minWidth: 0 }}
            placeholder="作品名"
          />
          <button
            type="button"
            onClick={handleNotInList}
            disabled={interactionDisabled}
            style={{
              ...chrome.btnPrimaryInline,
              flex: '0 0 auto',
              opacity: interactionDisabled ? 0.7 : 1,
              cursor: interactionDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            送信
          </button>
        </div>
      </div>
    );

  const actionButtonsRow =
    !submittedNotInList && (
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: chrome.gap,
          width: '100%',
          justifyContent: isMobile ? 'center' : 'flex-end',
          alignItems: 'center',
        }}
      >
        {onGoRecommend && (
          <button type="button" onClick={onGoRecommend} style={chrome.btnWhite}>
            {failListBtnRecommend}
          </button>
        )}
        <button type="button" onClick={onBackToTop} style={chrome.btnTop}>
          {failListBtnTop}
        </button>
      </div>
    );

  const submittedResetBlock =
    submittedNotInList && onBackToTopWithReset ? (
      <button type="button" onClick={onBackToTopWithReset} style={failFlowBackToTopButtonStyle(isMobile)}>
        {failListBtnTop}
      </button>
    ) : null;

  const rightColumnStack = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 0,
        width: '100%',
      }}
    >
      <div style={{ ...panelStyle, textAlign: isMobile ? 'left' : 'right' }}>{searchBlock}</div>
      {titleBlock}
      {actionButtonsRow}
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ padding: '0.75rem 0', maxWidth: '100%', minWidth: 0, width: '100%' }}>
        {hideCandidateGrid ? (
          <FailListVerticalList
            candidates={candidates}
            onSelectWork={(workId) => handleSelectWork(workId)}
            streamerMode={streamerMode}
          />
        ) : (
          candidateGrid
        )}
        <div style={{ marginTop: '0.75rem' }}>{rightColumnStack}</div>
        {submittedResetBlock}
      </div>
    );
  }

  return (
    <div style={{ padding: '0.25rem 0 0 0', maxWidth: '100%', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.25fr) minmax(260px, 400px)',
          gap: 20,
          alignItems: 'start',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, alignItems: 'stretch' }}>
          {candidateGrid}
          {submittedResetBlock}
        </div>
        <div style={{ minWidth: 0 }}>{rightColumnStack}</div>
      </div>
    </div>
  );
}
