import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { BusinessInfo } from '@/components/business-info';
import { LoginButtons } from '@/components/login-buttons';
import { Logo } from '@/components/logo';
import { getSession } from '@/lib/auth';
import { LAST_PROVIDER_COOKIE } from '@/lib/constants';
import type { OAuthProvider } from '@/lib/oauth-flow';

const LOGIN_ERRORS: Record<string, string> = {
  cancelled: '로그인을 취소했습니다.',
  invalid_state: '로그인 요청이 만료되었습니다. 다시 시도해 주세요.',
  login_failed: '로그인에 실패했습니다. 다시 시도해 주세요.',
  kakao_unavailable: '카카오 로그인을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  naver_unavailable: '네이버 로그인을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  apple_unavailable: 'Apple 로그인을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
};

/** 쿠키 값은 사용자가 바꿀 수 있으므로 아는 제공자일 때만 믿는다 */
function readRecentProvider(value: string | undefined): OAuthProvider | null {
  return value === 'kakao' || value === 'naver' || value === 'apple' ? value : null;
}

/**
 * 로그인 화면 (디자인 "로그인" 4584:4853).
 *
 * 메인과 달리 밝은 화면이다. 이미 로그인했으면 볼 이유가 없으므로 홈으로 보낸다.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [session, store, { error }] = await Promise.all([getSession(), cookies(), searchParams]);
  if (session) redirect('/');

  const recent = readRecentProvider(store.get(LAST_PROVIDER_COOKIE)?.value);

  return (
    // 디자인은 로고 묶음·버튼 묶음·©spectrum 을 24px 간격으로 쌓고,
    // 위 20px / 아래 54px 여백을 준다. 로고 묶음이 남은 높이를 모두 가져간다.
    // (Apple 로그인이 들어와 버튼이 셋이 되면서 간격이 48px 에서 24px 로 좁아졌다)
    <div
      className="flex flex-1 flex-col items-center gap-6 bg-night-text px-5 font-mono text-night"
      // 메인과 같은 규칙 — 디자인의 하단 54px 은 '홈 인디케이터 34px + 여백 20px' 이다.
      // 노치 영역까지 이 화면의 배경으로 덮은 뒤(그러지 않으면 셸의 흰색이 남는다)
      // 그 아래로 디자인의 상단 20px 을 준다.
      style={{
        marginTop: 'calc(var(--safe-top) * -1)',
        paddingTop: 'calc(var(--safe-top) + 20px)',
        paddingBottom: 'calc(max(var(--safe-bottom), 34px) + 20px)',
      }}
    >
      {/* 로고 묶음은 버튼 위 남은 공간을 모두 차지하고 그 안에서 가운데 정렬된다 */}
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 pt-9">
        <Logo tone="black" wordmark="Picky" className="text-[36px] text-black" />
        {/* 타이핑 애니메이션 — 폭이 늘면서 한 글자씩 드러나고 언더바가 커서처럼 따라간다.
            글자 수만큼 폭을 잡아 두어 타이핑 중에 문구가 좌우로 흔들리지 않는다. */}
        <p className="flex w-[14ch] text-[16px] leading-none">
          <span className="animate-typing shrink-0 overflow-hidden whitespace-nowrap">
            Pick your joy
          </span>
          <span className="animate-caret shrink-0" aria-hidden>
            _
          </span>
        </p>
      </div>

      {/* 디자인에 없는 오류 문구는 흐름에서 빼 둔다 — 넣고 빼는 것만으로
          버튼 묶음이 위아래로 움직이면 디자인과 어긋나기 때문이다.
          버튼과 ©spectrum 사이 24px 안에 그린다 — 간격이 좁아져 여백도 8px 로 줄였다. */}
      <div className="relative flex w-full flex-col items-center">
        <LoginButtons recent={recent} />

        {error && (
          <p className="absolute inset-x-0 top-full mt-2 text-center text-[13px] text-[#d93b3b]">
            {LOGIN_ERRORS[error] ?? '로그인 중 문제가 발생했습니다.'}
          </p>
        )}
      </div>

      {/* 전자상거래법 제10조 — 초기 화면에서 바로 확인돼야 한다 */}
      <footer className="flex flex-col items-center gap-3">
        <p className="text-[14px] font-medium leading-none text-night-sub">ⒸSpectrum</p>
        <BusinessInfo />
      </footer>
    </div>
  );
}
