/**
 * 管理画面アクセス制御（3重ロック）
 * 全ての条件を満たす必要あり
 *
 * ■ Vercel プレビュー（VERCEL_ENV=preview）だけ例外:
 *   ERONATOR_ADMIN を Vercel にコピーしなくてよい。トークン一致のみで /api/admin/* を許可。
 *
 * ■ それ以外（ローカル・本番・Vercel 本番）:
 * 1. process.env.ERONATOR_ADMIN === "1"
 * 2. process.env.NODE_ENV !== "production" または本番でも管理を許可する条件
 *    （ERONATOR_ADMIN_PRODUCTION=1、または Vercel 上では VERCEL=1 で自動付与のため追加変数不要）
 * 3. request header "x-eronator-admin-token" === process.env.ERONATOR_ADMIN_TOKEN
 */

/** 本番ビルドで管理APIを有効にする条件（いずれか） */
export function isAdminProductionAccessEnabled(): boolean {
  if (process.env.ERONATOR_ADMIN_PRODUCTION === '1') return true;
  // Vercel は本番・プレビューとも VERCEL=1 を付与。手動で ERONATOR_ADMIN_PRODUCTION を足さなくてよい。
  if (process.env.VERCEL === '1') return true;
  return false;
}

/**
 * Vercel のプレビューデプロイ専用: トークンだけ合えば管理API可（Preview に ERONATOR_ADMIN を複製不要）
 */
export function isAdminAllowedOnVercelPreview(request: Request): boolean {
  if (process.env.VERCEL_ENV !== 'preview') return false;
  const adminToken = request.headers.get('x-eronator-admin-token');
  const expectedToken = process.env.ERONATOR_ADMIN_TOKEN;
  return !!(adminToken && expectedToken && adminToken === expectedToken);
}

export function isAdminAllowed(request: Request): boolean {
  if (isAdminAllowedOnVercelPreview(request)) {
    return true;
  }

  // 1) process.env.ERONATOR_ADMIN === "1"
  if (process.env.ERONATOR_ADMIN !== '1') {
    return false;
  }

  // 2) 本番環境の場合は追加チェック
  if (process.env.NODE_ENV === 'production') {
    if (!isAdminProductionAccessEnabled()) {
      return false;
    }
  }

  // 3) request header "x-eronator-admin-token" === process.env.ERONATOR_ADMIN_TOKEN
  const adminToken = request.headers.get('x-eronator-admin-token');
  const expectedToken = process.env.ERONATOR_ADMIN_TOKEN;
  
  if (!adminToken || !expectedToken || adminToken !== expectedToken) {
    return false;
  }

  return true;
}
