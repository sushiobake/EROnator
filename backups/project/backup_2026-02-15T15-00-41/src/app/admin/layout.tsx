/**
 * 管理画面レイアウト
 * 本番（Vercel production）では /admin 以下を 404 にし、管理はローカルのみとする
 */

import { notFound } from 'next/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.VERCEL_ENV === 'production') {
    notFound();
  }
  return <>{children}</>;
}
