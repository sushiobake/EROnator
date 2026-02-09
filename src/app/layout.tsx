import type { Metadata } from 'next';
import { SITE_TITLE } from '@/config/app';

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: 'Akinator風の同人作品推測ゲーム',
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
        style={{
          fontFamily: '"Hiragino Maru Gothic ProN", "ヒラギノ丸ゴ ProN", "メイリオ", Meiryo, sans-serif',
        }}
      >
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
