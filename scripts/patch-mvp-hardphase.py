from pathlib import Path
p = Path(__file__).resolve().parents[1] / "config" / "mvpConfig.json"
t = p.read_text(encoding="utf-8")
n = '    "hardConfidenceMin": 0.6\n  },\n  "algo"'
r = '''    "hardConfidenceMin": 0.6,
    "hardConfidenceMinByPhase": {
      "enabled": true,
      "minPopularityBase": 50,
      "phases": {
        "q20": 0.85,
        "q25": 0.75,
        "q30": 0.65
      }
    }
  },
  "algo"'''
if n not in t:
    raise SystemExit("anchor missing or already patched")
p.write_text(t.replace(n, r, 1), encoding="utf-8")
print("mvpConfig ok")
