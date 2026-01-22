/**
 * DTO変換関数（Data exposure policy遵守）
 * DBレコードから表示に必要な最小限の情報のみを抽出
 */

import type { Work, Tag } from '@prisma/client';
import type { WorkResponse, TagResponse, QuestionResponse } from './types';
import type { QuestionHistoryEntry } from '@/server/session/manager';
import { isAllowedThumbnailHost } from '@/server/utils/allowedHosts';
import { prisma } from '@/server/db/client';

/**
 * Work → WorkResponse変換
 * 表示に必要な最小限の情報のみ返す
 */
export function toWorkResponse(work: Work): WorkResponse {
  return {
    workId: work.workId,
    title: work.title,
    authorName: work.authorName,
    productUrl: work.productUrl, // 必須（Spec §2.1）
    thumbnailUrl: isAllowedThumbnailHost(work.thumbnailUrl)
      ? work.thumbnailUrl
      : null, // 許可ホスト判定後のみ返す
    // 以下は返さない（Data exposure policy）:
    // - popularityBase, popularityPlayBonus
    // - reviewCount, reviewAverage
    // - sourcePayload
    // - isAi（AI_GATE後は不要）
  };
}

/**
 * Tag → TagResponse変換
 * 表示に必要な最小限の情報のみ返す
 */
export function toTagResponse(tag: Tag): TagResponse {
  return {
    tagKey: tag.tagKey,
    displayName: tag.displayName,
    // 以下は返さない（Data exposure policy）:
    // - tagType, category
    // - 辞書データ全量
  };
}

/**
 * QuestionHistoryEntry → QuestionResponse変換
 * 質問履歴から質問レスポンスを生成
 */
export async function toQuestionResponse(
  entry: QuestionHistoryEntry
): Promise<QuestionResponse> {
  if (entry.kind === 'HARD_CONFIRM') {
    return {
      kind: entry.kind,
      displayText: entry.hardConfirmType === 'TITLE_INITIAL'
        ? `タイトルは「${entry.hardConfirmValue}」から始まりますか？`
        : `作者（サークル）は「${entry.hardConfirmValue}」ですか？`,
      hardConfirmType: entry.hardConfirmType,
      hardConfirmValue: entry.hardConfirmValue,
    };
  } else {
    // EXPLORE_TAG or SOFT_CONFIRM
    if (!entry.tagKey) {
      throw new Error('tagKey is required for EXPLORE_TAG or SOFT_CONFIRM');
    }
    const tag = await prisma.tag.findUnique({
      where: { tagKey: entry.tagKey },
    });
    if (!tag) {
      throw new Error(`Tag not found: ${entry.tagKey}`);
    }
    return {
      kind: entry.kind,
      displayText: `この作品は「${tag.displayName}」ですか？`,
      tagKey: entry.tagKey,
    };
  }
}
