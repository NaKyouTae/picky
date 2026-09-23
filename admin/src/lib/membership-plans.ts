/** 서버(NestJS)의 admin-membership-plans 응답 타입 — 브라우저/서버 컴포넌트 공용 */

export type AdminMembershipPlan = {
  id: string;
  name: string;
  /** 구매 시 늘어나는 이용 기간 (개월) */
  months: number;
  /** 판매 금액 (원) — 실제로 청구되는 금액 */
  price: number;
  /** 할인 전 정가 (원). 있으면 앱에서 판매 금액 옆에 취소선으로 함께 보인다 */
  listPrice: number | null;
  description: string | null;
  /**
   * App Store Connect 에 등록한 인앱결제 상품 ID.
   * 비어 있으면 iOS 앱에서 이 회원권을 팔 수 없다 (웹 토스 결제는 영향 없음).
   */
  appleProductId: string | null;
  /** false 면 앱 결제 화면에 노출되지 않는다 */
  isActive: boolean;
  displayOrder: number;
  /** JSON 직렬화를 거치므로 ISO 문자열로 도착한다 */
  createdAt: string;
  updatedAt: string;
};

/** 서버 DTO 의 상한과 맞춘다 — 폼에서 먼저 걸러 주기 위한 값 */
export const MAX_MONTHS = 36;
export const MAX_PRICE = 10_000_000;

/** 원화 표기 — 원 단위 정수라 소수점을 쓰지 않는다 */
export function formatKrw(price: number): string {
  return `${price.toLocaleString('ko-KR')}원`;
}

/** 월 환산 금액 — 기간이 긴 회원권이 실제로 싼지 한눈에 비교하려고 보여 준다 */
export function monthlyPrice(price: number, months: number): string {
  if (months <= 0) return '—';
  return `${Math.round(price / months).toLocaleString('ko-KR')}원/월`;
}

/** 정가 대비 할인율 — 어드민에서 입력값이 의도대로 보이는지 바로 확인하려고 쓴다 */
export function discountPercent(price: number, listPrice: number): number {
  if (listPrice <= 0) return 0;
  return Math.round((1 - price / listPrice) * 100);
}
