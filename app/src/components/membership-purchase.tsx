'use client';

import Link from 'next/link';
import { useState } from 'react';
import { MembershipPlanPicker } from '@/components/membership-plan-picker';
import { formatKrw } from '@/lib/membership-format';
import type { MembershipPlan, MyMembership } from '@/lib/memberships';

/**
 * 회원권 고르기 — 기간·금액을 정하고 결제 화면(`/membership/checkout`)으로 넘긴다.
 *
 * 결제위젯은 금액이 정해진 뒤에야 그릴 수 있어서 화면을 나눴다. 고른 회원권은 쿼리로만
 * 넘기고 금액은 결제 화면이 서버에서 다시 읽는다.
 */
export function MembershipPurchase({
  plans,
  membership,
  returnTo,
}: {
  plans: MembershipPlan[];
  membership: MyMembership;
  /** 결제를 마친 뒤 돌아갈 화면 */
  returnTo: string;
}) {
  // 기본 선택은 첫 번째(= 노출 순서가 가장 앞선) 회원권
  const [selectedId, setSelectedId] = useState(plans[0]?.id ?? null);

  const selected = plans.find((plan) => plan.id === selectedId) ?? null;

  if (plans.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-sm text-ink-sub">
        판매 중인 회원권이 없어요. 조금만 기다려 주세요.
      </p>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <MembershipPlanPicker plans={plans} selectedId={selectedId} onSelect={setSelectedId} />

      <p className="mt-4 px-5 text-xs leading-relaxed text-ink-sub">
        결제하면 {membership.active ? '남은 이용 기간에 이어서' : '결제 시점부터'} 선택한 개월
        수만큼 유료 템플릿을 쓸 수 있어요. 기간이 끝나면 자동으로 결제되지 않습니다.
      </p>

      <div className="pb-bar mt-auto px-5 pt-4">
        {selected ? (
          <Link
            href={`/membership/checkout?planId=${selected.id}&returnTo=${encodeURIComponent(returnTo)}`}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-500 text-base font-semibold text-white active:bg-brand-600"
          >
            {formatKrw(selected.price)} 결제하기
          </Link>
        ) : (
          <span className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-500 text-base font-semibold text-white opacity-60">
            회원권을 선택해 주세요
          </span>
        )}
      </div>
    </div>
  );
}
