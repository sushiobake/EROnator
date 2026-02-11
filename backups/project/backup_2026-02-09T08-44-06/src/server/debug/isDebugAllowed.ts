/**
 * デバッグ有効化判定
 * - 本番（production）では常に無効
 * - プレビュー（Vercel preview）ではトークン一致で有効（デプロイ版とローカルの差を確認しやすくする）
 * - ローカルでは ERONATOR_DEBUG=1 かつ NODE_ENV !== production かつトークン一致で有効
 */

export function isDebugAllowed(request: Request): boolean {
  const debugToken = request.headers.get('x-eronator-debug-token');
  const expectedToken = process.env.ERONATOR_DEBUG_TOKEN;
  if (!debugToken || !expectedToken || debugToken !== expectedToken) {
    return false;
  }

  // 本番は常に無効（プレビューは VERCEL_ENV=preview で区別）
  if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV !== 'preview') {
    return false;
  }

  // プレビュー環境: トークン一致なら有効
  if (process.env.VERCEL_ENV === 'preview') {
    return true;
  }

  // ローカル: ERONATOR_DEBUG=1 かつ NODE_ENV !== production
  if (process.env.ERONATOR_DEBUG !== '1') {
    return false;
  }
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  return true;
}
