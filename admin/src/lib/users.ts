/** 서버(NestJS)의 admin-users 응답 타입 — 브라우저/서버 컴포넌트 공용 */

export type ProviderType = 'KAKAO' | 'NAVER';

/** 테이블에 제공자 컬럼을 그리는 순서 */
export const PROVIDERS: ProviderType[] = ['KAKAO', 'NAVER'];

export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type AdminUser = {
  id: string;
  /** 선택 동의 — 제공자에게 받지 못하면 null */
  email: string | null;
  name: string;
  role: 'USER' | 'ADMIN';
  status: UserStatus;
  /** 아래 3개는 제공자가 동의를 받지 못하면 null 이다 */
  gender: Gender | null;
  /** "20~29" 처럼 제공자마다 표기가 달라 문자열로 보관한다 */
  ageRange: string | null;
  /** Date 컬럼이지만 JSON 에서는 ISO 문자열로 도착한다 */
  birthday: string | null;
  /** JSON 직렬화를 거치므로 ISO 문자열로 도착한다 */
  createdAt: string;
  updatedAt: string;
  providers: ProviderType[];
};

export type AdminUserPage = {
  items: AdminUser[];
  /** null 이면 마지막 페이지 */
  nextCursor: string | null;
};

/** 한 페이지 크기 — 서버 기본값과 맞춘다 */
export const PAGE_SIZE = 20;

export const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: '정상',
  SUSPENDED: '정지',
  DELETED: '탈퇴',
};

export const STATUS_STYLES: Record<UserStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  SUSPENDED: 'bg-amber-50 text-amber-700',
  DELETED: 'bg-gray-100 text-ink-sub',
};

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: '남성',
  FEMALE: '여성',
  OTHER: '기타',
};

/** 값이 없는 셀에 쓰는 표시 */
export const EMPTY = '—';

/**
 * 생일은 Date 컬럼이라 UTC 자정으로 직렬화된다.
 * 로컬 시간대로 변환하면 날짜가 하루 밀릴 수 있으므로 ISO 문자열의 날짜 부분만 쓴다.
 */
export function formatBirthday(iso: string | null): string {
  if (!iso) return EMPTY;
  const [date] = iso.split('T');
  if (!date) return EMPTY;
  return date.replaceAll('-', '.');
}

/** UUID 는 그대로 두면 테이블을 지배하므로 앞 8자만 보이고 전체는 툴팁으로 확인한다 */
export function shortId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
