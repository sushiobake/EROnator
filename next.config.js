/** @type {import('next').NextConfig} */
const webpack = require('webpack');

const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/admin/tags', destination: '/admin', permanent: false },
    ];
  },
  env: {
    NEXT_PUBLIC_AFFILIATE_ID: process.env.AFFILIATE_ID || '',
  },
  // WorkTag 行列を Vercel のサーバーレスバンドルに含める（動的パスは NFT で検出されないため）
  experimental: {
    // Next 14: トップレベル serverExternalPackages は未対応。sudachi はランタイムで Node が読み込む。
    serverComponentsExternalPackages: ['sudachi'],
    outputFileTracingIncludes: {
      '/api/start': ['./data/workTagMatrix.json'],
      '/api/answer': ['./data/workTagMatrix.json'],
      '/api/reveal': ['./data/workTagMatrix.json'],
      '/api/admin/title-reading-initial/auto': ['./node_modules/sudachi/sudachi.js'],
      '/api/admin/title-reading-initial/auto/bulk-unconfirmed': ['./node_modules/sudachi/sudachi.js'],
    },
  },
  webpack(config, { isServer }) {
    if (isServer) {
      // sudachi.js 内の new URL('sudachi_bg.wasm', import.meta.url) は npm 同梱に wasm ファイルが無く、
      // 実体は wasmBASE64 + init(bytes) のトップレベル await。Webpack の静的解決だけが失敗するので無視する。
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /sudachi_bg\.wasm$/,
        })
      );
    }
    return config;
  },
};

module.exports = nextConfig;
