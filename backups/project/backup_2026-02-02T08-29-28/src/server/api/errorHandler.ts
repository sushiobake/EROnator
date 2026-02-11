/**
 * APIエラーハンドリング
 * ユーザーフレンドリーなエラーメッセージを提供
 */

import { NextResponse } from 'next/server';

/**
 * APIエラークラス
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public userMessage: string,
    public technicalMessage?: string
  ) {
    super(technicalMessage || userMessage);
    this.name = 'ApiError';
  }
}

/**
 * エラーをNextResponseに変換
 */
export function handleApiError(error: unknown): NextResponse {
  // ApiErrorの場合はそのまま返す
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.userMessage,
        ...(process.env.NODE_ENV === 'development' && error.technicalMessage && {
          technical: error.technicalMessage,
        }),
      },
      { status: error.statusCode }
    );
  }

  // バリデーションエラー（Zod等）
  if (error && typeof error === 'object' && 'issues' in error) {
    const zodError = error as { issues: Array<{ path: string[]; message: string }> };
    const messages = zodError.issues.map(issue => {
      const path = issue.path.join('.');
      return path ? `${path}: ${issue.message}` : issue.message;
    });
    return NextResponse.json(
      {
        error: '入力データに問題があります',
        details: messages,
        ...(process.env.NODE_ENV === 'development' && {
          technical: JSON.stringify(zodError, null, 2),
        }),
      },
      { status: 400 }
    );
  }

  // Prismaエラー
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code: string; meta?: unknown };
    
    switch (prismaError.code) {
      case 'P2002':
        return NextResponse.json(
          {
            error: 'データの重複が発生しました',
            ...(process.env.NODE_ENV === 'development' && {
              technical: `Prisma error: ${prismaError.code}`,
            }),
          },
          { status: 409 }
        );
      case 'P2025':
        return NextResponse.json(
          {
            error: 'データが見つかりませんでした',
            ...(process.env.NODE_ENV === 'development' && {
              technical: `Prisma error: ${prismaError.code}`,
            }),
          },
          { status: 404 }
        );
      default:
        return NextResponse.json(
          {
            error: 'データベースエラーが発生しました',
            ...(process.env.NODE_ENV === 'development' && {
              technical: `Prisma error: ${prismaError.code}`,
            }),
          },
          { status: 500 }
        );
    }
  }

  // 一般的なError
  if (error instanceof Error) {
    // 既知のエラーメッセージをユーザーフレンドリーに変換
    const userMessage = translateErrorMessage(error.message);
    
    return NextResponse.json(
      {
        error: userMessage,
        ...(process.env.NODE_ENV === 'development' && {
          technical: error.message,
          stack: error.stack,
        }),
      },
      { status: 500 }
    );
  }

  // 未知のエラー
  return NextResponse.json(
    {
      error: '予期しないエラーが発生しました',
      ...(process.env.NODE_ENV === 'development' && {
        technical: String(error),
      }),
    },
    { status: 500 }
  );
}

/**
 * エラーメッセージをユーザーフレンドリーに変換
 */
function translateErrorMessage(message: string): string {
  // セッション関連
  if (message.includes('Session not found')) {
    return 'セッションが見つかりませんでした。最初からやり直してください。';
  }
  if (message.includes('Session update failed')) {
    return 'セッションの更新に失敗しました。もう一度お試しください。';
  }

  // データ関連
  if (message.includes('No question available')) {
    return '質問が利用できません。';
  }
  if (message.includes('No top work found')) {
    return '候補作品が見つかりませんでした。';
  }
  if (message.includes('Failed to load works')) {
    return '作品データの読み込みに失敗しました。';
  }

  // 入力関連
  if (message.includes('required')) {
    return '必要な情報が不足しています。';
  }
  if (message.includes('invalid')) {
    return '無効な入力です。';
  }

  // ネットワーク関連
  if (message.includes('fetch') || message.includes('network')) {
    return 'ネットワークエラーが発生しました。接続を確認してください。';
  }

  // タイムアウト
  if (message.includes('timeout')) {
    return 'タイムアウトが発生しました。もう一度お試しください。';
  }

  // データベース接続（Neon等: Tenant or user not found など）
  if (
    message.includes('Tenant or user not found') ||
    message.includes('FATAL:') ||
    (message.includes('connection') && message.includes('refused'))
  ) {
    return 'データベースに接続できません。デプロイ先の環境変数（DATABASE_URL）を確認してください。';
  }

  // デフォルト
  return 'エラーが発生しました。もう一度お試しください。';
}

/**
 * エラーハンドリングラッパー
 * APIルートで使用
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error('[API Error]', error);
      return handleApiError(error);
    }
  };
}
