/**
 * workId の正規化・重複チェック用ユーティリティ
 *
 * 背景: DMM content_id が ingest では cid:d_xxx、DMM import では d_xxx と
 * 混在して重複が発生していた。今後は統一して再発を防ぐ。
 */

/** DMM content_id 形式 (d_数字) */
const DMM_CONTENT_ID_RE = /^d_\d+$/;

/**
 * 正規化された workId を返す。
 * - DMM content_id (d_xxx) および cid:d_xxx は d_xxx に統一
 * - それ以外はそのまま
 */
export function toCanonicalWorkId(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return s;
  if (s.startsWith('cid:')) {
    const inner = s.slice(4);
    return DMM_CONTENT_ID_RE.test(inner) ? inner : s;
  }
  return s;
}

/**
 * 既存チェック用: この workId と同等とみなす全バリアント
 * （DB に cid:d_xxx / d_xxx のどちらで入っているか不明なため両方検索）
 */
export function getWorkIdLookupVariants(workId: string): string[] {
  const s = String(workId ?? '').trim();
  if (!s) return [];
  const variants = new Set<string>([s]);
  if (s.startsWith('cid:')) {
    variants.add(s.slice(4));
  } else if (DMM_CONTENT_ID_RE.test(s)) {
    variants.add(`cid:${s}`);
  }
  return [...variants];
}
