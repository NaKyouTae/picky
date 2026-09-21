import Link from 'next/link';
import { CategoryList } from '@/components/category-list';
import { getActiveGroup, getCategories } from '@/lib/challenge-groups';
import { getSession } from '@/lib/auth';

const LOGIN_ERRORS: Record<string, string> = {
  cancelled: '로그인을 취소했습니다.',
  invalid_state: '로그인 요청이 만료되었습니다. 다시 시도해 주세요.',
  login_failed: '로그인에 실패했습니다. 다시 시도해 주세요.',
  google_unavailable: '구글 로그인을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  kakao_unavailable: '카카오 로그인을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // 어드민이 카테고리를 등록/공개하면 바로 반영돼야 해서 캐시하지 않는다.
  const [session, categories, activeGroup, { error }] = await Promise.all([
    getSession(),
    getCategories(),
    getActiveGroup(),
    searchParams,
  ]);

  return (
    <div className="pb-page flex flex-1 flex-col px-5 pt-8">
      <header className="flex items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Picky</h1>
          <p className="mt-1 text-sm text-ink-sub">
            무엇을 할지 고르면 챌린지를 하나씩 뽑아 드려요.
          </p>
        </div>

        {/* 계정 정보는 마이페이지에서 보여준다 */}
        {session && (
          <Link
            href="/mypage"
            aria-label="마이페이지"
            className="-mr-2 ml-auto flex size-11 shrink-0 items-center justify-center text-ink-sub active:text-ink"
          >
            <MyPageIcon />
          </Link>
        )}
      </header>

      {error && (
        <p className="mt-5 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
          {LOGIN_ERRORS[error] ?? '로그인 중 문제가 발생했습니다.'}
        </p>
      )}

      {/* 카테고리는 디바이스 세로 기준 가운데에 온다 */}
      <div className="flex flex-1 flex-col justify-center py-8">
        <CategoryList
          categories={categories}
          loggedIn={Boolean(session)}
          activeGroup={activeGroup}
        />
      </div>
    </div>
  );
}

function MyPageIcon() {
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
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  );
}
