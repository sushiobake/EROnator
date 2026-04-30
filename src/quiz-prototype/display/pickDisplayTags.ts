import type { QuizDisplayTag } from '../types';

export interface PickDisplayTagsInput {
  derivedTags: QuizDisplayTag[];
  officialTags: QuizDisplayTag[];
  officialFrequencyMap: Map<string, number>;
}

export interface PickDisplayTagsOutput {
  derivedSentences: string[];
  officialSentences: string[];
  hintSentences: string[];
}

export function pickDisplayTags(input: PickDisplayTagsInput): PickDisplayTagsOutput {
  const derived = [...input.derivedTags].sort((a, b) => {
    const ac = a.confidence ?? -1;
    const bc = b.confidence ?? -1;
    return bc - ac;
  });
  const pickedDerived = derived.slice(0, 2);

  const official = [...input.officialTags].sort((a, b) => {
    const af = input.officialFrequencyMap.get(a.tagKey) ?? Number.MAX_SAFE_INTEGER;
    const bf = input.officialFrequencyMap.get(b.tagKey) ?? Number.MAX_SAFE_INTEGER;
    if (af !== bf) return af - bf;
    return a.displayName.localeCompare(b.displayName, 'ja');
  });
  const pickedOfficial = official.slice(0, 3);

  const derivedSentences = pickedDerived.map((t) => `「${t.displayName}」の要素があります。`);
  const officialSentences = pickedOfficial.map((t) => `「${t.displayName}」の要素があります。`);

  const hintSentences = [...derivedSentences, ...officialSentences];
  return { derivedSentences, officialSentences, hintSentences };
}
