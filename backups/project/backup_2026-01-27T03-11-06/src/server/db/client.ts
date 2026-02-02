import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

// Singleton Prisma client (server-side only)
// Vercel serverless functions用にグローバルスコープで管理
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaConnected: boolean | undefined;
};

// DATABASE_URLを検証し、正しいDBファイルを参照するように修正
function validateDatabaseUrl(): void {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set');
    return;
  }

  // file:./prisma/dev.db 形式の場合、絶対パスに変換
  if (dbUrl.startsWith('file:./')) {
    const relativePath = dbUrl.replace('file:', '');
    const absolutePath = path.resolve(process.cwd(), relativePath);
    const normalizedPath = absolutePath.replace(/\\/g, '/');
    process.env.DATABASE_URL = `file:${normalizedPath}`;
    
    // 正しいDBファイルの存在確認
    if (!fs.existsSync(absolutePath)) {
      console.error(`Database file does not exist: ${absolutePath}`);
      return;
    }

    // 間違ったDBファイル（prisma/prisma/dev.db）が存在する場合、警告を表示
    const wrongDbPath = path.join(process.cwd(), 'prisma', 'prisma', 'dev.db');
    if (fs.existsSync(wrongDbPath)) {
      console.warn(`Warning: Found wrong DB file at ${wrongDbPath}`);
      console.warn('This may cause Prisma to read from the wrong database.');
      console.warn('Please run "npm run fix:prisma" to fix this issue.');
    }
  }
}

// 初期化時にDATABASE_URLを検証
validateDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error', 'warn'],
  });

// Vercel serverless functionsでもグローバルに保持（コールドスタート対策）
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}

/**
 * Prisma Clientの接続を確実にする
 * Vercelのサーバーレス関数では、最初のリクエスト時に明示的に接続する必要がある
 */
export async function ensurePrismaConnected(): Promise<void> {
  if (globalForPrisma.prismaConnected) {
    return; // 既に接続済み
  }

  try {
    await prisma.$connect();
    globalForPrisma.prismaConnected = true;
    // 本番環境ではログを出力しない（パフォーマンス向上）
    if (process.env.NODE_ENV === 'development') {
      console.log('Prisma Client connected successfully');
    }
  } catch (error) {
    console.error('Failed to connect Prisma Client:', error);
    globalForPrisma.prismaConnected = false;
    throw error;
  }
}
