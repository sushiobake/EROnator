/**
 * DBインポート処理（importBatch.cjsのロジックをAPI化）
 * 作品データとタグをDBにインポートする
 */

import { prisma } from '@/server/db/client';
import crypto from 'crypto';

/**
 * SHA1ハッシュの先頭10桁を取得
 */
function getHash10(text: string): string {
  return crypto.createHash('sha1').update(text, 'utf8').digest('hex').substring(0, 10);
}

/**
 * tagKey を決定論的に生成
 */
function generateTagKey(displayName: string, tagType: string): string {
  const hash10 = getHash10(displayName);
  if (tagType === 'DERIVED') {
    return `tag_${hash10}`;
  } else if (tagType === 'STRUCTURAL') {
    return `char_${hash10}`;
  } else {
    return `off_${hash10}`;
  }
}

/**
 * OFFICIALタグ除外判定
 */
function shouldExcludeOfficialTag(displayName: string): boolean {
  const trimmed = displayName.trim();
  
  const exactMatches = ['新作', '準新作', '旧作', 'イチオシ'];
  if (exactMatches.includes(trimmed)) {
    return true;
  }
  
  const regexPatterns = [
    /^コミケ\d+/,
    /^コミックマーケット/,
    /^J\.?GARDEN\d*/i,
    /^YOU\d+/,
    /赤ブー/,
    /博麗神社例大祭/,
    /^コミティア/i,
    /^エアコミケ/i,
  ];
  
  for (const pattern of regexPatterns) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  
  return false;
}

/**
 * OFFICIALタグをフィルタリング
 */
function filterOfficialTags(officialTags: string[]): { kept: string[]; dropped: string[] } {
  const kept: string[] = [];
  const dropped: string[] = [];
  
  for (const tag of officialTags || []) {
    if (shouldExcludeOfficialTag(tag)) {
      dropped.push(tag);
    } else {
      kept.push(tag);
    }
  }
  
  return { kept, dropped };
}

/**
 * OFFICIALとの重複判定用 正規化
 */
