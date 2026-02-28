import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * /api/admin/* への全リクエストを認証チェック
 * 個別ルートの isAdminAllowed と同等の3重ロック
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }

  if (process.env.ERONATOR_ADMIN !== '1') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (process.env.NODE_ENV === 'production' && process.env.ERONATOR_ADMIN_PRODUCTION !== '1') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const adminToken = request.headers.get('x-eronator-admin-token');
  const expectedToken = process.env.ERONATOR_ADMIN_TOKEN;
  if (!adminToken || !expectedToken || adminToken !== expectedToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/admin/:path*',
};
