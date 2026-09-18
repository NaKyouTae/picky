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
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-shell border-t border-line bg-white/95 backdrop-blur">
      <ul className="flex">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn(
                  'flex h-14 min-h-11 items-center justify-center text-sm font-medium',
                  active ? 'text-brand-500' : 'text-ink-sub',
                )}
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
