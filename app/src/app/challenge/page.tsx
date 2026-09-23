import { redirect } from 'next/navigation';
import { ChallengeGroupScreen } from '@/components/challenge-group-screen';
import { getActiveGroupInCategory, getChallengeGroup } from '@/lib/challenge-groups';

// 진행 상태는 매번 확인해야 하므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/**
 * 챌린지 화면 = 진행 중인 챌린지 그룹.
 * 그룹은 메인에서 카테고리를 고를 때 생성되므로, 진행 중인 게 없으면 볼 화면이 없다.
 *
 * 진행 중 그룹은 카테고리마다 하나씩 있을 수 있어서 `?category=` 로 어느 것을 볼지 받는다.
 * 값이 없으면 가장 최근에 시작한 그룹을 보여 준다 (이전 링크·북마크 호환).
 *
 * `?group=` 은 그룹을 **id 로 직접** 지목한다 — 끝난 그룹도 열린다.
 * 콜라주에서 뒤로 갈 때 마지막(5번째) 챌린지 화면을 다시 보여 주기 위한 것으로,
 * 이때는 되돌아보기만 할 수 있는 화면이 된다.
 */
export default async function ChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; group?: string }>;
}) {
  const { category, group: groupId } = await searchParams;
  const group = groupId
    ? await getChallengeGroup(groupId)
    : await getActiveGroupInCategory(category);
  if (!group) redirect('/');

  return <ChallengeGroupScreen group={group} />;
}
