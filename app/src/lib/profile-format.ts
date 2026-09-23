// 내 정보의 타입과 표시용 포맷터 — 서버 컴포넌트와 클라이언트 컴포넌트가 함께 쓴다.
// next/headers 를 쓰는 서버 전용 조회는 `lib/profile.ts` 에 있다.

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

/**
 * SNS 프로필에서 받아 보관 중인 항목.
 *
 * 이름·연락처는 제공자에서 필수 동의라 늘 있고(연락처는 해외 번호면 비어 있을 수 있다),
 * 나머지는 '추가' 제공이라 사용자가 거부하면 null 이다.
 */
export type Profile = {
  name: string;
  email: string | null;
  phone: string | null;
  gender: Gender | null;
  /** "20-29" 처럼 제공자마다 표기가 달라 문자열로 보관한다 */
  ageRange: string | null;
  /** Date 컬럼이지만 JSON 에서는 ISO 문자열로 도착한다 */
  birthday: string | null;
};

/** 값이 없을 때 자리에 놓는 문구 — 행을 숨기지 않고 '받지 않았다'는 사실을 보여 준다 */
export const NOT_PROVIDED = '제공받지 않음';

const GENDER_LABEL: Record<Gender, string> = {
  MALE: '남성',
  FEMALE: '여성',
  OTHER: '기타',
};

/** 저장은 숫자만 하므로 보여줄 때만 하이픈을 끼운다 (예: 01012345678 → 010-1234-5678) */
export function formatPhone(phone: string): string {
  if (phone.length < 10) return phone;
  return `${phone.slice(0, 3)}-${phone.slice(3, phone.length - 4)}-${phone.slice(-4)}`;
}

export function formatGender(gender: Gender | null): string {
  return gender ? GENDER_LABEL[gender] : NOT_PROVIDED;
}

/** "1990. 01. 01." — 제공받지 못했으면 안내 문구 */
export function formatBirthday(iso: string | null): string {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return NOT_PROVIDED;

  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  // @db.Date 로 저장할 때 UTC 자정으로 맞췄으므로 읽을 때도 UTC 로 본다
  // (KST 로 읽으면 하루 밀린다).
  return `${date.getUTCFullYear()}. ${month}. ${day}.`;
}
