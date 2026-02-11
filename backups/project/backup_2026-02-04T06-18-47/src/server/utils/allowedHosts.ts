/**
 * サムネ許可ホスト判定 (Brief §3, Spec §15)
 * 許可ホストの初期値は空（= MVPでは原則サムネ非表示）で安全側
 */

// 許可ホストリスト（server側の定数）
// 後日、運用側が許可ホストを確定できたら、この定数を更新して解放する（configキー追加は禁止）
const ALLOWED_THUMB_HOSTS: string[] = [];

/**
 * URLのホストが許可されているか判定
 */
export function isAllowedThumbnailHost(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    return ALLOWED_THUMB_HOSTS.includes(urlObj.hostname);
  } catch {
    return false;
  }
}

/**
 * 許可ホストリストを取得（デバッグ用）
 */
export function getAllowedThumbHosts(): readonly string[] {
  return [...ALLOWED_THUMB_HOSTS];
}
