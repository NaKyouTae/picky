/** 서버(NestJS)의 admin-membership-plans 응답 타입 — 브라우저/서버 컴포넌트 공용 */

export type AdminMembershipPlan = {
  id: string;
  name: string;
  /** 구매 시 늘어나는 이용 기간 (개월) */
  months: number;
  /** 판매 금액 (원) */
  price: number;
  description: string | null;
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
