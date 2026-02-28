/**
 * OG 画像動的生成
 * GET /api/og?q=15&result=success
 * GET /api/og?q=20&result=fail
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '??';
  const result = searchParams.get('result') || 'success';

  const isSuccess = result === 'success';
  const bgGradient = isSuccess
    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    : 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
  const mainText = isSuccess ? `${q}問で当てた！` : `${q}問 惜しかった…！`;
  const subText = 'あなたの妄想、エロネイターが当ててみる？';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: bgGradient,
          fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: 32,
            padding: '48px 64px',
            border: '2px solid rgba(255,255,255,0.3)',
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '0.1em',
              marginBottom: 16,
              textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            ERONATOR
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: '#fff',
              textShadow: '0 4px 16px rgba(0,0,0,0.4)',
              marginBottom: 24,
            }}
          >
            {mainText}
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.9)',
              textShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            {subText}
          </div>
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            right: 40,
            fontSize: 18,
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          #エロネイター
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
