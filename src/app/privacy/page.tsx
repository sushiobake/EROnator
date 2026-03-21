import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'プライバシー | 同人誌エロネイター',
  description: 'エロネイターの個人情報の取り扱いについて',
};

export default function PrivacyPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>プライバシーについて</h1>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', lineHeight: 1.7 }}>
        本サイト（同人誌エロネイター、以下「当サイト」）は、個人による非営利・趣味の提供を目的としています。
      </p>
      <section style={{ marginBottom: '1.5rem', lineHeight: 1.75 }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>取得する情報</h2>
        <ul style={{ paddingLeft: '1.25rem' }}>
          <li>ゲームプレイに伴うセッション情報（ブラウザの localStorage に保存される識別子、サーバー上の推論用データ）</li>
          <li>お問い合わせフォームにご入力いただいた氏名・メールアドレス・内容</li>
          <li>アクセス解析（ページ閲覧などの統計。Vercel Analytics を利用する場合があります）</li>
          <li>外部サイト（FANZA 等）へのリンク遷移に関する記録（運営改善のため）</li>
        </ul>
      </section>
      <section style={{ marginBottom: '1.5rem', lineHeight: 1.75 }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>利用目的</h2>
        <p>サービスの提供・不具合対応・お問い合わせへの返信・品質改善のため。</p>
      </section>
      <section style={{ marginBottom: '1.5rem', lineHeight: 1.75 }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>第三者提供</h2>
        <p>
          お問い合わせの送受信や解析に、ホスティング・メール送信等のサービスを利用する場合があります。アフィリエイトリンク先の事業者による
          Cookie 等の取得については、各サイトのポリシーに従います。
        </p>
      </section>
      <section style={{ marginBottom: '1.5rem', lineHeight: 1.75 }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '0.5rem' }}>お問い合わせ</h2>
        <p>
          <Link href="/contact" style={{ color: 'var(--color-primary)' }}>
            お問い合わせフォーム
          </Link>
          からご連絡ください。
        </p>
      </section>
      <p style={{ fontSize: '0.85rem', color: 'var(--color-text-subtle)' }}>
        本ページの内容は必要に応じて更新されます。最終更新: 2026年3月
      </p>
    </div>
  );
}
