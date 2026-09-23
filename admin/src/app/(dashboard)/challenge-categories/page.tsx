import { ChallengeCategoriesTable } from '@/components/challenge-categories-table';
import { api } from '@/lib/api';
import type { AdminChallengeCategory } from '@/lib/challenges';

// 등록/수정이 바로 반영돼야 하므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export default async function ChallengeCategoriesPage() {
  const categories = await api
    .get<AdminChallengeCategory[]>('/admin/challenge-categories', { cache: 'no-store' })
    .catch(() => [] as AdminChallengeCategory[]);

  return (
    <div>
      <h1 className="text-xl font-bold lg:text-2xl">챌린지 카테고리</h1>
      <p className="mt-2 text-sm text-ink-sub">
        앱 메인 화면에 나열되는 카테고리입니다. 고르면 그 안에서 챌린지 그룹이 시작됩니다.
      </p>
      <div className="mt-6">
        <ChallengeCategoriesTable categories={categories} />
      </div>
    </div>
  );
}
