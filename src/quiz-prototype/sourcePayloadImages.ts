/**
 * Work.sourcePayload（DMM ItemList JSON）からサンプル画像 URL 配列を取り出す
 */

export function extractSampleImageUrls(sourcePayloadStr: string | null | undefined): string[] | null {
  if (!sourcePayloadStr || sourcePayloadStr === '{}') return null;
  try {
    const p = JSON.parse(sourcePayloadStr) as Record<string, unknown>;
    const si = p.sampleImageURL as Record<string, unknown> | undefined;
    if (!si) return null;
    const large = si.sample_l as { image?: unknown } | undefined;
    const small = si.sample_s as { image?: unknown } | undefined;
    const raw = large?.image ?? small?.image;
    if (!raw || !Array.isArray(raw)) return null;
    const urls = raw.filter((u): u is string => typeof u === 'string' && u.length > 0);
    return urls.length ? urls : null;
  } catch {
    return null;
  }
}
