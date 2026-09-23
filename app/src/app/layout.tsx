import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { NativeSplash } from '@/components/native-splash';
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
        <NativeSplash />
        {/* 앱 셸 — 화면 중앙에 고정한다. 폰에서는 화면을 꽉 채우고, 데스크톱에서만
            디자인 폭(390px) 프레임으로 좁아진다 (globals.css 의 app-shell).
            translate 로 인해 이 셸이 내부 fixed 요소의 컨테이닝 블록이 되므로,
            헤더·바텀시트 등 fixed 요소가 셸 기준으로 앵커링된다. */}
        <div
          className="app-shell fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden bg-white"
          style={{ height: 'var(--app-h, 100dvh)' }}
        >
          {/* overscroll-none — 체이닝뿐 아니라 고무줄 바운스까지 끈다.
              contain 은 바운스를 남기는데, 그때 밀려난 자리에 셸의 흰 배경이 드러나서
              다크 화면(홈·챌린지·콜라주)에서 특히 눈에 띄었다.
              네이티브 쪽 바운스는 WebView.swift 의 scrollView.bounces = false 가 이미 껐다. */}
          <div
            id="app-scroll-container"
            className="relative h-full w-full overflow-y-auto overscroll-none"
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
