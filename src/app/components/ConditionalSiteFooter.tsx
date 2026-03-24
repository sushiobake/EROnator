'use client';

import { usePathname } from 'next/navigation';
import { SiteFooter } from './SiteFooter';

/**
 * ゲーム（/）では Stage 内の GameChromeFooter と二重になるためサイトフッターを出さない。
 * お問い合わせ・法務ページなどでは SiteFooter を表示する。
 */
export function ConditionalSiteFooter() {
  const pathname = usePathname();
  if (pathname === '/') return null;
  return <SiteFooter />;
}
