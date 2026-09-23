'use client';

import { useRouter } from 'next/navigation';
import { Logo } from '@/components/logo';
import { MEMBERSHIP_CTA_SPACE } from '@/components/membership-cta-bar';
import { MembershipPurchase } from '@/components/membership-purchase';
import type { MembershipPlan } from '@/lib/memberships';

/**
 * 회원권 구매 화면 (디자인 "마이페이지 > 회원권 구매" 4692:4275).
 *
 * **들어오는 길이 둘인데 화면은 하나다** — 마이페이지의 '회원권 구매' 메뉴와,
 * 콜라주에서 잠긴 유료 템플릿을 눌렀을 때. 둘 다 `/membership` 으로 오고 이 컴포넌트를 쓴다.
 * 다른 것은 결제를 마친 뒤 돌아갈 곳(`returnTo`)뿐이다.
 *
 * 마이페이지·홈과 같은 다크 터미널 톤이라, 레이아웃(main)이 준 safe-top 패딩까지
 * 끌어올려 덮는다 (그러지 않으면 노치 영역만 셸의 흰 배경으로 남는다).
 */
export function MembershipScreen({
  plans,
  returnTo,
}: {
  plans: MembershipPlan[];
  /** 결제를 마친 뒤 돌아갈 화면 */
  returnTo: string;
}) {
  const router = useRouter();

  return (
    <div
      className="flex flex-1 flex-col gap-6 bg-night px-5 font-mono text-night-text"
      style={{
        marginTop: 'calc(var(--safe-top) * -1)',
        paddingTop: 'var(--safe-top)',
        // 하단 고정 CTA 에 가리지 않도록 그만큼 비워 둔다.
        paddingBottom: MEMBERSHIP_CTA_SPACE,
      }}
    >
      <header className="flex h-14 shrink-0 items-center justify-between">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="뒤로가기"
          className="-ml-2 flex size-11 shrink-0 items-center justify-center text-main active:text-main/70"
        >
          <BackIcon />
        </button>

        <h1 className="flex-1 text-center text-[20px] leading-none">회원권 구매</h1>

        {/* 제목이 가운데 오도록 뒤로가기 버튼과 같은 크기의 빈 자리를 둔다 (마이페이지와 같은 처리) */}
        <span aria-hidden className="-mr-2 size-11 shrink-0" />
      </header>

      <div className="flex w-full flex-col items-center gap-4 py-9">
        <Logo className="text-[36px] text-point" />
        <p className="text-[16px] leading-none">Pick your joy_</p>
      </div>

      <MembershipPurchase plans={plans} returnTo={returnTo} />
    </div>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-7" aria-hidden>
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2Z" />
    </svg>
  );
}
