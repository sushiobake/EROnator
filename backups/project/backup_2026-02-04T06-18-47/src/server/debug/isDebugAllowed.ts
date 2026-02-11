/**
 * デバッグ有効化判定（3重ロック）
 * 全ての条件を満たす必要あり
 */

export function isDebugAllowed(request: Request): boolean {
  // 1) process.env.ERONATOR_DEBUG === "1"
  if (process.env.ERONATOR_DEBUG !== '1') {
    return false;
  }

  // 2) process.env.NODE_ENV !== "production"
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  // 3) request header "x-eronator-debug-token" === process.env.ERONATOR_DEBUG_TOKEN
  const debugToken = request.headers.get('x-eronator-debug-token');
  const expectedToken = process.env.ERONATOR_DEBUG_TOKEN;
  
  if (!debugToken || !expectedToken || debugToken !== expectedToken) {
    return false;
  }

  return true;
}
