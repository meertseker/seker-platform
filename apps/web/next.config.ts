import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
