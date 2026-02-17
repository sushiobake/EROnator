import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // OFFICIALタグをdisplayNameでグループ化
  const officialTags = await prisma.tag.findMany({
    where: { tagType: 'OFFICIAL' },
    include: {
      _count: { select: { workTags: true } }
    },
    orderBy: { displayName: 'asc' }
  });

  // displayNameでグループ化
  const grouped = new Map<string, typeof officialTags>();
  for (const tag of officialTags) {
    const name = tag.displayName;
    if (!grouped.has(name)) {
      grouped.set(name, []);
    }
    grouped.get(name)!.push(tag);
  }

  // 重複（2つ以上）があるものを表示
  console.log('=== 重複しているOFFICIALタグ ===\n');
  let duplicateCount = 0;
  let genreTagCount = 0;
  
  for (const [name, tags] of grouped) {
    if (tags.length >= 2) {
      duplicateCount++;
      console.log(`【${name}】`);
      
      // ジャンルタグがあるかチェック
      const genreTag = tags.find(t => t.category === 'ジャンル');
      const nonGenreTag = tags.find(t => t.category !== 'ジャンル');
      
      for (const t of tags) {
        const isGenre = t.category === 'ジャンル';
        const marker = isGenre ? ' ← 削除候補' : ' ← 統合先';
        console.log(`  ${t.tagKey} | ${t.category} | works: ${t._count.workTags}${marker}`);
      }
      
      if (genreTag) {
        genreTagCount++;
      }
      console.log('');
    }
  }
  
  console.log(`重複タグセット数: ${duplicateCount}`);
  console.log(`うち「ジャンル」を含むセット: ${genreTagCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
