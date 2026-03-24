# -*- coding: utf-8 -*-
"""RecommendMode.tsx: 推薦プレイ履歴用のセッションID・ステップログ・保存POST・ExternalLink"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "src" / "app" / "components" / "RecommendMode.tsx"
text = path.read_text(encoding="utf-8")

MARK_CAPTURE = "  const [captureMosaic, setCaptureMosaic] = useState(false);\n\n  const rc = recommendCopy ?? {"
INSERT_AFTER_CAPTURE = """  const [captureMosaic, setCaptureMosaic] = useState(false);

  const [recommendSessionId] = useState(() =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `rec-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  const sessionStartedAtRef = useRef<number>(Date.now());
  const stepTransitionsRef = useRef<Array<{ step: string; at: number }>>([]);

  const rc = recommendCopy ?? {"""

if MARK_CAPTURE not in text:
    raise SystemExit("marker for captureMosaic block not found")
text = text.replace(MARK_CAPTURE, INSERT_AFTER_CAPTURE, 1)

MARK_EFFECT = """  }, []);

  const resetInitial = () => {"""
# find: end of useEffect for /api/config/recommend - the `}, []);` before resetInitial
needle = "  }, []);\n\n  const resetInitial = () => {"
if needle not in text:
    raise SystemExit("marker before resetInitial not found")
step_effect = """  }, []);

  useEffect(() => {
    stepTransitionsRef.current.push({ step: String(step), at: Date.now() });
  }, [step]);

  const resetInitial = () => {"""
text = text.replace(needle, step_effect, 1)

OLD_SUBMIT = """  const submitRecommend = async (finalRanked?: RankedTag[]) => {
    const ranked = finalRanked ?? rankedFinal;
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          popularityChoice: popularityChoice ?? undefined,
          rankedFinal: ranked.map(t => ({ tagKey: t.tagKey, rank: t.rank })),
          famousTagKeys: famousTagKeysAll,
          debug: isDebugLocal,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.recommendedWorks)) {
        setRecommendedWorks(data.recommendedWorks);
        setTotalMatched(data.totalMatched ?? 0);
        setStep('results');
        if (isDebugLocal && data.debug) {
          setDebugData({
            phase: 'results',
            tagsWithWeights: data.debug.tagsWithWeights ?? [],
            works: data.debug.works ?? [],
          });
        }
      } else {
        setStep('initial');
      }
    } catch (e) {
      console.error('Recommend submit failed', e);
      setStep('initial');
    }
  };"""

NEW_SUBMIT = """  const submitRecommend = async (finalRanked?: RankedTag[]) => {
    const ranked = finalRanked ?? rankedFinal;
    try {
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          popularityChoice: popularityChoice ?? undefined,
          rankedFinal: ranked.map(t => ({ tagKey: t.tagKey, rank: t.rank })),
          famousTagKeys: famousTagKeysAll,
          debug: isDebugLocal,
        }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.recommendedWorks)) {
        setRecommendedWorks(data.recommendedWorks);
        setTotalMatched(data.totalMatched ?? 0);
        setStep('results');
        if (isDebugLocal && data.debug) {
          setDebugData({
            phase: 'results',
            tagsWithWeights: data.debug.tagsWithWeights ?? [],
            works: data.debug.works ?? [],
          });
        }
        const recs = data.recommendedWorks as WorkResult[];
        const sort1Obj = Object.fromEntries(sort1Ranks);
        const sort2Obj = Object.fromEntries(sort2Ranks);
        const detail = {
          version: 1 as const,
          recommendSessionId,
          sessionStartedAt: new Date(sessionStartedAtRef.current).toISOString(),
          endedAt: new Date().toISOString(),
          totalDurationMs: Date.now() - sessionStartedAtRef.current,
          aiGateChoice,
          popularityChoice,
          priorityOrder,
          stepTransitions: stepTransitionsRef.current,
          rankedFamous: rankedFamous.map(t => ({
            tagKey: t.tagKey,
            displayName: t.displayName,
            rank: t.rank,
            category: t.category,
          })),
          selectedFamous,
          selectedUnknown,
          sort1Ranks: sort1Obj,
          sort2Ranks: sort2Obj,
          rankedFinal: ranked.map(t => ({
            tagKey: t.tagKey,
            displayName: t.displayName,
            rank: t.rank,
            category: t.category,
          })),
          recommendedWorks: recs.map(w => ({
            workId: w.workId,
            title: w.title,
            authorName: w.authorName,
            matchRate: w.matchRate,
          })),
          totalMatched: data.totalMatched ?? 0,
          isMobile,
        };
        const top = recs[0];
        void fetch('/api/recommend/play-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recommendSessionId,
            sessionStartedAt: new Date(sessionStartedAtRef.current).toISOString(),
            detail,
            topWorkId: top?.workId ?? null,
            topWorkTitle: top?.title ?? null,
          }),
        }).catch(() => {});
      } else {
        setStep('initial');
      }
    } catch (e) {
      console.error('Recommend submit failed', e);
      setStep('initial');
    }
  };"""

if OLD_SUBMIT not in text:
    raise SystemExit("submitRecommend block not found")
text = text.replace(OLD_SUBMIT, NEW_SUBMIT, 1)

OLD_LINK = """            <ExternalLink href={rec.productUrl} linkText={LINK_TEXT}>
              {LINK_TEXT}
            </ExternalLink>"""
NEW_LINK = """            <ExternalLink href={rec.productUrl} linkText={LINK_TEXT} recommendSessionId={recommendSessionId}>
              {LINK_TEXT}
            </ExternalLink>"""
if OLD_LINK not in text:
    raise SystemExit("ExternalLink block not found")
text = text.replace(OLD_LINK, NEW_LINK, 1)

path.write_text(text, encoding="utf-8")
print("OK:", path)
