'use client';

import { useState, useEffect } from 'react';

/**
 * 選択肢表示直後の連打防止。キャラ画像クロスフェード(300ms)をカバーするため 350ms。
 */
export const CLICK_GUARD_MS = 350;

/**
 * マウント時または deps 変更時にクリックガードを有効化する。
 * @param deps 変更時にガードをリセットする依存配列（例: [questionCount]）
 * @returns ガード中は true
 */
export function useClickGuard(deps: React.DependencyList = []) {
  const [disabled, setDisabled] = useState(true);
  useEffect(() => {
    setDisabled(true);
    const t = setTimeout(() => setDisabled(false), CLICK_GUARD_MS);
    return () => clearTimeout(t);
  }, deps);
  return disabled;
}
