'use client';

import { DottedDivider } from '@/components/dotted-divider';
import {
  baselinePlan,
  formatKrw,
  formatMonthlyKrw,
  formatPeriodKrw,
  planSavings,
} from '@/lib/membership-format';
import type { MembershipPlan } from '@/lib/memberships';
import { cn } from '@/lib/utils';

/**
 * 회원권 고르기 (디자인 "마이페이지 > 회원권 구매" 4692:4275) —
 * 고른 결과는 위(구매 화면)가 들고 있고 여기서는 보여주기만 한다.
 *
 * 카드는 한 줄(이름 + 월 단가)이 기본이고, 할인 정보가 있는 회원권만 아래로 펼쳐진다 —
 * 정가(어드민 입력)가 있으면 취소선을, 1개월권보다 싸면 할인율 한 줄을 덧붙인다.
 * 고른 카드는 테두리가 Picky 3색 그라데이션이 된다.
 */
export function MembershipPlanPicker({
  plans,
  selectedId,
  onSelect,
  priceLabels,
}: {
  plans: MembershipPlan[];
  selectedId: string | null;
  onSelect: (planId: string) => void;
  /**
   * 플랜 id → 표시할 가격 문구. 인앱결제에서는 실제로 청구되는 App Store 가격을
   * 보여 줘야 하므로 스토어가 준 현지화 문구로 덮어쓴다 (없으면 DB 가격을 쓴다).
   */
  priceLabels?: Record<string, string>;
}) {
  // 할인 기준은 전체 목록에서 한 번만 고른다 (카드마다 다시 찾지 않도록).
  const baseline = baselinePlan(plans);

  return (
    <ul className="flex w-full flex-col gap-[10px]">
      {plans.map((plan) => {
        const active = plan.id === selectedId;
        const storePrice = priceLabels?.[plan.id];
        // 스토어 가격을 보여 줄 때는 할인 문구를 접는다 — 취소선·월 단가는 우리 DB 가격을
        // 나눠 만든 값이라, 청구 금액과 기준이 달라 합이 맞지 않게 보인다.
        const savings = storePrice ? null : planSavings(plan, baseline);

        return (
          <li key={plan.id}>
            <button
              type="button"
              onClick={() => onSelect(plan.id)}
              aria-pressed={active}
              className={cn(
                'block w-full rounded-lg p-px text-left',
                // 1px 테두리를 배경으로 그린다 — 그라데이션 테두리는 border 로 만들 수 없다.
                active
                  ? 'bg-[linear-gradient(135deg,var(--color-picky-red),var(--color-picky-yellow),var(--color-picky-blue))]'
                  : 'bg-night-raised',
              )}
            >
              <span className="flex min-h-[58px] flex-col justify-center gap-4 rounded-[7px] bg-night p-5">
                <span className="flex items-start justify-between gap-3">
                  <span className="flex min-w-0 flex-col gap-[10px]">
                    <span className="truncate text-[16px] font-medium leading-none">
                      {plan.name}
                    </span>

                    {/* 정가(취소선)는 어드민이 넣었을 때만 — 그때만 할인가를 함께 보여 준다 */}
                    {savings?.listPrice != null && (
                      <span className="flex items-center gap-[10px] whitespace-nowrap text-[14px] font-medium leading-none">
                        <span className="text-night-sub line-through">
                          {formatKrw(savings.listPrice)}
                        </span>
                        <span>{formatPeriodKrw(plan)}</span>
                      </span>
                    )}
                  </span>

                  <span className="shrink-0 whitespace-nowrap text-[16px] font-medium leading-none">
                    {storePrice ?? formatMonthlyKrw(plan)}
                  </span>
                </span>

                {savings?.percent != null && (
                  <>
                    <DottedDivider />
                    <span className="text-[14px] font-medium leading-none text-point">
                      {savings.baselineMonths}개월권 이용료보다 {savings.percent}% 더 저렴해요 !
                    </span>
                  </>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
