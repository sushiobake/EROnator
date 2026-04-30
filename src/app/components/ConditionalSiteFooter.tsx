'use client';

import { usePathname } from 'next/navigation';
import { SiteFooter } from './SiteFooter';

/**
 * ゲーム（/）では Stage 内の GameChromeFooter と二重になるためサイトフッターを出さない。
 * お問い合わせ・法務ページなどでは SiteFooter を表示する。
 * /quiz-prototype は専用の軽量フッターを持つので、こちらは出さない。
 */
export function ConditionalSiteFooter() {
  const pathname = usePathname();
  if (pathname === '/') return null;
  if (pathname?.startsWith('/admin')) return null;
  if (pathname?.startsWith('/quiz-prototype')) return null;
  return <SiteFooter />;
}
