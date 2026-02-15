/**
 * 管理画面アクセス制御（3重ロック）
 * 全ての条件を満たす必要あり
 * 
 * 1. process.env.ERONATOR_ADMIN === "1"
 * 2. process.env.NODE_ENV !== "production" または process.env.ERONATOR_ADMIN_PRODUCTION === "1"
 * 3. request header "x-eronator-admin-token" === process.env.ERONATOR_ADMIN_TOKEN
 */

export function isAdminAllowed(request: Request): boolean {
  // 1) process.env.ERONATOR_ADMIN === "1"
  if (process.env.ERONATOR_ADMIN !== '1') {
    return false;
  }

  // 2) 本番環境の場合は追加チェック
  if (process.env.NODE_ENV === 'production') {
    // 本番環境で許可する場合は ERONATOR_ADMIN_PRODUCTION === "1" が必要
    if (process.env.ERONATOR_ADMIN_PRODUCTION !== '1') {
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
