import { api } from '@/lib/api';
import type { ChallengeCategory, ChallengeGroup, ChallengeHistoryPage } from '@/lib/challenges';

/**
 * 앱 메인에 나열할 카테고리 (어드민에서 등록한 것).
 * 서버 컴포넌트 전용 — 브라우저는 BFF(`/api/challenges/categories`)로 호출한다.
 *
 * **현재 메인은 이것을 쓰지 않는다.** 카테고리가 세 개로 고정이라
 * `FIXED_CATEGORIES`(lib/challenges.ts)를 그대로 그린다.
 * 카테고리를 어드민에서 다시 관리하게 되면 이 함수를 되살리면 된다.
 */
export async function getCategories(): Promise<ChallengeCategory[]> {
  return api
    .get<ChallengeCategory[]>('/challenges/categories', { cache: 'no-store' })
    .catch(() => [] as ChallengeCategory[]);
}

/**
 * 진행 중인 챌린지 그룹 전부 — 카테고리당 최대 하나다.
 * 로그인하지 않았으면 서버가 401 을 주므로 빈 배열로 처리한다.
 */
export async function getActiveGroups(): Promise<ChallengeGroup[]> {
  return api
    .get<ChallengeGroup[]>('/challenge-groups/active', { cache: 'no-store' })
    .catch(() => [] as ChallengeGroup[]);
}

/**
 * 특정 카테고리의 진행 중 그룹 (없으면 null).
 * 진행 중 그룹은 많아야 카테고리 수(몇 개)라서 목록을 받아 골라낸다 — 요청을 늘리지 않는다.
 */
export async function getActiveGroupInCategory(
  categoryId: string | undefined,
): Promise<ChallengeGroup | null> {
  const groups = await getActiveGroups();
  if (!categoryId) return groups[0] ?? null;
  return groups.find((group) => group.category.id === categoryId) ?? null;
}

/**
 * 그룹 하나 (없거나 남의 것이면 null).
 *
 * 상태를 가리지 않으므로 **끝난 그룹도** 온다 — 콜라주에서 뒤로 가
 * 마지막 챌린지 화면을 다시 보여 줄 때 쓴다.
 */
export async function getChallengeGroup(id: string): Promise<ChallengeGroup | null> {
  return api
    .get<ChallengeGroup>(`/challenge-groups/${id}`, { cache: 'no-store' })
    .catch(() => null);
}

/**
 * 완료한 챌린지 내역 첫 페이지 (최신순).
 * 이어지는 페이지는 브라우저가 BFF(`/api/challenge-groups/history?cursor=…`)로 직접 받아 온다.
 */
export async function getChallengeHistory(): Promise<ChallengeHistoryPage> {
  return api
    .get<ChallengeHistoryPage>('/challenge-groups/history', { cache: 'no-store' })
    .catch(() => ({ items: [], nextCursor: null }));
}
