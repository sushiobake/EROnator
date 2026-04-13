/**
 * Special Question 選択（特別質問）
 * シリーズもの/総集編、タイトル文字種、有名度、50音分類、救済（TITLE_SYLLABLE_2, AUTHOR_CHAR_TYPE）
 */

import type { WorkProbability } from './types';
import { SERIES_TAG_KEYS } from './types';
import { getWorkTagMatrix, getWorkTagsFromMatrix } from '@/server/game/workTagMatrixLoader';
import { getTitleCharType, type TitleCharType } from '@/server/utils/titleCharType';
import { getAuthorCharType } from '@/server/utils/authorCharType';
import {
  loadSpecialQuestionsConfig,
  getTitleSyllable2Branches,
  getTitleSyllableRanges,
  getAuthorCharTypeQuestionText,
} from '@/server/config/specialQuestionsLoader';
import { prisma } from '@/server/db/client';
import { getSimWorkDataMap, type SimWorkData } from '@/server/game/engine';
import { getTitleReadingInitials } from '@/server/utils/titleReadingInitial';

export type SpecialQuestionType =
  | 'SERIES'
  | 'TITLE_CHAR_TYPE'
  | 'POPULARITY'
  | 'TITLE_SYLLABLE'
  | 'TITLE_SYLLABLE_2'
  | 'AUTHOR_CHAR_TYPE'
  | 'TITLE_LENGTH_STYLE';

export interface SpecialQuestionResult {
  specialQuestionType: SpecialQuestionType;
  displayText: string;
  /** Type SERIES: 判定用タグキー */
  seriesTagKeys?: string[];
  /** Type TITLE_CHAR_TYPE: 聞く文字種（KANJI or HIRAGANA_OR_KATAKANA の2択） */
  titleCharType?: 'KANJI' | 'HIRAGANA_OR_KATAKANA';
  /** Type POPULARITY: 閾値（popularityBase + playBonus >= で「有名」） */
  popularityThreshold?: number;
  /** Type TITLE_SYLLABLE / TITLE_SYLLABLE_2: 対象文字（titleReadingInitial が含まれるか） */
  syllableChars?: string[];
  /** Type TITLE_SYLLABLE: ranges[].id（編集用） */
  titleSyllableRangeId?: string;
  /** Type TITLE_SYLLABLE_2: 親rangeId と 枝（編集用） */
  titleSyllable2RangeId?: string;
  titleSyllable2Branch?: 'yesBranch' | 'noBranch';
  /** Type AUTHOR_CHAR_TYPE: 聞く文字種 */
  authorCharType?: 'HIRAGANA_OR_KATAKANA' | 'KANJI_OR_ALPHA';
  /** Type TITLE_LENGTH_STYLE: 「長い」判定の最小文字数（YES 側） */
  titleLengthYesMin?: number;
  /** Type TITLE_LENGTH_STYLE: 「短い」寄せの上限文字数（NO 側） */
  titleLengthNoMax?: number;
}

/** 質問履歴エントリ（救済スロット用） */
export interface QuestionHistoryEntryForRescue {
  kind: string;
  specialQuestionType?: string;
  syllableChars?: string[];
  answer?: string;
}

/** 残り候補に対する情報量（p が 0.5 に近いほど高い）。min(p, 1-p) の最大化 */
function informationGain(pYes: number): number {
  const p = Math.max(0.001, Math.min(0.999, pYes));
  return Math.min(p, 1 - p);
}

/**
 * 作品がシリーズタグを持つか
 */
function workHasSeriesTag(
  workId: string,
  workTagMap: Map<string, Set<string>>
): boolean {
  const tags = workTagMap.get(workId);
  if (!tags) return false;
  return SERIES_TAG_KEYS.some(tk => tags.has(tk));
}

/**
 * TITLE_SYLLABLE の syllableChars から rangeId を特定
 */
function getRangeIdFromSyllableChars(chars: string[]): string | null {
  const ranges = getTitleSyllableRanges();
  const charSet = new Set(chars);
  for (const r of ranges) {
    const rSet = new Set(r.chars ?? []);
    if (rSet.size > 0 && rSet.size === charSet.size && [...rSet].every(c => charSet.has(c))) {
      return r.id ?? null;
    }
  }
  return null;
}

