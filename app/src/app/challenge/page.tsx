import { ChallengePicker } from '@/components/challenge-picker';
import { api } from '@/lib/api';
import { CATEGORY_LABELS, type ChallengeCategory } from '@/lib/challenges';
import type { ChallengeCategorySummary } from '@/lib/challenges';

// 관리자가 챌린지를 등록/공개하면 바로 반영돼야 하므로 캐시하지 않는다.
export const dynamic = 'force-dynamic';

/** 쿼리로 넘어온 값이 실제 카테고리인지 확인한다 (임의 값이면 무시) */
function parseCategory(value?: string): ChallengeCategory | null {
  if (value && value in CATEGORY_LABELS) return value as ChallengeCategory;
  return null;
}

export default async function ChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const [summary, { category }] = await Promise.all([
    api
      .get<ChallengeCategorySummary[]>('/challenges/categories', { cache: 'no-store' })
      .catch(() => [] as ChallengeCategorySummary[]),
    searchParams,
  ]);

  return <ChallengePicker summary={summary} initialCategory={parseCategory(category)} />;
}
