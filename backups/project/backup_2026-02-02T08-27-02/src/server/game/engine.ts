/**
 * ゲームエンジン（アルゴリズムとDBの橋渡し）
 */

import { prisma } from '@/server/db/client';
import type { WorkWeight, WorkProbability, AiGateChoice } from '@/server/algo/types';
import {
  calculateBasePrior,
  normalizeWeights,
  calculateConfidence,
  calculateEffectiveCandidates,
  calculateEffectiveConfirmThreshold,
} from '@/server/algo/scoring';
import {
  selectExploreTag,
  shouldInsertConfirm,
  selectConfirmType,
  getNextHardConfirmType,
  type TagInfo,
} from '@/server/algo/questionSelection';
import { passesCoverageGate } from '@/server/algo/coverage';
import { hasDerivedFeature, updateWeightsForTagQuestion } from '@/server/algo/weightUpdate';
import { normalizeTitleForInitial } from '@/server/utils/normalizeTitle';
import { getMvpConfig } from '@/server/config/loader';
import type { MvpConfig } from '@/server/config/schema';
import type { QuestionHistoryEntry } from '@/server/session/manager';
import fs from 'fs';
import path from 'path';

// 質問テンプレートキャッシュ
let questionTemplatesCache: Record<string, string> | null = null;
let questionTemplatesCacheTime = 0;
const CACHE_TTL = 5000; // 5秒キャッシュ

/**
 * 質問テンプレートを読み込む
 */
