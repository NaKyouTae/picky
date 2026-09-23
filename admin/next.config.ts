import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 워크스페이스 패키지는 소스로 들어오므로 Next 가 직접 트랜스파일한다
  transpilePackages: ['@picky/collage'],
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
