# MVP_CONFIG_SCHEMA v1.5

**Purpose:** MVPのチューニング入口を **1ファイル（config/mvpConfig.json）に固定**し、Cursorが推測でキーを増やしたり形を誤読する事故を防ぐ。

- Source of truth: このスキーマ + 例JSON（`mvpConfig.example.v1.5.json`）
- ルール: **スキーマ外キーは禁止（起動時エラー）**
- 変更可能なのはここに列挙したキーのみ（=「コードを書き換えずに調整」の意味）

---

## JSON Schema (human-readable)

### Root
- `version`: string (must be "v1.5")
- `confirm`: object (required)
- `algo`: object (required)
- `flow`: object (required)
- `dataQuality`: object (required)
- `popularity`: object (required)

---

### confirm (required)
- `revealThreshold`: number [0..1], default 0.70
- `confidenceConfirmBand`: array[number,number] length=2, default [0.40, 0.60]
  - constraint: 0 <= band[0] <= band[1] <= 1
- `qForcedIndices`: array[integer], default [6, 10]
- `softConfidenceMin`: number [0..1], default 0.30
- `hardConfidenceMin`: number [0..1], default 0.50

---

### algo (required)
- `beta`: number > 0, default 1.2
- `alpha`: number [0..1], default 0.02
- `derivedConfidenceThreshold`: number [0..1], default 0.70
- `revealPenalty`: number (0..1], default 0.5

---

### flow (required)
- `maxQuestions`: integer >= 1, default 30
- `maxRevealMisses`: integer >= 1, default 3
- `failListN`: integer >= 1, default 10

- `effectiveConfirmThresholdFormula`: enum {"A"}, default "A"
- `effectiveConfirmThresholdParams`: object (required)
  - `min`: integer >= 1, default 100
  - `max`: integer >= `min`, default 200
  - `divisor`: integer >= 1, default 100

> Formula A:
> `effectiveConfirmThreshold = min(max, max(min, round(totalWorks / divisor)))`

---

### dataQuality (required)
- `minCoverageMode`: enum {"RATIO","WORKS","AUTO"}, default "AUTO"
- `minCoverageRatio`: number [0..1] or null, default 0.05
- `minCoverageWorks`: integer >= 0 or null, default 20

> coverage(tag) = tagWorkCount / totalWorks
>
> - RATIO: coverage >= minCoverageRatio
> - WORKS: tagWorkCount >= minCoverageWorks
> - AUTO: coverage >= max(minCoverageRatio, min(minCoverageWorks, totalWorks)/max(totalWorks, 1))

Notes (AUTO):
- Clamp `minCoverageWorks` by `totalWorks` to avoid ratios > 1 when the DB is small.
- Use `max(totalWorks, 1)` to avoid division-by-zero during dev/seed.


---

### popularity (required)
- `playBonusOnSuccess`: number >= 0, default 0.1

