/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_AFFILIATE_ID: process.env.AFFILIATE_ID || '',
  },
  // WorkTag 行列を Vercel のサーバーレスバンドルに含める（動的パスは NFT で検出されないため）
  experimental: {
    outputFileTracingIncludes: {
      '/api/start': ['./data/workTagMatrix.json'],
      '/api/answer': ['./data/workTagMatrix.json'],
      '/api/reveal': ['./data/workTagMatrix.json'],
    },
  },
}

module.exports = nextConfig
