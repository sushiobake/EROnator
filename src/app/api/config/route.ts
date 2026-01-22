/**
 * /api/config: 設定読み書きAPI
 * 開発環境のみアクセス可能
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { join } from 'path';
import { MvpConfigSchema, type MvpConfig } from '@/server/config/schema';

/**
 * GET: 現在の設定を取得
 */
export async function GET() {
  // 開発環境のみ許可
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  try {
    const configPath = join(process.cwd(), 'config', 'mvpConfig.json');
    const fileContent = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(fileContent);
    
    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST: 設定を更新
 */
export async function POST(request: NextRequest) {
  // 開発環境のみ許可
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not found' },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    const { config: newConfig } = body;

    if (!newConfig) {
      return NextResponse.json(
        { error: 'config is required' },
        { status: 400 }
      );
    }

    // バリデーション
    const result = MvpConfigSchema.safeParse(newConfig);
    if (!result.success) {
      const errors = result.error.errors.map(e => 
        `${e.path.join('.')}: ${e.message}`
      ).join('\n');
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errors,
        },
        { status: 400 }
      );
    }

    const configPath = join(process.cwd(), 'config', 'mvpConfig.json');
    const backupPath = join(process.cwd(), 'config', 'mvpConfig.json.bak');

    // バックアップ作成
    if (existsSync(configPath)) {
      copyFileSync(configPath, backupPath);
    }

    // 設定を保存
    writeFileSync(configPath, JSON.stringify(result.data, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Config updated successfully. Please restart the development server.',
      config: result.data,
    });
  } catch (error) {
    // エラー時はバックアップから復元を試みる
    const configPath = join(process.cwd(), 'config', 'mvpConfig.json');
    const backupPath = join(process.cwd(), 'config', 'mvpConfig.json.bak');
    
    if (existsSync(backupPath)) {
      try {
        copyFileSync(backupPath, configPath);
      } catch (restoreError) {
        // 復元失敗は無視
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
