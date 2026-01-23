/**
 * Supabaseのデータを確認するスクリプト
 * .env.local の DATABASE_URL が Supabase を指している必要がある
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

const prisma = new PrismaClient();

async function checkData() {
  console.log('🔍 Supabaseのデータを確認中...\n');

  try {
    // Worksの確認
    const worksCount = await prisma.work.count();
    console.log(`📦 Works: ${worksCount}件`);

    if (worksCount > 0 && worksCount <= 10) {
      const works = await prisma.work.findMany({
        take: 10,
        select: {
          workId: true,
          title: true,
          isAi: true,
        },
      });
      console.log('   サンプル（最初の10件）:');
      works.forEach(w => {
        console.log(`   - ${w.workId}: ${w.title} (${w.isAi})`);
      });
    }

    // Tagsの確認
    const tagsCount = await prisma.tag.count();
    console.log(`\n🏷️  Tags: ${tagsCount}件`);

    if (tagsCount > 0 && tagsCount <= 10) {
      const tags = await prisma.tag.findMany({
        take: 10,
        select: {
          tagKey: true,
          displayName: true,
          tagType: true,
        },
      });
      console.log('   サンプル（最初の10件）:');
      tags.forEach(t => {
        console.log(`   - ${t.tagKey}: ${t.displayName} (${t.tagType})`);
      });
    }

    // WorkTagsの確認
    const workTagsCount = await prisma.workTag.count();
    console.log(`\n🔗 WorkTags: ${workTagsCount}件`);

    console.log('\n✅ 確認完了');
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 実行
checkData()
  .then(() => {
    console.log('\n✅ スクリプトが正常に完了しました');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ スクリプトが失敗しました:', error);
    process.exit(1);
  });
