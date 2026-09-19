import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LogoutButton } from '@/components/logout-button';
import { getSession } from '@/lib/auth';

// 세션에 따라 내용이 달라지므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export default async function MyPage() {
  const session = await getSession();
  // 로그인하지 않았으면 볼 것이 없다 (홈에서 로그인 모달을 띄운다).
  if (!session) redirect('/');

  return (
    <div className="pb-page flex flex-1 flex-col px-5 pt-6">
      <header className="flex items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">마이페이지</h1>
          <p className="mt-1 text-sm text-ink-sub">{session.name}님, 반가워요</p>
        </div>

        <Link
          href="/"
          aria-label="닫기"
          className="-mr-2 ml-auto flex size-11 shrink-0 items-center justify-center text-ink-sub active:text-ink"
        >
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
        </Link>
      </header>

      <section className="mt-6">
        <h2 className="text-sm font-semibold">계정</h2>
        <dl className="mt-2 divide-y divide-line rounded-2xl border border-line bg-white px-4">
          <div className="flex items-center justify-between gap-4 py-3.5">
            <dt className="text-sm text-ink-sub">이름</dt>
            <dd className="truncate text-sm font-medium">{session.name}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 py-3.5">
            <dt className="shrink-0 text-sm text-ink-sub">이메일</dt>
            <dd className="truncate text-sm font-medium">{session.email}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-8">
        <LogoutButton />
      </div>
    </div>
  );
}
