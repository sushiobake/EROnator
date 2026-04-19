/**
 * 管理画面の本番プレイ履歴：参照元 JSON → 一行説明（日本語）
 */

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
      const shortRaw = `このサイト内の直前のページ：${internal}`;
      const short = shortRaw.length > 52 ? `${shortRaw.slice(0, 49)}…` : shortRaw;
      return { short, title: internal };
    }

    const land = o.landing?.trim() ?? '';
    if (land === '' || land === '/') {
      return {
        short: '直接アクセス（参照元のURLなし）',
        title: json,
      };
    }

    const shortRaw = `開いたページ：${land}`;
    const short = shortRaw.length > 52 ? `${shortRaw.slice(0, 49)}…` : shortRaw;
    return { short, title: land };
  } catch {
    return { short: '参照元データを表示できません', title: json };
  }
}
