/**
 * 문의 유형 — 서버 `InquiryType` 과 1:1 이고, 순서가 곧 화면의 칩 순서다 (디자인 4694:5424).
 *
 * 이 파일은 클라이언트 컴포넌트가 함께 쓰므로 `next/headers` 를 들이지 않는다.
 */
export const INQUIRY_TYPES = [
  'USAGE',
  'PAYMENT',
  'CHALLENGE',
  'COLLAGE',
  'ERROR',
  'ETC',
] as const;

export type InquiryType = (typeof INQUIRY_TYPES)[number];

export const INQUIRY_TYPE_LABELS: Record<InquiryType, string> = {
  USAGE: '이용',
  PAYMENT: '결제',
  CHALLENGE: '챌린지',
  COLLAGE: '콜라주',
  ERROR: '오류',
  ETC: '기타',
};

/** 첨부 사진 상한 — 서버(MAX_INQUIRY_IMAGES)와 같은 값이어야 한다 */
export const MAX_INQUIRY_IMAGES = 3;

/** 문의 내용 상한 — 서버 DTO(MAX_INQUIRY_CONTENT)와 같은 값이어야 한다 */
export const MAX_INQUIRY_CONTENT = 2000;
