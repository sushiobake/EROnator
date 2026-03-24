import type { Metadata } from 'next';
import { Noto_Sans_JP, Kosugi_Maru } from 'next/font/google';
import { SITE_TITLE } from '@/config/app';
import { AppProviders } from './components/AppProviders';
import { ConditionalSiteFooter } from './components/ConditionalSiteFooter';
import './globals.css';

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const kosugiMaru = Kosugi_Maru({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  variable: '--font-censored',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://eronator.com';

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: 'あなたの妄想、エロネイターが当ててみる？ 質問に答えて同人作品を推理するAIゲーム',
  icons: {
    icon: [{ url: '/ilust/inari_thinking_opening.png', type: 'image/png' }],
    apple: '/ilust/inari_thinking_opening.png',
  },
  openGraph: {
    title: SITE_TITLE,
    description: 'あなたの妄想、エロネイターが当ててみる？',
    type: 'website',
    url: siteUrl,
    images: [`${siteUrl}/api/og?q=15&result=success`],
    siteName: 'ERONATOR',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: 'あなたの妄想、エロネイターが当ててみる？',
    images: [`${siteUrl}/api/og?q=15&result=success`],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const vercelEnv = process.env.VERCEL_ENV ?? '';
  return (
    <html lang="ja">
      <body
        className={`${notoSansJP.className} ${kosugiMaru.variable}`}
        style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ERONATOR_VERCEL_ENV=${JSON.stringify(vercelEnv)};`,
          }}
        />
        <AppProviders>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</div>
          <ConditionalSiteFooter />
        </AppProviders>
      </body>
    </html>
  );
}
