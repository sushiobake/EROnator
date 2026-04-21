/**
 * 管理画面の本番プレイ履歴：参照元 JSON → 一行説明（日本語）
 */

const PAGE_PATH_LABELS: Record<string, string> = {
  '/': 'トップページ（ゲームメイン）',
  '/terms': '利用規約',
  '/privacy': 'プライバシーポリシー',
  '/contact': 'お問い合わせ',
  '/affiliate': 'アフィリエイト情報',
  '/admin': '管理画面',
  '/admin/tags': '管理画面 - タグ管理',
  '/admin/whitelist': '管理画面 - ホワイトリスト',
};

function resolvePathLabel(path: string): string {
  const cleanPath = (path.split('?')[0] ?? path).replace(/\/$/, '') || '/';
  return PAGE_PATH_LABELS[cleanPath] ?? path;
}

export function trafficAttributionAdminLabel(
  json: string | null | undefined
): { short: string; title: string } {
  if (!json || typeof json !== 'string') {
    return { short: '', title: '' };
  }
  try {
    const o = JSON.parse(json) as {
      referrer?: string | null;
      landing?: string | null;
      utm?: Record<string, string>;
      internalFrom?: string | null;
    };

    const utm = o.utm;
    if (utm?.source) {
      const parts = [`リンク・計測：${utm.source}`];
      if (utm.medium) parts.push(`経路：${utm.medium}`);
      if (utm.campaign) parts.push(`施策：${utm.campaign}`);
      const shortBase = parts[0]!;
      const short = shortBase.length > 52 ? `${shortBase.slice(0, 49)}…` : shortBase;
      const title = parts.join(' / ');
      return { short, title: title.length > 0 ? title : json };
    }

    if (o.referrer) {
      try {
        const u = new URL(o.referrer);
        const host = u.hostname.replace(/^www\./, '');
        const shortRaw = `別サイトから：${host}`;
        const short = shortRaw.length > 52 ? `${shortRaw.slice(0, 49)}…` : shortRaw;
        return { short, title: o.referrer };
      } catch {
        const shortRaw = `別サイトから：${o.referrer}`;
        const short = shortRaw.length > 52 ? `${shortRaw.slice(0, 49)}…` : shortRaw;
        return { short, title: o.referrer };
      }
    }

    const internal = o.internalFrom?.trim() ?? '';
    if (internal !== '') {
      const label = resolvePathLabel(internal);
      const shortRaw = `このサイト内の直前のページ：${label}`;
      const short = shortRaw.length > 52 ? `${shortRaw.slice(0, 49)}…` : shortRaw;
      return { short, title: label === internal ? internal : `${label}（${internal}）` };
    }

    const land = o.landing?.trim() ?? '';
    if (land === '' || land === '/') {
      return {
        short: '直接アクセス（参照元のURLなし）',
        title: json,
      };
    }

    const landLabel = resolvePathLabel(land);
    const shortRaw = `開いたページ：${landLabel}`;
    const short = shortRaw.length > 52 ? `${shortRaw.slice(0, 49)}…` : shortRaw;
    return { short, title: landLabel === land ? land : `${landLabel}（${land}）` };
  } catch {
    return { short: '参照元データを表示できません', title: json };
  }
}
