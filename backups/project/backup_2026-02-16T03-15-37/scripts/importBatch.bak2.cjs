#!/usr/bin/env node
/**
 * importBatch.json を読み取り、Prisma(SQLite)のDBへ反映する
 * 要件: DELETE禁止、既存優先マージ、自動バックアップ、JSON Schema検証、レポート出力
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const prisma = new PrismaClient();
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

/**
 * SHA1ハッシュの先頭10桁を取得
 */
function getHash10(text) {
  return crypto.createHash('sha1').update(text, 'utf8').digest('hex').substring(0, 10);
}

/**
 * tagKey を決定論的に生成
 * OFFICIAL の場合は既存優先ロジックは呼び出し側で処理
 */
function generateTagKey(displayName, tagType) {
  const hash10 = getHash10(displayName);
  if (tagType === 'DERIVED') {
    return `tag_${hash10}`;
  } else if (tagType === 'STRUCTURAL') {
    return `char_${hash10}`;
  } else {
    // OFFICIAL: off_<hash10> を生成（既存優先は呼び出し側で処理）
    return `off_${hash10}`;
  }
}

/**
 * DATABASE_URL からファイルパスを抽出（file: の場合のみ）
 */
function getDbFilePath() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || !dbUrl.startsWith('file:')) {
    return null;
  }
  const filePath = dbUrl.replace(/^file:/, '');
  return path.resolve(process.cwd(), filePath);
}

/**
 * DBをバックアップ（file: の場合のみ）
 */
