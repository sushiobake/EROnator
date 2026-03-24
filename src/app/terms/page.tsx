import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalSubPageShell } from '@/app/components/LegalSubPageShell';

export const metadata: Metadata = {
  title: '利用規約 | 同人誌エロネイター',
  description: 'エロネイターの利用条件について',
};

const linkStyle = { color: '#5eead4' as const, textDecoration: 'underline' as const };

export default function TermsPage() {
  return (
    <LegalSubPageShell>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#f8fafc' }}>利用規約</h1>
      <p style={{ color: 'rgba(226,232,240,0.82)', marginBottom: '1.5rem', lineHeight: 1.7 }}>
        当サイトを利用することで、以下に同意したものとみなします。
      </p>
      <ol style={{ paddingLeft: '1.25rem', lineHeight: 1.75, marginBottom: '1.5rem' }}>
        <li style={{ marginBottom: '0.75rem' }}>
          当サイトは<strong>18歳未満の方の利用を禁止</strong>します。
        </li>
        <li style={{ marginBottom: '0.75rem' }}>
          推薦・検索結果・ゲームの推理結果は参考情報であり、内容の正確性・完全性を保証するものではありません。
        </li>
        <li style={{ marginBottom: '0.75rem' }}>
          サービス内容の変更・中断・終了を、予告なく行う場合があります。
        </li>
        <li style={{ marginBottom: '0.75rem' }}>
          当サイトの利用により生じた損害について、運営者は法令上責任を負う場合を除き責任を負いません。
        </li>
        <li style={{ marginBottom: '0.75rem' }}>
          外部サイト（FANZA 等）の利用は、各サイトの規約に従ってください。
        </li>
      </ol>
      <p style={{ fontSize: '0.85rem', color: 'rgba(148,163,184,0.95)' }}>
        ご不明点は{' '}
        <Link href="/contact" style={linkStyle}>
          お問い合わせ
        </Link>
        ください。最終更新: 2026年3月
      </p>
    </LegalSubPageShell>
  );
}
