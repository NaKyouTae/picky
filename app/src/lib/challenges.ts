/** 서버(NestJS)의 challenges 응답 타입 + 화면 표기 — 서버/클라이언트 공용 */

export type ChallengeCategory = 'SOLO' | 'COUPLE' | 'KIDS';

export type Challenge = {
  id: string;
  category: ChallengeCategory;
  title: string;
  description: string | null;
  duration: string | null;
  emoji: string | null;
};

export type ChallengeCategorySummary = {
  category: ChallengeCategory;
  /** 공개된 챌린지 수 — 0 이면 "준비 중" 으로 표시한다 */
  count: number;
};

/** 화면에 카테고리를 그리는 순서와 문구 */
export const CATEGORY_META: {
  category: ChallengeCategory;
  label: string;
  emoji: string;
  hint: string;
}[] = [
  { category: 'SOLO', label: '혼자', emoji: '🙂', hint: '나를 위한 시간' },
  { category: 'COUPLE', label: '둘이서', emoji: '💞', hint: '늘 하던 데이트 말고' },
  { category: 'KIDS', label: '아이랑', emoji: '🧸', hint: '아이와 함께' },
];

export const CATEGORY_LABELS: Record<ChallengeCategory, string> = {
  SOLO: '혼자',
  COUPLE: '둘이서',
  KIDS: '아이랑',
};
