'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const MENUS = [
  { href: '/', label: '대시보드' },
  { href: '/users', label: '사용자' },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-line bg-white p-4">
      <div className="px-2 py-3 text-lg font-bold">
        Picky <span className="text-brand-500">Admin</span>
      </div>
      <nav className="mt-4 space-y-1">
        {MENUS.map((menu) => (
          <Link
            key={menu.href}
            href={menu.href}
            className={cn(
              'block rounded-lg px-3 py-2 text-sm font-medium',
              pathname === menu.href
                ? 'bg-brand-500/10 text-brand-600'
                : 'text-ink-sub hover:bg-gray-100',
            )}
          >
            {menu.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
