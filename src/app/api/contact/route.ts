/**
 * 公開お問い合わせ: DB に保存（管理画面で一覧）。スパム対策: honeypot + 簡易レート制限
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma, ensurePrismaConnected } from '@/server/db/client';

const ContactBodySchema = z.object({
  name: z.string().trim().min(1, 'お名前を入力してください').max(120),
  email: z
    .string()
    .max(254)
    .optional()
    .transform((val) => (val == null || val.trim() === '' ? undefined : val.trim()))
    .refine(
      (val) => val === undefined || z.string().email().safeParse(val).success,
      { message: 'メールアドレスの形式が正しくありません' }
    ),
  subject: z.string().trim().max(80).optional(),
  message: z.string().trim().min(1, 'お問い合わせ内容を入力してください').max(8000),
  /** 空のまま。埋まっていたらボットとみなす */
  website: z.string().optional(),
});

const COOLDOWN_MS = 60_000;
const lastSubmitByKey = new Map<string, number>();

function clientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  return ip;
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => null);
    const parsed = ContactBodySchema.safeParse(raw);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { error: first?.message ?? '入力データに問題があります' },
        { status: 400 }
      );
    }
    const { name, email, subject, message, website } = parsed.data;

    if (website && website.trim().length > 0) {
      return NextResponse.json({ success: true });
    }

    const key = clientKey(request);
    const now = Date.now();
    const last = lastSubmitByKey.get(key) ?? 0;
    if (now - last < COOLDOWN_MS) {
      return NextResponse.json(
        { error: '送信が早すぎます。しばらくしてから再度お試しください。' },
        { status: 429 }
      );
    }
    lastSubmitByKey.set(key, now);

    await ensurePrismaConnected();
    await prisma.contactInquiry.create({
      data: {
        name,
        email: email ?? null,
        subject: subject && subject.length > 0 ? subject : null,
        message,
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[contact]', e);
    return NextResponse.json({ error: '送信に失敗しました。時間をおいて再度お試しください。' }, { status: 500 });
  }
}
