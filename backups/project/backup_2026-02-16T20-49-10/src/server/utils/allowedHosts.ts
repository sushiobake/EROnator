/**
 * サムネ許可ホスト判定 (Brief §3, Spec §15)
 * DB に保存済みの thumbnailUrl（DMM API / FANZA 等）を表示する場合はここにホストを追加
 */

// 許可ホストリスト（server側の定数）
// DMM API imageURL.large / FANZA og:image 等で返る画像ドメインを許可（B: DBのURL表示を試す）
const ALLOWED_THUMB_HOSTS: string[] = [
  'p.dmm.co.jp',
  'dmm.co.jp',
  'www.dmm.co.jp',
  'db.fanza.co.jp',
  'fanza.co.jp',
  'www.fanza.co.jp',
  'cc3001.dmm.co.jp',
  'dmkt-sp.jp',
];

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
