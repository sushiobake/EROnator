/**
 * ローカル Postgres → Supabase 同期
 * Postgres をメインで使っている場合に使用。
 *
 * 使い方: npm run sync:supabase -- --source=postgres
 * 環境変数:
 *   SOURCE_DATABASE_URL: ソース Postgres（省略時: postgresql://postgres:localdev@localhost:5432/eronator）
 *   .env.supabase の DATABASE_URL: ターゲット Supabase
 */

import * as path from 'path';
import * as fs from 'fs';

const LAST_SYNC_FILE = path.join(process.cwd(), 'data', 'last-sync.json');

const SOURCE_DEFAULT = 'postgresql://postgres:localdev@localhost:5432/eronator';

function loadLastSyncAt(): string | null {
  try {
    if (fs.existsSync(LAST_SYNC_FILE)) {
      const data = JSON.parse(fs.readFileSync(LAST_SYNC_FILE, 'utf-8'));
      return data.lastSyncAt ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}

function saveLastSyncAt(): void {
  const dataDir = path.dirname(LAST_SYNC_FILE);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  fs.writeFileSync(LAST_SYNC_FILE, JSON.stringify({ lastSyncAt: ts }, null, 2), 'utf-8');
}

async function main() {
  const forceFull = process.argv.includes('--full');
  const sourceUrl = process.env.SOURCE_DATABASE_URL ?? SOURCE_DEFAULT;
  const targetUrl = process.env.DATABASE_URL ?? '';

  if (!targetUrl.startsWith('postgresql://') && !targetUrl.startsWith('postgres://')) {
    console.error('❌ DATABASE_URL（Supabase）が設定されていません。.env.supabase を読み込んでください。');
    process.exit(1);
  }

  const { PrismaClient } = await import('@prisma/client');
  const prismaSource = new PrismaClient({
    datasources: { db: { url: sourceUrl } },
  });
  const prismaTarget = new PrismaClient({
    datasources: { db: { url: targetUrl } },
  });

  const lastSyncAt = forceFull ? null : loadLastSyncAt();
  const isIncremental = lastSyncAt != null;
  if (isIncremental) {
    console.log(`📖 差分同期（前回: ${lastSyncAt}）`);
  } else {
    console.log('📖 全件同期');
  }

  const workWhere = {
    gameRegistered: true,
    needsReview: false,
    ...(lastSyncAt ? { updatedAt: { gt: new Date(lastSyncAt) } } : {}),
  };

  const works = await prismaSource.work.findMany({
    where: workWhere,
  });

  if (works.length === 0) {
    if (isIncremental) {
      console.log('✅ 変更なし。スキップします。');
      saveLastSyncAt();
    } else {
      console.log('⚠️  ゲーム登録済みの作品が 0 件です。終了します。');
    }
    await prismaSource.$disconnect();
    await prismaTarget.$disconnect();
    process.exit(0);
  }

  const workIds = works.map((w) => w.workId);

  // 差分の場合は対象 workIds の WorkTag のみ。全件の場合は全 workIds の WorkTag
  const workTags = await prismaSource.workTag.findMany({
    where: { workId: { in: workIds } },
  });

  const tagKeys = [...new Set(workTags.map((wt) => wt.tagKey))];
  const tags = await prismaSource.tag.findMany({
    where: { tagKey: { in: tagKeys } },
  });

  console.log(
    `   Works: ${works.length} 件, Tags: ${tags.length} 件, WorkTags: ${workTags.length} 件${isIncremental ? '（差分）' : ''}`
  );

  const TAG_BATCH_SIZE = 100;
  const WORK_BATCH_SIZE = 100;
  const WORKTAG_BATCH_SIZE = 1000;

  try {
    console.log('📥 Supabase に投入中...');

    for (let i = 0; i < tags.length; i += TAG_BATCH_SIZE) {
      const batch = tags.slice(i, i + TAG_BATCH_SIZE);
      await prismaTarget.$transaction(
        batch.map((t) =>
          prismaTarget.tag.upsert({
            where: { tagKey: t.tagKey },
            create: {
              tagKey: t.tagKey,
              displayName: t.displayName,
              tagType: t.tagType,
              category: t.category,
              questionText: t.questionText,
            },
            update: {
              displayName: t.displayName,
              tagType: t.tagType,
              category: t.category,
              questionText: t.questionText,
            },
          })
        )
      );
      if (tags.length > TAG_BATCH_SIZE) {
        console.log(`   Tag: ${Math.min(i + TAG_BATCH_SIZE, tags.length)} / ${tags.length} 件`);
      }
    }
    console.log(`   ✅ Tag: ${tags.length} 件`);

    for (let i = 0; i < works.length; i += WORK_BATCH_SIZE) {
      const batch = works.slice(i, i + WORK_BATCH_SIZE);
      await prismaTarget.$transaction(
        batch.map((w) =>
          prismaTarget.work.upsert({
            where: { workId: w.workId },
            create: {
              workId: w.workId,
              title: w.title,
              authorName: w.authorName,
              isAi: w.isAi,
              popularityBase: w.popularityBase ?? 0,
              popularityPlayBonus: w.popularityPlayBonus ?? 0,
              reviewCount: w.reviewCount,
              reviewAverage: w.reviewAverage,
              productUrl: w.productUrl,
              affiliateUrl: w.affiliateUrl,
              thumbnailUrl: w.thumbnailUrl,
              sourcePayload: w.sourcePayload ?? '{}',
              contentId: w.contentId,
              releaseDate: w.releaseDate,
              pageCount: w.pageCount,
              seriesInfo: w.seriesInfo,
              commentText: w.commentText,
              gameRegistered: w.gameRegistered ?? true,
              needsReview: w.needsReview ?? false,
              tagSource: w.tagSource,
              aiAnalyzed: w.aiAnalyzed,
              humanChecked: w.humanChecked,
            },
            update: {
              title: w.title,
              authorName: w.authorName,
              isAi: w.isAi,
              popularityBase: w.popularityBase ?? 0,
              popularityPlayBonus: w.popularityPlayBonus ?? 0,
              reviewCount: w.reviewCount,
              reviewAverage: w.reviewAverage,
              productUrl: w.productUrl,
              affiliateUrl: w.affiliateUrl,
              thumbnailUrl: w.thumbnailUrl,
              sourcePayload: w.sourcePayload ?? '{}',
              contentId: w.contentId,
              releaseDate: w.releaseDate,
              pageCount: w.pageCount,
              seriesInfo: w.seriesInfo,
              commentText: w.commentText,
              gameRegistered: w.gameRegistered ?? true,
              needsReview: w.needsReview ?? false,
              tagSource: w.tagSource,
              aiAnalyzed: w.aiAnalyzed,
              humanChecked: w.humanChecked,
            },
          })
        )
      );
      if (works.length > WORK_BATCH_SIZE) {
        console.log(`   Work: ${Math.min(i + WORK_BATCH_SIZE, works.length)} / ${works.length} 件`);
      }
    }
    console.log(`   ✅ Work: ${works.length} 件`);

    for (let i = 0; i < workTags.length; i += WORKTAG_BATCH_SIZE) {
      const batch = workTags.slice(i, i + WORKTAG_BATCH_SIZE);
      await prismaTarget.$transaction(
        batch.map((wt) =>
          prismaTarget.workTag.upsert({
            where: {
              workId_tagKey: { workId: wt.workId, tagKey: wt.tagKey },
            },
            create: {
              workId: wt.workId,
              tagKey: wt.tagKey,
              derivedSource: wt.derivedSource,
              derivedConfidence: wt.derivedConfidence,
            },
            update: {
              derivedSource: wt.derivedSource,
              derivedConfidence: wt.derivedConfidence,
            },
          })
        )
      );
      console.log(`   WorkTag: ${Math.min(i + WORKTAG_BATCH_SIZE, workTags.length)} / ${workTags.length} 件`);
    }
    console.log(`   ✅ WorkTag: ${workTags.length} 件`);

    if (forceFull) {
      const allSourceWorkIds = await prismaSource.work.findMany({
        where: { gameRegistered: true, needsReview: false },
        select: { workId: true },
      });
      const sourceIdSet = new Set(allSourceWorkIds.map((r) => r.workId));
      const supabaseWorks = await prismaTarget.work.findMany({
        where: { gameRegistered: true },
        select: { workId: true },
      });
      const toDelete = supabaseWorks.filter((w) => !sourceIdSet.has(w.workId)).map((w) => w.workId);
      if (toDelete.length > 0) {
        console.log(`   🗑️  Supabase から削除: ${toDelete.length} 件（ソースに存在しない Work）`);
        for (let i = 0; i < toDelete.length; i += WORK_BATCH_SIZE) {
          const batch = toDelete.slice(i, i + WORK_BATCH_SIZE);
          await prismaTarget.workTag.deleteMany({ where: { workId: { in: batch } } });
          await prismaTarget.work.deleteMany({ where: { workId: { in: batch } } });
        }
      }
    }

    saveLastSyncAt();
    console.log('\n🎉 Supabase への投入が完了しました。');
  } finally {
    await prismaSource.$disconnect();
    await prismaTarget.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
