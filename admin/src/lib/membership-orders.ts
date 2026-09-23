/** 서버(NestJS)의 admin-membership-orders 응답 타입 — 브라우저/서버 컴포넌트 공용 */

export type MembershipOrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

export const MEMBERSHIP_ORDER_STATUSES: MembershipOrderStatus[] = [
  'PAID',
  'PENDING',
  'FAILED',
  'REFUNDED',
];

export const MEMBERSHIP_ORDER_STATUS_LABELS: Record<MembershipOrderStatus, string> = {
  PAID: '결제 완료',
  PENDING: '결제 대기',
  FAILED: '결제 실패',
  REFUNDED: '환불 완료',
};

export const MEMBERSHIP_ORDER_STATUS_STYLES: Record<MembershipOrderStatus, string> = {
  PAID: 'bg-emerald-50 text-emerald-700',
  PENDING: 'bg-amber-50 text-amber-700',
  FAILED: 'bg-gray-100 text-ink-sub',
  REFUNDED: 'bg-rose-50 text-rose-700',
};

/** 결제를 처리한 스토어 — 환불 창구가 다르다 */
export type MembershipStore = 'WEB' | 'APPLE';

export const MEMBERSHIP_STORE_LABELS: Record<MembershipStore, string> = {
  WEB: '토스',
  APPLE: 'App Store',
};

export const MEMBERSHIP_STORE_STYLES: Record<MembershipStore, string> = {
  WEB: 'bg-blue-50 text-blue-700',
  APPLE: 'bg-gray-900 text-white',
};

/**
 * 환불을 어디서 처리해야 하는지 — **CS 가 헷갈리면 안 되는 부분이다.**
 *
 * 인앱결제는 우리가 돈을 받은 것이 아니라 Apple 이 받아 정산해 주는 구조라,
 * 토스 상점관리자에서도 우리 서버에서도 환불할 수 없다.
 */
export const MEMBERSHIP_REFUND_ROUTES: Record<MembershipStore, string> = {
  WEB: '토스페이먼츠 상점관리자에서 결제 취소',
  APPLE: 'Apple 에 직접 요청 (reportaproblem.apple.com) — 우리 쪽에서는 취소할 수 없음',
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
  /** 어디서 결제했는지 — 환불 창구가 갈린다 */
  store: MembershipStore;
  method: string | null;
  /** 토스 결제 식별자 — WEB 주문에만 있다 */
  paymentKey: string | null;
  /** App Store 거래 ID — APPLE 주문에만 있다 (Apple 에 문의할 때 기준값) */
  appleTransactionId: string | null;
  paidAt: string | null;
  /** 환불 시각 — Apple 알림으로 들어온다 (REFUNDED 일 때만) */
  refundedAt: string | null;
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

/** 환불된 주문은 PAID 에서 빠지므로 승인 합계가 곧 순매출이다 */
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
