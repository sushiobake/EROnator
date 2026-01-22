import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 既存データをクリア（開発用）
  await prisma.workTag.deleteMany();
  await prisma.work.deleteMany();
  await prisma.tag.deleteMany();

  // Tags作成
  const tag1 = await prisma.tag.create({
    data: {
      tagKey: 'tag_romance',
      displayName: '恋愛',
      tagType: 'OFFICIAL',
      category: 'ジャンル',
    },
  });

  const tag2 = await prisma.tag.create({
    data: {
      tagKey: 'tag_fantasy',
      displayName: 'ファンタジー',
      tagType: 'OFFICIAL',
      category: 'ジャンル',
    },
  });

  const tag3 = await prisma.tag.create({
    data: {
      tagKey: 'tag_onsen',
      displayName: '温泉',
      tagType: 'DERIVED',
      category: 'シチュエーション',
    },
  });

  // Works作成
  const work1 = await prisma.work.create({
    data: {
      workId: 'work_001',
      title: 'サンプル作品1',
      authorName: 'サークルA',
      isAi: 'HAND',
      popularityBase: 30.0,
      popularityPlayBonus: 0.0,
      reviewCount: 10,
      reviewAverage: 4.5,
      productUrl: 'https://example.com/work1',
      thumbnailUrl: null,
      sourcePayload: JSON.stringify({}),
    },
  });

  const work2 = await prisma.work.create({
    data: {
      workId: 'work_002',
      title: 'サンプル作品2',
      authorName: 'サークルB',
      isAi: 'AI',
      popularityBase: 25.0,
      popularityPlayBonus: 0.0,
      reviewCount: 5,
      reviewAverage: 4.0,
      productUrl: 'https://example.com/work2',
      thumbnailUrl: null,
      sourcePayload: JSON.stringify({}),
    },
  });

  const work3 = await prisma.work.create({
    data: {
      workId: 'work_003',
      title: 'サンプル作品3',
      authorName: 'サークルA',
      isAi: 'HAND',
      popularityBase: 35.0,
      popularityPlayBonus: 0.0,
      reviewCount: 20,
      reviewAverage: 4.8,
      productUrl: 'https://example.com/work3',
      thumbnailUrl: null,
      sourcePayload: JSON.stringify({}),
    },
  });

  // WorkTags作成
  await prisma.workTag.create({
    data: {
      workId: work1.workId,
      tagKey: tag1.tagKey,
      derivedConfidence: null,
    },
  });

  await prisma.workTag.create({
    data: {
      workId: work1.workId,
      tagKey: tag3.tagKey,
      derivedConfidence: 0.75, // DERIVEDタグの例
    },
  });

  await prisma.workTag.create({
    data: {
      workId: work2.workId,
      tagKey: tag2.tagKey,
      derivedConfidence: null,
    },
  });

  await prisma.workTag.create({
    data: {
      workId: work3.workId,
      tagKey: tag1.tagKey,
      derivedConfidence: null,
    },
  });

  await prisma.workTag.create({
    data: {
      workId: work3.workId,
      tagKey: tag2.tagKey,
      derivedConfidence: null,
    },
  });

  // 追加のWorks/Tags/WorkTags（coverage gate通過のため）
  // 最小限のデータで起動できるようにする
  // totalWorks=5の場合、AUTO modeでは minRatio = max(0.05, min(20, 5)/5) = 1.0
  // 全てのWorkにタグがある場合のみ通過可能
  const work4 = await prisma.work.create({
    data: {
      workId: 'work_004',
      title: 'サンプル作品4',
      authorName: 'サークルC',
      isAi: 'HAND',
      popularityBase: 20.0,
      popularityPlayBonus: 0.0,
      reviewCount: 3,
      reviewAverage: 4.0,
      productUrl: 'https://example.com/work4',
      thumbnailUrl: null,
      sourcePayload: JSON.stringify({}),
    },
  });

  const work5 = await prisma.work.create({
    data: {
      workId: 'work_005',
      title: 'サンプル作品5',
      authorName: 'サークルC',
      isAi: 'HAND',
      popularityBase: 22.0,
      popularityPlayBonus: 0.0,
      reviewCount: 4,
      reviewAverage: 4.2,
      productUrl: 'https://example.com/work5',
      thumbnailUrl: null,
      sourcePayload: JSON.stringify({}),
    },
  });

  // 全てのWorkにtag_romanceを付与（coverage = 5/5 = 1.0 >= 1.0 ✓）
  // work1, work3は既に付与済み
  await prisma.workTag.create({
    data: {
      workId: work2.workId,
      tagKey: tag1.tagKey,
      derivedConfidence: null,
    },
  });

  await prisma.workTag.create({
    data: {
      workId: work4.workId,
      tagKey: tag1.tagKey,
      derivedConfidence: null,
    },
  });

  await prisma.workTag.create({
    data: {
      workId: work5.workId,
      tagKey: tag1.tagKey,
      derivedConfidence: null,
    },
  });

  // tag_fantasy: work2, work3 (2件、coverage = 2/5 = 0.4 < 1.0 ✗)
  // tag_onsen: work1 (1件、DERIVED、coverage = 1/5 = 0.2 < 1.0 ✗)
  // → tag_romanceのみがcoverage gateを通過可能

  console.log('Seed completed!');
  console.log(`Created ${await prisma.work.count()} works`);
  console.log(`Created ${await prisma.tag.count()} tags`);
  console.log(`Created ${await prisma.workTag.count()} workTags`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
