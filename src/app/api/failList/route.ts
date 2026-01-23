/**
 * /api/failList: FAIL_LIST表示（上位N件のみ）
 * リスト外入力保存
 */

import { NextRequest, NextResponse } from 'next/server';
import { SessionManager } from '@/server/session/manager';
import { normalizeWeights } from '@/server/algo/scoring';
import { getMvpConfig } from '@/server/config/loader';
import type { MvpConfig } from '@/server/config/schema';
import { prisma, ensurePrismaConnected } from '@/server/db/client';
import type { WorkResponse, FailListResponse } from '@/server/api/types';
import { toWorkResponse } from '@/server/api/dto';

/**
 * GET: FAIL_LIST候補取得（上位N件のみ）
 */
export async function GET(request: NextRequest) {
  try {
    // Prisma Clientの接続を確実にする（Vercel serverless functions用）
    await ensurePrismaConnected();
    
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // セッション取得
    const session = await SessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const config: MvpConfig = getMvpConfig();

    // 重みを取得
    const weights = Object.entries(session.weights).map(([workId, weight]) => ({
      workId,
      weight,
    }));

    // 正規化してソート（P desc → workId asc、決定論的）
    const probabilities = normalizeWeights(weights);
    const sorted = [...probabilities].sort((a, b) => {
      if (a.probability !== b.probability) {
        return b.probability - a.probability;
      }
      return a.workId.localeCompare(b.workId);
    });

    // 上位N件のみ取得（Data exposure policy: 全量は返さない）
    const topN = sorted.slice(0, config.flow.failListN as number);

    // Work情報を取得
    const workIds = topN.map(p => p.workId);
    const works = await prisma.work.findMany({
      where: { workId: { in: workIds } },
    });

    const workMap = new Map(works.map(w => [w.workId, w]));

    const candidates: WorkResponse[] = topN
      .map(p => {
        const work = workMap.get(p.workId);
        if (!work) return null;
        return toWorkResponse(work);
      })
      .filter((w): w is WorkResponse => w !== null);

    const response: FailListResponse = {
      candidates,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in /api/failList GET:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST: リスト外入力保存
 */
export async function POST(request: NextRequest) {
  try {
    // Prisma Clientの接続を確実にする（Vercel serverless functions用）
    await ensurePrismaConnected();
    
    const body = await request.json();
    const { sessionId, submittedTitleText } = body;

    if (!sessionId || !submittedTitleText) {
      return NextResponse.json(
        { error: 'sessionId and submittedTitleText are required' },
        { status: 400 }
      );
    }

    // セッション取得
    const session = await SessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // 上位候補のスナップショット（オプション）
    const weights = Object.entries(session.weights).map(([workId, weight]) => ({
      workId,
      weight,
    }));
    const probabilities = normalizeWeights(weights);
    const sorted = [...probabilities].sort((a, b) => {
      if (a.probability !== b.probability) {
        return b.probability - a.probability;
      }
      return a.workId.localeCompare(b.workId);
    });
    const topCandidates = sorted.slice(0, 10).map(p => p.workId);

    // ログ保存
    await prisma.log.create({
      data: {
        submittedTitleText,
        aiGateChoice: session.aiGateChoice || null,
        topCandidates: JSON.stringify(topCandidates),
      },
    });

    return NextResponse.json({
      success: true,
      // ログの生データは返さない（Data exposure policy）
    });
  } catch (error) {
    console.error('Error in /api/failList POST:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
