import { redirect } from 'next/navigation';
import { ChallengeHistoryList } from '@/components/challenge-history-list';
import { PageHeader } from '@/components/page-header';
import { getSession } from '@/lib/auth';
import { getChallengeHistory } from '@/lib/challenge-groups';

export const metadata = { title: '완료한 챌린지 · Picky' };

// 내역은 완료할 때마다 늘어나므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export default async function ChallengeHistoryPage() {
  const session = await getSession();
  if (!session) redirect('/');

  const first = await getChallengeHistory();

  return (
    <div className="pb-page flex flex-1 flex-col">
      <PageHeader title="완료한 챌린지" />
      <ChallengeHistoryList first={first} />
    </div>
  );
}