/**
 * Special Question を1つ選択
 * slotIndex に応じてスロット別ロジックを適用:
 * - Q3: SERIES / POPULARITY（2枠で両方出す片方）
 * - Q5: TITLE_SYLLABLE 固定
 * - Q9: SERIES / POPULARITY の残り
 * - Q12: TITLE_LENGTH_STYLE or TITLE_CHAR_TYPE をランダム
 * - Q11(UNKNOWN補填): 未使用タイプから
 * - Q16, Q20, Q24(救済): AUTHOR_CHAR_TYPE, TITLE_SYLLABLE_2, TITLE_LENGTH_STYLE 等
 */
export async function selectSpecialQuestion(
  probabilities: WorkProbability[],
  usedSpecialTypes: Set<SpecialQuestionType>,
  workIds: string[],
  slotIndex?: number,
  _titleCharTypeAnsweredUnknown?: boolean,
  questionHistory?: QuestionHistoryEntryForRescue[]
): Promise<SpecialQuestionResult | null> {
  const config = loadSpecialQuestionsConfig();

  // スロット別の候補プールを決定（設計書 v1.5）
  let allowedTypes: SpecialQuestionType[] | null = null;
  if (slotIndex === 3) {
    allowedTypes = (['SERIES', 'POPULARITY'] as const).filter(t => !usedSpecialTypes.has(t));
  } else if (slotIndex === 5) {
    allowedTypes = !usedSpecialTypes.has('TITLE_SYLLABLE') ? (['TITLE_SYLLABLE'] as const) : null;
  } else if (slotIndex === 9) {
    allowedTypes = (['SERIES', 'POPULARITY'] as const).filter(t => !usedSpecialTypes.has(t));
  } else if (slotIndex === 12) {
    allowedTypes = (['TITLE_LENGTH_STYLE', 'TITLE_CHAR_TYPE'] as const).filter(t => !usedSpecialTypes.has(t));
  } else if (slotIndex === 11) {
    const all: SpecialQuestionType[] = ['SERIES', 'TITLE_CHAR_TYPE', 'POPULARITY', 'TITLE_SYLLABLE'];
    allowedTypes = all.filter(t => !usedSpecialTypes.has(t));
  } else if (slotIndex === 16 || slotIndex === 20 || slotIndex === 24) {
    const rescueCandidates: SpecialQuestionType[] = [];
    if (!usedSpecialTypes.has('AUTHOR_CHAR_TYPE')) rescueCandidates.push('AUTHOR_CHAR_TYPE');
    const lastSyllable = (questionHistory ?? [])
      .filter(q => q.kind === 'SPECIAL_QUESTION' && q.specialQuestionType === 'TITLE_SYLLABLE')
      .pop();
    const syllableAnsweredOk =
      lastSyllable &&
      lastSyllable.answer &&
      (lastSyllable.answer === 'YES' || lastSyllable.answer === 'NO') &&
      lastSyllable.syllableChars?.length;
    if (!usedSpecialTypes.has('TITLE_SYLLABLE_2') && syllableAnsweredOk) {
      rescueCandidates.push('TITLE_SYLLABLE_2');
    }
    if (!usedSpecialTypes.has('TITLE_LENGTH_STYLE')) rescueCandidates.push('TITLE_LENGTH_STYLE');
    allowedTypes = rescueCandidates.length > 0 ? rescueCandidates : null;
  }

  const candidates: Array<{ type: SpecialQuestionType; pYes: number; result: SpecialQuestionResult }> = [];

  // Type 3: シリーズもの/総集編
  if ((!allowedTypes || allowedTypes.includes('SERIES')) && !usedSpecialTypes.has('SERIES')) {
    const matrix = getWorkTagMatrix();
    const workTagMap = new Map<string, Set<string>>();

    if (matrix) {
      const workTags = getWorkTagsFromMatrix(workIds, { tagKeys: [...SERIES_TAG_KEYS] });
      for (const wt of workTags) {
        if (!workTagMap.has(wt.workId)) workTagMap.set(wt.workId, new Set());
        workTagMap.get(wt.workId)!.add(wt.tagKey);
      }
    } else {
      const workTags = await prisma.workTag.findMany({
        where: {
          workId: { in: workIds },
          tagKey: { in: [...SERIES_TAG_KEYS] },
        },
        select: { workId: true, tagKey: true },
      });
      for (const wt of workTags) {
        if (!workTagMap.has(wt.workId)) workTagMap.set(wt.workId, new Set());
        workTagMap.get(wt.workId)!.add(wt.tagKey);
      }
    }

    let pYes = 0;
    for (const p of probabilities) {
      if (workHasSeriesTag(p.workId, workTagMap)) {
        pYes += p.probability;
      }
    }

    const questionText = config.SERIES?.questionText ?? 'その作品は、シリーズものや総集編？';
    candidates.push({
      type: 'SERIES',
      pYes,
      result: {
        specialQuestionType: 'SERIES',
        displayText: questionText,
        seriesTagKeys: [...SERIES_TAG_KEYS],
      },
    });
  }

  // Type 5: タイトル文字種（漢字 vs ひらがなorカタカナ の2択からランダム）
  if ((!allowedTypes || allowedTypes.includes('TITLE_CHAR_TYPE')) && !usedSpecialTypes.has('TITLE_CHAR_TYPE')) {
    const _swd = getSimWorkDataMap();
    const works = _swd
      ? workIds.map(id => _swd.get(id)).filter((w): w is SimWorkData => w != null)
      : await prisma.work.findMany({
          where: { workId: { in: workIds } },
          select: { workId: true, title: true },
        });
    const workCharTypeMap = new Map<string, TitleCharType>();
    for (const w of works) {
      workCharTypeMap.set(w.workId, getTitleCharType(w.title ?? ''));
    }

    const charTypes: Array<'KANJI' | 'HIRAGANA_OR_KATAKANA'> = ['KANJI', 'HIRAGANA_OR_KATAKANA'];
    const ctDisplay = config.TITLE_CHAR_TYPE ?? {};
    const chosen = charTypes[Math.floor(Math.random() * charTypes.length)]!;
    let pYes = 0;
    for (const p of probabilities) {
      const ct = workCharTypeMap.get(p.workId);
      const matches = chosen === 'KANJI'
        ? ct === 'KANJI'
        : ct === 'HIRAGANA' || ct === 'KATAKANA';
      if (matches) pYes += p.probability;
    }
    const questionText = chosen === 'KANJI'
      ? (ctDisplay.KANJI ?? 'タイトルは【漢字】で始まる？')
      : (ctDisplay.HIRAGANA_OR_KATAKANA ?? 'タイトルは【ひらがな or カタカナ】で始まる？');
    candidates.push({
      type: 'TITLE_CHAR_TYPE',
      pYes,
      result: {
        specialQuestionType: 'TITLE_CHAR_TYPE',
        displayText: questionText,
        titleCharType: chosen,
      },
    });
  }

  // タイトル長（なろう系っぽさ）。YES 側 = 文字数 >= yesMinLength
  if ((!allowedTypes || allowedTypes.includes('TITLE_LENGTH_STYLE')) && !usedSpecialTypes.has('TITLE_LENGTH_STYLE')) {
    const tls = config.TITLE_LENGTH_STYLE;
    const yesMin = tls?.yesMinLength ?? 10;
    const noMax = tls?.noMaxLength ?? 20;
    const _swdTls = getSimWorkDataMap();
    const worksTls = _swdTls
      ? workIds.map(id => _swdTls.get(id)).filter((w): w is SimWorkData => w != null)
      : await prisma.work.findMany({
          where: { workId: { in: workIds } },
          select: { workId: true, title: true },
        });
    const workLenMap = new Map<string, number>();
    for (const w of worksTls) {
      workLenMap.set(w.workId, (w.title ?? '').length);
    }
    let pYesTls = 0;
    for (const p of probabilities) {
      const len = workLenMap.get(p.workId) ?? 0;
      if (len >= yesMin) pYesTls += p.probability;
    }
    const questionTextTls = tls?.questionText ?? 'なろう系みたいに長いタイトル？';
    candidates.push({
      type: 'TITLE_LENGTH_STYLE',
      pYes: pYesTls,
      result: {
        specialQuestionType: 'TITLE_LENGTH_STYLE',
        displayText: questionTextTls,
        titleLengthYesMin: yesMin,
        titleLengthNoMax: noMax,
      },
    });
  }

  // Type 2: 有名度（config.POPULARITY.popularityThreshold、デフォルト30）
  if ((!allowedTypes || allowedTypes.includes('POPULARITY')) && !usedSpecialTypes.has('POPULARITY')) {
    const threshold = config.POPULARITY?.popularityThreshold ?? 30;
    const _swd2 = getSimWorkDataMap();
    const works = _swd2
      ? workIds.map(id => _swd2.get(id)).filter((w): w is SimWorkData => w != null)
      : await prisma.work.findMany({
          where: { workId: { in: workIds } },
          select: { workId: true, popularityBase: true, popularityPlayBonus: true },
        });
    const workPopularityMap = new Map<string, number>();
    for (const w of works) {
      const total = (w.popularityBase ?? 0) + (w.popularityPlayBonus ?? 0);
      workPopularityMap.set(w.workId, total);
    }

    let pYes = 0;
    for (const p of probabilities) {
      const pop = workPopularityMap.get(p.workId) ?? 0;
      if (pop >= threshold) {
        pYes += p.probability;
      }
    }

    const questionText = config.POPULARITY?.questionText ?? 'その作品は、かなり有名？';
    candidates.push({
      type: 'POPULARITY',
      pYes,
      result: {
        specialQuestionType: 'POPULARITY',
        displayText: questionText,
        popularityThreshold: threshold,
      },
    });
  }

  // Type 1: 50音分類（titleReadingInitial が DB に登録されている作品のみ有効）
  if ((!allowedTypes || allowedTypes.includes('TITLE_SYLLABLE')) && !usedSpecialTypes.has('TITLE_SYLLABLE')) {
    const syllableOptions = config.TITLE_SYLLABLE && 'ranges' in config.TITLE_SYLLABLE
      ? (config.TITLE_SYLLABLE.ranges ?? [])
      : Array.isArray(config.TITLE_SYLLABLE)
        ? config.TITLE_SYLLABLE
        : [];
    if (syllableOptions.length > 0) {
      const _swd3 = getSimWorkDataMap();
      const works = _swd3
        ? workIds.map(id => _swd3.get(id)).filter((w): w is SimWorkData => w != null)
        : await prisma.work.findMany({
            where: { workId: { in: workIds } },
            select: { workId: true, titleReadingInitial: true },
          });
      const workInitialMap = new Map<string, string | null>();
      for (const w of works) {
        workInitialMap.set(w.workId, w.titleReadingInitial ?? null);
      }

      for (const opt of syllableOptions) {
        const charSet = new Set(opt.chars ?? []);
        if (charSet.size === 0) continue;

        let pYes = 0;
        for (const p of probabilities) {
          const raw = workInitialMap.get(p.workId);
          const initials = getTitleReadingInitials(raw);
          if (initials.some((c) => charSet.has(c))) {
            pYes += p.probability;
          }
        }

        const questionText = opt.questionText ?? `その作品のタイトルは、${opt.label}で始まりますか？`;
        candidates.push({
          type: 'TITLE_SYLLABLE',
          pYes,
          result: {
            specialQuestionType: 'TITLE_SYLLABLE',
            displayText: questionText,
            syllableChars: [...opt.chars],
            titleSyllableRangeId: opt.id,
          },
        });
      }
    }
  }

  // 救済: TITLE_SYLLABLE_2（TITLE_SYLLABLE の YES/NO に応じた2次50音）
  if ((!allowedTypes || allowedTypes.includes('TITLE_SYLLABLE_2')) && !usedSpecialTypes.has('TITLE_SYLLABLE_2')) {
    const lastSyllable = (questionHistory ?? [])
      .filter(q => q.kind === 'SPECIAL_QUESTION' && q.specialQuestionType === 'TITLE_SYLLABLE')
      .pop();
    if (lastSyllable?.syllableChars && lastSyllable.answer && (lastSyllable.answer === 'YES' || lastSyllable.answer === 'NO')) {
      const rangeId = getRangeIdFromSyllableChars(lastSyllable.syllableChars);
      const branches = getTitleSyllable2Branches();
      const branch = rangeId ? branches[rangeId] : null;
      const subBranch = lastSyllable.answer === 'YES' ? branch?.yesBranch : branch?.noBranch;
      if (subBranch?.chars?.length) {
        const _swd4 = getSimWorkDataMap();
        const works = _swd4
          ? workIds.map(id => _swd4.get(id)).filter((w): w is SimWorkData => w != null)
          : await prisma.work.findMany({
              where: { workId: { in: workIds } },
              select: { workId: true, titleReadingInitial: true },
            });
        const workInitialMap = new Map<string, string | null>();
        for (const w of works) {
          workInitialMap.set(w.workId, w.titleReadingInitial ?? null);
        }
        const charSet = new Set(subBranch.chars);
        let pYes = 0;
        for (const p of probabilities) {
          const raw = workInitialMap.get(p.workId);
          const initials = getTitleReadingInitials(raw);
          if (initials.some((c) => charSet.has(c))) pYes += p.probability;
        }
        const questionText = subBranch.questionText ?? `その作品のタイトルは、${subBranch.label}で始まりますか？`;
        candidates.push({
          type: 'TITLE_SYLLABLE_2',
          pYes,
          result: {
            specialQuestionType: 'TITLE_SYLLABLE_2',
            displayText: questionText,
            syllableChars: [...subBranch.chars],
            titleSyllable2RangeId: rangeId ?? undefined,
            titleSyllable2Branch: lastSyllable.answer === 'YES' ? 'yesBranch' : 'noBranch',
          },
        });
      }
    }
  }

  // 救済: AUTHOR_CHAR_TYPE（作者名の文字種）
  if ((!allowedTypes || allowedTypes.includes('AUTHOR_CHAR_TYPE')) && !usedSpecialTypes.has('AUTHOR_CHAR_TYPE')) {
    const _swd5 = getSimWorkDataMap();
    const works = _swd5
      ? workIds.map(id => _swd5.get(id)).filter((w): w is SimWorkData => w != null)
      : await prisma.work.findMany({
          where: { workId: { in: workIds } },
          select: { workId: true, authorName: true },
        });
    const workAuthorCharMap = new Map<string, ReturnType<typeof getAuthorCharType>>();
    for (const w of works) {
      workAuthorCharMap.set(w.workId, getAuthorCharType(w.authorName ?? ''));
    }
    const charTypes: Array<'HIRAGANA_OR_KATAKANA' | 'KANJI_OR_ALPHA'> = ['HIRAGANA_OR_KATAKANA', 'KANJI_OR_ALPHA'];
    const chosen = charTypes[Math.floor(Math.random() * charTypes.length)]!;
    let pYes = 0;
    for (const p of probabilities) {
      const ct = workAuthorCharMap.get(p.workId);
      const matches =
        chosen === 'HIRAGANA_OR_KATAKANA'
          ? ct === 'HIRAGANA' || ct === 'KATAKANA'
          : ct === 'KANJI' || ct === 'ALPHA';
      if (matches) pYes += p.probability;
    }
    const questionText = getAuthorCharTypeQuestionText(chosen);
    candidates.push({
      type: 'AUTHOR_CHAR_TYPE',
      pYes,
      result: {
        specialQuestionType: 'AUTHOR_CHAR_TYPE',
        displayText: questionText,
        authorCharType: chosen,
      },
    });
  }

  if (candidates.length === 0) return null;

  // Q12: タイトル長 vs 文字種を 50% で（設計書）
  if (slotIndex === 12) {
    const only = candidates.filter(
      c => c.type === 'TITLE_LENGTH_STYLE' || c.type === 'TITLE_CHAR_TYPE'
    );
    if (only.length >= 2) {
      const picked = only[Math.floor(Math.random() * only.length)]!;
      return picked.result;
    }
    if (only.length === 1) return only[0]!.result;
  }

  // スロット3,5,9,11,16,20,24: 情報量上位2〜3件からランダム選択（救済は候補1〜2件なのでそのまま）
  if (
    slotIndex === 3 ||
    slotIndex === 5 ||
    slotIndex === 9 ||
    slotIndex === 11 ||
    slotIndex === 16 ||
    slotIndex === 20 ||
    slotIndex === 24
  ) {
    candidates.sort((a, b) => informationGain(b.pYes) - informationGain(a.pYes));
    const topN = Math.min(3, candidates.length);
    const chosen = candidates[Math.floor(Math.random() * topN)]!;
    return chosen.result;
  }
  candidates.sort((a, b) => informationGain(b.pYes) - informationGain(a.pYes));
  const best = candidates[0]!;
  return best.result;
}
