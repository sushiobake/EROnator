/**
 * 問い合わせフォームページ
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { APP_VERSION } from '@/config/app';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      // ここでAPIを呼び出す（後で実装可能）
      // 現時点ではクライアント側でのバリデーションのみ
      if (!formData.name || !formData.email || !formData.message) {
        setSubmitStatus('error');
        alert('必須項目を入力してください。');
        setIsSubmitting(false);
        return;
      }

      // 簡易的な送信処理（実際のAPI実装は後で追加可能）
      console.log('Contact form submitted:', formData);
      
      // 成功メッセージ
      setSubmitStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '' });
      
      // 3秒後にステータスをリセット
      setTimeout(() => {
        setSubmitStatus('idle');
      }, 3000);
    } catch (error) {
      setSubmitStatus('error');
      alert('送信に失敗しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/" style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}>
          ← トップページに戻る
        </Link>
      </div>

      <h1 style={{ fontSize: '1.8rem', marginBottom: '1rem', fontWeight: 'bold' }}>
        お問い合わせ
      </h1>
      <p style={{ marginBottom: '2rem', color: 'var(--color-text-muted)' }}>
        ご質問やご意見がございましたら、以下のフォームよりお問い合わせください。
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label
            htmlFor="name"
            style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}
          >
            お名前 <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label
            htmlFor="email"
            style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}
          >
            メールアドレス <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label
            htmlFor="subject"
            style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}
          >
            件名
          </label>
          <select
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
            }}
          >
            <option value="">選択してください</option>
            <option value="bug">不具合報告</option>
            <option value="feature">機能要望</option>
            <option value="question">質問</option>
            <option value="other">その他</option>
          </select>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label
            htmlFor="message"
            style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}
          >
            お問い合わせ内容 <span style={{ color: 'red' }}>*</span>
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            required
            rows={8}
            style={{
              width: '100%',
              padding: '0.5rem',
              fontSize: '1rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              resize: 'vertical',
            }}
          />
        </div>

        {submitStatus === 'success' && (
          <div
            style={{
              padding: '1rem',
              marginBottom: '1rem',
              backgroundColor: '#d4edda',
              color: '#155724',
              border: '1px solid #c3e6cb',
              borderRadius: '4px',
            }}
          >
            お問い合わせを受け付けました。ありがとうございます。
          </div>
        )}

        {submitStatus === 'error' && (
          <div
            style={{
              padding: '1rem',
              marginBottom: '1rem',
              backgroundColor: '#f8d7da',
              color: '#721c24',
              border: '1px solid #f5c6cb',
              borderRadius: '4px',
            }}
          >
            送信に失敗しました。もう一度お試しください。
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '0.75rem',
            fontSize: '1rem',
            fontWeight: 'bold',
            backgroundColor: isSubmitting ? '#ccc' : 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => {
            if (!isSubmitting) {
              e.currentTarget.style.backgroundColor = 'var(--color-primary-hover)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSubmitting) {
              e.currentTarget.style.backgroundColor = 'var(--color-primary)';
            }
          }}
        >
          {isSubmitting ? '送信中...' : '送信'}
        </button>
      </form>

      <p style={{ marginTop: '2rem', fontSize: '0.875rem', color: 'var(--color-text-subtle)' }}>
        {APP_VERSION}
      </p>
    </div>
  );
}
