import { pickDisplayTags } from './display/pickDisplayTags';
import { pickTopSimilar } from './similarity';
import type { QuizChoice, QuizQuestion, QuizTier, QuizWork } from './types';
import { pickByTier } from './pool/selectWorks';

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function pickRandomDistinct(pool: QuizWork[], exclude: Set<string>, count: number): QuizWork[] {
  const candidates = pool.filter((w) => !exclude.has(w.workId));
  shuffleInPlace(candidates);
  return candidates.slice(0, count);
}

function pickThreeRandomImages(images: string[]): string[] {
  if (images.length <= 3) return [...images];
  const pickedIndices = new Set<number>();
  while (pickedIndices.size < 3) {
    pickedIndices.add(Math.floor(Math.random() * images.length));
  }
  return [...pickedIndices]
    .sort((a, b) => a - b)
    .map((i) => images[i]);
}

function buildChoices(target: QuizWork, distractors: QuizWork[]): QuizChoice[] {
  const letters: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
  const items = [target, ...distractors];
  shuffleInPlace(items);
  return items.map((w, i) => ({
    id: letters[i],
    workId: w.workId,
    title: w.title,
    authorName: w.authorName,
    isCorrect: w.workId === target.workId,
  }));
}

function buildOfficialFrequencyMap(pool: QuizWork[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const w of pool) {
    for (const t of w.officialTags) {
      map.set(t.tagKey, (map.get(t.tagKey) ?? 0) + 1);
    }
  }
  return map;
}

export function buildQuestion(target: QuizWork, pool: QuizWork[], officialFreq: Map<string, number>): QuizQuestion | null {
  // 同一作者を候補から排除（別作者のみ選択肢に入る）
  const differentAuthorPool = pool.filter(
    (w) => w.workId !== target.workId && w.authorName.trim() !== target.authorName.trim(),
  );

  const top = pickTopSimilar(target, differentAuthorPool, 5);
  shuffleInPlace(top);
  const picked = top.slice(0, 3);
  const exclude = new Set<string>([target.workId, ...picked.map((p) => p.workId)]);
  let distractors = [...picked];
  if (distractors.length < 3) {
    const need = 3 - distractors.length;
    distractors = [...distractors, ...pickRandomDistinct(differentAuthorPool, exclude, need)];
  }
  if (distractors.length < 3) return null;

  const hints = pickDisplayTags({
    derivedTags: target.derivedTags,
    officialTags: target.officialTags,
    officialFrequencyMap: officialFreq,
  });

  return {
    questionId: `q_${target.workId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    images: pickThreeRandomImages(target.sampleImages),
    hintSentences: hints.hintSentences,
    choices: buildChoices(target, distractors.slice(0, 3)),
    correctWorkId: target.workId,
    correctThumbnailUrl: target.thumbnailUrl,
    debugAllTags: {
      derived: target.derivedTags.map((t) => t.displayName),
      official: target.officialTags.map((t) => t.displayName),
      structural: target.structuralTags.map((t) => t.displayName),
    },
  };
}

function pickTargetsByTier(pool: QuizWork[]): QuizWork[] {
  const tiers: Array<{ tier: QuizTier; count: number }> = [
    { tier: 'famous', count: 3 },
    { tier: 'mid', count: 4 },
    { tier: 'minor', count: 3 },
  ];

  const chosen: QuizWork[] = [];
  const used = new Set<string>();

  const pickTier = (tier: QuizTier, count: number) => {
    const picks = pickByTier(pool, tier, count).filter((w) => !used.has(w.workId));
    for (const p of picks) {
      chosen.push(p);
      used.add(p.workId);
    }
    return picks.length;
  };

  for (const t of tiers) {
    const got = pickTier(t.tier, t.count);
    const short = t.count - got;
    if (short > 0) {
      const fallbackPool = pool.filter((w) => !used.has(w.workId));
      shuffleInPlace(fallbackPool);
      for (const f of fallbackPool.slice(0, short)) {
        chosen.push(f);
        used.add(f.workId);
      }
    }
  }

  return chosen.slice(0, 10);
}

export function buildQuestionSet(pool: QuizWork[]): QuizQuestion[] | null {
  if (pool.length < 10) return null;
  const officialFreq = buildOfficialFrequencyMap(pool);
  const targets = pickTargetsByTier(pool);
  if (targets.length < 10) return null;

  const questions: QuizQuestion[] = [];
  for (const t of targets) {
    const q = buildQuestion(t, pool, officialFreq);
    if (!q) return null;
    questions.push(q);
  }
  return questions;
}
