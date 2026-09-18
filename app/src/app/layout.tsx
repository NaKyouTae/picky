import type { Metadata, Viewport } from 'next';
import './globals.css';
import { BottomNav } from '@/components/bottom-nav';
import { ViewportHeightSetter } from '@/components/viewport-height-setter';

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
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full bg-canvas">
        <ViewportHeightSetter />
        {/* 앱 셸 — 데스크톱 웹에서도 모바일 폭(max-w-shell)으로 화면 중앙에 고정한다.
            translate 로 인해 이 셸이 내부 fixed 요소의 컨테이닝 블록이 되므로,
            헤더·바텀시트·하단 네비 등 fixed 요소가 셸 기준으로 앵커링된다. */}
        <div
          className="fixed left-1/2 top-1/2 w-full max-w-shell -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-white shadow-shell"
          style={{ height: 'var(--app-h, 100dvh)' }}
        >
          <div
            id="app-scroll-container"
            className="relative h-full w-full overflow-y-auto overscroll-contain"
          >
            <main className="safe-top pb-nav">{children}</main>
          </div>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