function normalizeForOverlap(s: string | null | undefined): string {
  return String(s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[・･\-‐‑–—―_~〜～:：;；,，.．/／\\|｜()（）\[\]【】{}｛｝"'""''!?！？]+/g, '')
    .trim();
}

/**
 * derivedDisplayName が OFFICIAL と「同一/包含」していれば true
 */
function isOverlappingWithOfficial(derivedDisplayName: string, officialNormList: string[]): boolean {
  const d = normalizeForOverlap(derivedDisplayName);
  if (!d) return false;
  if (d.length <= 1) return true;

  for (const o of officialNormList) {
    if (!o) continue;
    if (o.length <= 1) {
      if (d === o) return true;
      continue;
    }
    if (d === o) return true;
    if (d.includes(o)) return true;
    if (o.includes(d)) return true;
  }
  return false;
}

export interface ImportWorkData {
  workId: string;
  cid: string | null;
  title: string;
  circleName: string;
  productUrl: string;
  thumbnailUrl: string | null;
  reviewAverage: number | null;
  reviewCount: number | null;
  isAi: 'AI' | 'HAND' | 'UNKNOWN';
  scrapedAt: string;
  officialTags: string[];
  derivedTags: Array<{
    displayName: string;
    confidence: number;
    category: string | null;
  }>;
  characterTags: string[];
  metaText?: string;
  commentText?: string;
}

export interface ImportResult {
  success: boolean;
  stats: {
    worksProcessed: number;
    worksCreated: number;
    worksUpdated: number;
    tagsCreated: number;
    tagsSkipped: number;
    workTagsCreated: number;
    workTagsSkipped: number;
  };
  errors: string[];
}

/**
 * 作品データをDBにインポート
 */
export async function importWorksToDb(works: ImportWorkData[]): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    stats: {
      worksProcessed: 0,
      worksCreated: 0,
      worksUpdated: 0,
      tagsCreated: 0,
      tagsSkipped: 0,
      workTagsCreated: 0,
      workTagsSkipped: 0,
    },
    errors: [],
  };

  // 既存のOFFICIAL一覧（グローバル）を読み込む
  const existingOfficialTags = await prisma.tag.findMany({
    where: { tagType: 'OFFICIAL' },
    select: { displayName: true },
  });
  const officialNormListGlobal = Array.from(
    new Set(
      existingOfficialTags
        .map((t) => normalizeForOverlap(t.displayName))
        .filter(Boolean)
    )
  );

  try {
    await prisma.$transaction(async (tx) => {
      for (const workData of works) {
        result.stats.worksProcessed++;

        try {
          // Work の既存優先マージ
          const existingWork = await tx.work.findUnique({
            where: { workId: workData.workId },
            include: {
              workTags: {
                include: {
                  tag: true,
                },
              },
            },
          });

          const sourcePayload: any = existingWork?.sourcePayload
            ? JSON.parse(existingWork.sourcePayload)
            : {};

          // metaText, commentText を sourcePayload に保存
          if (workData.metaText) {
            sourcePayload.metaText = workData.metaText;
          }
          if (workData.commentText) {
            sourcePayload.commentText = workData.commentText;
          }

          const workDataToUpsert = {
            workId: workData.workId,
            title: existingWork?.title || workData.title,
            authorName: existingWork?.authorName || workData.circleName,
            isAi: existingWork?.isAi || workData.isAi,
            popularityBase: existingWork?.popularityBase ?? 0,
            popularityPlayBonus: existingWork?.popularityPlayBonus ?? 0,
            reviewCount: existingWork?.reviewCount ?? workData.reviewCount,
            reviewAverage: existingWork?.reviewAverage ?? workData.reviewAverage,
            productUrl: existingWork?.productUrl || workData.productUrl,
            thumbnailUrl: existingWork?.thumbnailUrl ?? workData.thumbnailUrl,
            sourcePayload: JSON.stringify(sourcePayload),
          };

          const work = await tx.work.upsert({
            where: { workId: workData.workId },
            create: workDataToUpsert,
            update: workDataToUpsert,
          });

          if (existingWork) {
            result.stats.worksUpdated++;
          } else {
            result.stats.worksCreated++;
          }

          // OFFICIAL タグのフィルタリング
          const { kept: keptOfficialTags } = filterOfficialTags(workData.officialTags);

          // OFFICIAL タグ処理
          for (const displayName of keptOfficialTags) {
            let tag = await tx.tag.findFirst({
              where: { displayName },
            });

            if (!tag) {
              const tagKey = generateTagKey(displayName, 'OFFICIAL');
              tag = await tx.tag.create({
                data: {
                  tagKey,
                  displayName,
                  tagType: 'OFFICIAL',
                  category: null,
                },
              });
              result.stats.tagsCreated++;
            } else {
              result.stats.tagsSkipped++;
            }

            const existingWorkTag = await tx.workTag.findUnique({
              where: {
                workId_tagKey: {
                  workId: work.workId,
                  tagKey: tag.tagKey,
                },
              },
            });

            if (!existingWorkTag) {
              await tx.workTag.create({
                data: {
                  workId: work.workId,
                  tagKey: tag.tagKey,
                  derivedConfidence: null,
                },
              });
              result.stats.workTagsCreated++;
            } else {
              result.stats.workTagsSkipped++;
            }
          }

          // DERIVED タグ処理
          const derivedCandidatesSorted = (workData.derivedTags || [])
            .filter((t) => t && t.displayName && typeof t.confidence === 'number' && !Number.isNaN(t.confidence))
            .sort((a, b) => b.confidence - a.confidence);

          // OFFICIALとの重複チェック
          const officialNormListForWork = Array.from(
            new Set([
              ...officialNormListGlobal,
              ...keptOfficialTags.map((t) => normalizeForOverlap(t)).filter(Boolean),
            ])
          );

          const derivedAfterOverlap = derivedCandidatesSorted.filter((t) => {
            return !isOverlappingWithOfficial(t.displayName, officialNormListForWork);
          });

          const MAX_DERIVED = 5;
          const derivedTagsLimited = derivedAfterOverlap.slice(0, MAX_DERIVED);

          for (const derivedTagData of derivedTagsLimited) {
            const tagKey = generateTagKey(derivedTagData.displayName, 'DERIVED');

            let existingTag = await tx.tag.findFirst({
              where: { displayName: derivedTagData.displayName },
            });

            if (!existingTag) {
              existingTag = await tx.tag.create({
                data: {
                  tagKey,
                  displayName: derivedTagData.displayName,
                  tagType: 'DERIVED',
                  category: derivedTagData.category ?? null,
                },
              });
              result.stats.tagsCreated++;
            } else {
              result.stats.tagsSkipped++;
            }

            try {
              await tx.workTag.create({
                data: {
                  workId: work.workId,
                  tagKey: existingTag.tagKey,
                  derivedConfidence: derivedTagData.confidence,
                },
              });
              result.stats.workTagsCreated++;
            } catch (e) {
              // unique constraint: already exists
              await tx.workTag.update({
                where: {
                  workId_tagKey: { workId: work.workId, tagKey: existingTag.tagKey },
                },
                data: {
                  derivedConfidence: derivedTagData.confidence,
                },
              });
              result.stats.workTagsSkipped++;
            }
          }

          // CHARACTER タグ処理
          for (const displayName of workData.characterTags || []) {
            let tag = await tx.tag.findFirst({
              where: { displayName },
            });

            if (!tag) {
              const tagKey = generateTagKey(displayName, 'STRUCTURAL');
              tag = await tx.tag.create({
                data: {
                  tagKey,
                  displayName,
                  tagType: 'STRUCTURAL',
                  category: 'CHARACTER',
                },
              });
              result.stats.tagsCreated++;
            } else {
              result.stats.tagsSkipped++;
            }

            const existingWorkTag = await tx.workTag.findUnique({
              where: {
                workId_tagKey: {
                  workId: work.workId,
                  tagKey: tag.tagKey,
                },
              },
            });

            if (!existingWorkTag) {
              await tx.workTag.create({
                data: {
                  workId: work.workId,
                  tagKey: tag.tagKey,
                  derivedConfidence: null,
                },
              });
              result.stats.workTagsCreated++;
            } else {
              result.stats.workTagsSkipped++;
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Work ${workData.workId}: ${errorMsg}`);
          console.error(`Error importing work ${workData.workId}:`, error);
        }
      }
    });
  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    console.error('Error in import transaction:', error);
  }

  return result;
}
