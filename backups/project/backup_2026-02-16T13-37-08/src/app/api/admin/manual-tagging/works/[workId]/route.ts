/**
 * 人力タグ付け: 1件取得・保存
 * GET: 作品詳細（既存S / 追加S / A/B/C / キャラ）
 * PUT: タグ保存（tagSource=human）、切り替え時に呼ぶ
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { resolveTagKeyForDisplayName } from '@/server/admin/resolveTagByDisplayName';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const TAG_RANKS_PATH = 'config/tagRanks.json';

function generateTagKey(displayName: string, tagType: 'DERIVED' | 'STRUCTURAL' = 'DERIVED'): string {
  const hash = crypto.createHash('sha1').update(displayName, 'utf8').digest('hex').substring(0, 10);
  return tagType === 'STRUCTURAL' ? `char_${hash}` : `tag_${hash}`;
}

async function addTagToRanks(displayName: string, rank: 'A' | 'B' | 'C'): Promise<void> {
  const fullPath = path.join(process.cwd(), TAG_RANKS_PATH);
  let data: { ranks?: Record<string, string>; [key: string]: unknown } = {};
  try {
    const content = await fs.readFile(fullPath, 'utf-8');
    data = JSON.parse(content);
  } catch {
    data = { ranks: {} };
  }
  const ranks = data.ranks || {};
  if (!(displayName in ranks)) {
    ranks[displayName] = rank;
    data.ranks = ranks;
    data.updatedAt = new Date().toISOString();
    try {
      await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[manual-tagging] addTagToRanks write failed:', fullPath, displayName, rank, err);
      // 書き込み失敗しても PUT は成功させる（DB にはタグが付く。GET でランク未登録は C として表示する）
    }
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ workId: string }> }
) {
  try {
    const { workId } = await params;
    const work = await prisma.work.findUnique({
      where: { workId },
      include: {
        workTags: {
          include: { tag: true },
        },
      },
    });
    if (!work) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }

    const officialTags = work.workTags
      .filter((wt) => wt.tag.tagType === 'OFFICIAL' && wt.derivedSource !== 'additionalS')
      .map((wt) => ({ displayName: wt.tag.displayName, category: wt.tag.category }));
    const additionalSTags = work.workTags
      .filter((wt) => wt.tag.tagType === 'OFFICIAL' && wt.derivedSource === 'additionalS')
      .map((wt) => ({ displayName: wt.tag.displayName, category: wt.tag.category }));
    const derivedTags = work.workTags
      .filter((wt) => wt.tag.tagType === 'DERIVED')
      .map((wt) => ({ displayName: wt.tag.displayName, category: wt.tag.category }));
    const structuralTags = work.workTags
      .filter((wt) => wt.tag.tagType === 'STRUCTURAL')
      .map((wt) => ({ displayName: wt.tag.displayName, category: wt.tag.category }));

    let tagRanks: Record<string, string> = {};
    try {
      const ranksPath = path.join(process.cwd(), TAG_RANKS_PATH);
      const content = await fs.readFile(ranksPath, 'utf-8');
      const parsed = JSON.parse(content);
      tagRanks = parsed.ranks || {};
    } catch {
      // ignore
    }
    // ランク未登録の DERIVED も C として返す（tagRanks.json の反映遅れや別プロセスで消えて見えるバグを防ぐ）
    const aTags = derivedTags.filter((t) => tagRanks[t.displayName] === 'A').map((t) => t.displayName);
    const bTags = derivedTags.filter((t) => tagRanks[t.displayName] === 'B').map((t) => t.displayName);
    const cTagsFromRanks = derivedTags.filter((t) => tagRanks[t.displayName] === 'C').map((t) => t.displayName);
    const unrankedDerived = derivedTags
      .filter((t) => !(tagRanks[t.displayName] === 'A' || tagRanks[t.displayName] === 'B' || tagRanks[t.displayName] === 'C'))
      .map((t) => t.displayName);
    const cTags = [...cTagsFromRanks, ...unrankedDerived];

    const folder = (work as { manualTaggingFolder?: string | null }).manualTaggingFolder ?? 'pending';

    let rawTagChanges: string | null =
      (work as { lastCheckTagChanges?: string | null }).lastCheckTagChanges ?? null;
    if (rawTagChanges == null) {
      try {
        const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');
        if (isPostgres) {
          const rows = await prisma.$queryRawUnsafe<Array<{ lastCheckTagChanges: string | null }>>(
            'SELECT "lastCheckTagChanges" FROM "Work" WHERE "workId" = $1',
            workId
          );
          rawTagChanges = rows[0]?.lastCheckTagChanges ?? null;
        } else {
          const rows = await prisma.$queryRawUnsafe<Array<{ lastCheckTagChanges: string | null }>>(
            'SELECT lastCheckTagChanges FROM Work WHERE workId = ?',
            workId
          );
          rawTagChanges = rows[0]?.lastCheckTagChanges ?? null;
        }
      } catch {
        rawTagChanges = null;
      }
    }
    let lastCheckTagChanges: { added: string[]; removed: string[] } | null = null;
    if (rawTagChanges) {
      try {
        const parsed = JSON.parse(rawTagChanges) as { added?: string[]; removed?: string[] };
        lastCheckTagChanges = {
          added: Array.isArray(parsed.added) ? parsed.added : [],
          removed: Array.isArray(parsed.removed) ? parsed.removed : [],
        };
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      success: true,
      work: {
        workId: work.workId,
        title: work.title,
        authorName: work.authorName,
        commentText: work.commentText,
        manualTaggingFolder: folder,
        officialTags,
        additionalSTags,
        aTags,
        bTags,
        cTags,
        characterTags: structuralTags.map((t) => t.displayName),
        lastCheckTagChanges,
      },
    });
  } catch (error) {
    console.error('[manual-tagging/works/[workId]] GET', error);
    return NextResponse.json({ error: 'Failed to fetch work' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ workId: string }> }
) {
  try {
    const { workId } = await params;
    const body = await request.json();
    const {
      manualTaggingFolder: bodyFolder,
      additionalSTags = [],
      aTags = [],
      bTags = [],
      cTags = [],
      characterTags = [],
    } = body as {
      manualTaggingFolder?: string;
      additionalSTags?: string[];
      aTags?: string[];
      bTags?: string[];
      cTags?: string[];
      characterTags?: string[];
    };

    const work = await prisma.work.findUnique({
      where: { workId },
      include: { workTags: { include: { tag: true } } },
    });
    if (!work) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }

    const toStrArr = (v: unknown): string[] =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean) : [];
    const addS = toStrArr(additionalSTags);
    const aList = toStrArr(aTags);
    const bList = toStrArr(bTags);
    const cList = toStrArr(cTags);
    const charList = toStrArr(characterTags).slice(0, 1);

    const officialNameToKey = new Map(
      (await prisma.tag.findMany({ where: { tagType: 'OFFICIAL' }, select: { displayName: true, tagKey: true } })).map(
        (t) => [t.displayName.toLowerCase(), t.tagKey]
      )
    );

    await prisma.$transaction(async (tx) => {
      const existingWorkTags = await tx.workTag.findMany({
        where: { workId },
        include: { tag: true },
      });
      const toDelete: string[] = [];
      for (const wt of existingWorkTags) {
        if (wt.tag.tagType === 'DERIVED') toDelete.push(wt.tagKey);
        else if (wt.tag.tagType === 'OFFICIAL' && wt.derivedSource === 'additionalS') toDelete.push(wt.tagKey);
        else if (wt.tag.tagType === 'STRUCTURAL') toDelete.push(wt.tagKey);
      }
      if (toDelete.length > 0) {
        await tx.workTag.deleteMany({
          where: { workId, tagKey: { in: toDelete } },
        });
      }

      for (const displayName of addS) {
        const tagKey = officialNameToKey.get(displayName.trim().toLowerCase());
        if (!tagKey) continue;
        await tx.workTag.upsert({
          where: { workId_tagKey: { workId, tagKey } },
          create: {
            workId,
            tagKey,
            derivedSource: 'additionalS',
            derivedConfidence: 0.9,
          },
          update: { derivedSource: 'additionalS', derivedConfidence: 0.9 },
        });
      }

      const defaultQuestionTemplate = (name: string) => `${name.trim()}が特徴的だったりするのかしら？`;

      const upsertDerived = async (displayName: string, rank: 'A' | 'B' | 'C') => {
        const trimmed = displayName.trim();
        let tagKey = await resolveTagKeyForDisplayName(tx as Parameters<typeof resolveTagKeyForDisplayName>[0], displayName);
        if (!tagKey) {
          tagKey = generateTagKey(displayName, 'DERIVED');
          await tx.tag.create({
            data: {
              tagKey,
              displayName: trimmed,
              tagType: 'DERIVED',
              category: 'その他',
              questionTemplate: defaultQuestionTemplate(displayName),
            },
          });
          await addTagToRanks(trimmed, rank);
        } else {
          // 既存タグでも questionTemplate が未設定なら設定（タグリストに表示されるようにする）
          await tx.tag.updateMany({
            where: { tagKey, questionTemplate: null },
            data: { questionTemplate: defaultQuestionTemplate(displayName) },
          });
        }
        await tx.workTag.upsert({
          where: { workId_tagKey: { workId, tagKey } },
          create: {
            workId,
            tagKey,
            derivedConfidence: 0.9,
            derivedSource: 'manual',
          },
          update: { derivedConfidence: 0.9, derivedSource: 'manual' },
        });
      };
      for (const name of aList) await upsertDerived(name, 'A');
      for (const name of bList) await upsertDerived(name, 'B');
      for (const name of cList) await upsertDerived(name, 'C');

      if (charList.length > 0) {
        const charName = charList[0];
        let charTagKey = await tx.tag.findFirst({
          where: { displayName: charName, tagType: 'STRUCTURAL' },
          select: { tagKey: true },
        });
        if (!charTagKey) {
          charTagKey = { tagKey: generateTagKey(charName, 'STRUCTURAL') };
          await tx.tag.create({
            data: {
              tagKey: charTagKey.tagKey,
              displayName: charName,
              tagType: 'STRUCTURAL',
              category: 'キャラクター',
              questionTemplate: `${charName}というキャラクターが登場する？`,
            },
          });
        } else {
          await tx.tag.updateMany({
            where: { tagKey: charTagKey.tagKey, questionTemplate: null },
            data: { questionTemplate: `${charName}というキャラクターが登場する？` },
          });
        }
        await tx.workTag.upsert({
          where: { workId_tagKey: { workId, tagKey: charTagKey.tagKey } },
          create: { workId, tagKey: charTagKey.tagKey, derivedSource: 'manual', derivedConfidence: 0.9 },
          update: { derivedSource: 'manual', derivedConfidence: 0.9 },
        });
      }

      const validFolders = ['tagged', 'needs_human_check', 'pending', 'untagged', 'legacy_ai', 'needs_review'];
      const folder =
        typeof bodyFolder === 'string' && validFolders.includes(bodyFolder) ? bodyFolder : null;
      if (folder) {
        const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');
        if (folder === 'tagged') {
          const taggedAtIso = new Date().toISOString();
          if (isPostgres) {
            await tx.$executeRawUnsafe(
              'UPDATE "Work" SET manualTaggingFolder = $1, taggedAt = $2::timestamptz, lastCheckTagChanges = NULL WHERE "workId" = $3',
              folder,
              taggedAtIso,
              workId
            );
          } else {
            await tx.$executeRawUnsafe(
              'UPDATE Work SET manualTaggingFolder = ?, taggedAt = ?, lastCheckTagChanges = NULL WHERE workId = ?',
              folder,
              taggedAtIso,
              workId
            );
          }
        } else {
          if (isPostgres) {
            await tx.$executeRawUnsafe(
              'UPDATE "Work" SET manualTaggingFolder = $1, lastCheckTagChanges = NULL WHERE "workId" = $2',
              folder,
              workId
            );
          } else {
            await tx.$executeRawUnsafe(
              'UPDATE Work SET manualTaggingFolder = ?, lastCheckTagChanges = NULL WHERE workId = ?',
              folder,
              workId
            );
          }
        }
      } else {
        const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');
        if (isPostgres) {
          await tx.$executeRawUnsafe('UPDATE "Work" SET lastCheckTagChanges = NULL WHERE "workId" = $1', workId);
        } else {
          await tx.$executeRawUnsafe('UPDATE Work SET lastCheckTagChanges = NULL WHERE workId = ?', workId);
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[manual-tagging/works/[workId]] PUT', error);
    return NextResponse.json({ error: 'Failed to save tags' }, { status: 500 });
  }
}

/** フォルダのみ更新（一覧から直接移動する用） */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workId: string }> }
) {
  try {
    const { workId } = await params;
    const body = await request.json().catch(() => ({}));
    const manualTaggingFolder = typeof body.manualTaggingFolder === 'string' ? body.manualTaggingFolder : null;
    const validFolders = ['tagged', 'needs_human_check', 'pending', 'untagged', 'legacy_ai', 'needs_review'];
    if (!manualTaggingFolder || !validFolders.includes(manualTaggingFolder)) {
      return NextResponse.json({ error: 'Invalid manualTaggingFolder' }, { status: 400 });
    }
    const work = await prisma.work.findUnique({ where: { workId }, select: { workId: true } });
    if (!work) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }
    const isPostgres = (process.env.DATABASE_URL ?? '').startsWith('postgres');
    if (manualTaggingFolder === 'tagged') {
      const taggedAtIso = new Date().toISOString();
      if (isPostgres) {
        await prisma.$executeRawUnsafe(
          'UPDATE "Work" SET manualTaggingFolder = $1, taggedAt = $2::timestamptz, lastCheckTagChanges = NULL WHERE "workId" = $3',
          manualTaggingFolder,
          taggedAtIso,
          workId
        );
      } else {
        await prisma.$executeRawUnsafe(
          'UPDATE Work SET manualTaggingFolder = ?, taggedAt = ?, lastCheckTagChanges = NULL WHERE workId = ?',
          manualTaggingFolder,
          taggedAtIso,
          workId
        );
      }
    } else {
      if (isPostgres) {
        await prisma.$executeRawUnsafe(
          'UPDATE "Work" SET manualTaggingFolder = $1, lastCheckTagChanges = NULL WHERE "workId" = $2',
          manualTaggingFolder,
          workId
        );
      } else {
        await prisma.$executeRawUnsafe(
          'UPDATE Work SET manualTaggingFolder = ?, lastCheckTagChanges = NULL WHERE workId = ?',
          manualTaggingFolder,
          workId
        );
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[manual-tagging/works/[workId]] PATCH', error);
    return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 });
  }
}