function loadQuestionTemplates(): Record<string, string> {
  const now = Date.now();
  if (questionTemplatesCache && now - questionTemplatesCacheTime < CACHE_TTL) {
    return questionTemplatesCache;
  }
  
  try {
    const filePath = path.join(process.cwd(), 'config', 'questionTemplates.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    questionTemplatesCache = data.templates || {};
    questionTemplatesCacheTime = now;
    return questionTemplatesCache ?? {};
  } catch {
    return {};
  }
}

/**
 * タグの質問文を取得（カスタムテンプレートがあればそれを使用）
 */
function getTagQuestionText(displayName: string): string {
  const templates = loadQuestionTemplates();
  if (templates[displayName]) {
    return templates[displayName];
  }
  return `この作品は「${displayName}」ですか？`;
}

/**
 * AI_GATEフィルタ適用（Spec §2.1）
 */
export function filterWorksByAiGate(
  works: Array<{ workId: string; isAi: string }>,
  aiGateChoice: AiGateChoice
): string[] {
  if (aiGateChoice === 'YES') {
    return works.filter(w => w.isAi === 'AI').map(w => w.workId);
  }
  if (aiGateChoice === 'NO') {
    return works.filter(w => w.isAi === 'HAND').map(w => w.workId);
  }
  // DONT_CARE: 全て許可
  return works.map(w => w.workId);
}

/**
 * 初期重み計算（AI_GATE後）
 */
export async function initializeWeights(
  allowedWorkIds: string[],
  alpha: number
): Promise<WorkWeight[]> {
  // productUrlは必須（Prisma schemaでnullableではない）
  const works = await prisma.work.findMany({
    where: {
      workId: { in: allowedWorkIds },
    },
  });

  // popularityPlayBonusを環境変数で無効化可能（デバッグ中は常に0として扱う）
  const usePlayBonus = process.env.DISABLE_POPULARITY_PLAY_BONUS !== '1';
  
  return works.map(w => ({
    workId: w.workId,
    weight: calculateBasePrior(
      w.popularityBase,
      usePlayBonus ? w.popularityPlayBonus : 0,
      alpha
    ),
  }));
}

/**
 * 質問生成（最小限の情報のみ返す）
 */
export interface QuestionData {
  kind: 'EXPLORE_TAG' | 'SOFT_CONFIRM' | 'HARD_CONFIRM';
  displayText: string;
  tagKey?: string;
  hardConfirmType?: 'TITLE_INITIAL' | 'AUTHOR';
  hardConfirmValue?: string;
}

/**
 * 次の質問を選択・生成
 */
export async function selectNextQuestion(
  weights: WorkWeight[],
  probabilities: WorkProbability[],
  questionCount: number,
  questionHistory: QuestionHistoryEntry[],
  config: MvpConfig
): Promise<QuestionData | null> {
  const confidence = calculateConfidence(probabilities);
  const effectiveCandidates = calculateEffectiveCandidates(probabilities);
  const effectiveConfirmThreshold = calculateEffectiveConfirmThreshold(
    weights.length,
    config.flow.effectiveConfirmThresholdParams.min,
    config.flow.effectiveConfirmThresholdParams.max,
    config.flow.effectiveConfirmThresholdParams.divisor
  );

  const qIndex = questionCount + 1; // 次の質問番号（1-based）

  // 使用済みタグを取得（SOFT_CONFIRMとEXPLORE_TAGの両方で使用）
  const usedTagKeys = new Set(
    questionHistory
      .filter(q => q.tagKey)
      .map(q => q.tagKey!)
  );

  // Confirm挿入判定
  const shouldConfirm = shouldInsertConfirm(
    qIndex,
    confidence,
    effectiveCandidates,
    {
      qForcedIndices: config.confirm.qForcedIndices,
      confidenceConfirmBand: config.confirm.confidenceConfirmBand,
      effectiveConfirmThreshold,
    }
  );

  if (shouldConfirm) {
    // SOFT_CONFIRM vs HARD_CONFIRM選択
    const usedHardTypes = questionHistory
      .filter(q => q.kind === 'HARD_CONFIRM')
      .map(q => q.hardConfirmType!)
      .filter((t): t is 'TITLE_INITIAL' | 'AUTHOR' => !!t);

    // SOFT_CONFIRM候補（DERIVEDタグ）を探す（使用済みタグを除外）
    // パフォーマンス最適化: 必要なフィールドのみ取得
    let derivedTags = await prisma.tag.findMany({
      where: {
        tagType: 'DERIVED',
        tagKey: { notIn: Array.from(usedTagKeys) },
      },
      select: {
        tagKey: true,
        displayName: true,
        workTags: {
          where: {
            workId: { in: weights.map(w => w.workId) },
            derivedConfidence: { gte: config.algo.derivedConfidenceThreshold },
          },
          select: {
            workId: true,
          },
        },
      },
    });

    // Prismaで0件の場合、直接SQLiteで取得（フォールバック）
    if (derivedTags.length === 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const sqlite3 = require('better-sqlite3');
        const path = require('path');
        const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
        const db = sqlite3(dbPath, { readonly: true });
        const workIds = weights.map(w => w.workId);
        const placeholders = workIds.map(() => '?').join(',');
        
        // DERIVEDタグを取得（使用済みタグを除外）
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const directTags = db.prepare(`
          SELECT 
            t.tagKey,
            t.displayName
          FROM Tag t
          WHERE t.tagType = 'DERIVED'
            AND t.tagKey NOT IN (${Array.from(usedTagKeys).map(() => '?').join(',')})
        `).all(...Array.from(usedTagKeys)) as Array<{
          tagKey: string;
          displayName: string;
        }>;
        
        // 各タグのworkTagsを取得
        derivedTags = directTags.map(tag => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          const workTags = db.prepare(`
            SELECT workId
            FROM WorkTag
            WHERE tagKey = ?
              AND workId IN (${placeholders})
              AND derivedConfidence >= ?
          `).all(tag.tagKey, ...workIds, config.algo.derivedConfidenceThreshold) as Array<{
            workId: string;
          }>;
          
          return {
            tagKey: tag.tagKey,
            displayName: tag.displayName,
            workTags,
          };
        });
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        db.close();
        console.log(`[selectNextQuestion] Direct SQLite query found ${derivedTags.length} DERIVED tags`);
      } catch (directError) {
        console.error('[selectNextQuestion] Error in direct SQLite fallback:', directError);
        // フォールバックも失敗した場合は空配列のまま続行
      }
    }

    const hasSoftConfirmData = derivedTags.some(tag => tag.workTags.length > 0);

    const confirmType = selectConfirmType(confidence, hasSoftConfirmData, {
      softConfidenceMin: config.confirm.softConfidenceMin,
      hardConfidenceMin: config.confirm.hardConfidenceMin,
    });

    if (confirmType === 'SOFT_CONFIRM' && derivedTags.length > 0) {
      // SOFT_CONFIRM: p値フィルタ付き
      // p値が10%以上90%以下のタグがある場合のみSOFT_CONFIRMを使用
      // それ以外はEXPLORE_TAGにフォールバック
      
      const probabilities = normalizeWeights(weights);
      const probMap = new Map(probabilities.map(p => [p.workId, p.probability]));
      
      // 各タグについてp値を計算
      const tagScores = derivedTags
        .filter(tag => tag.workTags.length > 0) // workTagsがあるタグのみ
        .map(tag => {
          // 確率ベースのカバレッジ（p値）
          const p = tag.workTags.reduce((sum, wt) => {
            return sum + (probMap.get(wt.workId) || 0);
          }, 0);
          return {
            tag,
            p,
            distanceFromHalf: Math.abs(p - 0.5),
          };
        });
      
      // p値が10%〜90%のタグをフィルタ（極端なものを除外）
      const usableTags = tagScores.filter(t => t.p >= 0.1 && t.p <= 0.9);
      
      if (usableTags.length > 0) {
        // 0.5に最も近いタグを選ぶ
        usableTags.sort((a, b) => {
          if (a.distanceFromHalf !== b.distanceFromHalf) {
            return a.distanceFromHalf - b.distanceFromHalf;
          }
          return a.tag.tagKey.localeCompare(b.tag.tagKey);
        });
        const selectedTag = usableTags[0];
        console.log(`[SOFT_CONFIRM] p値フィルタ: ${selectedTag.tag.displayName} (p: ${(selectedTag.p * 100).toFixed(1)}%)`);
        
        const displayText = getTagQuestionText(selectedTag.tag.displayName);
        return {
          kind: 'SOFT_CONFIRM',
          displayText,
          tagKey: selectedTag.tag.tagKey,
        };
      } else {
        // p値が極端なタグしかない → EXPLORE_TAGにフォールバック
        console.log(`[SOFT_CONFIRM] p値が極端なタグしかないため、EXPLORE_TAGにフォールバック`);
        return await selectExploreQuestion(weights, probabilities, questionHistory, config);
      }
    }
    
    // SOFT_CONFIRMのタグがない、またはHARD_CONFIRMの場合
    if (confirmType === 'HARD_CONFIRM' || derivedTags.length === 0) {
      // HARD_CONFIRM: 「当てに行く」スタイル
      // - top1の作品の頭文字/作者名を直接質問
      // - 2連続で発生しない（直前がHARD_CONFIRMならスキップ）
      // - 同じ値は使用済みなら除外
      
      // 直前がHARD_CONFIRMなら、EXPLORE_TAGにフォールバック（2連続防止）
      const lastQuestion = questionHistory[questionHistory.length - 1];
      if (lastQuestion?.kind === 'HARD_CONFIRM') {
        console.log(`[HARD_CONFIRM] 2連続防止: 直前がHARD_CONFIRMのため、EXPLORE_TAGにフォールバック`);
        return await selectExploreQuestion(weights, probabilities, questionHistory, config);
      }

      // 使用済みの値を取得
      const usedTitleInitials = new Set(
        questionHistory
          .filter(q => q.kind === 'HARD_CONFIRM' && q.hardConfirmType === 'TITLE_INITIAL')
          .map(q => q.hardConfirmValue!)
          .filter(v => v)
      );
      const usedAuthors = new Set(
        questionHistory
          .filter(q => q.kind === 'HARD_CONFIRM' && q.hardConfirmType === 'AUTHOR')
          .map(q => q.hardConfirmValue!)
          .filter(v => v)
      );

      // top1の作品を取得（ブロック内で別名を使用し、パラメータ probabilities の TDZ を避ける）
      const probsForTop1 = normalizeWeights(weights);
      const sortedByProb = [...probsForTop1].sort((a, b) => b.probability - a.probability);
      const top1WorkId = sortedByProb[0]?.workId;
      
      if (!top1WorkId) {
        return await selectExploreQuestion(weights, probsForTop1, questionHistory, config);
      }
      
      // top1の作品情報を取得
      const top1Work = await prisma.work.findUnique({
        where: { workId: top1WorkId },
        select: {
          workId: true,
          title: true,
          authorName: true,
        },
      });
      
      if (!top1Work) {
        return await selectExploreQuestion(weights, probsForTop1, questionHistory, config);
      }
      
      const top1Initial = normalizeTitleForInitial(top1Work.title ?? '');
      const top1Author = top1Work.authorName ?? '(不明)';
      
      // top1の頭文字が使用済みでなければTITLE_INITIAL
      if (!usedTitleInitials.has(top1Initial)) {
        console.log(`[HARD_CONFIRM] 当てに行く: TITLE_INITIAL "${top1Initial}" (top1: ${top1Work.title})`);
        
        return {
          kind: 'HARD_CONFIRM',
          displayText: `タイトルは「${top1Initial}」から始まりますか？`,
          hardConfirmType: 'TITLE_INITIAL',
          hardConfirmValue: top1Initial,
        };
      }
      
      // top1の作者名が使用済みでなければAUTHOR
      if (!usedAuthors.has(top1Author)) {
        console.log(`[HARD_CONFIRM] 当てに行く: AUTHOR "${top1Author}" (top1: ${top1Work.title})`);
        
        return {
          kind: 'HARD_CONFIRM',
          displayText: `作者（サークル）は「${top1Author}」ですか？`,
          hardConfirmType: 'AUTHOR',
          hardConfirmValue: top1Author,
        };
      }
      
      // top1の頭文字も作者名も使用済み → EXPLORE_TAGにフォールバック
      console.log(`[HARD_CONFIRM] top1の頭文字・作者名は使用済み、EXPLORE_TAGにフォールバック`);
      return await selectExploreQuestion(weights, probsForTop1, questionHistory, config);
    }
  }

  // EXPLORE_TAG
  return await selectExploreQuestion(weights, probabilities, questionHistory, config);
}

