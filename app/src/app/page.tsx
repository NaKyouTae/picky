import Link from 'next/link';
import { BusinessInfo } from '@/components/business-info';
import { CategoryList } from '@/components/category-list';
import { Logo } from '@/components/logo';
import { getActiveGroups } from '@/lib/challenge-groups';
import { FIXED_CATEGORIES } from '@/lib/challenges';
import { getSession } from '@/lib/auth';

export default async function HomePage() {
  // 어드민이 카테고리를 등록/공개하면 바로 반영돼야 해서 캐시하지 않는다.
  // 로그인 오류는 /login 이 보여준다 — OAuth 실패는 그쪽으로 돌아온다.
  const [session, activeGroups] = await Promise.all([getSession(), getActiveGroups()]);

  return (
    // 디자인(Figma 4584:5334)은 헤더·프롬프트·카드·푸터를 24px 간격으로 균등하게 쌓는다.
    <div
      className="flex flex-1 flex-col gap-6 bg-night px-5 font-mono text-night-text"
      // 이 화면만 다크라서, 레이아웃(main)이 준 safe-top 패딩까지 끌어올려 덮는다.
      // 그렇게 하지 않으면 노치 영역만 셸의 흰 배경으로 남는다.
      // 디자인은 헤더를 프레임 맨 위에 붙인다. 노치가 있는 기기에서만
      // safe-top 만큼 내려가고, 그 외에는 디자인 그대로 0 에서 시작한다.
      //
      // ©spectrum 아래 여백은 모든 화면과 같은 20px 이다.
      style={{
        marginTop: 'calc(var(--safe-top) * -1)',
        paddingTop: 'var(--safe-top)',
        paddingBottom: '20px',
      }}
    >
      <header className="flex h-14 items-center justify-between">
        <Logo className="text-[20px] text-point" />

        {/* 계정 정보는 마이페이지에서 보여준다 */}
        {session && (
          <Link
            href="/mypage"
            aria-label="마이페이지"
            className="-mr-2 flex h-11 items-center px-2 text-[20px] text-point active:text-point/70"
          >
            my
          </Link>
        )}
      </header>

      <div className="text-[16px] leading-[1.6]">
        <p>&gt; 누구와 함께할까요?</p>
        {/* 디자인의 두 번째 줄 — 프롬프트 기호만 두고 커서는 깜빡이지 않는다 */}
        <p aria-hidden>&gt;</p>
      </div>

      <div className="flex flex-1 flex-col">
        <CategoryList
          categories={FIXED_CATEGORIES}
          loggedIn={Boolean(session)}
          activeGroups={activeGroups}
        />
      </div>

      {/* 전자상거래법 제10조 — 사업자 정보는 초기 화면에서 바로 확인돼야 한다.
          디자인은 라인박스가 글자 높이와 같다(leading-none) — 기본 행간이 붙으면 3px 내려앉는다 */}
      <footer className="flex flex-col items-center gap-3">
        <p className="text-[14px] font-medium leading-none text-night-sub">ⒸSpectrum</p>
        <BusinessInfo />
      </footer>
    </div>
  );
}
