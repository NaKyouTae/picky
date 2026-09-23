/** 서버(NestJS)의 admin-membership-orders 응답 타입 — 브라우저/서버 컴포넌트 공용 */

export type MembershipOrderStatus = 'PENDING' | 'PAID' | 'FAILED';

export const MEMBERSHIP_ORDER_STATUSES: MembershipOrderStatus[] = ['PAID', 'PENDING', 'FAILED'];

export const MEMBERSHIP_ORDER_STATUS_LABELS: Record<MembershipOrderStatus, string> = {
  PAID: '결제 완료',
  PENDING: '결제 대기',
  FAILED: '결제 실패',
};

export const MEMBERSHIP_ORDER_STATUS_STYLES: Record<MembershipOrderStatus, string> = {
  PAID: 'bg-emerald-50 text-emerald-700',
  PENDING: 'bg-amber-50 text-amber-700',
  FAILED: 'bg-gray-100 text-ink-sub',
};

export type AdminMembershipOrder = {
  id: string;
  /** 토스에 넘긴 주문번호 — 토스 콘솔에서 조회할 때 쓴다 */
  orderCode: string;
  /** 구매 시점의 회원권 이름 (플랜이 바뀌거나 지워져도 그대로) */
  planName: string;
  months: number;
  amount: number;
  status: MembershipOrderStatus;
  method: string | null;
  paymentKey: string | null;
  paidAt: string | null;
  failReason: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string | null };
};

export type AdminMembershipOrderPage = {
  items: AdminMembershipOrder[];
  /** null 이면 마지막 페이지 */
  nextCursor: string | null;
};

/** 환불이 없으므로 승인 합계가 곧 매출이다 */
export type MembershipOrderSummary = {
  paidCount: number;
  paidAmount: number;
  pendingCount: number;
  failedCount: number;
};

export const ORDER_PAGE_SIZE = 20;

/** 원화 표기 — 원 단위 정수라 소수점을 쓰지 않는다 */
export function formatKrw(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

/** 이용 기간이 아직 남았는지 — 종료일이 지나면 만료다 */
export function isMembershipActive(endsAt: string | null): boolean {
  return endsAt !== null && new Date(endsAt).getTime() > Date.now();
}

/**
 * 종료까지 남은 날짜.
 * 하루 미만이 남았어도 '오늘까지' 로 보이도록 올림한다 (0일 남음은 이미 끝난 것처럼 읽힌다).
 */
export function remainingDays(endsAt: string | null): number {
  if (!endsAt) return 0;
  const diff = new Date(endsAt).getTime() - Date.now();
  return diff <= 0 ? 0 : Math.ceil(diff / (24 * 60 * 60 * 1000));
}

/** 2026. 9. 22. — 이용 기간은 시각까지 보여줄 이유가 없다 */
export function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
