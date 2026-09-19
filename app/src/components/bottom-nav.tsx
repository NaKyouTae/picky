'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type IconProps = { className?: string };

function HomeIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3.5 10.2 12 3.6l8.5 6.6" />
      <path d="M5.5 9.2v9.3a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9.2" />
      <path d="M9.8 20v-5.3h4.4V20" />
    </svg>
  );
}

function ChallengeIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5.5H4.5V7a3.5 3.5 0 0 0 2.8 3.4" />
      <path d="M17 5.5h2.5V7a3.5 3.5 0 0 1-2.8 3.4" />
      <path d="M12 14v3.5" />
      <path d="M10 17.5h4l1 3H9l1-3Z" />
    </svg>
  );
}

function StickerIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M14.2 3.2H7A3.5 3.5 0 0 0 3.5 6.7v10.6A3.5 3.5 0 0 0 7 20.8h4.4l9.1-9.1V8.3" />
      <path d="M13.2 20.6v-4.9a2 2 0 0 1 2-2h5" />
      <path d="M8.6 9.4h.01" />
      <path d="M13.4 9.4h.01" />
      <path d="M8.8 13.4a3.6 3.6 0 0 0 3.2 1.7" />
    </svg>
  );
}

const TABS = [
  { href: '/', label: '홈', Icon: HomeIcon },
  { href: '/challenge', label: '챌린지', Icon: ChallengeIcon },
  { href: '/sticker', label: '스티커', Icon: StickerIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    // 앱 셸 내부에 absolute 로 붙인다 — 셸이 뷰포트 높이에 고정돼 있으므로
    // 데스크톱에서도 셸 하단(= 모바일 화면 하단)에 정확히 앵커링된다.
    <nav className="safe-bottom absolute inset-x-0 bottom-0 z-50 border-t border-line bg-white/95 backdrop-blur">
      <ul className="flex">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 flex-col items-center justify-center gap-0.5',
                  active ? 'text-brand-500' : 'text-ink-sub',
                )}
                style={{ height: 'var(--nav-height)' }}
              >
                <Icon className="size-6" />
                <span className="text-[11px] font-medium leading-none">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
