/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_AFFILIATE_ID: process.env.AFFILIATE_ID || '',
  },
}

module.exports = nextConfig
