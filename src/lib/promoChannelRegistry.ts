/**
 * 配布先の既定マスタ（型と初期データ）。
 * 管理画面ではローカルストレージの上書き一覧が優先され、未設定時はこの配列が使われます。
 */

export interface PromoPostTemplate {
  id: string;
  label: string;
  body: string;
}

export interface PromoChannelDef {
  /** URL の r= と DB 保存 JSON の r（小文字推奨。サーバは 32 文字まで許可） */
  id: string;
  /** 配布先セレクトに出す表示名 */
  label: string;
  /** セレクト右のヒント（省略時は r=<id> を表示側で補完可） */
  hint?: string;
  /** 流入列の括弧前に使う短い媒体名（例: X, ci-en） */
  snsName: string;
  utm: { source: string; medium: string };
  postTemplates?: PromoPostTemplate[];
  /** 指定 id のチャンネルの postTemplates を流用（例: x1 → x） */
  inheritTemplatesFrom?: string;
}

const GENERIC_POST_TEMPLATES: PromoPostTemplate[] = [
  {
    id: 'generic-plain',
    label: '汎用 1 行',
    body: '同人誌当てAI「エロネイター」: {url}',
  },
];

/**
 * 既定の配布先一覧（順序がセレクトの並びになります）
 */
export const PROMO_CHANNELS: PromoChannelDef[] = [
  {
    id: 'c',
    label: 'ci-en',
    hint: 'r=c',
    snsName: 'ci-en',
    utm: { source: 'ci-en', medium: 'blog' },
    postTemplates: [
      {
        id: 'cien-intro',
        label: '記事用（挨拶あり）',
        body: 'こんにちは、エロネイターです🔮\n\nあなたが頭に思い浮かべた同人誌を、30問以内に当ててみせます。\n遊んでみた感想や「これも当ててほしい！」というお題を、ぜひコメントで教えてください。\n\n▼ プレイはこちら\n{url}',
      },
      {
        id: 'cien-short',
        label: '短文・お知らせ用',
        body: '【更新情報】エロネイター、今週も質問チューニング中です。\n30問以内でどれだけ当てられるか試してもらえると嬉しいです。\n\n{url}',
      },
    ],
  },
  {
    id: 'p',
    label: 'pommu',
    hint: 'r=p',
    snsName: 'pommu',
    utm: { source: 'pommu', medium: 'community' },
    postTemplates: [
      {
        id: 'pommu-generic',
        label: '一般告知用',
        body: 'エロネイターで「妄想した同人誌」を当ててもらうゲーム、公開しています。\n30問以内に当てる／外すの二択、気軽に一度遊んでみてください。\n\n{url}',
      },
    ],
  },
  {
    id: 'x',
    label: 'X（一般）',
    hint: 'r=x',
    snsName: 'X',
    utm: { source: 'twitter', medium: 'sns' },
    postTemplates: [
      {
        id: 'x-standard',
        label: '標準フック（140字前後）',
        body: '【同人誌クイズ】あなたが頭に思い浮かべた同人誌、エロネイターが30問以内に当ててみせる🔮\n#エロネイター #同人誌\n{url}',
      },
      {
        id: 'x-challenge',
        label: '挑戦状タイプ',
        body: 'エロネイターを困らせろ選手権。外せば君の勝ち。\n30問までに同人誌を当てます。\n#エロネイター\n{url}',
      },
      {
        id: 'x-result',
        label: '結果シェア想定',
        body: '妄想した同人誌、AI にバレた…\nあなたも試してみる？\n#エロネイター\n{url}',
      },
    ],
  },
  {
    id: 'x1',
    label: 'X（キャンペーン枠1）',
    hint: 'r=x1',
    snsName: 'X',
    utm: { source: 'twitter', medium: 'sns' },
    inheritTemplatesFrom: 'x',
  },
  {
    id: 'x2',
    label: 'X（キャンペーン枠2）',
    hint: 'r=x2',
    snsName: 'X',
    utm: { source: 'twitter', medium: 'sns' },
    inheritTemplatesFrom: 'x',
  },
  {
    id: 'n',
    label: 'note',
    hint: 'r=n',
    snsName: 'note',
    utm: { source: 'note', medium: 'blog' },
    postTemplates: [
      {
        id: 'note-lead',
        label: 'note 記事リード用',
        body: 'あなたが頭に浮かべた同人誌、AI が 30 問で当てます\n— エロネイター\n\n▼ 遊べる場所\n{url}\n',
      },
    ],
  },
  {
    id: '5ch',
    label: '5ch',
    hint: 'r=5ch',
    snsName: '5ch',
    utm: { source: '5ch', medium: 'forum' },
    postTemplates: [
      {
        id: '5ch-minimal',
        label: '最小文体（慎重に）',
        body: '同人誌当てるAIみたいなのがあったので貼っとく\n30問以内で当てるってやつ\n{url}',
      },
    ],
  },
];

