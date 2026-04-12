# -*- coding: utf-8 -*-
"""Apply mobile FAIL_LIST: candidates below canvas + intro inside whiteboard. UTF-8 safe."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

FAIL = ROOT / "src/app/components/FailList.tsx"
PAGE = ROOT / "src/app/page.tsx"

f = FAIL.read_text(encoding="utf-8")

# --- FailList.tsx ---
if "candidatesPlacement" in f:
    print("FailList.tsx: already patched, skip")
else:
    needle = "const DEFAULT_BTN_TOP = 'トップに戻る';\n\nconst CARD_GAP"
    insert = """const DEFAULT_BTN_TOP = 'トップに戻る';
const DEFAULT_INTRO_SPEECH = 'うーん…ちょっとわからなかったわ。';
const DEFAULT_INTRO_SUB_MOBILE = 'この中にある？　なければ検索か、作品名を教えてね。';

const CARD_GAP"""
    if needle not in f:
        raise SystemExit("FailList: anchor not found for DEFAULT constants")
    f = f.replace(needle, insert, 1)

    needle2 = """  /** @deprecated 未使用（互換のため残す） */
  mobileListBelow?: boolean;
  hideCandidateGrid?: boolean;
  streamerMode?: boolean;
}"""
    insert2 = """  /** @deprecated 未使用（互換のため残す） */
  mobileListBelow?: boolean;
  hideCandidateGrid?: boolean;
  /** スマホで白板先頭に出す主文（candidatesPlacement=belowStage 時） */
  introFailListSpeech?: string;
  /** スマホで白板先頭に出す補足 */
  introFailListSubMobile?: string;
  /** スマホ: 候補タイルを Stage の mobileBelowCanvas 側に出す */
  candidatesPlacement?: 'inline' | 'belowStage';
  streamerMode?: boolean;
}"""
    if needle2 not in f:
        raise SystemExit("FailList: interface block not found")
    f = f.replace(needle2, insert2, 1)

    needle3 = """  mobileListBelow: _,
  hideCandidateGrid = false,
  streamerMode,
}: FailListProps) {"""
    insert3 = """  mobileListBelow: _,
  hideCandidateGrid = false,
  introFailListSpeech,
  introFailListSubMobile,
  candidatesPlacement = 'inline',
  streamerMode,
}: FailListProps) {"""
    if needle3 not in f:
        raise SystemExit("FailList: destructuring not found")
    f = f.replace(needle3, insert3, 1)

    needle4 = "  const chrome = getFailListBottomRowStyles(isMobile);\n\n  const handleSelectWork"
    insert4 = """  const chrome = getFailListBottomRowStyles(isMobile);
  const candidatesRenderedBelow = isMobile && candidatesPlacement === 'belowStage';

  const handleSelectWork"""
    if needle4 not in f:
        raise SystemExit("FailList: chrome line not found")
    f = f.replace(needle4, insert4, 1)

    needle5 = "  const candidateGrid = !hideCandidateGrid ? ("
    insert5 = "  const candidateGrid = !candidatesRenderedBelow && !hideCandidateGrid ? ("
    if needle5 not in f:
        raise SystemExit("FailList: candidateGrid line not found")
    f = f.replace(needle5, insert5, 1)

    old_mobile = """  if (isMobile) {
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
  }"""
    new_mobile = """  if (isMobile) {
    return (
      <div style={{ padding: '0.75rem 0', maxWidth: '100%', minWidth: 0, width: '100%' }}>
        {candidatesRenderedBelow ? (
          <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 24 }}>
              {introFailListSpeech ?? DEFAULT_INTRO_SPEECH}
            </p>
            <p style={{ margin: '6px 0 0 0', color: 'var(--color-text-muted)', fontSize: 20 }}>
              {introFailListSubMobile ?? DEFAULT_INTRO_SUB_MOBILE}
            </p>
          </div>
        ) : null}
        {!candidatesRenderedBelow &&
          (hideCandidateGrid ? (
            <FailListVerticalList
              candidates={candidates}
              onSelectWork={(workId) => handleSelectWork(workId)}
              streamerMode={streamerMode}
            />
          ) : (
            candidateGrid
          ))}
        <div style={{ marginTop: candidatesRenderedBelow ? 0 : '0.75rem' }}>{rightColumnStack}</div>
        {submittedResetBlock}
      </div>
    );
  }"""
    if old_mobile not in f:
        raise SystemExit("FailList: mobile return block not found")
    f = f.replace(old_mobile, new_mobile, 1)

    FAIL.write_text(f, encoding="utf-8")
    print("FailList.tsx: ok")

# --- page.tsx ---
p = PAGE.read_text(encoding="utf-8")

if "FailListVerticalList" in p and "candidatesPlacement=" in p and "FAIL_LIST" in p:
    # idempotent check: only skip if our new props exist near FailList
    if "candidatesPlacement={isMobile ? 'belowStage' : 'inline'}" in p:
        print("page.tsx: already patched, skip")
    else:
        print("page.tsx: partial FailListVerticalList, review manually")
else:
    old_imp = "import { FailList } from './components/FailList';"
    new_imp = "import { FailList, FailListVerticalList } from './components/FailList';"
    if old_imp not in p:
        raise SystemExit("page.tsx: import not found")
    p = p.replace(old_imp, new_imp, 1)

    old_block = """        <Stage
          characterVariant={isThinking ? 'thinking' : 'usually'}
          thinkingSubType={thinkingSubType}
          hideCharacter={true}
          mobileExtendWhiteboard={true}
          onLogoClick={handleLogoClickToTop}
          logoClickDisabled={isThinking}
          characterSpeech={
            isThinking
              ? thinkingSpeech
              : (
                <div style={isMobile ? { textAlign: 'center' } : {}}>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: isMobile ? 24 : 17 }}>{gc?.failListSpeech ?? 'うーん…ちょっとわからなかったわ。'}</p>
                  <p style={{ margin: '6px 0 0 0', color: 'var(--color-text-muted)', fontSize: isMobile ? 20 : 15 }}>
                    {isMobile
                      ? (gc?.failListSubMobile ?? 'この中にある？　なければ検索か、作品名を教えてね。')
                      : (gc?.failListSubPc ?? 'この中に近いものはある？　ないなら右で検索してみて。')}
                  </p>
                </div>
              )
          }
          mobileBelowCanvas={undefined}
          whiteboardWide={true}
          whiteboardFullContentWidth={true}
        >
          {isThinking ? null : (
          <FailList
            candidates={failListCandidates}
            onSelectWork={handleFailListSelectWork}
            onNotInList={handleFailListNotInList}
            onBackToTop={() => setState('TOP')}
            onGoRecommend={() => setState('RECOMMEND')}
            onBackToTopWithReset={handleBackToTopWithReset}
            notInListPrompt={gc?.failListNotInListPrompt ?? 'それでも見つからなければ、作品名を教えてくれると助かるわ。'}
            failListBtnRecommend={gc?.failListBtnRecommend}
            failListBtnTop={gc?.failListBtnTop}
            failListSearchHeading={gc?.failListSearchHeading}
            failListSearchIntro={gc?.failListSearchIntro}
            failListSearchPlaceholder={gc?.failListSearchPlaceholder}
            mobileListBelow={isMobile}
            hideCandidateGrid={isMobile}
            streamerMode={streamerMode}
          />
          )}
        </Stage>"""

    new_block = """        <Stage
          characterVariant={isThinking ? 'thinking' : 'usually'}
          thinkingSubType={thinkingSubType}
          hideCharacter={true}
          mobileWhiteboardOverflowY={isMobile ? 'auto' : undefined}
          onLogoClick={handleLogoClickToTop}
          logoClickDisabled={isThinking}
          characterSpeech={
            isThinking
              ? thinkingSpeech
              : isMobile
                ? undefined
                : (
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-text)', fontSize: 17 }}>{gc?.failListSpeech ?? 'うーん…ちょっとわからなかったわ。'}</p>
                  <p style={{ margin: '6px 0 0 0', color: 'var(--color-text-muted)', fontSize: 15 }}>
                    {gc?.failListSubPc ?? 'この中に近いものはある？　ないなら右で検索してみて。'}
                  </p>
                </div>
              )
          }
          mobileBelowCanvas={
            isMobile && !isThinking && failListCandidates.length > 0 ? (
              <FailListVerticalList
                candidates={failListCandidates}
                onSelectWork={(workId) => handleFailListSelectWork(workId, 'topCandidates')}
                streamerMode={streamerMode}
              />
            ) : undefined
          }
          whiteboardWide={true}
          whiteboardFullContentWidth={true}
        >
          {isThinking ? null : (
          <FailList
            candidates={failListCandidates}
            onSelectWork={handleFailListSelectWork}
            onNotInList={handleFailListNotInList}
            onBackToTop={() => setState('TOP')}
            onGoRecommend={() => setState('RECOMMEND')}
            onBackToTopWithReset={handleBackToTopWithReset}
            notInListPrompt={gc?.failListNotInListPrompt ?? 'それでも見つからなければ、作品名を教えてくれると助かるわ。'}
            failListBtnRecommend={gc?.failListBtnRecommend}
            failListBtnTop={gc?.failListBtnTop}
            failListSearchHeading={gc?.failListSearchHeading}
            failListSearchIntro={gc?.failListSearchIntro}
            failListSearchPlaceholder={gc?.failListSearchPlaceholder}
            mobileListBelow={isMobile}
            hideCandidateGrid={false}
            introFailListSpeech={gc?.failListSpeech}
            introFailListSubMobile={gc?.failListSubMobile}
            candidatesPlacement={isMobile ? 'belowStage' : 'inline'}
            streamerMode={streamerMode}
          />
          )}
        </Stage>"""

    if old_block not in p:
        raise SystemExit("page.tsx: FAIL_LIST Stage block not found (file changed?)")
    p = p.replace(old_block, new_block, 1)
    PAGE.write_text(p, encoding="utf-8")
    print("page.tsx: ok")

print("done")
