# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "src" / "app" / "components" / "RecommendMode.tsx"
text = path.read_text(encoding="utf-8")

old_call = """        <RecommendResultsGrid
          works={recommendedWorks}
          totalMatched={totalMatched}
          onBack={onBack}
          shareUrl={shareUrl}
          shareText={shareText}
          onSharePC={handleSharePC}
          isMobile={false}
        />"""

new_call = """        <RecommendResultsGrid
          works={recommendedWorks}
          totalMatched={totalMatched}
          onBack={onBack}
          shareUrl={shareUrl}
          shareText={shareText}
          onSharePC={handleSharePC}
          isMobile={false}
          recommendSessionId={recommendSessionId}
        />"""

if old_call not in text:
    raise SystemExit("RecommendResultsGrid call not found")
text = text.replace(old_call, new_call, 1)

old_fn = """function RecommendResultsGrid({
  works,
  totalMatched,
  onBack,
  shareUrl,
  shareText,
  onSharePC,
  isMobile,
}: {
  works: WorkResult[];
  totalMatched: number;
  onBack: () => void;
  shareUrl: string;
  shareText: string;
  onSharePC?: (withMosaic?: boolean) => void;
  isMobile: boolean;
}) {"""

new_fn = """function RecommendResultsGrid({
  works,
  totalMatched,
  onBack,
  shareUrl,
  shareText,
  onSharePC,
  isMobile,
  recommendSessionId,
}: {
  works: WorkResult[];
  totalMatched: number;
  onBack: () => void;
  shareUrl: string;
  shareText: string;
  onSharePC?: (withMosaic?: boolean) => void;
  isMobile: boolean;
  recommendSessionId: string;
}) {"""

if old_fn not in text:
    raise SystemExit("RecommendResultsGrid signature not found")
text = text.replace(old_fn, new_fn, 1)

path.write_text(text, encoding="utf-8")
print("OK")
