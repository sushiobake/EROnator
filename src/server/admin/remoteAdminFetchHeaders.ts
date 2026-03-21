/**
 * Vercel 等が Node のデフォルト User-Agent を弾き HTML/404 になるのを避けるため、
 * リモートの /api/admin/* へ fetch するときに付与するヘッダ。
 *
 * Deployment Protection 有効時は、Vercel の「Protection Bypass for Automation」で発行した
 * シークレットを .env.local のいずれかに置く:
 *   ERONATOR_VERCEL_PROTECTION_BYPASS=...  または  VERCEL_AUTOMATION_BYPASS_SECRET=...
 * → x-vercel-protection-bypass ヘッダが付く（ローカル npm run dev からプレビューへ fetch する場合に必要なことが多い）
 */
export function getVercelProtectionBypassSecret(): string | undefined {
  const a = process.env.ERONATOR_VERCEL_PROTECTION_BYPASS?.trim();
  const b = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  return a || b || undefined;
}

export function remoteAdminFetchHeaders(token: string): HeadersInit {
  const h: Record<string, string> = {
    'x-eronator-admin-token': token,
    Accept: 'application/json',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };
  const bypass = getVercelProtectionBypassSecret();
  if (bypass) {
    h['x-vercel-protection-bypass'] = bypass;
  }
  return h;
}

/** クエリ付き URL にバイパスを足す（ヘッダが効かない場合の保険） */
export function appendVercelProtectionBypassQuery(url: string): string {
  const bypass = getVercelProtectionBypassSecret();
  if (!bypass) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
}
