import type { Metadata } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import { SITE_TITLE } from '@/config/app';
import './globals.css';

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: '質問に答えて同人作品を推理する',
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
