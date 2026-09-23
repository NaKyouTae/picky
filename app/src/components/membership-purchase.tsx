'use client';

import Link from 'next/link';
import { useState } from 'react';
import { DottedDivider } from '@/components/dotted-divider';
import {
  MembershipIapPurchase,
  MembershipIapUnavailable,
} from '@/components/membership-iap-purchase';
import { MembershipBenefits } from '@/components/membership-benefits';
import { MembershipCtaBar, MEMBERSHIP_CTA_CLASS } from '@/components/membership-cta-bar';
import { MembershipPlanPicker } from '@/components/membership-plan-picker';
import type { MembershipPlan } from '@/lib/memberships';
import { useIsIapAvailable, useIsNativeApp } from '@/lib/native-app';

/**
 * 회원권 고르기 — 화면 껍데기(헤더·로고)는 `MembershipScreen` 이 그리고,
 * 여기서는 그 안에 들어가는 회원권 목록·혜택·하단 CTA 만 그린다.
 * (조각들이 화면의 24px 간격 흐름에 그대로 얹히도록 프래그먼트로 돌려준다)
 *
 * **웹**은 기간·금액을 정하고 결제 화면(`/membership/checkout`)으로 넘긴다. 토스 결제위젯은
 * 금액이 정해진 뒤에야 그릴 수 있어서 화면을 나눴다 — 고른 회원권은 쿼리로만 넘기고 금액은
 * 결제 화면이 서버에서 다시 읽는다.
 *
 * **iOS 앱**은 화면을 나누지 않고 여기서 바로 App Store 인앱결제를 띄운다. 앱 안에서 열리는
 * 유료 템플릿은 외부 결제로 팔 수 없다(App Review Guideline 3.1.1).
 */
export function MembershipPurchase({
  plans,
  returnTo,
}: {
  plans: MembershipPlan[];
  /** 결제를 마친 뒤 돌아갈 화면 */
  returnTo: string;
}) {
  const isApp = useIsNativeApp();
  const iapAvailable = useIsIapAvailable();

  // 기본 선택은 첫 번째(= 노출 순서가 가장 앞선) 회원권
  const [selectedId, setSelectedId] = useState(plans[0]?.id ?? null);

  const selected = plans.find((plan) => plan.id === selectedId) ?? null;

  if (isApp) {
    // 인앱결제 브리지가 없는 예전 앱 빌드 — 토스로 되돌리지 않고 업데이트를 안내한다.
    if (!iapAvailable) return <MembershipIapUnavailable reason="outdated" />;

    // 상품 ID 가 연결된 회원권만 앱에서 팔 수 있다.
    const sellable = plans.filter((plan) => plan.appleProductId);
    if (sellable.length === 0) return <MembershipIapUnavailable reason="unlisted" />;

    return <MembershipIapPurchase plans={sellable} returnTo={returnTo} />;
  }

  if (plans.length === 0) {
    return (
      <p className="flex flex-1 items-center justify-center text-center text-[14px] leading-[1.6] text-night-sub">
        판매 중인 회원권이 없어요.
        <br />
        조금만 기다려 주세요.
      </p>
    );
  }

  return (
    <>
      <MembershipPlanPicker plans={plans} selectedId={selectedId} onSelect={setSelectedId} />

      <DottedDivider />

      <MembershipBenefits />

      <MembershipCtaBar>
        {selected ? (
          <Link
            href={`/membership/checkout?planId=${selected.id}&returnTo=${encodeURIComponent(returnTo)}`}
            className={MEMBERSHIP_CTA_CLASS}
          >
            Pro 회원으로 계속하기
          </Link>
        ) : (
          <span className={`${MEMBERSHIP_CTA_CLASS} opacity-60`}>회원권을 선택해 주세요</span>
        )}
      </MembershipCtaBar>
    </>
  );
}
