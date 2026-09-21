import { api } from '@/lib/api';
import type { ChallengeCategory, ChallengeGroup } from '@/lib/challenges';

/**
 * 앱 메인에 나열할 카테고리 (어드민에서 등록한 것).
 * 서버 컴포넌트 전용 — 브라우저는 BFF(`/api/challenges/categories`)로 호출한다.
 */
export async function getCategories(): Promise<ChallengeCategory[]> {
  return api
    .get<ChallengeCategory[]>('/challenges/categories', { cache: 'no-store' })
    .catch(() => [] as ChallengeCategory[]);
}

/**
 * 진행 중인 챌린지 그룹 (없으면 null).
 * 로그인하지 않았으면 서버가 401 을 주므로 null 로 처리한다.
 */
export async function getActiveGroup(): Promise<ChallengeGroup | null> {
  return api
    .get<ChallengeGroup | null>('/challenge-groups/active', { cache: 'no-store' })
    .catch(() => null);
}
