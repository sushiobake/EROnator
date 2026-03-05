/**
 * has_issues の作品を needs_human_check へ移動し、
 * 全8作品（needs_human_check + has_issues）の「理由」を表示する
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function extractReason(lastCheckResultJson: string | null): string {
  if (!lastCheckResultJson) return '—';
  try {
    const j = typeof lastCheckResultJson === 'string' ? JSON.parse(lastCheckResultJson) : lastCheckResultJson;
    if (j?.aiParseError && j?.reason) return j.reason;
    if (j?.result === '人間による確認が必要' && Array.isArray(j?.issues) && j.issues.length > 0) {
      return j.issues.join(' / ');
    }
    if (j?.checkReasoning && typeof j.checkReasoning === 'object') {
      return Object.entries(j.checkReasoning)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');
    }
    return j?.result || JSON.stringify(j).slice(0, 200);
  } catch {
    return '—';
  }
}

async function main() {
  const needsHuman = await prisma.work.findMany({
    where: { manualTaggingFolder: 'needs_human_check', commentText: { not: null } },
    select: { workId: true, title: true, lastCheckResultJson: true },
  });
  const hasIssues = await prisma.work.findMany({
    where: { manualTaggingFolder: 'has_issues', commentText: { not: null } },
    select: { workId: true, title: true, lastCheckResultJson: true },
  });

  console.log('=== 8作品の「理由」 ===\n');
  console.log('【needs_human_check】', needsHuman.length, '件');
  for (const w of needsHuman) {
    const reason = extractReason(w.lastCheckResultJson);
    console.log(`  ${w.workId} | ${(w.title || '').slice(0, 35)}`);
    console.log(`    理由: ${reason}\n`);
  }

  console.log('【has_issues】', hasIssues.length, '件');
  for (const w of hasIssues) {
    const reason = extractReason(w.lastCheckResultJson);
    console.log(`  ${w.workId} | ${(w.title || '').slice(0, 35)}`);
    console.log(`    理由: ${reason}\n`);
  }

  if (hasIssues.length > 0) {
    console.log('--- has_issues → needs_human_check へ移動 ---');
    const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');
    for (const w of hasIssues) {
      if (isPostgres) {
        await prisma.$executeRawUnsafe(
          'UPDATE "Work" SET "manualTaggingFolder" = $1, "updatedAt" = NOW() WHERE "workId" = $2',
          'needs_human_check',
          w.workId
        );
      } else {
        await prisma.$executeRawUnsafe(
          "UPDATE Work SET manualTaggingFolder = ?, updatedAt = datetime('now') WHERE workId = ?",
          'needs_human_check',
          w.workId
        );
      }
      console.log(`  ✓ ${w.workId}`);
    }
    console.log(`\n${hasIssues.length}件を needs_human_check へ移動しました。`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
