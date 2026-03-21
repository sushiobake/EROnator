'use client';

import { useEffect, useRef, useState } from 'react';

/** 画像にモザイク（ピクセル化）。Xのセンシティブ判定対策。RecommendMode / Success で共用 */
export function MosaicImage({
  src,
  alt: _alt,
  style,
}: {
  src: string;
  /** 装飾用（canvas 表示のため alt は未使用） */
  alt: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !src) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      const block = Math.max(4, Math.floor(Math.min(w, h) / 12));
      const sw = Math.ceil(w / block);
      const sh = Math.ceil(h / block);
      ctx.drawImage(img, 0, 0, sw, sh);
      ctx.drawImage(canvas, 0, 0, sw, sh, 0, 0, w, h);
      setReady(true);
    };
    img.onerror = () => setReady(true);
    img.src = src;
  }, [src]);
  return (
    <canvas
      ref={canvasRef}
      style={{
        ...style,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: ready ? 'block' : 'none',
      }}
      aria-hidden
    />
  );
}
