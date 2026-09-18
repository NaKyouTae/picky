'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/', label: '홈' },
  { href: '/search', label: '탐색' },
  { href: '/my', label: '마이' },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    // 앱 셸 내부에 absolute 로 붙인다 — 셸이 뷰포트 높이에 고정돼 있으므로
    // 데스크톱에서도 셸 하단(= 모바일 화면 하단)에 정확히 앵커링된다.
    <nav className="safe-bottom absolute inset-x-0 bottom-0 z-50 border-t border-line bg-white/95 backdrop-blur">
      <ul className="flex">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  'flex min-h-11 items-center justify-center text-sm font-medium',
                  active ? 'text-brand-500' : 'text-ink-sub',
                )}
                style={{ height: 'var(--nav-height)' }}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
