import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'エロネーター MVP0',
  description: 'Akinator風の同人作品推測ゲーム',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          fontFamily: '"Hiragino Maru Gothic ProN", "ヒラギノ丸ゴ ProN", "メイリオ", Meiryo, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
