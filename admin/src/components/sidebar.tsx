'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * 사이드바 메뉴 — 다루는 대상(사용자 / 콘텐츠)끼리 묶는다.
 * 제목이 없는 첫 묶음은 대시보드처럼 분류가 필요 없는 항목이다.
 */
const MENU_GROUPS = [
  {
    title: null,
    items: [{ href: '/', label: '대시보드' }],
  },
  {
    title: '사용자',
    items: [
      { href: '/users', label: '사용자' },
      { href: '/user-memberships', label: '회원권' },
      { href: '/membership-orders', label: '결제 내역' },
    ],
  },
  {
    title: '콘텐츠',
    items: [
      // 카테고리는 앱에서 세 개로 고정해 두었다 (app/src/lib/challenges.ts 의 FIXED_CATEGORIES).
      // 지금은 어드민에서 건드릴 일이 없어 메뉴만 감춰 둔다 —
      // 화면·API 는 그대로 살아 있으므로, 카테고리를 늘릴 때 이 줄만 되살리면 된다.
      // { href: '/challenge-categories', label: '챌린지 카테고리' },
      { href: '/notices', label: '공지사항' },
      { href: '/challenges', label: '챌린지' },
      { href: '/collages', label: '콜라주' },
      { href: '/collage-lab', label: '콜라주 실험실' },
      { href: '/membership-plans', label: '회원권 관리' },
    ],
  },
] as const;

type Menu = { readonly href: string; readonly label: string };

/** 모바일 상단바에 현재 화면 이름을 띄우려고 묶음을 평탄하게 편 목록 */
const MENUS: Menu[] = MENU_GROUPS.flatMap((group) => [...group.items]);

/** 하위 경로(/challenges/new, /challenges/:id)에서도 메뉴가 활성으로 보이도록 */
function isActive(href: string, pathname: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

/**
 * 관리자 내비게이션.
 * lg 이상은 고정 사이드바, 그 아래에서는 상단바 + 왼쪽에서 밀려나오는 드로어로 바뀐다.
 * 같은 <aside> 를 위치만 바꿔 쓰므로 메뉴를 한 벌만 관리한다.
 */
export function Sidebar({ username }: { username: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  // 드로어가 떠 있는 동안 뒤 배경이 스크롤되지 않게 한다
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  async function handleLogout() {
    setPending(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    router.replace('/login');
    router.refresh();
  }

  const current = MENUS.find((menu) => isActive(menu.href, pathname));

  return (
    <>
      {/* 모바일 상단바 — 스크롤해도 메뉴 버튼이 늘 손 닿는 곳에 있도록 고정한다 */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-line bg-white px-2 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          aria-expanded={open}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-gray-100"
        >
          <MenuIcon />
        </button>
        <span className="text-base font-bold">
          Picky <span className="text-brand-500">Admin</span>
        </span>
        {current && (
          <span className="ml-auto truncate pl-2 pr-1 text-sm text-ink-sub">{current.label}</span>
        )}
      </header>

      {/* 드로어 뒤 배경 — 눌러서 닫는다 */}
      {open && (
        <button
          type="button"
          aria-label="메뉴 닫기"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-white p-4 transition-transform duration-200',
          // lg 이상에서는 문서 흐름에 놓인 평범한 사이드바로 되돌린다
          'lg:static lg:z-auto lg:w-56 lg:shrink-0 lg:translate-x-0',
          // 닫혀 있으면 화면 밖 + invisible — 보이지 않는 링크에 탭 포커스가 가지 않게 한다
          open ? 'translate-x-0' : '-translate-x-full max-lg:invisible',
        )}
      >
        <div className="flex items-center justify-between">
          <div className="px-2 py-3 text-lg font-bold">
            Picky <span className="text-brand-500">Admin</span>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="메뉴 닫기"
            className="flex size-10 items-center justify-center rounded-lg text-xl leading-none text-ink-sub hover:bg-gray-100 lg:hidden"
          >
            ×
          </button>
        </div>

        <nav className="mt-4 space-y-4">
          {MENU_GROUPS.map((group) => (
            <div key={group.title ?? 'root'} className="space-y-1">
              {group.title && (
                <p className="px-3 pb-1 text-xs font-medium text-ink-sub/70">{group.title}</p>
              )}
              {group.items.map((menu) => (
                <Link
                  key={menu.href}
                  href={menu.href}
                  // 이동하면 드로어를 닫는다 (pathname 을 보는 effect 는 연쇄 렌더를 만든다)
                  onClick={() => setOpen(false)}
                  aria-current={isActive(menu.href, pathname) ? 'page' : undefined}
                  className={cn(
                    // 모바일 터치 타깃 44px — lg 에서는 기존 밀도를 유지한다
                    'flex min-h-11 items-center rounded-lg px-3 text-sm font-medium lg:min-h-0 lg:py-2',
                    isActive(menu.href, pathname)
                      ? 'bg-brand-500/10 text-brand-600'
                      : 'text-ink-sub hover:bg-gray-100',
                  )}
                >
                  {menu.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-auto border-t border-line pt-3">
          <p className="truncate px-3 text-sm font-medium">{username}</p>
          <button
            type="button"
            onClick={handleLogout}
            disabled={pending}
            className="mt-2 min-h-11 w-full rounded-lg px-3 text-left text-sm text-ink-sub hover:bg-gray-100 disabled:opacity-60 lg:min-h-0 lg:py-2"
          >
            {pending ? '로그아웃 중…' : '로그아웃'}
          </button>
        </div>
      </aside>
    </>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="size-6"
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
