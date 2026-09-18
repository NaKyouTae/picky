import type { Metadata, Viewport } from 'next';
import './globals.css';
import { BottomNav } from '@/components/bottom-nav';

export const metadata: Metadata = {
  title: 'Picky',
  description: '순간',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Picky',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        {/* 모바일 전용 셸 — 데스크톱에서도 중앙 고정 폭 */}
        <div className="mx-auto flex min-h-dvh w-full max-w-shell flex-col bg-white">
          <main className="safe-top flex-1 pb-20">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
