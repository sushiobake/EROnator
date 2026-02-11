import { NextResponse } from 'next/server';
import crypto from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';

export const runtime = 'nodejs';

const RAW_TEXT_MAX = 30000;

function norm(s: unknown): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function clampRawText(rawText: unknown): string {
  const s = String(rawText ?? '');
  if (s.length <= RAW_TEXT_MAX) return s;
  return s.slice(0, RAW_TEXT_MAX);
}

function stableWorkId(cid: string | null, productUrl: string): string {
  if (cid) return `cid:${cid}`;
  const h = crypto.createHash('sha1').update(productUrl).digest('hex').slice(0, 12);
  return `urlhash:${h}`;
}

function toNumberOrNull(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[^\d.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

type IsAi = 'AI' | 'HAND' | 'UNKNOWN';

function normalizeIsAi(v: unknown): IsAi {
  const s = String(v ?? '').trim().toUpperCase();
  if (s === 'AI') return 'AI';
  if (s === 'HAND') return 'HAND';
  if (s === 'UNKNOWN') return 'UNKNOWN';
  return 'UNKNOWN';
}

// 既存送信形式を壊さない（sourcePayload でも flat でも受ける）
type IngestBody = {
  productUrl: string;
  title: string;

  // legacy / new (どちらでも可)
  authorName?: string | null;
  circleName?: string | null;

  thumbnailUrl?: string | null;
  officialTags?: string[];

  // new（任意）
  reviewCount?: number | string | null;
  reviewAverage?: number | string | null;
  isAi?: string; // 'AI' | 'HAND' | 'UNKNOWN'（normalizeIsAiで正規化）

  // legacy
  sourcePayload?: {
    rawText?: string;
    scrapedAt?: string;
    pageUrl?: string; // 受け取っても保存しない
    cid?: string | null;
  };

  // new（任意）
  rawText?: string;
  scrapedAt?: string;
  cid?: string | null;
};

// rawText を meta / comment に分離（“削る/残す”はここで調整可能）
function splitRawText(rawText: string) {
  const t = rawText.replace(/\r\n/g, '\n');

  const marker = '作品コメント';
  const idx = t.indexOf(marker);

  // marker無しの場合は全部 metaText 扱い
  if (idx === -1) {
    return { metaText: t.trim(), commentText: '' };
  }

  const before = t.slice(0, idx);
  const after = t.slice(idx);

  // meta 側（dt/dd由来を想定）
  const lines = before
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const dropPrefixes = [
    'お気に入り登録数:',
    'お気に入り登録者数:',
    '配信開始日:',
  ];
  const keepPrefixes = [
    'デモ・体験版:',
    'シナリオ:',
    'イラスト:',
    '作品形式:',
    'ページ数:',
    '題材:',
  ];

  const metaLines = lines
    .filter((l) => !dropPrefixes.some((p) => l.startsWith(p)))
    .filter((l) => l.startsWith('デモ・体験版:') || keepPrefixes.some((p) => l.startsWith(p)));

  const metaText = metaLines.join('\n').trim();

  // 本文側（作品コメント～末尾）
  const commentText = after.trim();

  return { metaText, commentText };
}

function serializeBlock(w: {
  workId: string;
  cid: string | null;
  title: string;
  circleName: string;
  productUrl: string;
  thumbnailUrl: string | null;
  scrapedAt: string;
  officialTags: string[];
  reviewCount: number | null;
  reviewAverage: number | null;
  isAi: IsAi;
  metaText: string;
  commentText: string;
}) {
  const tags = w.officialTags.length ? w.officialTags.join(', ') : '';

  return [
    `workId: ${w.workId}`,
    `cid: ${w.cid ?? ''}`,
    `title: ${w.title}`,
    `circleName: ${w.circleName}`,
    `productUrl: ${w.productUrl}`,
    `thumbnailUrl: ${w.thumbnailUrl ?? ''}`,
    `reviewAverage: ${w.reviewAverage ?? ''}`,
    `reviewCount: ${w.reviewCount ?? ''}`,
    `isAi: ${w.isAi}`,
    `officialTags: ${tags}`,
    `scrapedAt: ${w.scrapedAt}`,
    `aiReviewStatus: PENDING`,
    ``,
    `# metaText`,
    w.metaText || '',
    ``,
    `# commentText`,
    w.commentText || '',
    ``,
  ].join('\n');
}

// 1ファイル内で workId 単位に “追記 or 置換”
async function upsertInTextFile(filePath: string, workId: string, blockBody: string) {
  const begin = `@@BEGIN ${workId}\n`;
  const end = `\n@@END ${workId}\n`;

  let existing = '';
  try {
    existing = await fs.readFile(filePath, 'utf-8');
  } catch {
    // file not found -> create
  }

  if (existing.includes(begin)) {
    const startIdx = existing.indexOf(begin);
    const endIdx = existing.indexOf(end, startIdx);
    if (endIdx !== -1) {
      const updated =
        existing.slice(0, startIdx) + begin + blockBody + end + existing.slice(endIdx + end.length);
      await fs.writeFile(filePath, updated, 'utf-8');
      return { created: false };
    }
  }

  const sep = existing && !existing.endsWith('\n') ? '\n' : '';
  await fs.writeFile(filePath, existing + sep + begin + blockBody + end, 'utf-8');
  return { created: true };
}

export async function POST(req: Request) {
  const headerToken = req.headers.get('x-ingest-token');
  const envToken = process.env.INGEST_TOKEN;

  if (!envToken || headerToken !== envToken) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: IngestBody;
  try {
    body = (await req.json()) as IngestBody;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const productUrl = norm(body?.productUrl);
  const title = String(body?.title ?? '').trim(); // タイトルは空白圧縮しない（極力そのまま）
  const circleName = norm(body?.circleName ?? body?.authorName) || 'UNKNOWN';
  const thumbnailUrl = body?.thumbnailUrl == null ? null : (norm(body.thumbnailUrl) || null);

  const isAi = normalizeIsAi(body?.isAi);

  const sp = body?.sourcePayload;
  const rawText = clampRawText(sp?.rawText ?? body?.rawText);
  const scrapedAt = norm(sp?.scrapedAt ?? body?.scrapedAt);
  const cid = (sp?.cid ?? body?.cid) == null ? null : (norm(sp?.cid ?? body?.cid) || null);

  if (!productUrl || !title || !rawText || !scrapedAt) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const workId = stableWorkId(cid, productUrl);

  const officialTagsRaw = Array.isArray(body?.officialTags) ? body.officialTags : [];
  const officialTags = Array.from(
    new Set(
      officialTagsRaw
        .map((t) => String(t ?? '').trim())
        .filter((t) => t && t.length <= 50),
    ),
  );

  const reviewCount = toNumberOrNull(body?.reviewCount);
  const reviewAverage = toNumberOrNull(body?.reviewAverage);

  const { metaText, commentText } = splitRawText(rawText);

  // A / C の出力先
  const outDir = path.join(process.cwd(), 'data', 'staging');
  const A_PATH = path.join(outDir, 'works_A.txt');
  const C_PATH = path.join(outDir, 'works_C.txt'); // 追加分ログ（追記）

  await fs.mkdir(outDir, { recursive: true });

  const block = serializeBlock({
    workId,
    cid,
    title,
    circleName,
    productUrl,
    thumbnailUrl,
    scrapedAt,
    officialTags,
    reviewCount,
    reviewAverage,
    isAi,
    metaText,
    commentText,
  });

  const { created } = await upsertInTextFile(A_PATH, workId, block);

  // C は “今回入ったもの” を見やすくするため追記（末尾だけ見ればOK）
  const cEntry = [
    `=== ${new Date().toISOString()} ${created ? 'CREATED' : 'UPDATED'} ${workId} ===`,
    block,
    '',
  ].join('\n');
  await fs.appendFile(C_PATH, cEntry, 'utf-8');

  // レスポンスには rawText を含めない
  return NextResponse.json({ ok: true, workId, created });
}
