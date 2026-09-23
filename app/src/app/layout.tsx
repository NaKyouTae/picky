import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ViewportHeightSetter } from '@/components/viewport-height-setter';

/** 메인 화면의 고정폭 서체. 굵기는 디자인이 쓰는 Regular/Medium 만 받는다 */
const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

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
    <html lang="ko" className={`h-full ${jetBrainsMono.variable}`}>
      <body className="h-full bg-canvas">
        <ViewportHeightSetter />
        {/* 앱 셸 — 데스크톱 웹에서도 모바일 폭(max-w-shell)으로 화면 중앙에 고정한다.
            translate 로 인해 이 셸이 내부 fixed 요소의 컨테이닝 블록이 되므로,
            헤더·바텀시트 등 fixed 요소가 셸 기준으로 앵커링된다. */}
        <div
          className="fixed left-1/2 top-1/2 w-full max-w-shell -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-white shadow-shell"
          style={{ height: 'var(--app-h, 100dvh)' }}
        >
          <div
            id="app-scroll-container"
            className="relative h-full w-full overflow-y-auto overscroll-contain"
          >
            {/* flex 컨테이너 + min-h-full — 자식 페이지가 flex-1 로 남은 높이를 채워
                화면 세로 중앙 정렬을 할 수 있게 한다.
                하단 여백은 화면마다 다르므로(고정 CTA 유무) 각 페이지가 직접 준다. */}
            <main className="safe-top flex min-h-full flex-col">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
