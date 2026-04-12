/**
 * HARD_CONFIRM で YES のとき、revealThreshold を待たずに断定へ進める判定。
 * 本番 handleAnswerResponse とシミュレーションで共有。
 */
import type { MvpConfig } from '@/server/config/schema';
import type { QuestionHistoryEntry } from '@/server/session/manager';

export function shouldForceRevealAfterHardConfirmYes(
  lastAnswered: QuestionHistoryEntry | undefined,
  confidence: number,
  config: MvpConfig
): boolean {
  const opt = config.confirm.hardConfirmYesAutoReveal;
  if (opt?.enabled === false) return false;
  if (!lastAnswered || lastAnswered.kind !== 'HARD_CONFIRM') return false;

  const ans = lastAnswered.answer;
  if (ans !== 'YES' && ans !== 'PROBABLY_YES') return false;

  const t = lastAnswered.hardConfirmType;
  if (t === 'TITLE_INITIAL' || t === 'CHARACTER') return true;
  if (t === 'AUTHOR') {
    const minC = opt?.authorMinConfidence ?? 0.3;
    return confidence >= minC;
  }
  return false;
}
