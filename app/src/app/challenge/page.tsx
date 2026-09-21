import { redirect } from 'next/navigation';
import { ChallengeGroupScreen } from '@/components/challenge-group-screen';
import { getActiveGroup } from '@/lib/challenge-groups';

// 진행 상태는 매번 확인해야 하므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/**
 * 챌린지 화면 = 진행 중인 챌린지 그룹.
 * 그룹은 메인에서 카테고리를 고를 때 생성되므로, 진행 중인 게 없으면 볼 화면이 없다.
 */
export default async function ChallengePage() {
  const group = await getActiveGroup();
  if (!group) redirect('/');

  return <ChallengeGroupScreen group={group} />;
}
