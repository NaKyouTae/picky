/** 서버(NestJS)의 admin-inquiries 응답 타입 — 브라우저/서버 컴포넌트 공용 */

export type InquiryStatus = 'RECEIVED' | 'IN_PROGRESS' | 'ANSWERED';

export const INQUIRY_STATUSES: InquiryStatus[] = ['RECEIVED', 'IN_PROGRESS', 'ANSWERED'];

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  RECEIVED: '접수',
  IN_PROGRESS: '확인 중',
  ANSWERED: '답변 완료',
};

export const INQUIRY_STATUS_STYLES: Record<InquiryStatus, string> = {
  RECEIVED: 'bg-amber-50 text-amber-700',
  IN_PROGRESS: 'bg-sky-50 text-sky-700',
  ANSWERED: 'bg-emerald-50 text-emerald-700',
};

/** 앱의 칩 6개와 같은 순서 */
export type InquiryType = 'USAGE' | 'PAYMENT' | 'CHALLENGE' | 'COLLAGE' | 'ERROR' | 'ETC';

export const INQUIRY_TYPES: InquiryType[] = [
  'USAGE',
  'PAYMENT',
  'CHALLENGE',
  'COLLAGE',
  'ERROR',
  'ETC',
];

export const INQUIRY_TYPE_LABELS: Record<InquiryType, string> = {
  USAGE: '이용',
  PAYMENT: '결제',
  CHALLENGE: '챌린지',
  COLLAGE: '콜라주',
  ERROR: '오류',
  ETC: '기타',
};

export type AdminInquiry = {
  id: string;
  type: InquiryType;
  /** 사용자가 보낸 글 — 관리자가 고칠 수 없다 */
  content: string;
  /** 답변을 받을 주소 (로그인 계정 이메일과 다를 수 있다) */
  email: string;
  status: InquiryStatus;
  /** 관리자 메모 — 사용자에게 보이지 않는다 */
  adminNote: string | null;
  answeredAt: string | null;
  /** JSON 직렬화를 거치므로 ISO 문자열로 도착한다 */
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string | null };
  /** 첨부 사진 수 — 실물은 상세에서 연다 */
  imageCount: number;
};

/** 첨부 사진 — private 버킷이라 주소가 짧게 만료된다 (모달을 열 때마다 새로 받는다) */
export type AdminInquiryImage = {
  id: string;
  displayOrder: number;
  /** 발급에 실패한 장은 null */
  url: string | null;
};

export type AdminInquiryDetail = AdminInquiry & { images: AdminInquiryImage[] };

export type AdminInquiryPage = {
  items: AdminInquiry[];
  /** null 이면 마지막 페이지 */
  nextCursor: string | null;
};

/** 한 페이지 크기 — 서버 기본값과 맞춘다 */
export const INQUIRY_PAGE_SIZE = 20;
