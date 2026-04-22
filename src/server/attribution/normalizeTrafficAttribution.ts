/**
 * /api/start から受け取る流入情報を検証・正規化し JSON 文字列化（DB 保存用）
 */

const MAX_URL = 1500;
const MAX_UTM = 128;
const MAX_R = 32;
const MAX_CT = 128;
const MAX_JSON = 4000;

function trimStr(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

/**
 * クライアントがオブジェクトで送ってきたら必ず1件分保存する（landing は未指定なら "/"）。
 * 管理画面で「直接アクセス」と「別サイト経由」を区別できるようにする。
 */
export function normalizeTrafficAttributionFromBody(body: unknown): string | null {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) return null;
  const o = body as Record<string, unknown>;

  const referrer = trimStr(o.referrer, MAX_URL);
  let landing = trimStr(o.landing, MAX_URL);
  if (landing == null || landing === '') {
    landing = '/';
  }

  let utm: Record<string, string> | undefined;
  if (o.utm != null && typeof o.utm === 'object' && !Array.isArray(o.utm)) {
    const raw = o.utm as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const key of ['source', 'medium', 'campaign', 'content', 'term'] as const) {
      const v = trimStr(raw[key], MAX_UTM);
      if (v) out[key] = v;
    }
    if (Object.keys(out).length > 0) utm = out;
  }

  /** SPA 遷移の直前パス（pathname + search）。document.referrer だけでは取れない */
  const internalFrom = trimStr(o.internalFrom, MAX_URL);
  const r = trimStr(o.r, MAX_R);
  const ct = trimStr(o.ct, MAX_CT);

  const payload: Record<string, unknown> = { landing };
  if (referrer) payload.referrer = referrer;
  if (utm) payload.utm = utm;
  if (internalFrom) payload.internalFrom = internalFrom;
  if (r) payload.r = r;
  if (ct) payload.ct = ct;

  let json = JSON.stringify(payload);
  if (json.length > MAX_JSON) {
    const shrink = {
      landing: landing.slice(0, 800),
      referrer: referrer ? referrer.slice(0, 400) : undefined,
      internalFrom: internalFrom ? internalFrom.slice(0, 400) : undefined,
      utm,
      r,
      ct,
    };
    json = JSON.stringify(shrink);
    if (json.length > MAX_JSON) {
      json = json.slice(0, MAX_JSON);
    }
  }
  return json;
}
