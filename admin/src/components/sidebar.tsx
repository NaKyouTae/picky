'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const MENUS = [
  { href: '/', label: '대시보드' },
  { href: '/users', label: '사용자' },
] as const;

export function Sidebar({ username }: { username: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    router.replace('/login');
    router.refresh();
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-white p-4">
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

      <div className="mt-auto border-t border-line pt-3">
        <p className="px-3 text-sm font-medium">{username}</p>
        <button
          type="button"
          onClick={handleLogout}
          disabled={pending}
          className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-ink-sub hover:bg-gray-100 disabled:opacity-60"
        >
          {pending ? '로그아웃 중…' : '로그아웃'}
        </button>
      </div>
    </aside>
  );
}
