/**
 * Special Question 選択（特別質問）
 * シリーズもの/総集編、タイトル文字種、有名度、50音分類
 */

import type { WorkProbability } from './types';
import { SERIES_TAG_KEYS } from './types';
import { getWorkTagMatrix, getWorkTagsFromMatrix } from '@/server/game/workTagMatrixLoader';
import { getTitleCharType, TITLE_CHAR_TYPE_DISPLAY, type TitleCharType } from '@/server/utils/titleCharType';
import { prisma } from '@/server/db/client';

export type SpecialQuestionType = 'SERIES' | 'TITLE_CHAR_TYPE' | 'POPULARITY' | 'TITLE_SYLLABLE';

export interface SpecialQuestionResult {
  specialQuestionType: SpecialQuestionType;
  displayText: string;
  /** Type SERIES: 判定用タグキー */
  seriesTagKeys?: string[];
  /** Type TITLE_CHAR_TYPE: 聞く文字種 */
  titleCharType?: 'KANJI' | 'KATAKANA' | 'HIRAGANA';
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
 * Special Question を1つ選択（未使用タイプから、情報量が最大のものを選ぶ）
 */
export async function selectSpecialQuestion(
  probabilities: WorkProbability[],
  usedSpecialTypes: Set<SpecialQuestionType>,
  workIds: string[]
): Promise<SpecialQuestionResult | null> {
  const candidates: Array<{ type: SpecialQuestionType; pYes: number; result: SpecialQuestionResult }> = [];

  // Type 3: シリーズもの/総集編
  if (!usedSpecialTypes.has('SERIES')) {
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

    candidates.push({
      type: 'SERIES',
      pYes,
      result: {
        specialQuestionType: 'SERIES',
        displayText: 'その作品は、シリーズものや総集編？',
        seriesTagKeys: [...SERIES_TAG_KEYS],
      },
    });
  }

  // Type 5: タイトル文字種（漢字/カタカナ/ひらがな）
  if (!usedSpecialTypes.has('TITLE_CHAR_TYPE')) {
    const works = await prisma.work.findMany({
      where: { workId: { in: workIds } },
      select: { workId: true, title: true },
    });
    const workCharTypeMap = new Map<string, TitleCharType>();
    for (const w of works) {
      workCharTypeMap.set(w.workId, getTitleCharType(w.title ?? ''));
    }

    const charTypes: Array<'KANJI' | 'KATAKANA' | 'HIRAGANA'> = ['KANJI', 'KATAKANA', 'HIRAGANA'];
    for (const ct of charTypes) {
      let pYes = 0;
      for (const p of probabilities) {
        if (workCharTypeMap.get(p.workId) === ct) {
          pYes += p.probability;
        }
      }
      candidates.push({
        type: 'TITLE_CHAR_TYPE',
        pYes,
        result: {
          specialQuestionType: 'TITLE_CHAR_TYPE',
          displayText: TITLE_CHAR_TYPE_DISPLAY[ct],
          titleCharType: ct,
        },
      });
    }
  }

  if (candidates.length === 0) return null;

  // 情報量が最大のものを選ぶ（同率なら先頭）
  candidates.sort((a, b) => informationGain(b.pYes) - informationGain(a.pYes));
  const best = candidates[0]!;
  return best.result;
}
