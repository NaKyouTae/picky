/**
 * 회원권 화면의 표시용 값 — 서버 컴포넌트와 클라이언트 컴포넌트가 함께 쓴다.
 *
 * `lib/memberships.ts` 는 서버 전용 API 클라이언트(next/headers)를 끌고 오므로,
 * 클라이언트 번들에 들어가도 되는 것만 여기에 둔다 (타입은 저쪽에서 `import type` 으로 가져온다).
 */
import type { MembershipOrderStatus } from '@/lib/memberships';

export const MEMBERSHIP_ORDER_STATUS_LABELS: Record<MembershipOrderStatus, string> = {
  PENDING: '결제 대기',
  PAID: '결제 완료',
  FAILED: '결제 실패',
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
