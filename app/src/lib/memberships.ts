import { api } from '@/lib/api';

// 화면 표시용 포맷터·라벨은 `lib/membership-format.ts` 에 있다 —
// 이 파일은 next/headers 를 쓰는 서버 전용이라 클라이언트 번들에 들어가면 안 된다.

/** 판매 중인 회원권 (공개 API) */
export type MembershipPlan = {
  id: string;
  name: string;
  /** 구매 시 늘어나는 이용 기간 (개월) */
  months: number;
  /** 판매 금액 (원) — 실제로 청구되는 금액이다 (웹은 토스 결제 금액) */
  price: number;
  /**
   * 할인 전 정가 (원) — 어드민이 넣었을 때만 있다.
   * 청구 금액이 아니라 취소선으로 함께 보여 주는 값이다.
   */
  listPrice: number | null;
  description: string | null;
  /**
   * App Store 인앱결제 상품 ID.
   * iOS 앱은 이 값으로 StoreKit 상품을 찾는다 — 비어 있으면 앱에서 팔 수 없다.
   */
  appleProductId: string | null;
};

export type MembershipOrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

/** 결제를 처리한 스토어 — 환불 창구가 다르다 (WEB=우리, APPLE=Apple) */
export type MembershipStore = 'WEB' | 'APPLE';

/** 내 결제 내역 한 건 */
export type MembershipOrder = {
  id: string;
  orderCode: string;
  /** 구매 시점의 회원권 이름 — 플랜이 바뀌거나 지워져도 그대로 남는다 */
  planName: string;
  months: number;
  amount: number;
  status: MembershipOrderStatus;
  store: MembershipStore;
  /** 결제수단 표기 — 토스는 '카드' 등, 인앱결제는 'App Store' */
  method: string | null;
  paidAt: string | null;
  /** 환불 시각 — REFUNDED 일 때만 채워진다 */
  refundedAt: string | null;
  failReason: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

export type MembershipOrderPage = {
  items: MembershipOrder[];
  /** null 이면 마지막 페이지 */
  nextCursor: string | null;
};

/** 지금 유료 템플릿을 쓸 수 있는지 */
export type MyMembership = {
  active: boolean;
  endsAt: string | null;
};

/** 결제창에 넘길 주문 정보 — 금액·주문번호는 서버가 정한다 */
export type PreparedOrder = {
  orderCode: string;
  orderName: string;
  amount: number;
  customerKey: string;
};

/** 판매 중인 회원권 — 서버 컴포넌트 전용 (브라우저는 BFF `/api/memberships/plans`) */
export async function getMembershipPlans(): Promise<MembershipPlan[]> {
  return api
    .get<MembershipPlan[]>('/memberships/plans', { cache: 'no-store' })
    .catch(() => [] as MembershipPlan[]);
}

/**
 * 내 이용권 상태 — 서버 컴포넌트 전용.
 * 로그인하지 않았거나 조회에 실패하면 "이용권 없음" 으로 본다 (유료 템플릿은 잠긴 채로 둔다).
 */
export async function getMyMembership(): Promise<MyMembership> {
  return api
    .get<MyMembership>('/memberships/me', { cache: 'no-store' })
    .catch(() => ({ active: false, endsAt: null }));
}

/** 내 결제 내역 첫 페이지 — 서버 컴포넌트 전용 */
export async function getMyOrders(take = 20): Promise<MembershipOrderPage> {
  return api
    .get<MembershipOrderPage>(`/memberships/orders?take=${take}`, { cache: 'no-store' })
    .catch(() => ({ items: [], nextCursor: null }));
}
