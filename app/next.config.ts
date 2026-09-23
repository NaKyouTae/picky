import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 워크스페이스 패키지는 소스로 들어오므로 Next 가 직접 트랜스파일한다
  transpilePackages: ['@picky/collage'],
  // 모노레포 루트 기준으로 파일 추적 (Vercel 배포 시 필요)
  outputFileTracingRoot: new URL('..', import.meta.url).pathname,
  images: {
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
