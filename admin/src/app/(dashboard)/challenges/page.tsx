import { ChallengesTable } from '@/components/challenges-table';
import { api } from '@/lib/api';
import type { AdminChallengeCategory } from '@/lib/challenges';

// 카테고리를 어드민에서 바로 등록하므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export default async function ChallengesPage() {
  const categories = await api
    .get<AdminChallengeCategory[]>('/admin/challenge-categories', { cache: 'no-store' })
    .catch(() => [] as AdminChallengeCategory[]);

  return (
    <div>
      <h1 className="text-2xl font-bold">챌린지</h1>
      <p className="mt-2 text-sm text-ink-sub">
        앱에서 카테고리를 고르면 공개 상태의 챌린지 중 하나가 랜덤으로 뽑힙니다.
      </p>
      <div className="mt-6">
        <ChallengesTable categories={categories} />
      </div>
    </div>
  );
}