export type PromoChannelId = (typeof PROMO_CHANNELS)[number]['id'];

export function cloneDefaultPromoChannels(): PromoChannelDef[] {
  return JSON.parse(JSON.stringify(PROMO_CHANNELS)) as PromoChannelDef[];
}

export function getPromoChannelById(id: string, channels: PromoChannelDef[] = PROMO_CHANNELS): PromoChannelDef | undefined {
  const key = id.trim().toLowerCase();
  return channels.find((c) => c.id.toLowerCase() === key);
}

export function getPromoUtm(id: string, channels: PromoChannelDef[] = PROMO_CHANNELS): { source: string; medium: string } {
  const ch = getPromoChannelById(id, channels);
  if (!ch) {
    return { source: 'eronator', medium: 'promo' };
  }
  return ch.utm;
}

/** 投稿テンプレ用: このチャンネルで使うテンプレ配列（無ければ汎用） */
export function getPostTemplatesForChannel(channelId: string, channels: PromoChannelDef[] = PROMO_CHANNELS): PromoPostTemplate[] {
  const ch = getPromoChannelById(channelId, channels);
  if (!ch) return GENERIC_POST_TEMPLATES;
  const sourceId = ch.inheritTemplatesFrom ?? ch.id;
  const source = getPromoChannelById(sourceId, channels);
  const direct = ch.postTemplates;
  if (direct && direct.length > 0) return direct;
  const inherited = source?.postTemplates;
  if (inherited && inherited.length > 0) return inherited;
  return GENERIC_POST_TEMPLATES;
}

/**
 * 流入 JSON の r 値から、管理画面用の短名（旧 resolveTrafficShortCodeDisplay の label）を返す
 */
export function resolveTrafficShortCodeDisplay(
  code: string,
  channels: PromoChannelDef[] = PROMO_CHANNELS
): { label: string; variant?: string } {
  const raw = code.trim().toLowerCase();
  const ch = getPromoChannelById(raw, channels);
  if (!ch) {
    return { label: code.trim() };
  }
  const variant = ch.inheritTemplatesFrom ? ch.id : undefined;
  return { label: ch.snsName, variant };
}

/** 流入列: 「X（r=x）」形式の一行目と、任意の二行目（ct） */
export function formatTrafficInflowLines(
  rRaw: string,
  ctRaw: string | null | undefined,
  channels: PromoChannelDef[] = PROMO_CHANNELS
): {
  line1: string;
  line2: string | null;
  title: string;
  cell: string;
} {
  const raw = rRaw.trim().toLowerCase();
  const ct = (ctRaw ?? '').trim();
  const ch = getPromoChannelById(raw, channels);
  const snsName = ch ? ch.snsName : rRaw.trim();
  const line1 = `${snsName}（r=${raw}）`;
  const line2 = ct ? `ct=${ct}` : null;
  const { variant } = resolveTrafficShortCodeDisplay(raw, channels);
  let title = line1;
  if (variant) {
    title = ct ? `${snsName}（${variant}: ${ct}）` : `${snsName}（${variant}）`;
  } else if (ct) {
    title = `${snsName}（${ct}）`;
  }
  const cell = line2 ? `${line1} ${line2}` : line1;
  return { line1, line2, title, cell };
}
