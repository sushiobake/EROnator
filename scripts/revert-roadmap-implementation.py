# -*- coding: utf-8 -*-
"""Revert roadmap-implementation session changes.

Items reverted:
  2 - Reveal->Success wait (page.tsx)
  3 - Success headline + button reorder + tweet text (Success.tsx)
  4 - FailList share button + og miss variant (FailList.tsx, og/route.tsx, page.tsx questionCount->FailList)
  6 - CHECKLIST-copy-layout-mobile.md (delete)

Items NOT touched (docs only, user said OK):
  1 - VERIFY-top100-hit-rate.md
  5 - X-smoke-test-procedure.md
  7/8 - BACKLOG-recommend-purchase-and-untagged.md
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_one(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count == 0:
        raise SystemExit(f"[FAIL] anchor not found: {label!r}")
    if count > 1:
        raise SystemExit(f"[FAIL] anchor not unique ({count} hits): {label!r}")
    return text.replace(old, new, 1)


def revert_page_tsx() -> None:
    p = ROOT / "src/app/page.tsx"
    t = p.read_text(encoding="utf-8")

    # --- item 2: remove REVEAL_SUCCESS_BUILDUP_MS constant ---
    t = replace_one(
        t,
        "\n  /** Reveal で YES 後、SUCCESS 画面へ切り替える前の追加タメ（ms）。NEXT_PUBLIC_REVEAL_SUCCESS_BUILDUP_MS で上書き。未設定時 900 */\n"
        "  const REVEAL_SUCCESS_BUILDUP_MS =\n"
        "    (typeof process.env.NEXT_PUBLIC_REVEAL_SUCCESS_BUILDUP_MS !== 'undefined' &&\n"
        "      Number(process.env.NEXT_PUBLIC_REVEAL_SUCCESS_BUILDUP_MS)) ||\n"
        "    900;\n",
        "\n",
        "page: REVEAL_SUCCESS_BUILDUP_MS constant",
    )

    # --- item 2: remove extraMs / await block ---
    t = replace_one(
        t,
        "        if (revealWork) {\n"
        "          const extraMs = Number.isFinite(REVEAL_SUCCESS_BUILDUP_MS) ? Math.max(0, REVEAL_SUCCESS_BUILDUP_MS) : 900;\n"
        "          if (extraMs > 0) {\n"
        "            await new Promise<void>((resolve) => setTimeout(resolve, extraMs));\n"
        "          }\n"
        "          setSuccessWork(revealWork);\n",
        "        if (revealWork) {\n"
        "          setSuccessWork(revealWork);\n",
        "page: extraMs await block",
    )

    # --- item 4: remove questionCount={questionCount} from FailList JSX ---
    t = replace_one(
        t,
        "            streamerMode={streamerMode}\n"
        "            questionCount={questionCount}\n"
        "          />\n"
        "          )}\n"
        "        </Stage>\n"
        "      </>\n"
        "    );\n"
        "  }\n"
        "\n"
        "  return <div>Loading...</div>;\n"
        "}",
        "            streamerMode={streamerMode}\n"
        "          />\n"
        "          )}\n"
        "        </Stage>\n"
        "      </>\n"
        "    );\n"
        "  }\n"
        "\n"
        "  return <div>Loading...</div>;\n"
        "}",
        "page: questionCount in FailList JSX",
    )

    p.write_text(t, encoding="utf-8")
    print("[OK] reverted page.tsx")


def revert_success_tsx() -> None:
    s = ROOT / "src/app/components/Success.tsx"
    st = s.read_text(encoding="utf-8")

    # --- item 3a: revert X tweet text ---
    st = replace_one(
        st,
        "    const text = isAlmostSuccess\n"
        "      ? `【ERONATOR】${qCount}問で惜しかった…！ 思い浮かべた同人、当てられるか試す？\\n#エロネイター`\n"
        "      : `【ERONATOR】${qCount}問で当てられた！ 思い浮かべた同人、エロネイターが当てる。\\n#エロネイター`;\n",
        "    const text = isAlmostSuccess\n"
        "      ? `【ERONATOR】${qCount}問で惜しかった…！ あなたの妄想、エロネイターが当ててみる？\\n#エロネイター`\n"
        "      : `【ERONATOR】${qCount}問で当てられた！ あなたの妄想、エロネイターが当ててみる？\\n#エロネイター`;\n",
        "Success: X tweet text",
    )

    # --- item 3b: remove headline block ---
    st = replace_one(
        st,
        "      {typeof questionCount === 'number' && questionCount >= 0 && (\n"
        "        <p\n"
        "          style={{\n"
        "            margin: '0 0 10px 0',\n"
        "            fontSize: isMobile ? 18 : 22,\n"
        "            fontWeight: 800,\n"
        "            color: 'var(--color-primary)',\n"
        "            textAlign: isMobile ? 'center' : 'left',\n"
        "            letterSpacing: '0.02em',\n"
        "          }}\n"
        "        >\n"
        "          {isAlmostSuccess ? `${questionCount}問で惜しかった…！` : `${questionCount}問で正解！`}\n"
        "        </p>\n"
        "      )}\n",
        "",
        "Success: headline block",
    )

    # --- item 3c: move buttons back AFTER recommendations ---
    # Step A: remove the early buttons block (marginTop 8:10 / marginBottom 10:12)
    st = replace_one(
        st,
        "      </div>\n"
        "\n"
        "      <div\n"
        "        style={{\n"
        "          display: 'flex',\n"
        "          flexDirection: 'column',\n"
        "          gap: 8,\n"
        "          width: '100%',\n"
        "          marginTop: isMobile ? 8 : 10,\n"
        "          marginBottom: isMobile ? 10 : 12,\n"
        "        }}\n"
        "      >\n"
        "        <ResultScreenFourButtons\n"
        "          onSavePlain={() => runCapture(false)}\n"
        "          onSaveMosaic={() => runCapture(true)}\n"
        "          onPost={handlePostToX}\n"
        "          onBackToTop={onBackToTop}\n"
        "          isMobile={isMobile}\n"
        "        />\n"
        "        {onRestart && (\n"
        "          <RestartButton onRestart={onRestart} inline compact={isMobile} small={!isMobile} />\n"
        "        )}\n"
        "      </div>\n"
        "\n"
        "      {/* 下半分: おすすめ5件。スマホ・mobileListBelow時はキャンバス下に表示 */}\n",
        "      </div>\n"
        "\n"
        "      {/* 下半分: おすすめ5件。スマホ・mobileListBelow時はキャンバス下に表示 */}\n",
        "Success: remove early buttons block",
    )

    # Step B: add buttons back after recommendations closing, restore marginTop 12:14
    st = replace_one(
        st,
        "        </>\n"
        "      )}\n"
        "\n"
        "      </div>\n"
        "    </>\n"
        "  );\n"
        "}",
        "        </>\n"
        "      )}\n"
        "\n"
        "      <div\n"
        "        style={{\n"
        "          display: 'flex',\n"
        "          flexDirection: 'column',\n"
        "          gap: 8,\n"
        "          width: '100%',\n"
        "          marginTop: isMobile ? 12 : 14,\n"
        "        }}\n"
        "      >\n"
        "        <ResultScreenFourButtons\n"
        "          onSavePlain={() => runCapture(false)}\n"
        "          onSaveMosaic={() => runCapture(true)}\n"
        "          onPost={handlePostToX}\n"
        "          onBackToTop={onBackToTop}\n"
        "          isMobile={isMobile}\n"
        "        />\n"
        "        {onRestart && (\n"
        "          <RestartButton onRestart={onRestart} inline compact={isMobile} small={!isMobile} />\n"
        "        )}\n"
        "      </div>\n"
        "      </div>\n"
        "    </>\n"
        "  );\n"
        "}",
        "Success: restore buttons after recommendations",
    )

    s.write_text(st, encoding="utf-8")
    print("[OK] reverted Success.tsx")


def revert_faillist_tsx() -> None:
    f = ROOT / "src/app/components/FailList.tsx"
    ft = f.read_text(encoding="utf-8")

    # --- item 4a: remove questionCount from interface ---
    ft = replace_one(
        ft,
        "  hideCandidateGrid?: boolean;\n"
        "  streamerMode?: boolean;\n"
        "  /** FAIL_LIST 到達時点の質問数（シェア文用） */\n"
        "  questionCount?: number | null;\n"
        "}",
        "  hideCandidateGrid?: boolean;\n"
        "  streamerMode?: boolean;\n"
        "}",
        "FailList: interface questionCount",
    )

    # --- item 4b: remove questionCount from destructuring ---
    ft = replace_one(
        ft,
        "  hideCandidateGrid = false,\n"
        "  streamerMode,\n"
        "  questionCount,\n"
        "}: FailListProps) {",
        "  hideCandidateGrid = false,\n"
        "  streamerMode,\n"
        "}: FailListProps) {",
        "FailList: destructuring questionCount",
    )

    # --- item 4c: remove handleShareFailListToX function ---
    ft = replace_one(
        ft,
        "  const handleShareFailListToX = () => {\n"
        "    const origin = typeof window !== 'undefined' ? window.location.origin : '';\n"
        "    const q = typeof questionCount === 'number' && questionCount >= 0 ? questionCount : 0;\n"
        "    const text = `【ERONATOR】${q}問かけられたのに当てられなかった…！ あなたも同人、当てられる？\\n#エロネイター`;\n"
        "    const shareUrl = `${origin}?q=${q}&result=miss`;\n"
        "    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;\n"
        "    window.open(intent, '_blank', 'noopener,noreferrer');\n"
        "  };\n"
        "\n",
        "",
        "FailList: handleShareFailListToX",
    )

    # --- item 4d: remove share panel block ---
    ft = replace_one(
        ft,
        "      {titleBlock}\n"
        "      {typeof questionCount === 'number' && questionCount >= 0 && (\n"
        "        <div\n"
        "          style={{\n"
        "            ...panelStyle,\n"
        "            textAlign: 'left',\n"
        "            border: '1px dashed #cbd5e1',\n"
        "            backgroundColor: '#f8fafc',\n"
        "          }}\n"
        "        >\n"
        "          <p style={{ margin: `0 0 ${chrome.gap}px 0`, fontSize: chrome.fontBody, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>\n"
        "            長く考えさせたのに外したなら、それもネタ。Xにポストして自慢してね。\n"
        "          </p>\n"
        "          <button\n"
        "            type=\"button\"\n"
        "            onClick={handleShareFailListToX}\n"
        "            style={{\n"
        "              width: '100%',\n"
        "              minHeight: isMobile ? 40 : 44,\n"
        "              padding: isMobile ? '8px 12px' : '10px 16px',\n"
        "              fontSize: isMobile ? 12 : 14,\n"
        "              fontWeight: 700,\n"
        "              backgroundColor: '#000',\n"
        "              color: '#fff',\n"
        "              border: 'none',\n"
        "              borderRadius: 10,\n"
        "              cursor: 'pointer',\n"
        "            }}\n"
        "          >\n"
        "            Xにポスト（失敗ネタ）\n"
        "          </button>\n"
        "        </div>\n"
        "      )}\n"
        "      {actionButtonsRow}",
        "      {titleBlock}\n"
        "      {actionButtonsRow}",
        "FailList: share panel block",
    )

    f.write_text(ft, encoding="utf-8")
    print("[OK] reverted FailList.tsx")


def revert_og_route() -> None:
    og = ROOT / "src/app/api/og/route.tsx"
    ot = og.read_text(encoding="utf-8")

    # Remove miss comment line
    ot = replace_one(
        ot,
        " * GET /api/og?q=15&result=success\n"
        " * GET /api/og?q=20&result=fail\n"
        " * GET /api/og?q=18&result=miss（FAIL_LIST 用: 外れた強調）\n",
        " * GET /api/og?q=15&result=success\n"
        " * GET /api/og?q=20&result=fail\n",
        "og: miss comment",
    )

    # Remove isMiss logic
    ot = replace_one(
        ot,
        "  const isSuccess = result === 'success';\n"
        "  const isMiss = result === 'miss';\n"
        "  const bgGradient = isSuccess\n"
        "    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'\n"
        "    : isMiss\n"
        "      ? 'linear-gradient(135deg, #64748b 0%, #0f172a 100%)'\n"
        "      : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';\n"
        "  const mainText = isSuccess\n"
        "    ? `${q}問で当てた！`\n"
        "    : isMiss\n"
        "      ? `${q}問かけても外れた！`\n"
        "      : `${q}問 惜しかった…！`;\n",
        "  const isSuccess = result === 'success';\n"
        "  const bgGradient = isSuccess\n"
        "    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'\n"
        "    : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';\n"
        "  const mainText = isSuccess ? `${q}問で当てた！` : `${q}問 惜しかった…！`;\n",
        "og: isMiss logic",
    )

    og.write_text(ot, encoding="utf-8")
    print("[OK] reverted og/route.tsx")


def delete_checklist() -> None:
    checklist = ROOT / "docs/CHECKLIST-copy-layout-mobile.md"
    if checklist.exists():
        checklist.unlink()
        print("[OK] deleted CHECKLIST-copy-layout-mobile.md")
    else:
        print("[SKIP] CHECKLIST-copy-layout-mobile.md already gone")


def main() -> None:
    revert_page_tsx()
    revert_success_tsx()
    revert_faillist_tsx()
    revert_og_route()
    delete_checklist()
    print("\nAll done. Run: npx tsc --noEmit  to verify.")


if __name__ == "__main__":
    main()
