/**
 * FAIL_LISTコンポーネント
 * 上位N件（config failListN・既出除外・同一作者1本まで）をグリッド表示。
 * PC: 5列×行（推薦結果のPCグリッドに近い）、モバイル: 2列（推薦キャプチャの2列に近い）。
 * 流れ: ①リストから選択 → ②タイトル一部で検索（右上/先に表示） → ③「リストにない」でタイトル入力
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

const DEFAULT_NOT_IN_LIST_PROMPT = 'ない？ならここに作品名書いてよ！お願いだから！';

/** 検索ブロック見出し（右上エリアのラベル） */
const FAIL_LIST_SEARCH_HEADING = '名前を入れて検索';

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

  const searchPanelStyle: CSSProperties = {
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

  const searchPanelInner = (
    <>
      <p
        style={{
          margin: '0 0 6px 0',
          fontSize: chrome.fontBody + 1,
          fontWeight: 700,
          color: 'var(--color-text)',
        }}
      >
        {FAIL_LIST_SEARCH_HEADING}
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
            maxHeight: 280,
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

  const threeButtonsRow = !submittedNotInList && !showInput && (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: chrome.gap,
        width: '100%',
        maxWidth: '100%',
        justifyContent: isMobile ? 'center' : 'flex-end',
        alignItems: 'center',
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
  );

  const titleInputBlock =
    showInput && !submittedNotInList ? (
      <div
        style={{
          marginTop: isMobile ? '0.75rem' : 0,
          width: '100%',
          maxWidth: isMobile ? 420 : '100%',
          minWidth: 0,
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
    ) : null;

  const submittedResetBlock =
    submittedNotInList && onBackToTopWithReset ? (
      <button type="button" onClick={onBackToTopWithReset} style={failFlowBackToTopButtonStyle(isMobile)}>
        {failListBtnTop}
      </button>
    ) : null;

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
        <div style={{ ...searchPanelStyle, marginTop: '0.75rem' }}>{searchPanelInner}</div>
        <div style={{ marginTop: '0.75rem' }}>{threeButtonsRow}</div>
        {titleInputBlock}
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
          alignItems: 'stretch',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, alignItems: 'stretch' }}>
          {candidateGrid}
          {titleInputBlock}
          {submittedResetBlock}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignSelf: 'stretch',
            minWidth: 0,
            minHeight: 360,
          }}
        >
          <div style={{ ...searchPanelStyle, textAlign: 'right' }}>{searchPanelInner}</div>
          <div style={{ marginTop: 'auto', paddingTop: 16, width: '100%' }}>{threeButtonsRow}</div>
        </div>
      </div>
    </div>
  );
}
