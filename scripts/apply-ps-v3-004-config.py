# -*- coding: utf-8 -*-
"""Apply V3 pipeline winner ps_v3_004 to config/mvpConfig.json (UTF-8 safe)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "config" / "mvpConfig.json"

data = json.loads(path.read_text(encoding="utf-8"))

# CF1 (ps_v3_004 Group A): band 0.25–0.5, hardMin 0.6, injection 0
data["confirm"]["confidenceConfirmBand"] = [0.25, 0.5]
data["confirm"]["hardConfidenceMin"] = 0.6

data["flow"]["hardConfirmInjectionRatio"] = 0

eer = data["flow"]["earlyExitReview"]
# Same as simulation winner (no Q40 review point)
eer["reviewIndices"] = [25, 30, 35]
th = eer["thresholds"]
# MC1 × EC4 — condition ②: effectiveCandidates > maxEffectiveCandidates (wide)
th["q25"] = {"minConfidence": 0.04, "maxEffectiveCandidates": 90}
th["q30"] = {"minConfidence": 0.06, "maxEffectiveCandidates": 60}
th["q35"] = {"minConfidence": 0.08, "maxEffectiveCandidates": 35}
# Schema / merge: keep q40 for config shape; not used while 40 not in reviewIndices
th["q40"] = {"minConfidence": 0.1, "maxEffectiveCandidates": 40}

out = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
path.write_text(out, encoding="utf-8")
print("Updated", path)
