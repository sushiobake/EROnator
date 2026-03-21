import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'アフィリエイトについて | 同人誌エロネイター',
  description: 'エロネイターの広告・成果報酬リンクについて',
};

export default function AffiliatePage() {
  return (
    <div style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>アフィリエイトについて</h1>
      <p style={{ lineHeight: 1.75, marginBottom: '1rem' }}>
        当サイト（同人誌エロネイター）は、FANZA / DMM をはじめとする外部サービスへのリンクに、成果報酬型のプログラム（アフィリエイト）が含まれる場合があります。
      </p>
      <p style={{ lineHeight: 1.75, marginBottom: '1rem' }}>
        ユーザーが当サイト経由で商品を購入等した場合、運営者に紹介料が支払われることがあります。商品の価格はリンク経由でも変わりません。
      </p>
      <p style={{ lineHeight: 1.75 }}>
        <Link href="/privacy" style={{ color: 'var(--color-primary)' }}>
          プライバシーについて
        </Link>
      </p>
    </div>
  );
}
