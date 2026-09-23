import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BusinessInfo } from '@/components/business-info';
import { DottedDivider } from '@/components/dotted-divider';
import { LogoutButton } from '@/components/logout-button';
import { WithdrawButton } from '@/components/withdraw-button';
import { ConsentMenuRow } from '@/components/consent-menu-row';
import { getSession } from '@/lib/auth';
import { getMyConsents } from '@/lib/consents';
import { getMyMembership } from '@/lib/memberships';

// 세션에 따라 내용이 달라지므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/**
 * 마이페이지 — 디자인(Figma 4658:152)은 홈과 같은 다크 터미널 톤이다.
 *
 * 블록(프로필·섹션·푸터)을 24px 간격으로 쌓고 사이를 점선으로 끊는다.
 * 섹션 안은 제목과 목록이 16px, 행끼리는 10px 간격이다.
 */
export default async function MyPage() {
  const session = await getSession();
  // 로그인하지 않았으면 볼 것이 없다 (홈에서 로그인 모달을 띄운다).
  if (!session) redirect('/');

  // 동의 상태는 여기서 한 번만 읽어 아래 행들에 내려 준다 (행마다 따로 조회하지 않도록).
  const [membership, consents] = await Promise.all([getMyMembership(), getMyConsents()]);

  return (
    <div
      className="flex flex-1 flex-col gap-6 bg-night px-5 font-mono text-night-text"
      // 이 화면은 다크라서, 레이아웃(main)이 준 safe-top 패딩까지 끌어올려 덮는다.
      // 그렇게 하지 않으면 노치 영역만 셸의 흰 배경으로 남는다 (홈과 같은 처리).
      //
      // 아래는 디자인의 푸터 하단 여백 54px 을 그대로 재현한다 —
      // 프레임에서 그 54px 은 '홈 인디케이터 영역 34px + 그 위 여백 20px' 이다.
      style={{
        marginTop: 'calc(var(--safe-top) * -1)',
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'calc(max(var(--safe-bottom), 34px) + 20px)',
      }}
    >
      <header className="flex h-14 shrink-0 items-center justify-between">
        {/* 디자인의 왼쪽 뒤로가기 아이콘은 opacity 0 (자리만 잡는 용도) —
            제목이 가운데 오도록 닫기 버튼과 같은 크기의 빈 자리를 둔다. */}
        <span aria-hidden className="-ml-2 size-11 shrink-0" />

        <h1 className="flex-1 text-center text-[20px] leading-none">My page</h1>

        <Link
          href="/"
          aria-label="닫기"
          className="-mr-2 flex size-11 shrink-0 items-center justify-center text-main active:text-main/70"
        >
          <CloseIcon />
        </Link>
      </header>

      {/* 프로필 — 디자인에는 화살표가 없지만, 내 정보 화면으로 가는 입구는 여기뿐이라 링크로 둔다 */}
      <Link
        href="/mypage/profile"
        className="flex w-full flex-col items-start gap-4 active:opacity-60"
      >
        <span className="max-w-full truncate text-[20px] leading-none">{session.name} 님</span>
        {session.email && (
          <span className="max-w-full truncate text-[14px] leading-none text-night-sub">
            {session.email}
          </span>
        )}
        <span className="bg-night-raised p-1 text-[12px] leading-none">
          {membership.active ? 'Standard' : 'Free'}
        </span>
      </Link>

      <DottedDivider />

      <Section title="결제">
        <MenuLink href="/membership" label="회원권 구매" />
        <MenuLink href="/mypage/payments" label="결제 내역" />
      </Section>

      <DottedDivider />

      <Section title="나의 활동">
        <MenuLink href="/mypage/challenges" label="완료한 챌린지" />
      </Section>

      <DottedDivider />

      <Section title="약관 및 정책">
        <MenuLink href="/mypage/terms" label="이용약관" />
        <MenuLink href="/mypage/privacy" label="개인정보처리방침" />
        <MenuLink href="/mypage/refund" label="환불 정책" />
        <ConsentMenuRow
          consentKey="thirdParty"
          label="개인정보 제3자 제공 동의"
          href="/mypage/third-party"
          initialConsents={consents}
        />
        <ConsentMenuRow
          consentKey="marketing"
          label="마케팅 정보 수신 동의"
          href="/mypage/marketing"
          initialConsents={consents}
        />
      </Section>

      <DottedDivider />

      {/* 디자인의 14px 텍스트 두 줄 — 세로 여백(16px)을 버튼 패딩으로 흡수해
          보이는 간격은 그대로 두고 누를 수 있는 높이만 넓힌다. */}
      <div className="-my-2 flex w-full flex-col items-start">
        <LogoutButton />
        <WithdrawButton />
      </div>

      <DottedDivider />

      {/* 사업자 정보 — 값은 lib/business.ts 한 곳에서만 온다 */}
      <section className="flex w-full flex-col gap-4">
        <p className="text-[16px] leading-none">Ⓒspectrum</p>
        <BusinessInfo align="left" className="text-[14px]" />
      </section>
    </div>
  );
}

/**
 * 제목 + 메뉴 목록 한 덩어리.
 *
 * 행은 디자인상 24px 높이에 10px 간격이라 그대로 두면 터치 타깃이 너무 작다.
 * 행마다 위아래 5px 패딩을 주어 간격을 흡수하고(= 34px), 목록 전체를 그만큼
 * 끌어당겨 제목과의 16px 간격은 디자인대로 유지한다.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-4">
      <h2 className="text-[14px] leading-none text-night-sub">{title}</h2>
      <div className="-my-[5px] flex flex-col">{children}</div>
    </section>
  );
}

function MenuLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 py-[5px] active:opacity-60"
    >
      <span className="min-w-0 flex-1 truncate text-[16px] leading-6">{label}</span>
      <ChevronIcon />
    </Link>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-6 shrink-0" aria-hidden>
      <path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="currentColor" className="size-7" aria-hidden>
      <path d="M22.1667 7.47833 20.5217 5.83333 14 12.355 7.47833 5.83333 5.83333 7.47833 12.355 14l-6.52167 6.5217 1.645 1.645L14 15.645l6.5217 6.5217 1.645-1.645L15.645 14l6.5217-6.52167Z" />
    </svg>
  );
}
