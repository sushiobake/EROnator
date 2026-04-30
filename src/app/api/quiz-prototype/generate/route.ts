import { NextResponse } from 'next/server';
import { buildQuestionSet } from '@/quiz-prototype/questionBuilder';
import { getQuizPool } from '@/quiz-prototype/pool/selectWorks';
import { getQuizReadPrismaClient } from '@/quiz-prototype/prismaResolver';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quiz-prototype/generate
 * 100件固定プール（40/40/20）から 3/4/3 で10問生成
 */
export async function GET() {
  try {
    const prisma = await getQuizReadPrismaClient();
    const poolData = await getQuizPool(prisma);
    const pool = poolData.works;
    if (pool.length < 10) {
      return NextResponse.json(
        {
          error: 'Insufficient pool',
          poolSize: pool.length,
          message: '出題可能な作品が10件未満です。',
        },
        { status: 500 },
      );
    }

    const questions = buildQuestionSet(pool);
    if (!questions) {
      return NextResponse.json(
        { error: 'Failed to build questions', poolSize: pool.length },
        { status: 500 },
      );
    }

    return NextResponse.json({ questions, poolSummary: poolData.summary });
  } catch (e) {
    console.error('[quiz-prototype/generate]', e);
    return NextResponse.json(
      { error: 'Internal error', message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
