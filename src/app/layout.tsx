import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import { SITE_TITLE } from '@/config/app';
import './globals.css';

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://eronator.com';

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: 'あなたの妄想、エロネイターが当ててみる？ 質問に答えて同人作品を推理するAIゲーム',
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
      <body className={notoSansJP.className}>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__ERONATOR_VERCEL_ENV=${JSON.stringify(vercelEnv)};`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
