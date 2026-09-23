import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Picky Admin',
  description: 'Picky 관리자',
};

/** 모바일에서 확대/축소는 막지 않는다 — 표를 키워 보는 게 어드민에서는 실제로 쓸모 있다 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
