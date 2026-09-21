/** 서버(NestJS)의 admin-challenges 응답 타입 — 브라우저/서버 컴포넌트 공용 */

export type ChallengeStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export const STATUSES: ChallengeStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

/** 어드민에서 등록·관리하는 챌린지 카테고리 */
export type AdminChallengeCategory = {
  id: string;
  name: string;
  emoji: string | null;
  description: string | null;
  status: ChallengeStatus;
  displayOrder: number;
  /** JSON 직렬화를 거치므로 ISO 문자열로 도착한다 */
  createdAt: string;
  updatedAt: string;
  /** 연결 수 — 0 일 때만 삭제할 수 있다 */
  _count: { challenges: number; groups: number };
};

export const CHALLENGE_STATUS_LABELS: Record<ChallengeStatus, string> = {
  DRAFT: '작성 중',
  PUBLISHED: '공개',
  ARCHIVED: '보관',
};

export const CHALLENGE_STATUS_STYLES: Record<ChallengeStatus, string> = {
  DRAFT: 'bg-amber-50 text-amber-700',
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
  ARCHIVED: 'bg-gray-100 text-ink-sub',
};

export type AdminChallenge = {
  id: string;
  categoryId: string;
  /** 목록에서 이름을 바로 그릴 수 있게 서버가 함께 내려준다 */
  category: { id: string; name: string; emoji: string | null };
  status: ChallengeStatus;
  title: string;
  description: string | null;
  duration: string | null;
  emoji: string | null;
  /** JSON 직렬화를 거치므로 ISO 문자열로 도착한다 */
  createdAt: string;
  updatedAt: string;
};

export type AdminChallengePage = {
  items: AdminChallenge[];
  /** null 이면 마지막 페이지 */
  nextCursor: string | null;
};

/** 한 페이지 크기 — 서버 기본값과 맞춘다 */
export const CHALLENGE_PAGE_SIZE = 20;
