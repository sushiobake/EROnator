# -*- coding: utf-8 -*-
"""One-off patches for roadmap items (UTF-8 safe)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    # --- page.tsx ---
    p = ROOT / "src/app/page.tsx"
    t = p.read_text(encoding="utf-8")
    old = """  const MIN_THINKING_MS =
    (typeof process.env.NEXT_PUBLIC_MIN_THINKING_MS !== 'undefined' && Number(process.env.NEXT_PUBLIC_MIN_THINKING_MS)) ||
    (process.env.NODE_ENV === 'development' ? 1000 : 200);

  useEffect("""
    new = """  const MIN_THINKING_MS =
    (typeof process.env.NEXT_PUBLIC_MIN_THINKING_MS !== 'undefined' && Number(process.env.NEXT_PUBLIC_MIN_THINKING_MS)) ||
    (process.env.NODE_ENV === 'development' ? 1000 : 200);

  /** Reveal で YES 後、SUCCESS 画面へ切り替える前の追加タメ（ms）。NEXT_PUBLIC_REVEAL_SUCCESS_BUILDUP_MS で上書き。未設定時 900 */
  const REVEAL_SUCCESS_BUILDUP_MS =
    (typeof process.env.NEXT_PUBLIC_REVEAL_SUCCESS_BUILDUP_MS !== 'undefined' &&
      Number(process.env.NEXT_PUBLIC_REVEAL_SUCCESS_BUILDUP_MS)) ||
    900;

  useEffect("""
    if old not in t:
        raise SystemExit("page.tsx anchor1 not found")
    t = t.replace(old, new, 1)

    old2 = """      if (data.state === 'SUCCESS') {
        if (revealWork) {
          setSuccessWork(revealWork);
          setSuccessRecommendedWorks(Array.isArray(data.recommendedWorks) ? data.recommendedWorks : []);
          setState('SUCCESS');
        }
      } else if (data.state === 'FAIL_LIST') {"""
    new2 = """      if (data.state === 'SUCCESS') {
        if (revealWork) {
          const extraMs = Number.isFinite(REVEAL_SUCCESS_BUILDUP_MS) ? Math.max(0, REVEAL_SUCCESS_BUILDUP_MS) : 900;
          if (extraMs > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, extraMs));
          }
          setSuccessWork(revealWork);
          setSuccessRecommendedWorks(Array.isArray(data.recommendedWorks) ? data.recommendedWorks : []);
          setState('SUCCESS');
        }
      } else if (data.state === 'FAIL_LIST') {"""
    if old2 not in t:
        raise SystemExit("page.tsx anchor2 not found")
    t = t.replace(old2, new2, 1)

    old3 = """            failListSearchPlaceholder={gc?.failListSearchPlaceholder}
            mobileListBelow={isMobile}
            hideCandidateGrid={isMobile}
            streamerMode={streamerMode}
          />"""
    new3 = """            failListSearchPlaceholder={gc?.failListSearchPlaceholder}
            mobileListBelow={isMobile}
            hideCandidateGrid={isMobile}
            streamerMode={streamerMode}
            questionCount={questionCount}
          />"""
    if old3 not in t:
        raise SystemExit("page.tsx FailList anchor not found")
    t = t.replace(old3, new3, 1)
    p.write_text(t, encoding="utf-8")
    print("patched page.tsx")

    # --- Success.tsx ---
    s = ROOT / "src/app/components/Success.tsx"
    st = s.read_text(encoding="utf-8")

    old_tweet = """    const text = isAlmostSuccess
      ? `【ERONATOR】${qCount}問で惜しかった…！ あなたの妄想、エロネイターが当ててみる？\\n#エロネイター`
      : `【ERONATOR】${qCount}問で当てられた！ あなたの妄想、エロネイターが当ててみる？\\n#エロネイター`;
    const resultParam = isAlmostSuccess ? 'fail' : 'success';"""
    new_tweet = """    const text = isAlmostSuccess
      ? `【ERONATOR】${qCount}問で惜しかった…！ 思い浮かべた同人、当てられるか試す？\\n#エロネイター`
      : `【ERONATOR】${qCount}問で当てられた！ 思い浮かべた同人、エロネイターが当てる。\\n#エロネイター`;
    const resultParam = isAlmostSuccess ? 'fail' : 'success';"""
    if old_tweet not in st:
        raise SystemExit("Success.tsx tweet block not found")
    st = st.replace(old_tweet, new_tweet, 1)

    old_head = """      <div
        style={{
          width: '100%',
          /** キャンバス内フッター（GameChromeFooter）直前でスクロール末尾に余白（margin より確実） */
          paddingBottom: isMobile ? 32 : 0,
          boxSizing: 'border-box',
        }}
      >
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 10 : 16,
          alignItems: isMobile ? 'stretch' : 'flex-start',
          flexWrap: isMobile ? 'nowrap' : 'wrap',
          marginBottom: isMobile ? 14 : 20,
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        <img"""
    new_head = """      <div
        style={{
          width: '100%',
          /** キャンバス内フッター（GameChromeFooter）直前でスクロール末尾に余白（margin より確実） */
          paddingBottom: isMobile ? 32 : 0,
          boxSizing: 'border-box',
        }}
      >
      {typeof questionCount === 'number' && questionCount >= 0 && (
        <p
          style={{
            margin: '0 0 10px 0',
            fontSize: isMobile ? 18 : 22,
            fontWeight: 800,
            color: 'var(--color-primary)',
            textAlign: isMobile ? 'center' : 'left',
            letterSpacing: '0.02em',
          }}
        >
          {isAlmostSuccess ? `${questionCount}問で惜しかった…！` : `${questionCount}問で正解！`}
        </p>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 10 : 16,
          alignItems: isMobile ? 'stretch' : 'flex-start',
          flexWrap: isMobile ? 'nowrap' : 'wrap',
          marginBottom: isMobile ? 14 : 20,
          maxWidth: '100%',
          minWidth: 0,
        }}
      >
        <img"""
    if old_head not in st:
        raise SystemExit("Success.tsx headline anchor not found")
    st = st.replace(old_head, new_head, 1)

    old_mid = """      </div>

      {/* 下半分: おすすめ5件。スマホ・mobileListBelow時はキャンバス下に表示 */}
      {recommendedWorks.length > 0 && !hideRecommendations && (
        <>
          <p
            style={{
              fontSize: isMobile ? 11 : 15,
              color: 'var(--color-text-muted)',
              margin: isMobile ? '12px 0 6px 0' : '20px 0 10px 0',
              fontWeight: 500,
              lineHeight: isMobile ? 1.35 : 1.45,
            }}
          >
            {recommendTitle}
          </p>
          <div
            style={{ overflowX: 'auto', overflowY: 'hidden', marginBottom: 8, maxWidth: '100%' }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: REC_GAP,
                flexWrap: 'nowrap',
                width: 'max-content',
                minHeight: 1,
              }}
            >
              {recommendedWorks.slice(0, 5).map((rec) => (
                <div
                  key={rec.workId}
                  style={{
                    minWidth: REC_CARD_MIN_WIDTH,
                    width: REC_CARD_MIN_WIDTH,
                    padding: isMobile ? 6 : 8,
                    backgroundColor: '#fafafa',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    flexShrink: 0,
                    ...(isMobile
                      ? {
                          WebkitFontSmoothing: 'antialiased',
                          textRendering: 'optimizeLegibility',
                        }
                      : {}),
                  }}
                >
                  {typeof rec.matchRate === 'number' && (
                    <div style={{ marginBottom: isMobile ? 3 : 6 }}>
                      <p style={{ fontSize: isMobile ? 8 : 11, color: 'var(--color-text-muted)', fontWeight: 600, margin: '0 0 2px 0', lineHeight: 1.2 }}>
                        似てる度
                      </p>
                      <p style={{ fontSize: isMobile ? 11 : 18, color: '#059669', fontWeight: 700, margin: 0, lineHeight: 1.2, letterSpacing: '0.02em' }}>
                        {Number(rec.matchRate).toFixed(1)}％
                      </p>
                    </div>
                  )}
                  <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 6, overflow: 'hidden', marginBottom: isMobile ? 4 : 6 }}>
                    <img
                      src={rec.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(rec.workId)}`}
                      alt={rec.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <p
                    style={
                      isMobile
                        ? {
                            fontSize: 10,
                            fontWeight: 600,
                            color: 'var(--color-text)',
                            margin: '0 0 2px 0',
                            lineHeight: 1.35,
                            minHeight: 34,
                            maxHeight: 40,
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                          }
                        : {
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--color-text)',
                            margin: '0 0 2px 0',
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }
                    }
                  >
                    {streamerMode ? <StreamerCensoredText text={rec.title} censorAll /> : rec.title}
                  </p>
                  <p style={{ fontSize: isMobile ? 9 : 11, color: 'var(--color-text-muted)', margin: '0 0 4px 0', lineHeight: 1.25 }}>
                    {rec.authorName}
                  </p>
                  <div style={{ fontSize: isMobile ? 10 : 14, color: 'var(--color-text-muted)', lineHeight: 1.2 }}>
                    <ExternalLink href={rec.productUrl} linkText={linkText} sessionId={sessionId}>
                      {linkText}
                    </ExternalLink>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: '100%',
          marginTop: isMobile ? 12 : 14,
        }}
      >
        <ResultScreenFourButtons
          onSavePlain={() => runCapture(false)}
          onSaveMosaic={() => runCapture(true)}
          onPost={handlePostToX}
          onBackToTop={onBackToTop}
          isMobile={isMobile}
        />
        {onRestart && (
          <RestartButton onRestart={onRestart} inline compact={isMobile} small={!isMobile} />
        )}
      </div>
      </div>"""

    new_mid = """      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: '100%',
          marginTop: isMobile ? 8 : 10,
          marginBottom: isMobile ? 10 : 12,
        }}
      >
        <ResultScreenFourButtons
          onSavePlain={() => runCapture(false)}
          onSaveMosaic={() => runCapture(true)}
          onPost={handlePostToX}
          onBackToTop={onBackToTop}
          isMobile={isMobile}
        />
        {onRestart && (
          <RestartButton onRestart={onRestart} inline compact={isMobile} small={!isMobile} />
        )}
      </div>

      {/* 下半分: おすすめ5件。スマホ・mobileListBelow時はキャンバス下に表示 */}
      {recommendedWorks.length > 0 && !hideRecommendations && (
        <>
          <p
            style={{
              fontSize: isMobile ? 11 : 15,
              color: 'var(--color-text-muted)',
              margin: isMobile ? '12px 0 6px 0' : '20px 0 10px 0',
              fontWeight: 500,
              lineHeight: isMobile ? 1.35 : 1.45,
            }}
          >
            {recommendTitle}
          </p>
          <div
            style={{ overflowX: 'auto', overflowY: 'hidden', marginBottom: 8, maxWidth: '100%' }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                gap: REC_GAP,
                flexWrap: 'nowrap',
                width: 'max-content',
                minHeight: 1,
              }}
            >
              {recommendedWorks.slice(0, 5).map((rec) => (
                <div
                  key={rec.workId}
                  style={{
                    minWidth: REC_CARD_MIN_WIDTH,
                    width: REC_CARD_MIN_WIDTH,
                    padding: isMobile ? 6 : 8,
                    backgroundColor: '#fafafa',
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    flexShrink: 0,
                    ...(isMobile
                      ? {
                          WebkitFontSmoothing: 'antialiased',
                          textRendering: 'optimizeLegibility',
                        }
                      : {}),
                  }}
                >
                  {typeof rec.matchRate === 'number' && (
                    <div style={{ marginBottom: isMobile ? 3 : 6 }}>
                      <p style={{ fontSize: isMobile ? 8 : 11, color: 'var(--color-text-muted)', fontWeight: 600, margin: '0 0 2px 0', lineHeight: 1.2 }}>
                        似てる度
                      </p>
                      <p style={{ fontSize: isMobile ? 11 : 18, color: '#059669', fontWeight: 700, margin: 0, lineHeight: 1.2, letterSpacing: '0.02em' }}>
                        {Number(rec.matchRate).toFixed(1)}％
                      </p>
                    </div>
                  )}
                  <div style={{ width: '100%', aspectRatio: '3/4', borderRadius: 6, overflow: 'hidden', marginBottom: isMobile ? 4 : 6 }}>
                    <img
                      src={rec.thumbnailUrl || `/api/thumbnail?workId=${encodeURIComponent(rec.workId)}`}
                      alt={rec.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <p
                    style={
                      isMobile
                        ? {
                            fontSize: 10,
                            fontWeight: 600,
                            color: 'var(--color-text)',
                            margin: '0 0 2px 0',
                            lineHeight: 1.35,
                            minHeight: 34,
                            maxHeight: 40,
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                          }
                        : {
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--color-text)',
                            margin: '0 0 2px 0',
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }
                    }
                  >
                    {streamerMode ? <StreamerCensoredText text={rec.title} censorAll /> : rec.title}
                  </p>
                  <p style={{ fontSize: isMobile ? 9 : 11, color: 'var(--color-text-muted)', margin: '0 0 4px 0', lineHeight: 1.25 }}>
                    {rec.authorName}
                  </p>
                  <div style={{ fontSize: isMobile ? 10 : 14, color: 'var(--color-text-muted)', lineHeight: 1.2 }}>
                    <ExternalLink href={rec.productUrl} linkText={linkText} sessionId={sessionId}>
                      {linkText}
                    </ExternalLink>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      </div>"""

    if old_mid not in st:
        raise SystemExit("Success.tsx reorder block not found")
    st = st.replace(old_mid, new_mid, 1)
    s.write_text(st, encoding="utf-8")
    print("patched Success.tsx")

    # --- FailList.tsx ---
    f = ROOT / "src/app/components/FailList.tsx"
    ft = f.read_text(encoding="utf-8")
    iface_old = """  hideCandidateGrid?: boolean;
  streamerMode?: boolean;
}

interface SearchCandidateItem {"""
    iface_new = """  hideCandidateGrid?: boolean;
  streamerMode?: boolean;
  /** FAIL_LIST 到達時点の質問数（シェア文用） */
  questionCount?: number | null;
}

interface SearchCandidateItem {"""
    if iface_old not in ft:
        raise SystemExit("FailList interface anchor not found")
    ft = ft.replace(iface_old, iface_new, 1)

    dest_old = """  hideCandidateGrid = false,
  streamerMode,
}: FailListProps) {"""
    dest_new = """  hideCandidateGrid = false,
  streamerMode,
  questionCount,
}: FailListProps) {"""
    if dest_old not in ft:
        raise SystemExit("FailList destructuring anchor not found")
    ft = ft.replace(dest_old, dest_new, 1)

    chrome_anchor = "  const chrome = getFailListBottomRowStyles(isMobile);\n\n  const handleSelectWork"
    if "handleShareFailListToX" in ft:
        print("FailList share handler already present, skip insert")
    else:
        chrome_repl = """  const chrome = getFailListBottomRowStyles(isMobile);

  const handleShareFailListToX = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const q = typeof questionCount === 'number' && questionCount >= 0 ? questionCount : 0;
    const text = `【ERONATOR】${q}問かけられたのに当てられなかった…！ あなたも同人、当てられる？\\n#エロネイター`;
    const shareUrl = `${origin}?q=${q}&result=miss`;
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(intent, '_blank', 'noopener,noreferrer');
  };

  const handleSelectWork"""
        if chrome_anchor not in ft:
            raise SystemExit("FailList chrome_anchor not found")
        ft = ft.replace(chrome_anchor, chrome_repl, 1)

    needle = "      {titleBlock}\n      {actionButtonsRow}"
    share_block = """      {titleBlock}
      {typeof questionCount === 'number' && questionCount >= 0 && (
        <div
          style={{
            ...panelStyle,
            textAlign: 'left',
            border: '1px dashed #cbd5e1',
            backgroundColor: '#f8fafc',
          }}
        >
          <p style={{ margin: `0 0 ${chrome.gap}px 0`, fontSize: chrome.fontBody, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
            長く考えさせたのに外したなら、それもネタ。Xにポストして自慢してね。
          </p>
          <button
            type="button"
            onClick={handleShareFailListToX}
            style={{
              width: '100%',
              minHeight: isMobile ? 40 : 44,
              padding: isMobile ? '8px 12px' : '10px 16px',
              fontSize: isMobile ? 12 : 14,
              fontWeight: 700,
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
            }}
          >
            Xにポスト（失敗ネタ）
          </button>
        </div>
      )}
      {actionButtonsRow}"""
    if needle in ft and "失敗ネタ" not in ft:
        ft = ft.replace(needle, share_block, 1)

    f.write_text(ft, encoding="utf-8")
    print("patched FailList.tsx")

    # --- og route ---
    og = ROOT / "src/app/api/og/route.tsx"
    ot = og.read_text(encoding="utf-8")
    old_og = """  const isSuccess = result === 'success';
  const bgGradient = isSuccess
    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
  const mainText = isSuccess ? `${q}問で当てた！` : `${q}問 惜しかった…！`;
  const subText = 'あなたの妄想、エロネイターが当ててみる？';
"""
    new_og = """  const isSuccess = result === 'success';
  const isMiss = result === 'miss';
  const bgGradient = isSuccess
    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    : isMiss
      ? 'linear-gradient(135deg, #64748b 0%, #0f172a 100%)'
      : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
  const mainText = isSuccess
    ? `${q}問で当てた！`
    : isMiss
      ? `${q}問かけても外れた！`
      : `${q}問 惜しかった…！`;
  const subText = 'あなたの妄想、エロネイターが当ててみる？';
"""
    if old_og not in ot:
        raise SystemExit("og route anchor not found")
    ot = ot.replace(old_og, new_og, 1)
    og.write_text(ot, encoding="utf-8")
    print("patched og/route.tsx")


if __name__ == "__main__":
    main()
