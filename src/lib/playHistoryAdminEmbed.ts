/**
 * 管理画面のプレイ履歴「正解埋め込み」用ラベル・文言（日本語）
 */

/** DB の outcome はそのままに、埋め込み済みなら一覧用の表示ラベルを返す */
export function playHistoryOutcomeAdminLabel(
  outcome: string,
  resultWorkId: string | null | undefined
): string {
  if (outcome === 'NOT_IN_LIST' && resultWorkId) {
    return 'NOT_IN_LIST（正解埋め込み済み）';
  }
  if (outcome === 'FAIL_LIST' && resultWorkId) {
    return 'FAIL_LIST（正解埋め込み済み）';
  }
  return outcome;
}

export const PLAY_HISTORY_EMBED_COPY = {
  buttonOpen: '正解を埋め込む',
  buttonClosePanel: '埋め込みパネルを閉じる',
  heading: '候補にないなら、ここで検索してみて',
  intro: 'タイトルの一部でいいから、入れてみて。',
  placeholder: '例: 鬼、学園、寝取られ など',
  searching: '検索中...',
  saving: '保存中...',
  pickHint: '一覧から正解作品をクリックすると保存します。',
  success: '正解を埋め込みました。',
  remoteNeedsUrl: 'リモートの履歴を更新するには「本番URL」または「プレビューURL」を入力してください。',
  adminBannerTitle: '管理者による正解埋め込み',
  embedFailed: '埋め込みに失敗しました。',
} as const;

export function playHistoryEmbedConfirmMessage(title: string, authorName: string): string {
  return `次の作品を正解として埋め込みます。\n\n${title}\n${authorName}\n\nよろしいですか？`;
}

/** 詳細モーダル用: 埋め込み日時と検索語の1行 */
export function adminEmbeddedDetailLine(isoAt: unknown, searchQuery: unknown): string {
  const at = typeof isoAt === 'string' && isoAt ? isoAt : '—';
  const sq =
    typeof searchQuery === 'string' && searchQuery.trim() !== ''
      ? ` · 検索語: ${searchQuery}`
      : '';
  return `${at}${sq}`;
}
