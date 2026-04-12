# -*- coding: utf-8 -*-
"""Remove duplicate mergeEarlyExitReview from ConfigTab; import from earlyExitReviewMerged."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "src" / "app" / "admin" / "tags" / "tabs" / "ConfigTab.tsx"
text = path.read_text(encoding="utf-8")

old_import = """import { RANK_BG, RANK_TEXT } from '@/app/admin/constants/rankColors';
import { DEFAULT_THINKING, DEFAULT_GAME_COPY, DEFAULT_RECOMMEND_COPY } from '@/server/config/schema';
"""

new_import = """import { RANK_BG, RANK_TEXT } from '@/app/admin/constants/rankColors';
import { mergeEarlyExitReview } from '@/app/admin/utils/earlyExitReviewMerged';
import { DEFAULT_THINKING, DEFAULT_GAME_COPY, DEFAULT_RECOMMEND_COPY } from '@/server/config/schema';
"""

if old_import not in text:
    raise SystemExit("import block not found")
text = text.replace(old_import, new_import, 1)

anchor = text.find("}\n\n\nconst DEFAULT_EARLY_EXIT_REVIEW")
if anchor == -1:
    raise SystemExit("}\n\n\nconst DEFAULT not found")
end_cut = text.find("\nfunction CollapsibleSection", anchor)
if end_cut == -1:
    raise SystemExit("CollapsibleSection not found")
# `}\n` まで残し、重複ブロックを削除
text = text[: anchor + 2] + text[end_cut:]

path.write_text(text, encoding="utf-8")
print("ConfigTab.tsx patched OK")