function backupDatabase() {
  const dbPath = getDbFilePath();
  if (!dbPath || !fs.existsSync(dbPath)) {
    return null;
  }

  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('T', '_').substring(0, 15);
  const backupDir = path.join(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const backupPath = path.join(backupDir, `dev_${timestamp}.db`);

  fs.copyFileSync(dbPath, backupPath);
  console.log(`✓ Database backed up to: ${backupPath}`);
  return backupPath;
}

/**
 * JSON Schema検証
 */
function validateSchema(data, schemaPath) {
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(schemaContent);
  const validate = ajv.compile(schema);

  if (!validate(data)) {
    console.error('✗ JSON Schema validation failed:');
    console.error(JSON.stringify(validate.errors, null, 2));
    process.exit(1);
  }
  console.log('✓ JSON Schema validation passed');
}

/**
 * OFFICIALタグ除外判定
 * 完全一致と正規表現で除外するタグを判定
 */
function shouldExcludeOfficialTag(displayName) {
  const trimmed = displayName.trim();
  
  // A) 完全一致で除外
  const exactMatches = ['新作', '準新作', '旧作', 'イチオシ'];
  if (exactMatches.includes(trimmed)) {
    return true;
  }
  
  // B) 正規表現で除外
  const regexPatterns = [
    /^コミケ\d+/,              // 例: コミケ107（2025冬）, コミケ92（2017夏）など全部
    /^コミックマーケット/,      // 表記揺れ対策
    /^J\.?GARDEN\d*/i,         // J.GARDEN58, JGARDEN57 など
    /^YOU\d+/,                 // YOU5月イベント など
    /赤ブー/,                   // 赤ブー5月イベント
    /博麗神社例大祭/,           // 博麗神社例大祭
    /^コミティア/i,            // コミティア132extra など
    /^エアコミケ/i,            // エアコミケ2 など
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
 * @param {string[]|null|undefined} officialTags - フィルタリング対象のタグ配列
 * @returns {Object} { kept: string[], dropped: string[] }
 */
function filterOfficialTags(officialTags) {
  const kept = [];
  const dropped = [];
  
  // null/undefined の場合は空配列として扱う
  const tags = officialTags || [];
  
  for (const tag of tags) {
    if (shouldExcludeOfficialTag(tag)) {
      dropped.push(tag);
    } else {
      kept.push(tag);
    }
  }
  
  return { kept, dropped };
}


/**
 * popularityBase をレビュー情報から決定論的に算出（MVP_SPEC準拠）
 * - reviewCount null/0 -> 0
 * - reviewCount >= 1 -> 10
 * - reviewCount >= 10 -> 30
 * - reviewCount >= 100 -> 50
 * - その後 round(reviewAverage) を加算（reviewAverageが数値のときのみ）
 * - 0..55 にクランプ（play bonus は別）
 */
function computePopularityBase(reviewCount, reviewAverage) {
  const rc = (reviewCount == null || Number.isNaN(Number(reviewCount))) ? 0 : Number(reviewCount);
  let base = 0;

  if (rc >= 100) base = 50;
  else if (rc >= 10) base = 30;
  else if (rc >= 1) base = 10;
  else base = 0;

  const ra = (reviewAverage == null || Number.isNaN(Number(reviewAverage))) ? null : Number(reviewAverage);
  if (ra != null) {
    base += Math.round(ra);
  }

  if (base < 0) base = 0;
  if (base > 55) base = 55;
  return base;
}

/**
 * 既存のTagを displayName で検索（トランザクション内で使用）
 */
async function findTagByDisplayName(tx, displayName) {
  return await tx.tag.findFirst({
    where: { displayName },
  });
}

/**
 * 既存のWorkを workId で取得（トランザクション内で使用）
 */
async function getExistingWork(tx, workId) {
  return await tx.work.findUnique({
    where: { workId },
    include: {
      workTags: {
        include: {
          tag: true,
        },
      },
    },
  });
}

/**
 * メイン処理
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npm run import:batch -- <path-to-importBatch.json>');
    process.exit(1);
  }

  const importFilePath = path.resolve(process.cwd(), args[0]);
  if (!fs.existsSync(importFilePath)) {
    console.error(`✗ File not found: ${importFilePath}`);
    process.exit(1);
  }

  console.log(`Reading: ${importFilePath}`);

  // JSON読み込み
  const importData = JSON.parse(fs.readFileSync(importFilePath, 'utf8'));

  // Schema検証
  const schemaPath = path.join(process.cwd(), 'data', 'schemas', 'importBatch.schema.json');
  validateSchema(importData, schemaPath);

  // DBバックアップ
  const backupPath = backupDatabase();

  // レポート用データ
  const report = {
    timestamp: new Date().toISOString(),
    importFile: importFilePath,
    backupPath,
    stats: {
      worksProcessed: 0,
      worksCreated: 0,
      worksUpdated: 0,
      tagsCreated: 0,
      tagsSkipped: 0,
      workTagsCreated: 0,
      workTagsSkipped: 0,
      derivedTagsDropped: [],
    },
    works: [], // 各作品の詳細レポート（除外タグ情報含む）
    errors: [],
  };

  try {
    // トランザクション開始
    await prisma.$transaction(async (tx) => {
      for (const workData of importData.works) {
        report.stats.worksProcessed++;

        // Work の既存優先マージ
        const existingWork = await getExistingWork(tx, workData.workId);
        const sourcePayload = existingWork?.sourcePayload
          ? JSON.parse(existingWork.sourcePayload)
          : {};
        
        // textRef を sourcePayload にマージ（既存優先）
        if (workData.textRef) {
          sourcePayload.textRef = workData.textRef;
        }

// review情報は「既存優先」で確定（DB上の値があればそれを正とする）
const reviewCountToStore = existingWork?.reviewCount ?? workData.reviewCount;
const reviewAverageToStore = existingWork?.reviewAverage ?? workData.reviewAverage;

// popularityBase はレビューから決定論的に初期化（既に値がある場合は保持）
const computedPopularityBase = computePopularityBase(reviewCountToStore, reviewAverageToStore);
const popularityBaseToStore =
  existingWork?.popularityBase == null || existingWork.popularityBase === 0
    ? computedPopularityBase
    : existingWork.popularityBase;

        const workDataToUpsert = {
          workId: workData.workId,
          title: existingWork?.title || workData.title,
          authorName: existingWork?.authorName || workData.circleName,
          isAi: existingWork?.isAi || workData.isAi,
          popularityBase: popularityBaseToStore,
          popularityPlayBonus: existingWork?.popularityPlayBonus ?? 0,
          reviewCount: reviewCountToStore,
          reviewAverage: reviewAverageToStore,
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
          report.stats.worksUpdated++;
        } else {
          report.stats.worksCreated++;
        }

        // OFFICIAL タグのフィルタリング（除外ルール適用）
        const { kept: keptOfficialTags, dropped: droppedOfficialTags } = filterOfficialTags(workData.officialTags);

        // OFFICIAL タグ処理（フィルタ後の配列を使用）
        for (const displayName of keptOfficialTags) {
          // 既存のTagを displayName で検索（既存優先）
          let tag = await findTagByDisplayName(tx, displayName);
          if (!tag) {
            // 既存に displayName 一致が無い場合のみ新規作成
            const tagKey = generateTagKey(displayName, 'OFFICIAL');
            tag = await tx.tag.create({
              data: {
                tagKey,
                displayName,
                tagType: 'OFFICIAL',
                category: null,
              },
            });
            report.stats.tagsCreated++;
          } else {
            report.stats.tagsSkipped++;
          }

          // WorkTag の upsert（既存優先）
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
            report.stats.workTagsCreated++;
          } else {
            report.stats.workTagsSkipped++;
          }
        }

        // DERIVED タグ処理（confidence降順で最大10件）
        const derivedTagsSorted = (workData.derivedTags || [])
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 10);

        const droppedDerived = (workData.derivedTags || []).slice(10);
        if (droppedDerived.length > 0) {
          report.stats.derivedTagsDropped.push({
            workId: workData.workId,
            count: droppedDerived.length,
            tags: droppedDerived.map(t => t.displayName),
          });
        }

        for (const derivedTagData of derivedTagsSorted) {
          // 既存のTagを displayName で検索（既存優先）
          let tag = await findTagByDisplayName(tx, derivedTagData.displayName);
          if (!tag) {
            // 新規作成
            const tagKey = generateTagKey(derivedTagData.displayName, 'DERIVED');
            tag = await tx.tag.create({
              data: {
                tagKey,
                displayName: derivedTagData.displayName,
                tagType: 'DERIVED',
                category: derivedTagData.category || null,
              },
            });
            report.stats.tagsCreated++;
          } else {
            report.stats.tagsSkipped++;
          }

          // WorkTag の upsert（既存優先、derivedConfidence は上書き）
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
                derivedConfidence: derivedTagData.confidence,
              },
            });
            report.stats.workTagsCreated++;
          } else {
            // 既存があっても derivedConfidence は更新（DERIVEDタグなので）
            await tx.workTag.update({
              where: {
                workId_tagKey: {
                  workId: work.workId,
                  tagKey: tag.tagKey,
                },
              },
              data: {
                derivedConfidence: derivedTagData.confidence,
              },
            });
            report.stats.workTagsSkipped++;
          }
        }

        // CHARACTER タグ処理
        for (const displayName of workData.characterTags || []) {
          // 既存のTagを displayName で検索（既存優先）
          let tag = await findTagByDisplayName(tx, displayName);
          if (!tag) {
            // 新規作成
            const tagKey = generateTagKey(displayName, 'STRUCTURAL');
            tag = await tx.tag.create({
              data: {
                tagKey,
                displayName,
                tagType: 'STRUCTURAL',
                category: 'CHARACTER',
              },
            });
            report.stats.tagsCreated++;
          } else {
            report.stats.tagsSkipped++;
          }

          // WorkTag の upsert（既存優先）
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
            report.stats.workTagsCreated++;
          } else {
            report.stats.workTagsSkipped++;
          }
        }

        // レポートに作品ごとの詳細情報を記録
        report.works.push({
          workId: workData.workId,
          droppedOfficialTags,
          keptOfficialTags,
        });
      }
    });

    console.log('\n✓ Import completed successfully');
    console.log(`  Works processed: ${report.stats.worksProcessed}`);
    console.log(`  Works created: ${report.stats.worksCreated}`);
    console.log(`  Works updated: ${report.stats.worksUpdated}`);
    console.log(`  Tags created: ${report.stats.tagsCreated}`);
    console.log(`  Tags skipped (existing): ${report.stats.tagsSkipped}`);
    console.log(`  WorkTags created: ${report.stats.workTagsCreated}`);
    console.log(`  WorkTags skipped (existing): ${report.stats.workTagsSkipped}`);
    if (report.stats.derivedTagsDropped.length > 0) {
      console.log(`  Derived tags dropped: ${report.stats.derivedTagsDropped.length} works`);
    }
    
    // OFFICIALタグ除外の統計
    const totalDroppedOfficial = report.works.reduce((sum, w) => sum + (w.droppedOfficialTags?.length || 0), 0);
    if (totalDroppedOfficial > 0) {
      console.log(`  Official tags filtered out: ${totalDroppedOfficial} tags across ${report.works.filter(w => (w.droppedOfficialTags?.length || 0) > 0).length} works`);
    }

    // レポート出力
    const reportDir = path.join(process.cwd(), 'data', 'import', 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('T', '_').substring(0, 15);
    const reportPath = path.join(reportDir, `report_${timestamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\n✓ Report saved to: ${reportPath}`);
  } catch (error) {
    console.error('\n✗ Import failed:');
    console.error(error);
    report.errors.push({
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
