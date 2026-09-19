import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: new URL('..', import.meta.url).pathname,
  images: {
    // 스티커 템플릿 이미지는 Supabase Storage 의 public 버킷에서 온다
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
