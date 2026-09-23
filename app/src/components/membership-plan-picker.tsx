'use client';

import { formatKrw } from '@/lib/membership-format';
import type { MembershipPlan } from '@/lib/memberships';
import { cn } from '@/lib/utils';

/** 회원권 고르기 — 고른 결과는 위(구매 화면)가 들고 있고 여기서는 보여주기만 한다 */
export function MembershipPlanPicker({
  plans,
  selectedId,
  onSelect,
}: {
  plans: MembershipPlan[];
  selectedId: string | null;
  onSelect: (planId: string) => void;
}) {
  return (
    <ul className="space-y-2 px-5">
      {plans.map((plan) => {
        const active = plan.id === selectedId;
        return (
          <li key={plan.id}>
            <button
              type="button"
              onClick={() => onSelect(plan.id)}
              aria-pressed={active}
              className={cn(
                'flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left',
                active ? 'border-brand-500' : 'border-line',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">{plan.name}</span>
                <span className="block text-xs text-ink-sub">
                  {plan.description ?? `${plan.months}개월 이용`}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-base font-bold">{formatKrw(plan.price)}</span>
                <span className="block text-xs text-ink-sub">
                  월 {Math.round(plan.price / plan.months).toLocaleString('ko-KR')}원
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
