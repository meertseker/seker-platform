import path from 'node:path';
import type { NextConfig } from 'next';

const monorepoRoot = path.resolve(process.cwd(), '../..');

const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  transpilePackages: ['@seker/auth', '@seker/shared', '@seker/db'],
  cacheComponents: true,
  experimental: {
    viewTransition: true,
    serverActions: { bodySizeLimit: '11mb' },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: mediaBase ? [new URL(`${mediaBase}/site-images/**`)] : [],
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
