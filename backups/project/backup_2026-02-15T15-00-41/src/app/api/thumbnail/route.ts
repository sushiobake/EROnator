/**
 * GET /api/thumbnail?workId=xxx
 * productUrl から og:image を取得して画像を返す（A: URLから取得）
 * DB に thumbnailUrl が無い場合に使用。取得結果はメモリキャッシュ（24h）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensurePrismaConnected } from '@/server/db/client';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const cache = new Map<string, { imageUrl: string; expires: number }>();

function getCachedImageUrl(workId: string): string | null {
  const entry = cache.get(workId);
  if (!entry || Date.now() > entry.expires) return null;
  return entry.imageUrl;
}

function setCachedImageUrl(workId: string, imageUrl: string): void {
  cache.set(workId, { imageUrl, expires: Date.now() + CACHE_TTL_MS });
}

function extractOgImage(html: string): string | null {
  const match = html.match(/<meta[^>]+property\s*=\s*["']og:image["'][^>]+content\s*=\s*["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:image["']/i);
  return match ? match[1].trim() : null;
}

export async function GET(request: NextRequest) {
  try {
    const workId = request.nextUrl.searchParams.get('workId');
    if (!workId) {
      return NextResponse.json({ error: 'workId required' }, { status: 400 });
    }

    await ensurePrismaConnected();
    const work = await prisma.work.findUnique({
      where: { workId },
      select: { productUrl: true, thumbnailUrl: true },
    });

    if (!work) {
      return NextResponse.json({ error: 'Work not found' }, { status: 404 });
    }

    // 1) キャッシュにあればその画像URLを取得してプロキシ
    let imageUrl = getCachedImageUrl(workId);

    // 2) DB に thumbnailUrl がありそうならそれを使う（許可ホストは別途; ここでは取得のみ）
    if (!imageUrl && work.thumbnailUrl) {
      imageUrl = work.thumbnailUrl;
      setCachedImageUrl(workId, imageUrl);
    }

    // 3) productUrl から og:image を取得
    if (!imageUrl && work.productUrl) {
      const res = await fetch(work.productUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });
      if (res.ok) {
        const html = await res.text();
        const og = extractOgImage(html);
        if (og) {
          imageUrl = og.startsWith('http') ? og : new URL(og, work.productUrl).href;
          setCachedImageUrl(workId, imageUrl);
        }
      }
    }

    if (!imageUrl) {
      return NextResponse.json({ error: 'Thumbnail not found' }, { status: 404 });
    }

    // 画像を取得してプロキシ（Referer 等でブロックされても自サーバー経由なら表示できる）
    const imgRes = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': work.productUrl,
      },
    });

    if (!imgRes.ok) {
      return NextResponse.json({ error: 'Image fetch failed' }, { status: 502 });
    }

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const buffer = await imgRes.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (e) {
    console.error('[thumbnail]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
