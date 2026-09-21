'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6"
      aria-hidden
    >
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      className="size-6"
      aria-hidden
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/**
 * 가운데 제목 + 한쪽 액션 버튼을 가진 화면 헤더.
 *
 * 루트 layout 이 세이프에어리어만큼 본문을 내려 두므로, 스크롤해도 노치에 가리지 않도록
 * top 을 --safe-top 에 맞춰 붙인다 (top-0 이면 스크롤 시 상태바 아래로 들어간다).
 */
export function PageHeader({
  title,
  variant = 'back',
  href,
}: {
  title: string;
  /** 'back' = 왼쪽 뒤로가기, 'close' = 오른쪽 닫기 */
  variant?: 'back' | 'close';
  /** 주면 이동 링크, 없으면 브라우저 뒤로가기 */
  href?: string;
}) {
  const router = useRouter();
  const back = variant === 'back';
  const label = back ? '뒤로가기' : '닫기';
  const icon = back ? <BackIcon /> : <CloseIcon />;
  const position = back ? 'left-3' : 'right-3';
  const className = `absolute ${position} flex size-11 items-center justify-center text-ink-sub active:text-ink`;

  return (
    <header
      className="sticky z-30 flex h-14 items-center justify-center bg-white px-14"
      style={{ top: 'var(--safe-top)' }}
    >
      <h1 className="truncate text-base font-semibold">{title}</h1>

      {href ? (
        <Link href={href} aria-label={label} className={className}>
          {icon}
        </Link>
      ) : (
        <button type="button" onClick={() => router.back()} aria-label={label} className={className}>
          {icon}
        </button>
      )}
    </header>
  );
}
