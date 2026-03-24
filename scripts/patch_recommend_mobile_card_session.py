# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "RecommendMode.tsx"
text = path.read_text(encoding="utf-8")
old = '<MobileWorkCardHorizontal key={rec.workId} work={rec} showFanzaLink={true} matchRate={rec.matchRate} matchRateLabel="好みマッチ度" />'
new = '<MobileWorkCardHorizontal key={rec.workId} work={rec} showFanzaLink={true} matchRate={rec.matchRate} matchRateLabel="好みマッチ度" recommendSessionId={recommendSessionId} />'
if old not in text:
    raise SystemExit("MobileWorkCardHorizontal line not found")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("OK")
