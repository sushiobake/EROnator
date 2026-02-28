/**
 * 作品頭文字（titleReadingInitial）のパース
 * 保存形式: "カ" または "カ,サ"（カンマ区切り、メイン,サブ）
 * ソートはメインのみ、ゲーム判定はメイン or サブのいずれかでマッチすれば YES
 */

/** カンマ区切りをパースして配列で返す（メイン, サブ） */
export function getTitleReadingInitials(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** ソート用：メイン（先頭）の1文字を返す */
export function getPrimaryInitial(raw: string | null | undefined): string {
  const initials = getTitleReadingInitials(raw);
  return initials[0] ?? '';
}
