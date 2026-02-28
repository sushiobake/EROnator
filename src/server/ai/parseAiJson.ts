/**
 * AI レスポンスの JSON パース耐性ユーティリティ
 * 未エスケープの " などよくある壊れ方を修復してからパース
 */

/**
 * 文字列値内の未エスケープ " を修復（例: "OMNIBUS" の前後の "）
 * " の直後に [A-Za-z0-9/] が続く場合、その " は文字列内の引用とみなしてエスケープ
 */
function repairUnescapedQuotes(jsonStr: string): string {
  return jsonStr.replace(/"([A-Za-z0-9/])/g, '\\"$1');
}

/**
 * JSON 文字列をパース。失敗時は修復を試みて再パース
 * @returns { parsed, repaired, retried } - 修復・リトライしたかどうか
 */
export function parseAiJson<T>(jsonStr: string): { data: T; repaired?: boolean } {
  try {
    const data = JSON.parse(jsonStr) as T;
    return { data };
  } catch {
    const repaired = repairUnescapedQuotes(jsonStr);
    try {
      const data = JSON.parse(repaired) as T;
      return { data, repaired: true };
    } catch {
      throw new Error('JSON parse failed (repair attempted)');
    }
  }
}