/**
 * EXPLORE_TAG質問選択
 */
async function selectExploreQuestion(
  weights: WorkWeight[],
  probabilities: WorkProbability[],
  questionHistory: QuestionHistoryEntry[],
  config: MvpConfig
): Promise<QuestionData | null> {
  // 使用済みタグを除外（selectNextQuestionから渡される想定だが、念のため再計算）
  const usedTagKeys = new Set(
    questionHistory
      .filter(q => q.tagKey)
      .map(q => q.tagKey!)
  );
  
  // デバッグ: 使用済みタグを表示
  console.log(`[selectExploreQuestion] usedTagKeys (${usedTagKeys.size}): ${Array.from(usedTagKeys).slice(0, 10).join(', ')}${usedTagKeys.size > 10 ? '...' : ''}`);

  // パフォーマンス最適化: WorkTagsを先に取得して、カバレッジゲートを通過するタグのみを取得
  const workIds = weights.map(w => w.workId);
  const totalWorks = weights.length;

  // まず、WorkTagsを取得してタグごとの作品数を集計
  const workTags = await prisma.workTag.findMany({
    where: {
      workId: { in: workIds },
    },
    select: {
      tagKey: true,
      workId: true,
    },
  });

  // タグごとの作品数を集計
  const tagWorkCountMap = new Map<string, number>();
  for (const wt of workTags) {
    tagWorkCountMap.set(wt.tagKey, (tagWorkCountMap.get(wt.tagKey) || 0) + 1);
  }

  // カバレッジゲートを通過するタグのみをフィルタ
  // 下限: タグを持つ作品が少なすぎるタグを除外
  // 上限: 全員が持っているタグを除外（確度が変わらないため）
  const passingTagKeys: string[] = [];
  for (const [tagKey, workCount] of tagWorkCountMap.entries()) {
    if (!usedTagKeys.has(tagKey) && passesCoverageGate(
      workCount,
      totalWorks,
      config.dataQuality.minCoverageMode,
      config.dataQuality.minCoverageRatio,
      config.dataQuality.minCoverageWorks,
      config.dataQuality.maxCoverageRatio ?? null // 上限（未設定の場合はチェックなし）
    )) {
      passingTagKeys.push(tagKey);
    }
  }

  // デバッグ: passingTagKeysの数を表示
  console.log(`[selectExploreQuestion] passingTagKeys: ${passingTagKeys.length} tags available`);
  
  if (passingTagKeys.length === 0) {
    console.log(`[selectExploreQuestion] No tags available, returning null`);
    return null;
  }

  // カバレッジゲートを通過したタグのみを取得
  let allTags = await prisma.tag.findMany({
    where: {
      tagKey: { in: passingTagKeys },
      tagType: { in: ['OFFICIAL', 'DERIVED'] },
    },
    select: {
      tagKey: true,
      displayName: true,
      tagType: true,
    },
  });

  // Prismaで0件の場合、直接SQLiteで取得（フォールバック）
  if (allTags.length === 0 && passingTagKeys.length > 0) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sqlite3 = require('better-sqlite3');
      const path = require('path');
      const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
      const db = sqlite3(dbPath, { readonly: true });
      const placeholders = passingTagKeys.map(() => '?').join(',');
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      allTags = db.prepare(`
        SELECT tagKey, displayName, tagType
        FROM Tag
        WHERE tagKey IN (${placeholders})
          AND tagType IN ('OFFICIAL', 'DERIVED')
      `).all(...passingTagKeys) as Array<{
        tagKey: string;
        displayName: string;
        tagType: string;
      }>;
      
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      db.close();
      console.log(`[selectExploreQuestion] Direct SQLite query found ${allTags.length} tags`);
    } catch (directError) {
      console.error('[selectExploreQuestion] Error in direct SQLite fallback:', directError);
      // フォールバックも失敗した場合は空配列のまま続行
    }
  }

  const availableTags: TagInfo[] = [];
  for (const tag of allTags) {
    // 使用済みタグを再度チェック（安全策）
    if (usedTagKeys.has(tag.tagKey)) {
      console.log(`[selectExploreQuestion] WARNING: tag "${tag.tagKey}" was in allTags but should be excluded`);
      continue;
    }
    const workCount = tagWorkCountMap.get(tag.tagKey) || 0;
    availableTags.push({
      tagKey: tag.tagKey,
      displayName: tag.displayName,
      tagType: tag.tagType as 'OFFICIAL' | 'DERIVED' | 'STRUCTURAL',
      workCount,
    });
  }

  console.log(`[selectExploreQuestion] availableTags: ${availableTags.length} (after filtering used tags)`);

  if (availableTags.length === 0) {
    console.log(`[selectExploreQuestion] No available tags after filtering`);
    return null;
  }

  // workHasTag関数（既に取得済みのworkTagsを使用）
  const workTagMap = new Map<string, Set<string>>();
  for (const wt of workTags) {
    if (passingTagKeys.includes(wt.tagKey)) {
      if (!workTagMap.has(wt.workId)) {
        workTagMap.set(wt.workId, new Set());
      }
      workTagMap.get(wt.workId)!.add(wt.tagKey);
    }
  }

  const workHasTag = (workId: string, tagKey: string): boolean => {
    const tags = workTagMap.get(workId);
    if (!tags) return false;
    return tags.has(tagKey);
  };

  // 確度とtop1を計算（後半モード用）
  const sorted = [...probabilities].sort((a, b) => {
    if (a.probability !== b.probability) {
      return b.probability - a.probability;
    }
    return a.workId.localeCompare(b.workId);
  });
  const confidence = sorted[0]?.probability ?? 0;
  const topWorkId = sorted[0]?.workId ?? null;

  const selectedTagKey = selectExploreTag(
    availableTags,
    probabilities,
    workHasTag,
    confidence, // 確度を渡す
    topWorkId   // top1のworkIdを渡す
  );
  if (!selectedTagKey) {
    return null;
  }

  const selectedTag = allTags.find(t => t.tagKey === selectedTagKey);
  if (!selectedTag) {
    return null;
  }

  const displayText = getTagQuestionText(selectedTag.displayName);

  return {
    kind: 'EXPLORE_TAG',
    displayText,
    tagKey: selectedTagKey,
  };
}

