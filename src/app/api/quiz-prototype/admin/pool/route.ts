/**
 * F@NZA王クイズ プロトタイプ 管理API: 使用中プール + 候補作品の取得
 */
import { NextResponse } from 'next/server';
import { getQuizReadPrismaClient } from '@/quiz-prototype/prismaResolver';
import { getQuizPool, type QuizTagSourceFilter } from '@/quiz-prototype/pool/selectWorks';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const refresh = url.searchParams.get('refresh') === '1';
    const filterParam = url.searchParams.get('tagSource');
    const tagSourceFilter: QuizTagSourceFilter =
      filterParam === 'any' ? 'any' : 'hand';
    const prisma = await getQuizReadPrismaClient();
    const data = await getQuizPool(prisma, { refresh, tagSourceFilter });
    return NextResponse.json(data);
  } catch (e) {
    console.error('[quiz-prototype/admin/pool]', e);
    return NextResponse.json(
      { error: 'Internal error', message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
