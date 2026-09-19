import Link from 'next/link';
import { ChallengeStartButton } from '@/components/challenge-start-button';
import { StickerSheetButton } from '@/components/sticker-sheet-button';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';
import type { ChallengeCategorySummary } from '@/lib/challenges';
import type { StickerTemplate } from '@/lib/sticker-templates';

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
  // 스티커와 카테고리 개수는 시트·모달을 열자마자 보여야 하므로 미리 받아 둔다.
  // 관리자가 공개하면 바로 반영돼야 해서 캐시하지 않는다.
  const [session, templates, summary, { error }] = await Promise.all([
    getSession(),
    api
      .get<StickerTemplate[]>('/sticker-templates', { cache: 'no-store' })
      .catch(() => [] as StickerTemplate[]),
    api
      .get<ChallengeCategorySummary[]>('/challenges/categories', { cache: 'no-store' })
      .catch(() => [] as ChallengeCategorySummary[]),
    searchParams,
  ]);

  return (
    <div className="pb-page flex flex-1 flex-col px-5 pt-8">
      <header className="flex items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Picky</h1>
          <p className="mt-1 text-sm text-ink-sub">순간을 고르는 가장 쉬운 방법</p>
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

      {/* 두 버튼은 디바이스 세로 기준 가운데에 온다 (헤더 아래 남은 공간의 중앙) */}
      <div className="flex flex-1 flex-col justify-center gap-3 py-8">
        <ChallengeStartButton loggedIn={Boolean(session)} summary={summary} />
        <StickerSheetButton templates={templates} />
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
