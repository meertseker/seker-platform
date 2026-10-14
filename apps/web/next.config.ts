import path from 'node:path';
import type { NextConfig } from 'next';

const monorepoRoot = path.resolve(process.cwd(), '../..');

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  transpilePackages: ['@seker/auth', '@seker/shared', '@seker/db'],
  experimental: {
    viewTransition: true,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async redirects() {
    return [
      {
        source: '/ucretler',
        destination: '/kayit',
        permanent: true,
      },
      {
        source: '/admin/:path*',
        destination: process.env.PANEL_URL ?? 'https://panel.sekeranaokulu.com',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
