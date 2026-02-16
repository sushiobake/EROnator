/**
 * アフィリエイトリンクが正しく付与されるか検証するスクリプト
 * 実行: node scripts/verify-affiliate-link.js
 * または: AFFILIATE_ID=sok-xxxx node scripts/verify-affiliate-link.js
 */

// 1. next.config.js が AFFILIATE_ID を NEXT_PUBLIC_AFFILIATE_ID に渡すか確認
process.env.AFFILIATE_ID = process.env.AFFILIATE_ID || 'test-affiliate-id';
const nextConfig = require('../next.config.js');
const nextEnv = typeof nextConfig.env === 'function' ? nextConfig.env() : nextConfig.env;
const publicId = nextConfig.env?.NEXT_PUBLIC_AFFILIATE_ID ?? nextEnv?.NEXT_PUBLIC_AFFILIATE_ID ?? '';

console.log('=== 1. next.config.js の確認 ===');
console.log('  AFFILIATE_ID (入力):', process.env.AFFILIATE_ID);
console.log('  NEXT_PUBLIC_AFFILIATE_ID (ビルド時に埋め込まれる値):', publicId || '(空)');
if (publicId !== process.env.AFFILIATE_ID) {
  console.log('  ❌ 一致しません。next.config.js の env.NEXT_PUBLIC_AFFILIATE_ID を確認してください。');
  process.exit(1);
}
console.log('  ✅ next.config.js は AFFILIATE_ID を NEXT_PUBLIC_AFFILIATE_ID に正しく渡しています。\n');

// 2. ExternalLink と同じ URL 生成ロジック
function buildLink(href, affiliateId) {
  return affiliateId ? `${href}${href.includes('?') ? '&' : '?'}af_id=${affiliateId}` : href;
}

console.log('=== 2. リンク生成ロジック（ExternalLink と同じ） ===');
const testCases = [
  { href: 'https://www.fanza.jp/game/123/', id: 'sok-1234' },
  { href: 'https://www.fanza.jp/game/456/?ref=top', id: 'sok-1234' },
  { href: 'https://www.fanza.jp/game/789/', id: '' },
];
for (const { href, id } of testCases) {
  const url = buildLink(href, id);
  const hasAfId = url.includes('af_id=');
  console.log('  href:', href);
  console.log('  id:', id || '(空)');
  console.log('  →', url);
  console.log('  af_id 付与:', hasAfId ? '✅' : (id ? '❌' : '-(IDなしのため付与しない)'));
  console.log('');
}

// 3. 本番想定: ID があるとき必ず af_id が付くか
console.log('=== 3. 本番想定の確認 ===');
const prodUrl = 'https://www.fanza.jp/game/999/';
const prodResult = buildLink(prodUrl, publicId);
const ok = publicId && prodResult.includes('af_id=') && prodResult.endsWith('af_id=' + publicId);
if (ok) {
  console.log('  本番で AFFILIATE_ID を設定した場合のリンク例:');
  console.log('  ', prodResult);
  console.log('  ✅ アフィリエイトリンクが正しく生成されます。');
} else {
  console.log('  ID が空のため、またはロジック異常。');
  process.exit(1);
}

console.log('\n=== 検証完了 ===');
