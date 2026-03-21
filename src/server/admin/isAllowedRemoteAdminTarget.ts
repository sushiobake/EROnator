/**
 * ローカル開発時のみ使う: 管理画面のリモートプロキシが fetch してよい targetUrl か（SSRF 緩和）。
 * 本番ビルドではこれらのルート自体が無効。
 */

const ALLOWED_ORIGINS = () =>
  (process.env.PRODUCTION_APP_URL || process.env.NEXT_PUBLIC_PRODUCTION_APP_URL || '')
    .split(',')
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean);

function trustVercelAppEnabled(): boolean {
  const v = process.env.ERONATOR_REMOTE_ADMIN_TRUST_VERCEL_APP;
  return v === '1' || v === 'true';
}

/** Vercel のデプロイ（本番・プレビューともホストが *.vercel.app） */
function isTrustedVercelAppUrl(u: URL): boolean {
  if (u.protocol.toLowerCase() !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (host === 'vercel.app') return false;
  return host.endsWith('.vercel.app');
}

export function isAllowedRemoteAdminTargetUrl(url: string): boolean {
  if (!url) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }

  if (trustVercelAppEnabled() && isTrustedVercelAppUrl(u)) {
    return true;
  }

  const origin = `${u.protocol}//${u.host}`.toLowerCase();
  return ALLOWED_ORIGINS().some((o) => origin === o || origin.startsWith(o));
}
