/**
 * 회원권 화면의 표시용 값 — 서버 컴포넌트와 클라이언트 컴포넌트가 함께 쓴다.
 *
 * `lib/memberships.ts` 는 서버 전용 API 클라이언트(next/headers)를 끌고 오므로,
 * 클라이언트 번들에 들어가도 되는 것만 여기에 둔다 (타입은 저쪽에서 `import type` 으로 가져온다).
 */
import type { MembershipOrderStatus, MembershipPlan, MembershipStore } from '@/lib/memberships';

export const MEMBERSHIP_ORDER_STATUS_LABELS: Record<MembershipOrderStatus, string> = {
  PENDING: '결제 대기',
  PAID: '결제 완료',
  FAILED: '결제 실패',
  REFUNDED: '환불 완료',
};

export const MEMBERSHIP_STORE_LABELS: Record<MembershipStore, string> = {
  WEB: '웹 결제',
  APPLE: 'App Store',
};

/**
 * 환불을 어디에 요청해야 하는지.
 *
 * **인앱결제는 우리가 환불할 수 없다.** 돈을 받은 쪽이 Apple 이라 취소도 Apple 이 한다 —
 * 우리 고객센터로 요청이 오면 되돌려보내야 하므로, 내역 화면에서 미리 알려 준다.
 */
export const MEMBERSHIP_REFUND_NOTES: Record<MembershipStore, string | null> = {
  // 웹 결제는 환불정책대로 고객센터에서 처리한다 — 따로 덧붙일 말이 없다.
  WEB: null,
  APPLE:
    'App Store에서 결제한 건은 Apple을 통해 환불을 요청해야 합니다. (reportaproblem.apple.com)',
};

/** 원화 표기 — 원 단위 정수라 소수점을 쓰지 않는다 */
export function formatKrw(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

/** 2026년 9월 22일 — 이용 기간 표시용 */
export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** 결제 일시 표시용 */
export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 월 단가 — 총액을 개월 수로 나눈 값 (원 단위 반올림) */
export function monthlyPrice(plan: MembershipPlan): number {
  return Math.round(plan.price / plan.months);
}

/** 2,075원/월 */
export function formatMonthlyKrw(plan: MembershipPlan): string {
  return `${monthlyPrice(plan).toLocaleString('ko-KR')}원/월`;
}

/** 24,900원/년 · 29,900원/6개월 — 기간이 붙은 총액 표기 */
export function formatPeriodKrw(plan: MembershipPlan): string {
  const period = plan.months === 12 ? '년' : `${plan.months}개월`;
  return `${plan.price.toLocaleString('ko-KR')}원/${period}`;
}

/**
 * 할인 폭을 재는 기준 회원권 — 기간이 가장 짧은(보통 1개월) 회원권이다.
 * 같은 기간이 여럿이면 월 단가가 비싼 쪽을 기준으로 둔다 (할인율을 부풀리지 않도록).
 */
export function baselinePlan(plans: MembershipPlan[]): MembershipPlan | null {
  return plans.reduce<MembershipPlan | null>((baseline, plan) => {
    if (!baseline) return plan;
    if (plan.months !== baseline.months) return plan.months < baseline.months ? plan : baseline;
    return monthlyPrice(plan) > monthlyPrice(baseline) ? plan : baseline;
  }, null);
}

/**
 * 카드에 덧붙일 할인 정보.
 *
 * 두 값의 기준이 서로 다르다 (디자인도 그렇다):
 * - `listPrice` 는 어드민이 넣은 **할인 전 정가** 다. 넣지 않았으면 취소선을 그리지 않는다 —
 *   우리가 지어낸 정가를 취소선으로 보여 주면 그냥 거짓말이 된다.
 * - `percent` 는 **1개월권을 같은 기간만큼 샀을 때** 보다 얼마나 싼지다 (실제로 파는 두 상품의
 *   비교라 정가 없이도 말할 수 있다). 기준 회원권 자신이거나 더 싸지 않으면 null 이다.
 */
export function planSavings(
  plan: MembershipPlan,
  baseline: MembershipPlan | null,
): { listPrice: number | null; percent: number | null; baselineMonths: number } | null {
  const listPrice = plan.listPrice !== null && plan.listPrice > plan.price ? plan.listPrice : null;
  const percent = baselineDiscountPercent(plan, baseline);
  if (listPrice === null && percent === null) return null;

  return { listPrice, percent, baselineMonths: baseline?.months ?? 1 };
}

/** 기준 회원권(= 1개월권) 월 단가 대비 몇 % 싼지 — 1% 미만이면 할인이라 부르지 않는다 */
function baselineDiscountPercent(
  plan: MembershipPlan,
  baseline: MembershipPlan | null,
): number | null {
  if (!baseline || baseline.id === plan.id) return null;

  const percent = Math.round((1 - monthlyPrice(plan) / monthlyPrice(baseline)) * 100);
  return percent >= 1 ? percent : null;
}