/**
 * 回答による重み更新
 */
export async function processAnswer(
  weights: WorkWeight[],
  question: QuestionData,
  answerChoice: string,
  config: MvpConfig
): Promise<WorkWeight[]> {
  const strengthMap: Record<string, number> = {
    YES: 1.0,
    PROBABLY_YES: 0.6,
    UNKNOWN: 0,
    PROBABLY_NO: -0.6,
    NO: -1.0,
    DONT_CARE: 0,
  };

  const strength = strengthMap[answerChoice] ?? 0;

  if (question.kind === 'EXPLORE_TAG' || question.kind === 'SOFT_CONFIRM') {
    // Tag-based質問
    const tagKey = question.tagKey!;
    
    // WorkTagsを取得
    // パフォーマンス最適化: 必要なフィールドのみ取得
    const workTags = await prisma.workTag.findMany({
      where: {
        workId: { in: weights.map(w => w.workId) },
        tagKey,
      },
      select: {
        workId: true,
        derivedConfidence: true,
      },
    });

    const workTagMap = new Map<string, number | null>();
    for (const wt of workTags) {
      workTagMap.set(wt.workId, wt.derivedConfidence);
    }

    const workHasFeature = (workId: string): boolean => {
      const derivedConf = workTagMap.get(workId);
      if (question.kind === 'SOFT_CONFIRM') {
        // SOFT_CONFIRM: DERIVEDタグのみ（derivedConfidence >= threshold）
        return hasDerivedFeature(derivedConf, config.algo.derivedConfidenceThreshold);
      } else {
        // EXPLORE_TAG:
        // - WorkTag行が存在しない (undefined) → タグ無し → false
        // - OFFICIALタグなど derivedConfidence=null → タグが付いているので feature=true
        // - DERIVEDタグ (number) → threshold で二値化
        if (derivedConf === undefined) {
          // WorkTag自体が無い
          return false;
        }
        if (derivedConf === null) {
          // OFFICIALタグなど: 「タグが付いている」ので true 扱い
          return true;
        }
        // DERIVEDタグ: thresholdで二値化
        return hasDerivedFeature(derivedConf, config.algo.derivedConfidenceThreshold);
      }
    };

    return updateWeightsForTagQuestion(
      weights,
      workHasFeature,
      strength as -1.0 | -0.6 | 0 | 0.6 | 1.0,
      config.algo.beta
    );
  } else {
    // HARD_CONFIRM
    // 質問のhardConfirmValueから判定（top1は質問生成時に確定済み）
    const expectedValue = question.hardConfirmValue!;
    const hardConfirmType = question.hardConfirmType!;

    // 全Workを取得して判定
    const workIds = weights.map(w => w.workId);
    const works = await prisma.work.findMany({
      where: { workId: { in: workIds } },
    });

    const workMap = new Map(works.map(w => [w.workId, w]));

    let workHasFeature: (workId: string) => boolean;
    if (hardConfirmType === 'TITLE_INITIAL') {
      workHasFeature = (workId: string) => {
        const work = workMap.get(workId);
        if (!work) return false;
        const initial = normalizeTitleForInitial(work.title ?? '');
        return initial === expectedValue;
      };
    } else {
      // AUTHOR
      workHasFeature = (workId: string) => {
        const work = workMap.get(workId);
        if (!work) return false;
        return (work.authorName ?? '') === expectedValue;
      };
    }

    return updateWeightsForTagQuestion(
      weights,
      workHasFeature,
      strength as -1.0 | -0.6 | 0 | 0.6 | 1.0,
      config.algo.beta
    );
  }
}
